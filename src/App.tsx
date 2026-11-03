import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react'
import {
  listenToAuthState,
  listenToUserTransactions,
  logOut,
  saveUserTransaction,
  type AuthUserProfile,
  type SyncStatus,
  type TransactionRecord,
} from './firebase'
import { firebaseConfigured } from './firebase-config'
import { AuthModal } from './AuthModal'
import './App.css'

type TransactionType = TransactionRecord['type']
type Transaction = TransactionRecord

const initialTransactions: Transaction[] = [
  { id: 1, title: 'Pembayaran proyek branding', category: 'Proyek', date: '2026-10-18', type: 'income', amount: 8500000, account: 'BCA Operasional' },
  { id: 2, title: 'Sewa ruang kerja', category: 'Operasional', date: '2026-10-16', type: 'expense', amount: 2400000, account: 'BCA Operasional' },
  { id: 3, title: 'Retainer klien — Oktober', category: 'Proyek', date: '2026-10-14', type: 'income', amount: 12500000, account: 'BCA Operasional' },
  { id: 4, title: 'Langganan perangkat lunak', category: 'Tools', date: '2026-10-12', type: 'expense', amount: 685000, account: 'Kartu bisnis' },
  { id: 5, title: 'Transportasi & meeting', category: 'Perjalanan', date: '2026-10-10', type: 'expense', amount: 420000, account: 'Tunai' },
  { id: 6, title: 'Uang muka desain kemasan', category: 'Proyek', date: '2026-10-08', type: 'income', amount: 4750000, account: 'BCA Operasional' },
  { id: 7, title: 'Pembelian perlengkapan kantor', category: 'Operasional', date: '2026-10-05', type: 'expense', amount: 735000, account: 'Kartu bisnis' },
  { id: 8, title: 'Konsultasi strategi', category: 'Proyek', date: '2026-09-24', type: 'income', amount: 6200000, account: 'BCA Operasional' },
  { id: 9, title: 'Tagihan internet', category: 'Operasional', date: '2026-09-19', type: 'expense', amount: 580000, account: 'BCA Operasional' },
  { id: 10, title: 'Workshop tim', category: 'Operasional', date: '2026-08-21', type: 'expense', amount: 1850000, account: 'BCA Operasional' },
  { id: 11, title: 'Pembuatan website', category: 'Proyek', date: '2026-08-12', type: 'income', amount: 9800000, account: 'BCA Operasional' },
  { id: 12, title: 'Pembayaran invoice konsultasi', category: 'Proyek', date: '2026-07-27', type: 'income', amount: 7200000, account: 'BCA Operasional' },
]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(amount) || 0
  )

