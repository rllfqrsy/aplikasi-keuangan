import type { TransactionRecord } from './firebase'

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const FULL_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const normalizeLedger = (transaction: TransactionRecord) => transaction.ledger?.trim() || ''

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)

export const formatAmountInput = (value: string) =>
  value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const parseAmount = (value: string) => Number(value.replace(/[^0-9]/g, '')) || 0

export const formatDate = (date: string) => {
  if (!date) return '-'
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${date}T00:00:00`))
  } catch {
    return date
  }
}

export const formatPeriodLabel = (periodKey: string) => {
  if (periodKey === 'all') return 'Semua Periode'
  const [year, month] = periodKey.split('-')
  const monthIndex = Number(month) - 1
  return monthIndex >= 0 && monthIndex < 12 ? `${FULL_MONTH_NAMES[monthIndex]} ${year}` : periodKey
}

export const remainingReceivable = (transaction: TransactionRecord) =>
  Math.max(
    (Number(transaction.amount) || 0) - (Number(transaction.receivablePaidAmount) || 0),
    0,
  )

export const sumTransactions = (transactions: TransactionRecord[], type: TransactionRecord['type']) =>
  transactions.reduce(
    (total, transaction) => transaction.type === type
      ? total + remainingReceivable(transaction)
      : total,
    0,
  )
