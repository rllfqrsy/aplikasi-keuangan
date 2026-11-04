import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { firebaseConfig, firebaseConfigured } from './firebase-config'

export type TransactionRecord = {
  id: number
  title: string
  category: string
  date: string
  type: 'income' | 'expense' | 'receivable'
  amount: number
  account: string
  ledger?: string
  dueDate?: string
  receivablePaid?: boolean
  receivablePaidAmount?: number
}

export type SyncStatus = 'local' | 'connecting' | 'synced' | 'error'

export type AuthUserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  isAnonymous: boolean
}

const app = firebaseConfigured
  ? getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  : undefined

export const auth = app ? getAuth(app) : undefined
export const database = app ? getFirestore(app) : undefined

function mapFirebaseUser(user: User | null): AuthUserProfile | null {
  if (!user) return null
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Pengguna'),
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  }
}

export function getCurrentAuthUser(): AuthUserProfile | null {
  if (!auth?.currentUser) return null
  return mapFirebaseUser(auth.currentUser)
}

const LOCAL_AUTH_KEY = 'catat-rapi-local-account'
const LOCAL_SESSION_KEY = 'catat-rapi-local-session'

async function hashPassword(password: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function getLocalAuthUser(): AuthUserProfile | null {
  try {
    const session = JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || 'null') as AuthUserProfile | null
    return session
  } catch {
    return null
  }
}

export async function signUpLocal(email: string, pass: string, displayName?: string): Promise<AuthUserProfile> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || pass.length < 6) throw new Error('Data akun tidak valid.')

  const accounts = JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) || '{}') as Record<string, { passwordHash: string; displayName: string }>
  if (accounts[normalizedEmail]) throw new Error('Email ini sudah terdaftar. Silakan masuk.')

  accounts[normalizedEmail] = { passwordHash: await hashPassword(pass), displayName: displayName?.trim() || normalizedEmail.split('@')[0] }
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(accounts))
  const profile: AuthUserProfile = {
    uid: `local-${normalizedEmail}`,
    email: normalizedEmail,
    displayName: accounts[normalizedEmail].displayName,
    photoURL: null,
    isAnonymous: false,
  }
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profile))
  return profile
}

export async function signInLocal(email: string, pass: string): Promise<AuthUserProfile> {
  const normalizedEmail = email.trim().toLowerCase()
  const accounts = JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) || '{}') as Record<string, { passwordHash: string; displayName: string }>
  const account = accounts[normalizedEmail]
  if (!account || account.passwordHash !== await hashPassword(pass)) throw new Error('Email atau kata sandi tidak cocok.')

  const profile: AuthUserProfile = {
    uid: `local-${normalizedEmail}`,
    email: normalizedEmail,
    displayName: account.displayName,
    photoURL: null,
    isAnonymous: false,
  }
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profile))
  return profile
}

export async function logOutLocal() {
  localStorage.removeItem(LOCAL_SESSION_KEY)
}

export function listenToAuthState(callbacks: {
  onUser: (user: AuthUserProfile | null) => void
  onLoading?: (loading: boolean) => void
}) {
  if (!auth) {
    callbacks.onUser(getLocalAuthUser())
    callbacks.onLoading?.(false)
    return () => undefined
  }

  callbacks.onLoading?.(true)
  return onAuthStateChanged(
    auth,
    (user) => {
      callbacks.onUser(mapFirebaseUser(user))
      callbacks.onLoading?.(false)
    },
    () => {
      callbacks.onUser(null)
      callbacks.onLoading?.(false)
    }
  )
}

export async function signInWithEmail(email: string, pass: string): Promise<AuthUserProfile> {
  if (!auth) throw new Error('Firebase belum dikonfigurasi.')
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass)
  const profile = mapFirebaseUser(credential.user)
  if (!profile) throw new Error('Gagal mendapatkan profil pengguna.')
  return profile
}

export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<AuthUserProfile> {
  if (!auth) throw new Error('Firebase belum dikonfigurasi.')
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass)
  if (displayName && credential.user) {
    try {
      await updateProfile(credential.user, { displayName: displayName.trim() })
    } catch {
      // Abaikan jika update profile display name gagal
    }
  }
  const profile = mapFirebaseUser(credential.user)
  if (!profile) throw new Error('Gagal membuat profil pengguna.')
  return profile
}

export async function signInWithGoogle(): Promise<AuthUserProfile> {
  if (!auth) throw new Error('Firebase belum dikonfigurasi.')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const credential = await signInWithPopup(auth, provider)
  const profile = mapFirebaseUser(credential.user)
  if (!profile) throw new Error('Gagal masuk dengan akun Google.')
  return profile
}