const formatDate = (date: string) => {
  if (!date) return '-'
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${date}T00:00:00`)
    )
  } catch {
    return date
  }
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fullMonthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

function formatPeriodLabel(periodKey: string): string {
  if (periodKey === 'all') return 'Semua Periode'
  const [yearStr, monthStr] = periodKey.split('-')
  const monthNum = Number(monthStr) - 1
  if (monthNum >= 0 && monthNum < 12) {
    return `${fullMonthNames[monthNum]} ${yearStr}`
  }
  return periodKey
}

const defaultTodayDate = new Date().toISOString().slice(0, 10)
const defaultMonthPrefix = new Date().toISOString().slice(0, 7)
const defaultFormattedToday = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date())

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const savedTransactions = localStorage.getItem('catat-rapi-transactions')
      return savedTransactions ? (JSON.parse(savedTransactions) as Transaction[]) : initialTransactions
    } catch {
      return initialTransactions
    }
  })

  const [activeNav, setActiveNav] = useState('Dashboard')
  const [activeFilter, setActiveFilter] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseConfigured ? 'connecting' : 'local')
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([])

  // Auth State
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)

  // Selected period filter (default: 'all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')

  const topbarUserMenuRef = useRef<HTMLDivElement>(null)
  const periodMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (topbarUserMenuRef.current && !topbarUserMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
        setIsPeriodMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Persist transactions in localStorage
  useEffect(() => {
    localStorage.setItem('catat-rapi-transactions', JSON.stringify(transactions))
  }, [transactions])

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!firebaseConfigured) return

    const unsubscribeAuth = listenToAuthState({
      onUser: (user) => {
        setAuthUser(user)
      },
    })

    return () => {
      unsubscribeAuth()
    }
  }, [])

  // Listen to User Transactions when authUser changes
  useEffect(() => {
    if (!firebaseConfigured || !authUser?.uid) return

    let isMounted = true
    const unsubscribeTransactions = listenToUserTransactions(authUser.uid, {
      onTransactions: (userTransactions) => {
        if (!isMounted) return
        setTransactions(userTransactions)
      },
      onStatus: (status) => {
        if (!isMounted) return
        setSyncStatus(status)
      },
    })

    return () => {
      isMounted = false
      unsubscribeTransactions()
    }
  }, [authUser?.uid])

  // Sync any pending transactions when authenticated
  useEffect(() => {
    if (!authUser?.uid || pendingTransactions.length === 0) return

    let stopped = false
    void Promise.all(pendingTransactions.map((tx) => saveUserTransaction(authUser.uid, tx)))
      .then(() => {
        if (stopped) return
        setPendingTransactions([])
        setSyncStatus('synced')
      })
      .catch(() => {
        if (!stopped) setSyncStatus('error')
      })

    return () => {
      stopped = true
    }
  }, [authUser?.uid, pendingTransactions])

  // Calculate available months dynamically from transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    monthSet.add(defaultMonthPrefix)
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthSet.add(tx.date.slice(0, 7))
      }
    })
    return Array.from(monthSet).sort().reverse()
  }, [transactions])

  // All-time totals (used for total cash balance)
  const allTimeIncome = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [transactions]
  )

  const allTimeExpense = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [transactions]
  )

  // Total dynamic balance
  const totalBalance = allTimeIncome - allTimeExpense

  // Period-specific transactions (for current summary view)
  const periodTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions
    return transactions.filter((tx) => tx.date.startsWith(selectedPeriod))
  }, [transactions, selectedPeriod])

  const periodIncomeTotal = useMemo(
    () =>
      periodTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [periodTransactions]
  )

  const periodExpenseTotal = useMemo(
    () =>
      periodTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [periodTransactions]
  )

  const netCashflow = periodIncomeTotal - periodExpenseTotal

  // Filtered transactions for table search & tab filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesType =
        activeFilter === 'Semua' ||
        (activeFilter === 'Pemasukan' ? transaction.type === 'income' : transaction.type === 'expense')
      const matchesSearch = `${transaction.title} ${transaction.category} ${transaction.account}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesPeriod =
        selectedPeriod === 'all' || activeNav !== 'Dashboard' || transaction.date.startsWith(selectedPeriod)
      return matchesType && matchesSearch && matchesPeriod
    })
  }, [transactions, activeFilter, searchQuery, selectedPeriod, activeNav])

  const reportIncomeTotal = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((total, tx) => total + (Number(tx.amount) || 0), 0),
    [filteredTransactions]
  )

  const reportExpenseTotal = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((total, tx) => total + (Number(tx.amount) || 0), 0),
    [filteredTransactions]
  )

  // Dynamic 6-month chart
  const chartMonths = useMemo(() => {
    const [yearStr, monthStr] = defaultTodayDate.split('-')
    const currentYear = Number(yearStr)
    const currentMonth = Number(monthStr) - 1
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(currentYear, currentMonth - (5 - index), 1)
      const year = d.getFullYear()
      const monthNumber = String(d.getMonth() + 1).padStart(2, '0')
      const prefix = `${year}-${monthNumber}`
      const mTransactions = transactions.filter((tx) => tx.date.startsWith(prefix))
      const income = mTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((total, tx) => total + (Number(tx.amount) || 0), 0)
      const expense = mTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((total, tx) => total + (Number(tx.amount) || 0), 0)
      return {
        label: monthNames[d.getMonth()],
        income,
        expense,
        prefix,
      }
    })
  }, [transactions])

  const chartMaximum = Math.max(
    ...chartMonths.map((month) => Math.max(month.income, month.expense)),
    1
  )

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthModalMode(mode)
    setIsAuthModalOpen(true)
    setIsUserMenuOpen(false)
  }

  const handleLogout = async () => {
    setIsUserMenuOpen(false)
    await logOut()
    setAuthUser(null)
  }

  // Handle adding a new transaction with robust number parsing
  const addTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const rawAmount = String(formData.get('amount') || '').trim()
    const cleanAmount = Number(rawAmount.replace(/[^0-9]/g, '')) || Number(rawAmount) || 0

    if (cleanAmount <= 0) {
      alert('Jumlah transaksi harus berupa angka positif lebih dari 0.')
      return
    }

    const inputDate = String(formData.get('date') || defaultTodayDate)

    const newTransaction: Transaction = {
      id: Date.now(),
      title: String(formData.get('title')).trim(),
      category: String(formData.get('category')),
      date: inputDate,
      type: transactionType,
      amount: cleanAmount,
      account: String(formData.get('account')),
    }

    // Immediately update local state
    setTransactions((current) => [newTransaction, ...current])

    // If the new transaction's month is not in the currently selected period, switch to 'all'
    if (selectedPeriod !== 'all' && !inputDate.startsWith(selectedPeriod)) {
      setSelectedPeriod('all')
    }

    // Save to Firestore if authenticated
    if (authUser?.uid) {
      try {
        await saveUserTransaction(authUser.uid, newTransaction)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    } else if (firebaseConfigured) {
      setPendingTransactions((current) => [...current, newTransaction])
    }

    setIsModalOpen(false)
    setActiveNav('Transaksi')
  }

  const exportTransactions = () => {
    const rows = [
      ['Tanggal', 'Nama', 'Kategori', 'Jenis', 'Jumlah', 'Akun'],
      ...filteredTransactions.map((tx) => [
        tx.date,
        tx.title,
        tx.category,
        tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        String(tx.amount),
        tx.account,
      ]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n')}`
    const fileUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = 'transaksi-catat-rapi.csv'
    link.click()
    URL.revokeObjectURL(fileUrl)
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Transaksi', icon: CreditCard },
    { label: 'Laporan', icon: ChartNoAxesCombined },
  ]

  const userName = authUser?.displayName || (authUser?.isAnonymous ? 'Pengguna Tamu' : 'Pemilik Usaha')
  const userInitial = (userName.charAt(0) || 'U').toUpperCase()

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => setActiveNav('Dashboard')}>
          <span className="brand-mark">
            <Wallet size={19} strokeWidth={2.3} />
          </span>
          <span>
            catat<span className="brand-light">rapi</span>
            <small>KEUANGAN USAHA</small>
          </span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">{userInitial}</span>
          <span className="workspace-copy">
            <strong>{authUser?.displayName || 'Karsa Studio'}</strong>
            <small>{authUser ? 'Akun Bisnis Aktif' : 'Workspace Bisnis'}</small>
          </span>
          <ChevronDown size={15} />
        </div>

        <p className="nav-caption">MENU UTAMA</p>
        <nav className="main-nav" aria-label="Navigasi utama">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? 'is-active' : ''}`}
              onClick={() => setActiveNav(label)}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {label === 'Transaksi' && <span className="nav-count">{transactions.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-note">
            <span className="help-icon">
              <CircleHelp size={17} />
            </span>
            <strong>Perlu bantuan?</strong>
            <p>Catatan keuangan jadi lebih rapi dan terkontrol.</p>
            <button onClick={() => setActiveNav('Laporan')}>
              Lihat ringkasan <span aria-hidden="true">→</span>
            </button>
          </div>

          <button
            className={`nav-item settings-link ${activeNav === 'Pengaturan' ? 'is-active' : ''}`}
            onClick={() => setActiveNav('Pengaturan')}
          >
            <Settings2 size={18} />
            <span>Pengaturan</span>
          </button>

          {/* User profile row in sidebar */}
          {authUser ? (
            <div style={{ position: 'relative' }}>
              <button
                className="profile-row"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="Menu akun pengguna"
                type="button"
              >
                <span className="profile-avatar">
                  {authUser.photoURL ? (
                    <img src={authUser.photoURL} alt={userName} className="avatar-img" />
                  ) : (
                    userInitial
                  )}
                </span>
                <span className="profile-copy">
                  <strong>{userName}</strong>
                  <small>{authUser.email || (authUser.isAnonymous ? 'Akun Tamu' : 'Tersambung')}</small>
                </span>
                <span className="profile-dots">···</span>
              </button>

              {isUserMenuOpen && (
                <div className="user-menu-popover sidebar-user-popover">
                  <div className="user-menu-header">
                    <span className="user-menu-name">{userName}</span>
                    <span className="user-menu-email">{authUser.email || 'Mode Tamu / Offline'}</span>
                    <span className={`user-menu-badge ${authUser.isAnonymous ? 'guest' : ''}`}>
                      <i className="badge-dot" />
                      {authUser.isAnonymous ? 'Tamu Firebase' : 'Akun Terhubung'}
                    </span>
                  </div>
                  <button
                    className="user-menu-btn"
                    onClick={() => {
                      setActiveNav('Pengaturan')
                      setIsUserMenuOpen(false)
                    }}
                  >
                    <Settings2 size={14} />
                    <span>Pengaturan Akun</span>
                  </button>
                  <button className="user-menu-btn logout-btn" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="sidebar-auth-cta"
              onClick={() => openAuthModal('login')}
              type="button"
            >
              <LogIn size={15} />
              <span>Masuk / Daftar Akun</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{activeNav}</strong>
          </div>

          <div className="topbar-actions">
            {/* Period selector dropdown */}
            <div style={{ position: 'relative' }} ref={periodMenuRef}>
              <button
                type="button"
                className="select-button"
                onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
                style={{ fontSize: '11px', fontWeight: 600 }}
              >
                <CalendarDays size={14} style={{ color: '#276846' }} />
                <span>{formatPeriodLabel(selectedPeriod)}</span>
                <ChevronDown size={14} />
              </button>

              {isPeriodMenuOpen && (
                <div
                  className="user-menu-popover"
                  style={{ width: '200px', left: 0, right: 'auto' }}
                >
                  <div className="user-menu-header" style={{ padding: '6px 8px' }}>
                    <span style={{ fontSize: '10px', color: '#828e85', fontWeight: 700 }}>
                      PILIH PERIODE
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`user-menu-btn ${selectedPeriod === 'all' ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedPeriod('all')
                      setIsPeriodMenuOpen(false)
                    }}
                    style={{ fontWeight: selectedPeriod === 'all' ? 700 : 500 }}
                  >
                    Semua Periode ({transactions.length})
                  </button>
                  {availableMonths.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="user-menu-btn"
                      onClick={() => {
                        setSelectedPeriod(m)
                        setIsPeriodMenuOpen(false)
                      }}
                      style={{ fontWeight: selectedPeriod === m ? 700 : 500 }}
                    >
                      {formatPeriodLabel(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Topbar User Action */}
            {authUser ? (
              <div className="topbar-profile-wrap" ref={topbarUserMenuRef}>
                <button
                  className="avatar-mini"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-label="Profil Akun"
                  type="button"
                >
                  {authUser.photoURL ? (
                    <img src={authUser.photoURL} alt={userName} className="avatar-img" />
                  ) : (
                    userInitial
                  )}
                </button>

                {isUserMenuOpen && (
                  <div className="user-menu-popover">
                    <div className="user-menu-header">
                      <span className="user-menu-name">{userName}</span>
                      <span className="user-menu-email">{authUser.email || 'Mode Tamu / Offline'}</span>
                      <span className={`user-menu-badge ${authUser.isAnonymous ? 'guest' : ''}`}>
                        <i className="badge-dot" />
                        {authUser.isAnonymous ? 'Mode Tamu' : 'Tersinkron ke Cloud'}
                      </span>
                    </div>
                    <button
                      className="user-menu-btn"
                      onClick={() => {
                        setActiveNav('Pengaturan')
                        setIsUserMenuOpen(false)
                      }}
                    >
                      <Settings2 size={14} />
                      <span>Pengaturan Akun</span>
                    </button>
                    <button className="user-menu-btn logout-btn" onClick={handleLogout}>
                      <LogOut size={14} />
                      <span>Keluar Akun</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="topbar-login-btn"
                onClick={() => openAuthModal('login')}
                type="button"
              >
                <LogIn size={14} />
                <span>Masuk</span>
              </button>
            )}
          </div>
        </header>

        <div className="page-content">
          {/* Guest notification banner if not logged in */}
          {!authUser && activeNav === 'Dashboard' && (
            <section className="guest-banner" aria-label="Pemberitahuan Akun">
              <div className="guest-banner-content">
                <Sparkles size={20} className="guest-banner-icon" />
                <div>
                  <strong>Simpan catatan keuangan Anda secara aman di Cloud Firestore</strong>
                  <p>
                    Saat ini data disimpan di peramban lokal. Masuk atau daftar akun agar transaksi tersinkronisasi otomatis antar perangkat.
                  </p>
                </div>
              </div>
              <div className="guest-banner-actions">
                <button
                  type="button"
                  className="banner-login-btn"
                  onClick={() => openAuthModal('login')}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  className="banner-register-btn"
                  onClick={() => openAuthModal('register')}
                >
                  Daftar Akun Baru
                </button>
              </div>
            </section>
          )}

          {/* Heading */}
          <section className="page-heading">
            <div>
              <p className="eyebrow">{defaultFormattedToday.toUpperCase()}</p>
              <h1>
                {activeNav === 'Dashboard'
                  ? `Selamat datang, ${userName}`
                  : activeNav}
              </h1>
              <p className="page-subtitle">
                {activeNav === 'Dashboard'
                  ? `Ringkasan performa keuangan — Periode: ${formatPeriodLabel(selectedPeriod)}.`
                  : activeNav === 'Transaksi'
                  ? 'Semua pemasukan dan pengeluaran usahamu yang tercatat.'
                  : activeNav === 'Laporan'
                  ? 'Pantau arus kas dan performa keuangan usahamu.'
                  : 'Atur preferensi akun dan workspace usahamu.'}
              </p>
            </div>
            <button className="primary-button" onClick={() => setIsModalOpen(true)}>
              <Plus size={17} strokeWidth={2.4} /> Catat transaksi
            </button>
          </section>

          {/* Summary Cards */}
          <section className="summary-grid" aria-label="Ringkasan keuangan">
            <article className="summary-card balance-card">
              <div className="summary-top">
                <span className="summary-label">Total saldo keseluruhan</span>
                <span className="summary-icon balance-icon">
                  <Wallet size={18} />
                </span>
              </div>
              <strong className="summary-amount">{formatCurrency(totalBalance)}</strong>
              <div className="summary-foot">
                <span className="positive-change">
                  <ArrowUpRight size={14} /> Total Akumulasi
                </span>
                <span>dari {transactions.length} transaksi</span>
              </div>
              <div className="balance-decoration" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span className="summary-label">
                  Pemasukan {selectedPeriod === 'all' ? '(Semua)' : 'Bulan Ini'}
                </span>
                <span className="summary-icon income-icon">
                  <ArrowDownLeft size={18} />
                </span>
              </div>
              <strong className="summary-amount">{formatCurrency(periodIncomeTotal)}</strong>
              <div className="summary-foot">
                <span className="positive-change">
                  <ArrowUpRight size={14} />
                  {periodTransactions.filter((t) => t.type === 'income').length} transaksi
                </span>
                <span>pemasukan tercatat</span>
              </div>
              <div className="mini-bars income-bars" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span className="summary-label">
                  Pengeluaran {selectedPeriod === 'all' ? '(Semua)' : 'Bulan Ini'}
                </span>
                <span className="summary-icon expense-icon">
                  <ArrowUpRight size={18} />
                </span>
              </div>
              <strong className="summary-amount">{formatCurrency(periodExpenseTotal)}</strong>
              <div className="summary-foot">
                <span className="negative-change">
                  <ArrowDownRight size={14} />
                  {periodTransactions.filter((t) => t.type === 'expense').length} transaksi
                </span>
                <span>pengeluaran tercatat</span>
              </div>
              <div className="mini-bars expense-bars" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span className="summary-label">Arus kas bersih</span>
                <span className="summary-icon net-icon">
                  <ChartNoAxesCombined size={18} />
                </span>
              </div>
              <strong className="summary-amount">{formatCurrency(netCashflow)}</strong>
              <div className="summary-foot">
                <span className={netCashflow >= 0 ? 'positive-change' : 'negative-change'}>
                  {netCashflow >= 0 ? 'Surplus' : 'Defisit'}
                </span>
                <span>{periodTransactions.length} transaksi di periode ini</span>
              </div>
              <div className="net-line" aria-hidden="true">
                <svg viewBox="0 0 160 42" preserveAspectRatio="none">
                  <path d="M1 34 C17 29, 19 35, 32 24 S52 27, 63 20 S80 28, 92 14 S108 22, 118 11 S138 16, 159 3" />
                </svg>
              </div>
            </article>
          </section>

          {/* Cashflow Chart */}
          {(activeNav === 'Dashboard' || activeNav === 'Laporan') && (
            <section className="chart-section">
              <div className="section-heading">
                <div>
                  <h2>Arus kas bulanan</h2>
                  <p>Tren pemasukan dan pengeluaran 6 bulan terakhir</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="select-button"
                    onClick={() => setSelectedPeriod('all')}
                  >
                    Tampilkan Semua
                  </button>
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-income" /> Pemasukan
                </span>
                <span>
                  <i className="legend-expense" /> Pengeluaran
                </span>
                <span className="chart-unit">Dalam rupiah</span>
              </div>
              <div
                className="cashflow-chart"
                role="img"
                aria-label="Grafik batang pemasukan dan pengeluaran selama enam bulan terakhir"
              >
                <div className="chart-y-labels">
                  <span>{formatCurrency(chartMaximum)}</span>
                  <span>{formatCurrency(chartMaximum * 0.66)}</span>
                  <span>{formatCurrency(chartMaximum * 0.33)}</span>
                  <span>Rp 0</span>
                </div>
                <div className="chart-plot">
                  <div className="chart-gridlines">
                    <i /><i /><i /><i />
                  </div>
                  <div className="chart-columns">
                    {chartMonths.map((month) => (
                      <div
                        className="chart-month"
                        key={month.prefix}
                        onClick={() => setSelectedPeriod(month.prefix)}
                        style={{ cursor: 'pointer' }}
                        title={`Klik untuk memfilter transaksi ${month.label}`}
                      >
                        <div className="bar-pair">
                          <span
                            className="bar income-bar"
                            style={{
                              height: `${Math.max(
                                (month.income / chartMaximum) * 100,
                                month.income ? 6 : 0
                              )}%`,
                            }}
                            title={`Pemasukan ${month.label}: ${formatCurrency(month.income)}`}
                          />
                          <span
                            className="bar expense-bar"
                            style={{
                              height: `${Math.max(
                                (month.expense / chartMaximum) * 100,
                                month.expense ? 6 : 0
                              )}%`,
                            }}
                            title={`Pengeluaran ${month.label}: ${formatCurrency(month.expense)}`}
                          />
                        </div>
                        <span className="month-label">{month.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Transactions Table Section */}
          {(activeNav === 'Dashboard' || activeNav === 'Transaksi' || activeNav === 'Laporan') && (
            <section className="transactions-section">
              <div
                className={`section-heading transaction-heading ${
                  activeNav === 'Laporan' ? 'report-heading' : ''
                }`}
              >
                <div>
                  <h2>
                    {activeNav === 'Dashboard'
                      ? 'Transaksi terbaru'
                      : activeNav === 'Laporan'
                      ? 'Rincian laporan keuangan'
                      : 'Semua transaksi'}
                  </h2>
                  <p>
                    {activeNav === 'Dashboard'
                      ? `Menampilkan aktivitas keuangan (${formatPeriodLabel(selectedPeriod)})`
                      : activeNav === 'Laporan'
                      ? `${filteredTransactions.length} transaksi dalam laporan`
                      : `${transactions.length} total transaksi tersimpan`}
                  </p>
                </div>

                {activeNav === 'Dashboard' && (
                  <button className="text-button" onClick={() => setActiveNav('Transaksi')}>
                    Lihat semua <span aria-hidden="true">→</span>
                  </button>
                )}

                {activeNav === 'Laporan' && (
                  <div className="report-actions">
                    <button className="report-action" onClick={exportTransactions}>
                      <Download size={15} /> Ekspor CSV
                    </button>
                    <button
                      className="report-action report-print-action"
                      onClick={() => window.print()}
                    >
                      <Printer size={15} /> Cetak / PDF
                    </button>
                  </div>
                )}
              </div>

              <div className="table-toolbar">
                <div className="filter-tabs" role="tablist" aria-label="Filter transaksi">
                  {['Semua', 'Pemasukan', 'Pengeluaran'].map((filter) => (
                    <button
                      key={filter}
                      className={activeFilter === filter ? 'filter-active' : ''}
                      onClick={() => setActiveFilter(filter)}
                    >
                      {filter}
                      {filter === 'Semua' && <span>{transactions.length}</span>}
                    </button>
                  ))}
                </div>

                <div className={`table-actions ${activeNav === 'Laporan' ? 'report-filter-actions' : ''}`}>
                  <label className="search-box">
                    <Search size={16} />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari transaksi"
                      aria-label="Cari transaksi"
                    />
                  </label>
                  <button
                    className="icon-button export-button"
                    onClick={exportTransactions}
                    title="Unduh CSV"
                    aria-label="Unduh transaksi sebagai CSV"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="icon-button print-button"
                    onClick={() => window.print()}
                    title="Cetak atau simpan sebagai PDF"
                    aria-label="Cetak atau simpan transaksi sebagai PDF"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>TRANSAKSI</th>
                      <th>KATEGORI</th>
                      <th>TANGGAL</th>
                      <th>AKUN</th>
                      <th className="amount-heading">JUMLAH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions
                      .slice(0, activeNav === 'Dashboard' ? 6 : undefined)
                      .map((transaction) => (
                        <tr key={transaction.id}>
                          <td>
                            <div className="transaction-name">
                              <span className={`transaction-symbol ${transaction.type}`}>
                                {transaction.type === 'income' ? (
                                  <ArrowDownLeft size={16} />
                                ) : (
                                  <ArrowUpRight size={16} />
                                )}
                              </span>
                              <span>
                                <strong>{transaction.title}</strong>
                                <small>{transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="category-label">{transaction.category}</span>
                          </td>
                          <td className="date-cell">{formatDate(transaction.date)}</td>
                          <td className="account-cell">{transaction.account}</td>
                          <td className={`amount-cell ${transaction.type}`}>
                            {transaction.type === 'income' ? '+' : '−'}{' '}
                            {formatCurrency(transaction.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {filteredTransactions.length === 0 && (
                  <div className="empty-state">
                    <FileText size={23} />
                    <strong>Belum ada transaksi</strong>
                    <span>Coba ubah filter periode atau catat transaksi baru.</span>
                  </div>
                )}
              </div>

              <div className="table-footer">
                <span>
                  Menampilkan{' '}
                  <strong>
                    {Math.min(
                      filteredTransactions.length,
                      activeNav === 'Dashboard' ? 6 : filteredTransactions.length
                    )}
                  </strong>{' '}
                  dari <strong>{filteredTransactions.length}</strong> transaksi
                </span>
                {activeNav !== 'Laporan' && (
                  <button onClick={exportTransactions}>
                    Unduh CSV <Download size={14} />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Settings Section with User Account Info */}
          {activeNav === 'Pengaturan' && (
            <div className="settings-container">
              <section className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-header-info">
                    <div className="settings-icon">
                      <UserIcon size={22} />
                    </div>
                    <div>
                      <h2>Profil & Autentikasi Pengguna</h2>
                      <p>Kelola sesi akun dan status sinkronisasi cloud Anda.</p>
                    </div>
                  </div>
                  <span className={`settings-badge ${!authUser || authUser.isAnonymous ? 'guest' : ''}`}>
                    <CheckCircle2 size={13} />
                    {authUser
                      ? authUser.isAnonymous
                        ? 'Akun Tamu Firebase'
                        : 'Akun Cloud Aktif'
                      : 'Mode Lokal (Offline)'}
                  </span>
                </div>

                <div className="settings-details">
                  <div className="settings-field-box">
                    <span>Nama Pengguna</span>
                    <strong>{userName}</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Alamat Email</span>
                    <strong>{authUser?.email || 'Belum terhubung ke email'}</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>ID Pengguna (UID)</span>
                    <strong>{authUser?.uid ? `${authUser.uid.slice(0, 14)}...` : 'Lokal / Browser'}</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Status Penyimpanan</span>
                    <strong>
                      {syncStatus === 'synced'
                        ? 'Tersinkron di Firestore'
                        : syncStatus === 'connecting'
                        ? 'Menghubungkan...'
                        : syncStatus === 'error'
                        ? 'Gagal sinkron (Lokal)'
                        : 'Penyimpanan Lokal'}
                    </strong>
                  </div>
                </div>

                <div className="settings-actions">
                  {authUser ? (
                    <>
                      <button
                        type="button"
                        className="settings-btn-outline"
                        onClick={() => openAuthModal('login')}
                      >
                        Ganti Akun
                      </button>
                      <button
                        type="button"
                        className="settings-btn-danger"
                        onClick={handleLogout}
                      >
                        <LogOut size={14} /> Keluar Akun
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="settings-btn-primary"
                      onClick={() => openAuthModal('login')}
                    >
                      <LogIn size={15} /> Masuk atau Hubungkan Akun
                    </button>
                  )}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-header-info">
                    <div className="settings-icon">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h2>Pengaturan Usaha & Workspace</h2>
                      <p>Informasi dasar workspace pembukuan keuangan.</p>
                    </div>
                  </div>
                </div>
                <div className="settings-details">
                  <div className="settings-field-box">
                    <span>Nama Workspace</span>
                    <strong>Karsa Studio</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Mata Uang</span>
                    <strong>IDR — Rupiah Indonesia (Rp)</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Total Transaksi</span>
                    <strong>{transactions.length} Transaksi Tercatat</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Firebase Status</span>
                    <strong>{firebaseConfigured ? 'Terkonfigurasi' : 'Belum Terkonfigurasi'}</strong>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Footer */}
          <footer className="page-footer">
            <span>© 2026 CatatRapi — Pembukuan Keuangan Usaha</span>
            <span>
              <span className={`status-dot ${syncStatus}`} />
              {syncStatus === 'synced'
                ? 'Data tersinkron ke Firestore'
                : syncStatus === 'connecting'
                ? 'Menghubungkan ke Firestore...'
                : syncStatus === 'error'
                ? 'Sinkronisasi gagal · data tersimpan lokal'
                : 'Mode lokal · Belum login ke Cloud'}
            </span>
          </footer>
        </div>
      </main>

      {/* Printable Report View */}
      <section className="print-report" aria-label="Laporan transaksi untuk dicetak">
        <header className="print-report-header">
          <span className="print-brand">
            catat<span>rapi</span>
          </span>
          <div>
            <h1>Laporan Transaksi</h1>
            <p>
              {formatPeriodLabel(selectedPeriod)} · {activeFilter}
              {searchQuery && ` · Pencarian: ${searchQuery}`}
            </p>
          </div>
          <small>Dicetak {defaultFormattedToday}</small>
        </header>
        <div className="print-summary">
          <div>
            <span>Total pemasukan</span>
            <strong>{formatCurrency(reportIncomeTotal)}</strong>
          </div>
          <div>
            <span>Total pengeluaran</span>
            <strong>{formatCurrency(reportExpenseTotal)}</strong>
          </div>
          <div>
            <span>Arus kas bersih</span>
            <strong>{formatCurrency(reportIncomeTotal - reportExpenseTotal)}</strong>
          </div>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Transaksi</th>
              <th>Kategori</th>
              <th>Akun</th>
              <th>Jenis</th>
              <th>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td>{formatDate(tx.date)}</td>
                <td>{tx.title}</td>
                <td>{tx.category}</td>
                <td>{tx.account}</td>
                <td>{tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</td>
                <td className="print-amount">
                  {tx.type === 'income' ? '+' : '−'} {formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="print-report-footer">
          CatatRapi · {filteredTransactions.length} transaksi
        </footer>
      </section>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsModalOpen(false)
          }}
        >
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">PEMBUKUAN</p>
                <h2 id="modal-title">Catat transaksi</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={addTransaction}>
              <div className="type-switch" role="group" aria-label="Jenis transaksi">
                <button
                  type="button"
                  className={transactionType === 'expense' ? 'selected-expense' : ''}
                  onClick={() => setTransactionType('expense')}
                >
                  <ArrowUpRight size={16} /> Pengeluaran
                </button>
                <button
                  type="button"
                  className={transactionType === 'income' ? 'selected-income' : ''}
                  onClick={() => setTransactionType('income')}
                >
                  <ArrowDownLeft size={16} /> Pemasukan
                </button>
              </div>

              <label className="form-field">
                Nama transaksi
                <input
                  name="title"
                  placeholder="Contoh: Pembayaran klien / Beli perlengkapan"
                  required
                  autoFocus
                />
              </label>

              <div className="form-row">
                <label className="form-field">
                  Jumlah (Rp)
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    required
                  />
                </label>
                <label className="form-field">
                  Tanggal
                  <input
                    name="date"
                    type="date"
                    defaultValue={defaultTodayDate}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-field">
                  Kategori
                  <select name="category" defaultValue="Operasional">
                    <option>Operasional</option>
                    <option>Proyek</option>
                    <option>Tools</option>
                    <option>Perjalanan</option>
                    <option>Gaji</option>
                    <option>Lainnya</option>
                  </select>
                </label>
                <label className="form-field">
                  Akun
                  <select name="account" defaultValue="BCA Operasional">
                    <option>BCA Operasional</option>
                    <option>Kartu bisnis</option>
                    <option>Tunai</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="primary-button">
                  <Plus size={16} /> Simpan transaksi
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={(profile) => {
          setAuthUser(profile)
        }}
      />
    </div>
  )
}

export default App
