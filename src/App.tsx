import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react'
import {
  type SyncStatus,
  type TransactionRecord,
} from './firebase'
import {
  formatAmountInput,
  formatCurrency,
  formatDate,
  formatPeriodLabel,
  MONTH_NAMES,
  normalizeLedger,
  parseAmount,
  remainingReceivable,
  sumTransactions,
} from './financeUtils'
import './App.css'

type TransactionType = TransactionRecord['type']
type Transaction = TransactionRecord

const initialTransactions: Transaction[] = []

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
      if (!savedTransactions) return initialTransactions
      const saved = JSON.parse(savedTransactions) as Transaction[]
      const containsOnlyDemoData = saved.length === 12 && saved.every((transaction) => Number(transaction.id) >= 1 && Number(transaction.id) <= 12)
      return containsOnlyDemoData ? [] : saved
    } catch {
      return initialTransactions
    }
  })

  const [activeNav, setActiveNav] = useState('Buku Keuangan')
  const [activeFilter, setActiveFilter] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [receivableMode, setReceivableMode] = useState<'credit' | 'payment'>('credit')
  const [activeLedger, setActiveLedger] = useState('Semua Buku')
  const [ledgers, setLedgers] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('catat-rapi-ledgers') || '[]') as string[]
      return Array.from(new Set(saved.filter((ledger) => ledger.trim() && ledger.trim() !== 'Umum')))
    } catch {
      return []
    }
  })
  const [hasCompletedLedgerSetup, setHasCompletedLedgerSetup] = useState(() => {
    try {
      const savedLedgers = JSON.parse(localStorage.getItem('catat-rapi-ledgers') || '[]') as string[]
      const usableLedgers = savedLedgers.filter((ledger) => ledger.trim() && ledger.trim() !== 'Umum')
      return usableLedgers.length > 0
    } catch {
      return false
    }
  })
  const [newLedgerName, setNewLedgerName] = useState('')
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false)
  const [editingLedgerName, setEditingLedgerName] = useState<string | null>(null)
  const syncStatus: SyncStatus = 'local'

  // Auth State
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)

  // Selected period filter (default: 'all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')

  const topbarUserMenuRef = useRef<HTMLDivElement>(null)
  const periodMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (topbarUserMenuRef.current && !topbarUserMenuRef.current.contains(e.target as Node)) {
        return
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

  useEffect(() => {
    localStorage.setItem('catat-rapi-ledgers', JSON.stringify(ledgers))
  }, [ledgers])

  const availableLedgers = useMemo(
    () => Array.from(new Set(
      [...ledgers, ...transactions.map(normalizeLedger)]
        .filter((ledger) => ledger.trim() && ledger.trim() !== 'Umum')
    )),
    [ledgers, transactions]
  )


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
  const allTimeIncome = useMemo(() => sumTransactions(transactions, 'income'), [transactions])
  const allTimeExpense = useMemo(() => sumTransactions(transactions, 'expense'), [transactions])

  // Total dynamic balance
  const totalBalance = allTimeIncome - allTimeExpense

  // Period-specific transactions (for current summary view)
  const periodTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions
    return transactions.filter((tx) => tx.date.startsWith(selectedPeriod))
  }, [transactions, selectedPeriod])

  const periodIncomeTotal = useMemo(() => sumTransactions(periodTransactions, 'income'), [periodTransactions])
  const periodExpenseTotal = useMemo(() => sumTransactions(periodTransactions, 'expense'), [periodTransactions])

  const netCashflow = periodIncomeTotal - periodExpenseTotal

  const outstandingReceivables = useMemo(
    () => periodTransactions
      .filter((tx) => tx.type === 'receivable' && !tx.receivablePaid)
      .reduce((sum, tx) => sum + remainingReceivable(tx), 0),
    [periodTransactions]
  )

  // Filtered transactions for table search & tab filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesType =
        activeFilter === 'Semua' ||
        (activeFilter === 'Pemasukan' ? transaction.type === 'income'
          : activeFilter === 'Pengeluaran' ? transaction.type === 'expense'
          : activeFilter === 'Utang' && transaction.type === 'receivable')
      const matchesLedger = activeLedger === 'Semua Buku' || normalizeLedger(transaction) === activeLedger
      const matchesSearch = `${transaction.title} ${transaction.category} ${transaction.account} ${normalizeLedger(transaction)}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesPeriod =
        selectedPeriod === 'all' || transaction.date.startsWith(selectedPeriod)
      return matchesType && matchesLedger && matchesSearch && matchesPeriod
    })
  }, [transactions, activeFilter, activeLedger, searchQuery, selectedPeriod])

  const reportIncomeTotal = useMemo(() => sumTransactions(filteredTransactions, 'income'), [filteredTransactions])
  const reportExpenseTotal = useMemo(() => sumTransactions(filteredTransactions, 'expense'), [filteredTransactions])

  const reportReceivableTotal = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'receivable' && !tx.receivablePaid)
        .reduce((total, tx) => total + remainingReceivable(tx), 0),
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
        label: MONTH_NAMES[d.getMonth()],
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

  // Handle adding a new transaction with robust number parsing
  const addTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const rawAmount = String(formData.get('amount') || '').trim()
    const cleanAmount = parseAmount(rawAmount)
    if (transactionType === 'receivable' && receivableMode === 'payment') {
      const receivableId = Number(formData.get('receivableId'))
      const target = transactions.find((transaction) => transaction.id === receivableId && transaction.type === 'receivable')
      if (!target) {
        alert('Pilih piutang yang akan dilunasi.')
        return
      }
      const alreadyPaid = Number(target.receivablePaidAmount) || 0
      const remaining = Number(target.amount) - alreadyPaid
      if (cleanAmount > remaining) {
        alert(`Pelunasan maksimal adalah ${formatCurrency(remaining)}.`)
        return
      }
      const totalPaid = alreadyPaid + cleanAmount
      setTransactions((current) => current.map((transaction) => transaction.id === receivableId
        ? {
            ...transaction,
            receivablePaidAmount: totalPaid,
            receivablePaid: totalPaid >= transaction.amount,
          }
        : transaction))
      setIsModalOpen(false)
      setEditingTransaction(null)
      setActiveNav('Transaksi')
      return
    }

    if (cleanAmount <= 0) {
      alert('Jumlah transaksi harus berupa angka positif lebih dari 0.')
      return
    }

    const inputDate = String(formData.get('date') || defaultTodayDate)

    const newTransaction: Transaction = {
      id: editingTransaction?.id ?? Date.now(),
      title: String(formData.get('title')).trim(),
      category: transactionType === 'receivable'
        ? '-'
        : String(formData.get('category') || (transactionType === 'income' ? 'Pendapatan' : 'Operasional')),
      date: inputDate,
      type: transactionType,
      amount: cleanAmount,
      account: String(formData.get('account')),
      ledger: String(formData.get('ledger') || '').trim(),
      dueDate: transactionType === 'receivable' ? String(formData.get('dueDate') || '') : undefined,
      receivablePaid: transactionType === 'receivable'
        ? false
        : undefined,
      receivablePaidAmount: transactionType === 'receivable' ? 0 : undefined,
    }

    if (newTransaction.ledger) {
      setLedgers((current) => Array.from(new Set([...current, newTransaction.ledger!])))
    }

    // Immediately update local state
    setTransactions((current) => editingTransaction
      ? current.map((transaction) => transaction.id === editingTransaction.id ? newTransaction : transaction)
      : [newTransaction, ...current])

    // If the new transaction's month is not in the currently selected period, switch to 'all'
    if (selectedPeriod !== 'all' && !inputDate.startsWith(selectedPeriod)) {
      setSelectedPeriod('all')
    }

    setIsModalOpen(false)
    setEditingTransaction(null)
    setActiveNav('Transaksi')
  }

  const openNewTransactionModal = () => {
    if (ledgers.length === 0) {
      setIsLedgerModalOpen(true)
      return
    }
    setEditingTransaction(null)
    setTransactionType('expense')
    setReceivableMode('credit')
    setIsModalOpen(true)
  }

  const openCreateLedgerModal = () => {
    setEditingLedgerName(null)
    setNewLedgerName('')
    setIsLedgerModalOpen(true)
  }

  const createLedger = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ledgerName = newLedgerName.trim()
    if (!ledgerName) return
    if (ledgerName.toLowerCase() === 'umum') {
      alert('Buku Umum tidak tersedia. Silakan gunakan nama buku lain.')
      return
    }
    if (editingLedgerName) {
      if (
        ledgerName.toLowerCase() !== editingLedgerName.toLowerCase()
        && ledgers.some((ledger) => ledger.toLowerCase() === ledgerName.toLowerCase())
      ) {
        alert('Nama buku keuangan sudah digunakan.')
        return
      }
      setLedgers((current) => current.map((ledger) => ledger === editingLedgerName ? ledgerName : ledger))
      setTransactions((current) => current.map((transaction) =>
        normalizeLedger(transaction) === editingLedgerName
          ? { ...transaction, ledger: ledgerName }
          : transaction
      ))
      if (activeLedger === editingLedgerName) setActiveLedger(ledgerName)
      setEditingLedgerName(null)
      setNewLedgerName('')
      setIsLedgerModalOpen(false)
      return
    }
    if (ledgers.some((ledger) => ledger.toLowerCase() === ledgerName.toLowerCase())) {
      alert('Nama buku keuangan sudah digunakan.')
      return
    }
    setLedgers((current) => [...current, ledgerName])
    setActiveLedger(ledgerName)
    setHasCompletedLedgerSetup(true)
    localStorage.setItem('catat-rapi-ledger-setup', 'true')
    setNewLedgerName('')
    setIsLedgerModalOpen(false)
  }

  const openEditLedgerModal = (ledger: string) => {
    setEditingLedgerName(ledger)
    setNewLedgerName(ledger)
    setIsLedgerModalOpen(true)
  }

  const closeLedgerModal = () => {
    setEditingLedgerName(null)
    setNewLedgerName('')
    setIsLedgerModalOpen(false)
  }

  const openEditTransactionModal = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setTransactionType(transaction.type)
    setIsModalOpen(true)
  }

  const deleteTransaction = (transaction: Transaction) => {
    if (!window.confirm(`Hapus transaksi "${transaction.title}"?`)) return
    setTransactions((current) => current.filter((item) => item.id !== transaction.id))
  }

  const toggleReceivablePaid = (transaction: Transaction) => {
    setTransactions((current) => current.map((item) => item.id === transaction.id
      ? {
          ...item,
          receivablePaid: !item.receivablePaid,
          receivablePaidAmount: item.receivablePaid ? 0 : item.amount,
        }
      : item))
  }

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    let y = 16

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(17)
    pdf.text('CatatRapi - Laporan Keuangan', 14, y)
    y += 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(`${formatPeriodLabel(selectedPeriod)} | ${activeLedger}`, 14, y)
    y += 10

    pdf.setFont('helvetica', 'bold')
    pdf.text(`Pemasukan: ${formatCurrency(reportIncomeTotal)}`, 14, y)
    pdf.text(`Pengeluaran: ${formatCurrency(reportExpenseTotal)}`, 75, y)
    pdf.text(`Utang: ${formatCurrency(reportReceivableTotal)}`, 136, y)
    pdf.text(`Bersih: ${formatCurrency(reportIncomeTotal - reportExpenseTotal)}`, 190, y)
    y += 8

    pdf.setFontSize(9)
    filteredTransactions.forEach((transaction) => {
      if (y > 185) {
        pdf.addPage()
        y = 16
      }
      const typeLabel = transaction.type === 'income'
        ? 'Pemasukan'
        : transaction.type === 'expense'
          ? 'Pengeluaran'
          : 'Utang'
      const status = transaction.type === 'receivable'
        ? (transaction.receivablePaid ? 'Lunas' : 'Belum lunas')
        : ''
      const line = `${formatDate(transaction.date)} | ${transaction.title} | ${normalizeLedger(transaction)} | ${typeLabel} | ${formatCurrency(transaction.amount)}${status ? ` | ${status}` : ''}`
      pdf.text(pdf.splitTextToSize(line, pageWidth - 28), 14, y)
      y += 7
    })

    pdf.save(`laporan-keuangan-${selectedPeriod === 'all' ? 'semua-periode' : selectedPeriod}.pdf`)
  }

  const navItems = [
    { label: 'Buku Keuangan', icon: BookOpen },
    { label: 'Transaksi', icon: CreditCard },
    { label: 'Laporan', icon: ChartNoAxesCombined },
  ]

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <a className="brand" href="#buku-keuangan" onClick={() => setActiveNav('Buku Keuangan')}>
          <span className="brand-mark">
            <Wallet size={19} strokeWidth={2.3} />
          </span>
          <span>
            catat<span className="brand-light">rapi</span>
            <small>KEUANGAN USAHA</small>
          </span>
        </a>

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

          </div>
        </header>

        <div className="page-content">
          {/* Heading */}
          <section className="page-heading">
            <div>
              <p className="eyebrow">{defaultFormattedToday.toUpperCase()}</p>
              <h1>
                {activeNav}
              </h1>
              <p className="page-subtitle">
                {activeNav === 'Buku Keuangan'
                  ? 'Buat dan kelola pencatatan keuangan yang dipisahkan per usaha atau proyek.'
                  : activeNav === 'Transaksi'
                  ? 'Semua pemasukan dan pengeluaran usahamu yang tercatat.'
                  : activeNav === 'Laporan'
                  ? 'Pantau arus kas dan performa keuangan usahamu.'
                  : 'Atur preferensi akun dan workspace usahamu.'}
              </p>
            </div>
            {activeNav === 'Buku Keuangan' ? (
              <button className="primary-button" onClick={openCreateLedgerModal}>
                <Plus size={17} strokeWidth={2.4} /> Buku baru
              </button>
            ) : (
              <button className="primary-button" onClick={openNewTransactionModal}>
                <Plus size={17} strokeWidth={2.4} /> Catat transaksi
              </button>
            )}
          </section>

          {/* Summary Cards */}
          {activeNav !== 'Buku Keuangan' && activeNav !== 'Pengaturan' && (
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
              <strong className="summary-amount">
                {formatCurrency(activeNav === 'Laporan' ? reportIncomeTotal : periodIncomeTotal)}
              </strong>
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
              <strong className="summary-amount">
                {formatCurrency(activeNav === 'Laporan' ? reportExpenseTotal : periodExpenseTotal)}
              </strong>
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

            <article className="summary-card receivable-card">
              <div className="summary-top">
                <span className="summary-label">Utang belum lunas</span>
                <span className="summary-icon receivable-icon">
                  <FileText size={18} />
                </span>
              </div>
              <strong className="summary-amount">
                {formatCurrency(activeNav === 'Laporan' ? reportReceivableTotal : outstandingReceivables)}
              </strong>
              <div className="summary-foot">
                <span className="neutral-change">
                  {periodTransactions.filter((tx) => tx.type === 'receivable' && !tx.receivablePaid).length} utang
                </span>
                <span>belum masuk kas</span>
              </div>
            </article>

            <article className="summary-card">
              <div className="summary-top">
                <span className="summary-label">Arus kas bersih</span>
                <span className="summary-icon net-icon">
                  <ChartNoAxesCombined size={18} />
                </span>
              </div>
              <strong className="summary-amount">
                {formatCurrency(
                  activeNav === 'Laporan'
                    ? reportIncomeTotal - reportExpenseTotal
                    : netCashflow
                )}
              </strong>
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
          )}

          {/* Cashflow Chart */}
          {activeNav === 'Laporan' && (
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
          {(activeNav === 'Transaksi' || activeNav === 'Laporan') && (
            <section className="transactions-section">
              <div
                className={`section-heading transaction-heading ${
                  activeNav === 'Laporan' ? 'report-heading' : ''
                }`}
              >
                <div>
                  <h2>
                    {activeNav === 'Laporan'
                      ? 'Rincian laporan keuangan'
                      : 'Semua transaksi'}
                  </h2>
                  <p>
                    {activeNav === 'Laporan'
                      ? `${filteredTransactions.length} transaksi dalam laporan`
                      : `${transactions.length} total transaksi tersimpan`}
                  </p>
                </div>

                {activeNav === 'Laporan' && (
                  <div className="report-actions">
                    <button
                      className="report-action report-print-action"
                      onClick={downloadPdf}
                    >
                      <Printer size={15} /> Unduh PDF
                    </button>
                    <button
                      type="button"
                      className="report-action"
                      onClick={() => window.print()}
                    >
                      <Printer size={15} /> Cetak
                    </button>
                  </div>
                )}
              </div>

              <div className="table-toolbar">
                <div className="filter-tabs" role="tablist" aria-label="Filter transaksi">
                  {['Semua', 'Pemasukan', 'Pengeluaran', 'Utang'].map((filter) => (
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
                  <label className="ledger-filter">
                    <span>Buku</span>
                    <select value={activeLedger} onChange={(event) => setActiveLedger(event.target.value)}>
                      <option>Semua Buku</option>
                      {availableLedgers.map((ledger) => <option key={ledger}>{ledger}</option>)}
                    </select>
                  </label>
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
                    onClick={downloadPdf}
                    title="Unduh PDF"
                    aria-label="Unduh laporan sebagai PDF"
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    className="icon-button print-button"
                    onClick={downloadPdf}
                    title="Unduh PDF"
                    aria-label="Unduh transaksi sebagai PDF"
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
                      <th>BUKU</th>
                      <th>TANGGAL</th>
                      <th>AKUN</th>
                      <th className="amount-heading">JUMLAH</th>
                      <th className="transaction-actions-heading">AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions
                      .map((transaction) => (
                        <tr key={transaction.id}>
                          <td>
                            <div className="transaction-name">
                              <span className={`transaction-symbol ${transaction.type}`}>
                                {transaction.type === 'income' ? (
                                  <ArrowDownLeft size={16} />
                                ) : transaction.type === 'expense' ? (
                                  <ArrowUpRight size={16} />
                                ) : (
                                  <CheckCircle2 size={16} />
                                )}
                              </span>
                              <span>
                                <strong>{transaction.title}</strong>
                                <small>
                                  {transaction.type === 'income'
                                    ? 'Pemasukan'
                                    : transaction.type === 'expense'
                                      ? 'Pengeluaran'
                                      : transaction.receivablePaid ? 'Utang lunas' : 'Utang belum lunas'}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="category-label">{transaction.category}</span>
                          </td>
                          <td>{normalizeLedger(transaction)}</td>
                          <td className="date-cell">{formatDate(transaction.date)}</td>
                          <td className="account-cell">{transaction.account}</td>
                          <td className={`amount-cell ${transaction.type}`}>
                            {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : ''}{' '}
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="transaction-actions-cell">
                            <div className="transaction-row-actions">
                              {transaction.type === 'receivable' && (
                                <button
                                  type="button"
                                  className={transaction.receivablePaid ? 'delete-action' : ''}
                                  onClick={() => toggleReceivablePaid(transaction)}
                                  aria-label={transaction.receivablePaid ? 'Tandai belum lunas' : 'Tandai piutang lunas'}
                                  title={transaction.receivablePaid ? 'Belum lunas' : 'Tandai lunas'}
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                              )}
                              <button type="button" onClick={() => openEditTransactionModal(transaction)} aria-label={`Edit ${transaction.title}`} title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button className="delete-action" type="button" onClick={() => void deleteTransaction(transaction)} aria-label={`Hapus ${transaction.title}`} title="Hapus">
                                <Trash2 size={14} />
                              </button>
                            </div>
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
                    )}
                  </strong>{' '}
                  dari <strong>{filteredTransactions.length}</strong> transaksi
                </span>
                {activeNav !== 'Laporan' && (
                  <button onClick={downloadPdf}>
                    Unduh PDF <Printer size={14} />
                  </button>
                )}
              </div>
            </section>
          )}

          {activeNav === 'Buku Keuangan' && (
            <div className="ledger-grid">
              {availableLedgers.length === 0 ? (
                <section className="ledger-empty-state">
                  <BookOpen size={28} />
                  <h2>Buat buku keuangan pertama</h2>
                  <p>Buku membantu memisahkan pencatatan per usaha, proyek, atau kebutuhan tertentu.</p>
                  <button className="primary-button" onClick={openCreateLedgerModal}>
                    <Plus size={16} /> Buat buku keuangan
                  </button>
                </section>
              ) : (
                availableLedgers.map((ledger) => (
                  <div key={ledger} className="ledger-card">
                    <button
                      type="button"
                      className="ledger-card-main"
                      onClick={() => {
                        setActiveLedger(ledger)
                        setActiveNav('Laporan')
                      }}
                    >
                      <span className="ledger-card-icon"><BookOpen size={20} /></span>
                      <span>
                        <strong>{ledger}</strong>
                        <small>
                          {transactions.filter((transaction) => normalizeLedger(transaction) === ledger).length} pencatatan
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ledger-card-edit"
                      onClick={() => openEditLedgerModal(ledger)}
                      aria-label={`Edit nama buku ${ledger}`}
                      title="Edit nama buku"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pengaturan penyimpanan lokal */}
          {activeNav === 'Pengaturan' && (
            <div className="settings-container">
              <section className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-header-info">
                    <div className="settings-icon"><UserIcon size={22} /></div>
                    <div><h2>Data & Penyimpanan</h2><p>Transaksi disimpan di browser perangkat ini.</p></div>
                  </div>
                  <span className="settings-badge"><CheckCircle2 size={13} />Mode Lokal</span>
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
                    <span>Mata Uang</span>
                    <strong>IDR — Rupiah Indonesia (Rp)</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Total Transaksi</span>
                    <strong>{transactions.length} Transaksi Tercatat</strong>
                  </div>
                  <div className="settings-field-box">
                    <span>Firebase Status</span>
                    <strong>Aktif</strong>
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
              Data tersimpan di browser
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
            <span>Total saldo keseluruhan</span>
            <strong>{formatCurrency(totalBalance)}</strong>
          </div>
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
          <div>
            <span>Utang belum lunas</span>
            <strong>{formatCurrency(reportReceivableTotal)}</strong>
          </div>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Transaksi</th>
              <th>Kategori</th>
              <th>Buku</th>
              <th>Akun</th>
              <th>Jenis</th>
              <th>Status</th>
              <th>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td>{formatDate(tx.date)}</td>
                <td>{tx.title}</td>
                <td>{tx.category}</td>
                <td>{normalizeLedger(tx)}</td>
                <td>{tx.account}</td>
                <td>{tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : 'Utang'}</td>
                <td>{tx.type === 'receivable' ? (tx.receivablePaid ? 'Lunas' : 'Belum lunas') : '-'}</td>
                <td className="print-amount">
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''} {formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="print-report-footer">
          CatatRapi · {filteredTransactions.length} transaksi
        </footer>
      </section>

      {(isLedgerModalOpen || !hasCompletedLedgerSetup) && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && hasCompletedLedgerSetup) closeLedgerModal()
          }}
        >
          <section className="transaction-modal ledger-modal" role="dialog" aria-modal="true" aria-labelledby="ledger-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{editingLedgerName ? 'EDIT BUKU' : 'LANGKAH PERTAMA'}</p>
                <h2 id="ledger-modal-title">{editingLedgerName ? 'Edit nama buku keuangan' : 'Buat buku keuangan'}</h2>
              </div>
              {hasCompletedLedgerSetup && (
                <button className="icon-button" onClick={closeLedgerModal} aria-label="Tutup dialog">
                  <X size={18} />
                </button>
              )}
            </div>
            <p className="ledger-modal-description">
              {editingLedgerName
                ? 'Nama baru akan diperbarui pada buku dan seluruh transaksi yang menggunakannya.'
                : 'Sebelum mencatat keuangan, buat buku untuk memisahkan pencatatan usaha, proyek, atau kebutuhanmu.'}
            </p>
            <form onSubmit={createLedger}>
              <label className="form-field">
                Nama buku keuangan
                <input
                  value={newLedgerName}
                  onChange={(event) => setNewLedgerName(event.target.value)}
                  placeholder="Contoh: Usaha Toko, Proyek A"
                  autoFocus
                  required
                />
              </label>
              <div className="modal-actions">
                {hasCompletedLedgerSetup && (
                  <button type="button" className="secondary-button" onClick={closeLedgerModal}>
                    Batal
                  </button>
                )}
                <button type="submit" className="primary-button">
                  <BookOpen size={16} /> {editingLedgerName ? 'Simpan perubahan' : 'Buat buku'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false)
              setEditingTransaction(null)
            }
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
                <h2 id="modal-title">{editingTransaction ? 'Edit transaksi' : 'Catat transaksi'}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingTransaction(null)
                }}
                aria-label="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form key={editingTransaction?.id ?? 'new'} onSubmit={addTransaction}>
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
                <button
                  type="button"
                  className={transactionType === 'receivable' ? 'selected-receivable' : ''}
                  onClick={() => setTransactionType('receivable')}
                >
                  <FileText size={16} /> Piutang
                </button>
              </div>

              {transactionType === 'receivable' && (
                <div className="receivable-mode-switch" role="group" aria-label="Opsi piutang">
                  <button
                    type="button"
                    className={receivableMode === 'credit' ? 'active' : ''}
                    onClick={() => setReceivableMode('credit')}
                  >
                    Kredit / Piutang baru
                  </button>
                  <button
                    type="button"
                    className={receivableMode === 'payment' ? 'active' : ''}
                    onClick={() => setReceivableMode('payment')}
                  >
                    Pelunasan piutang
                  </button>
                </div>
              )}

              {transactionType === 'receivable' && receivableMode === 'payment' ? (
                <>
                  <label className="form-field">
                    Piutang yang dilunasi
                    <select name="receivableId" required defaultValue="">
                      <option value="" disabled>Pilih piutang</option>
                      {transactions
                        .filter((transaction) => transaction.type === 'receivable' && !transaction.receivablePaid)
                        .map((transaction) => (
                          <option key={transaction.id} value={transaction.id}>
                            {transaction.title} — Sisa {formatCurrency(
                              transaction.amount - (Number(transaction.receivablePaidAmount) || 0)
                            )}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label className="form-field">
                      Jumlah dibayar (Rp)
                      <input
                        name="amount"
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        onChange={(event) => {
                          event.currentTarget.value = formatAmountInput(event.currentTarget.value)
                        }}
                        required
                      />
                    </label>
                    <label className="form-field">
                      Tanggal pelunasan
                      <input name="date" type="date" defaultValue={defaultTodayDate} required />
                    </label>
                  </div>
                </>
              ) : (
                <>

              <label className="form-field">
                Nama transaksi
                <input
                  name="title"
                  placeholder="Contoh: Pembayaran klien / Beli perlengkapan"
                  defaultValue={editingTransaction?.title ?? ''}
                  required
                  autoFocus
                />
              </label>

              <div className="form-row">
                <label className="form-field">
                  Jumlah (Rp)
                  <input
                    name="amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    defaultValue={editingTransaction?.amount ? formatAmountInput(String(editingTransaction.amount)) : ''}
                    onChange={(event) => {
                      event.currentTarget.value = formatAmountInput(event.currentTarget.value)
                    }}
                    required
                  />
                </label>
                <label className="form-field">
                  Tanggal
                  <input
                    name="date"
                    type="date"
                    defaultValue={editingTransaction?.date ?? defaultTodayDate}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                {transactionType !== 'receivable' && (
                  <label className="form-field">
                    Kategori
                    <select
                      key={`${transactionType}-${editingTransaction?.id ?? 'new'}`}
                      name="category"
                      defaultValue={
                        editingTransaction && editingTransaction.category !== '-'
                          ? editingTransaction.category
                          : transactionType === 'income'
                            ? 'Pendapatan'
                            : 'Operasional'
                      }
                    >
                      {transactionType === 'income' ? (
                        <>
                          <option>Pendapatan</option>
                          <option>Penjualan</option>
                          <option>Jasa</option>
                          <option>Lainnya</option>
                        </>
                      ) : (
                        <>
                          <option>Operasional</option>
                          <option>Proyek</option>
                          <option>Tools</option>
                          <option>Perjalanan</option>
                          <option>Gaji</option>
                          <option>Lainnya</option>
                        </>
                      )}
                    </select>
                  </label>
                )}
                <label className="form-field">
                  Akun
                  <select name="account" defaultValue={editingTransaction?.account ?? 'Tunai'}>
                    <option>BCA Operasional</option>
                    <option>Kartu bisnis</option>
                    <option>Tunai</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label className="form-field">
                  Buku pencatatan
                  <select
                    name="ledger"
                    defaultValue={
                      editingTransaction && normalizeLedger(editingTransaction)
                        ? normalizeLedger(editingTransaction)
                        : activeLedger !== 'Semua Buku'
                          ? activeLedger
                          : ledgers[0] || ''
                    }
                    required
                  >
                    {ledgers.map((ledger) => <option key={ledger} value={ledger}>{ledger}</option>)}
                  </select>
                </label>
                {transactionType === 'receivable' && (
                  <label className="form-field">
                    Jatuh tempo
                    <input
                      name="dueDate"
                      type="date"
                      defaultValue={editingTransaction?.dueDate ?? ''}
                    />
                  </label>
                )}
              </div>

                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingTransaction(null)
                  }}
                >
                  Batal
                </button>
                <button type="submit" className="primary-button">
                  <Plus size={16} /> {editingTransaction ? 'Simpan perubahan' : 'Simpan transaksi'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </div>
  )
}

export default App