export async function signInAsGuest(): Promise<AuthUserProfile> {
  if (!auth) throw new Error('Firebase belum dikonfigurasi.')
  const credential = await signInAnonymously(auth)
  const profile = mapFirebaseUser(credential.user)
  if (!profile) throw new Error('Gagal masuk sebagai tamu.')
  return profile
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase belum dikonfigurasi.')
  await sendPasswordResetEmail(auth, email.trim())
}

export async function logOut(): Promise<void> {
  if (!auth) return
  await signOut(auth)
}

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Terjadi kendala saat memproses permintaan Anda.'
  }

  const code = 'code' in error ? String((error as { code: string }).code) : ''

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email atau kata sandi tidak cocok. Silakan periksa kembali.'
    case 'auth/user-not-found':
      return 'Akun dengan email ini belum terdaftar.'
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan pilih tab Masuk.'
    case 'auth/weak-password':
      return 'Kata sandi terlalu pendek. Gunakan minimal 6 karakter.'
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.'
    case 'auth/popup-closed-by-user':
      return 'Jendela masuk dengan Google ditutup sebelum selesai.'
    case 'auth/popup-blocked':
      return 'Jendela pop-up diblokir peramban. Izinkan pop-up lalu coba lagi.'
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.'
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server. Periksa koneksi internet Anda.'
    case 'auth/operation-not-allowed':
      return 'Metode masuk ini belum diaktifkan di Firebase Console.'
    case 'auth/unauthorized-domain':
      return 'Domain aplikasi ini belum diizinkan di Firebase Console.'
    default:
      if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
        const msg = (error as { message: string }).message
        if (msg.includes('network') || msg.includes('offline')) {
          return 'Koneksi internet bermasalah. Periksa jaringan Anda.'
        }
      }
      return 'Terjadi kesalahan saat otentikasi. Silakan coba lagi.'
  }
}

function sortTransactions(transactions: TransactionRecord[]) {
  return [...transactions].sort((first, second) => second.date.localeCompare(first.date) || second.id - first.id)
}

function getLocalTransactions(): TransactionRecord[] {
  try {
    const stored = localStorage.getItem('catat-rapi-transactions')
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as TransactionRecord[]) : []
  } catch {
    return []
  }
}

export function listenToUserTransactions(
  userId: string,
  callbacks: {
    onTransactions: (transactions: TransactionRecord[]) => void
    onStatus: (status: SyncStatus) => void
  }
) {
  if (!database || !userId) {
    callbacks.onStatus('local')
    return () => undefined
  }

  callbacks.onStatus('connecting')
  let stopped = false
  let unsubscribeTransactions: () => void = () => undefined

  void (async () => {
    try {
      const transactionsRef = collection(database, 'users', userId, 'transactions')
      const remoteSnapshot = await getDocs(transactionsRef)
      if (stopped) return

      const remoteTransactions = remoteSnapshot.docs.map(
        (snapshot) =>
          ({
            ...snapshot.data(),
            id: Number(snapshot.id),
          }) as TransactionRecord
      )
      const remoteIds = new Set(remoteSnapshot.docs.map((snapshot) => snapshot.id))
      const localTransactions = getLocalTransactions()
      const missingTransactions = localTransactions.filter(
        (transaction) => transaction.id > 12 && !remoteIds.has(String(transaction.id))
      )

      if (missingTransactions.length > 0) {
        for (let offset = 0; offset < missingTransactions.length; offset += 450) {
          const batch = writeBatch(database)
          missingTransactions.slice(offset, offset + 450).forEach((transaction) => {
            batch.set(doc(transactionsRef, String(transaction.id)), transaction)
          })
          await batch.commit()
        }
      }

      const mergedTransactions = sortTransactions([...remoteTransactions, ...missingTransactions])
      if (stopped) return

      callbacks.onTransactions(mergedTransactions)
      callbacks.onStatus('synced')

      unsubscribeTransactions = onSnapshot(
        transactionsRef,
        (snapshot) => {
          if (stopped) return
          const currentTransactions = snapshot.docs.map(
            (item) =>
              ({
                ...item.data(),
                id: Number(item.id),
              }) as TransactionRecord
          )
          callbacks.onTransactions(sortTransactions(currentTransactions))
          callbacks.onStatus('synced')
        },
        () => {
          if (!stopped) callbacks.onStatus('error')
        }
      )
    } catch {
      if (!stopped) callbacks.onStatus('error')
    }
  })()

  return () => {
    stopped = true
    unsubscribeTransactions()
  }
}

export async function saveUserTransaction(userId: string, transaction: TransactionRecord) {
  if (!database) throw new Error('Firebase belum dikonfigurasi.')
  await setDoc(doc(database, 'users', userId, 'transactions', String(transaction.id)), transaction)
}

export async function deleteUserTransaction(userId: string, transactionId: number) {
  if (!database) throw new Error('Firebase belum dikonfigurasi.')
  await deleteDoc(doc(database, 'users', userId, 'transactions', String(transactionId)))
}