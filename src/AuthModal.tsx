import React, { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  User,
  Wallet,
  X,
} from 'lucide-react'
import {
  getFirebaseAuthErrorMessage,
  resetPassword,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AuthUserProfile,
} from './firebase'
import './AuthModal.css'

type AuthMode = 'login' | 'register' | 'forgot'

type AuthModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (user: AuthUserProfile) => void
  initialMode?: 'login' | 'register'
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const resetForm = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const switchMode = (newMode: AuthMode) => {
    resetForm()
    setMode(newMode)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Silakan masukkan alamat email Anda.')
          setLoading(false)
          return
        }
        await resetPassword(email)
        setSuccessMessage('Tautan pemulihan kata sandi telah dikirim ke email Anda.')
        setLoading(false)
        return
      }

      if (mode === 'register') {
        if (password.length < 6) {
          setError('Kata sandi harus terdiri dari minimal 6 karakter.')
          setLoading(false)
          return
        }
        const profile = await signUpWithEmail(email, password, name)
        onSuccess?.(profile)
        onClose()
      } else {
        const profile = await signInWithEmail(email, password)
        onSuccess?.(profile)
        onClose()
      }
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setSuccessMessage(null)
    setGoogleLoading(true)
    try {
      const profile = await signInWithGoogle()
      onSuccess?.(profile)
      onClose()
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGuestSignIn = async () => {
    setError(null)
    setSuccessMessage(null)
    setGuestLoading(true)
    try {
      const profile = await signInAsGuest()
      onSuccess?.(profile)
      onClose()
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err))
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div
      className="auth-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="auth-modal-card">
        <button
          className="auth-close-btn"
          onClick={onClose}
          aria-label="Tutup jendela login"
          type="button"
          disabled={loading || googleLoading || guestLoading}
        >
          <X size={18} />
        </button>

        <div className="auth-header">
          <div className="auth-brand-badge">
            <span className="auth-brand-icon">
              <Wallet size={18} strokeWidth={2.4} />
            </span>
            <span className="auth-brand-text">
              catat<strong>rapi</strong>
            </span>
          </div>
          <h2 id="auth-modal-title">
            {mode === 'login' && 'Masuk ke Akun Anda'}
            {mode === 'register' && 'Buat Akun CatatRapi'}
            {mode === 'forgot' && 'Atur Ulang Kata Sandi'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login' && 'Kelola dan pantau keuangan bisnis Anda secara rapi dan tersinkron.'}
            {mode === 'register' && 'Daftar sekarang untuk mengamankan data pembukuan di cloud.'}
            {mode === 'forgot' && 'Masukkan email yang terdaftar untuk menerima tautan atur ulang.'}
          </p>
        </div>

        {mode !== 'forgot' && (
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'is-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Masuk
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'register' ? 'is-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Daftar Akun
            </button>
          </div>
        )}

        {error && (
          <div className="auth-alert error-alert" role="alert">
            <AlertCircle size={16} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-alert success-alert" role="status">
            <CheckCircle2 size={16} className="alert-icon" />
            <span>{successMessage}</span>
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="auth-social-area">
            <button
              type="button"
              className="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading || guestLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.25 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{googleLoading ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}</span>
            </button>

            <div className="auth-divider">
              <span>atau menggunakan email</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <label className="auth-field">
              <span className="field-label">Nama Lengkap / Nama Bisnis</span>
              <div className="input-group">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="Misal: Studio Kreatif Rallef"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span className="field-label">Alamat Email</span>
            <div className="input-group">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="nama@bisnis.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </label>

          {mode !== 'forgot' && (
            <label className="auth-field">
              <div className="field-label-row">
                <span className="field-label">Kata Sandi</span>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => switchMode('forgot')}
                  >
                    Lupa sandi?
                  </button>
                )}
              </div>
              <div className="input-group">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Minimal 6 karakter' : 'Masukkan kata sandi'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || googleLoading || guestLoading}
          >
            {loading ? (
              <span className="btn-spinner" />
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Masuk Sekarang'}
                  {mode === 'register' && 'Daftar Akun'}
                  {mode === 'forgot' && 'Kirim Tautan Reset'}
                </span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'forgot' ? (
            <button
              type="button"
              className="text-link-btn"
              onClick={() => switchMode('login')}
            >
              ← Kembali ke halaman Masuk
            </button>
          ) : (
            <div className="guest-row">
              <button
                type="button"
                className="guest-btn"
                onClick={handleGuestSignIn}
                disabled={loading || googleLoading || guestLoading}
              >
                <Globe size={14} />
                <span>{guestLoading ? 'Memuat...' : 'Coba Mode Tamu / Offline'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
