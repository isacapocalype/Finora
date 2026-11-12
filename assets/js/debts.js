import { createLedgerPage } from './components/ledger.js';
import {
  computeDebtSummary,
  createDebt,
  deleteDebt,
  listDebtPayments,
  listDebts,
  recordDebtPayment,
  updateDebt
} from './services/debt.service.js';
import { formatCurrency, getStatusMeta } from './utils.js';

const ledger = createLedgerPage({
  kind: 'debt',
  entityName: 'utang',
  entityLabel: 'Utang',
  icons: {
    person: 'user-round',
    empty: 'wallet-cards'
  },
  labels: {
    addTitle: 'Tambah Utang',
    editTitle: 'Edit Utang',
    detailTitle: 'Detail Utang',
    addAction: 'Tambah Utang',
    formDescription:
      'Catat utang baru. Status dan sisa dihitung otomatis oleh aplikasi.',
    personHeader: 'Pemberi pinjaman',
    personLabel: 'Nama pemberi pinjaman',
    personPlaceholder: 'Contoh: Budi Santoso',
    amountLabel: 'Nominal utang',
    paidLabel: 'Sudah dibayar',
    remainingLabel: 'Sisa utang',
    dateLabel: 'Tanggal utang',
    dueLabel: 'Jatuh tempo',
    paymentNoun: 'pembayaran',
    paymentAction: 'Catat Pembayaran',
    paymentTitle: 'Catat Pembayaran Utang',
    paymentDescription:
      'Pembayaran disimpan secara atomik di perangkat dan tidak dapat melebihi sisa utang.',
    historyTitle: 'Riwayat Pembayaran',
    historyEmpty: 'Belum ada pembayaran untuk utang ini.',
    emptyTitle: 'Belum ada utang',
    emptyDescription:
      'Catat utang pertamamu untuk mulai memantau sisa kewajiban dan jatuh tempo.',
    emptyAction: 'Tambah Utang',
    deleteTitle: 'Hapus utang ini?',
    deleteMessage: (record) =>
      `Utang kepada ${record.lender_name} beserta seluruh riwayat pembayarannya akan dihapus permanen.`
  },
  services: {
    list: listDebts,
    create: createDebt,
    update: updateDebt,
    remove: deleteDebt,
    listPayments: listDebtPayments,
    recordPayment: (userId, debtId, payload) =>
      recordDebtPayment({
        userId,
        debtId,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        description: payload.description
      })
  },
  computeSummary: computeDebtSummary,
  read: {
    person: (record) => record.lender_name,
    amount: (record) => record.amount,
    paid: (record) => record.paid_amount
  },
  toForm: (record) => ({
    person: record.lender_name,
    amount: record.amount,
    transactionDate: record.transaction_date,
    dueDate: record.due_date || '',
    description: record.description || ''
  }),
  toPayload: (values) => ({
    lenderName: values.person,
    amount: values.amount,
    transactionDate: values.transactionDate,
    dueDate: values.dueDate,
    description: values.description
  }),
  summaryCards: (summary) => {
    const paidPercent =
      summary.totalAmount > 0
        ? Math.round((summary.totalPaid / summary.totalAmount) * 100)
        : 0;

    return [
      {
        label: 'Total Utang',
        value: formatCurrency(summary.totalAmount),
        meta:
          summary.activeCount > 0
            ? `${summary.activeCount} utang aktif`
            : 'Tidak ada utang aktif',
        iconName: 'wallet',
        tone: 'danger',
        metaIcon: 'arrow-down-left'
      },
      {
        label: 'Sudah Dibayar',
        value: formatCurrency(summary.totalPaid),
        meta: `${paidPercent}% dari total utang`,
        iconName: 'circle-check-big',
        tone: 'success',
        metaIcon: 'trending-up'
      },
      {
        label: 'Sisa Utang',
        value: formatCurrency(summary.totalRemaining),
        meta: getStatusMeta('debt', summary.totalRemaining > 0 ? 'unpaid' : 'paid')
          .label,
        iconName: 'circle-alert',
        tone: 'primary',
        metaIcon: 'circle-dot'
      }
    ];
  }
});

export function initPage({ user }) {
  return ledger.init(user);
}
