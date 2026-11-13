import { createLedgerPage } from './components/ledger.js';
import {
  addDebtPrincipal,
  computeDebtSummary,
  createDebt,
  deleteDebt,
  listAllDebtPayments,
  listDebtAdditions,
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
    initialAmountLabel: 'Nominal awal utang',
    paidLabel: 'Sudah dibayar',
    remainingLabel: 'Sisa utang',
    dateLabel: 'Tanggal utang',
    dueLabel: 'Jatuh tempo',
    paymentNoun: 'pembayaran',
    paymentAction: 'Catat Pembayaran',
    paymentTitle: 'Catat Pembayaran Utang',
    paymentDescription:
      'Pembayaran disimpan secara atomik di perangkat dan tidak dapat melebihi sisa utang.',
    principalAction: 'Tambah Pokok',
    principalTitle: 'Tambah Pokok Utang',
    principalNoun: 'pokok utang',
    principalDescription:
      'Nominal pokok akan ditambahkan ke catatan yang dipilih dan disimpan sebagai riwayat penambahan.',
    profileTitle: 'Profil Pemberi Pinjaman',
    profileAddAction: 'Catat Utang Baru',
    profileDescription:
      'Semua utang dan penambahan pokok untuk orang ini dikumpulkan dalam satu profil.',
    profileHistoryTitle: 'Riwayat Utang',
    profileAdditionTitle: 'Riwayat Penambahan Pokok',
    profileAdditionEmpty:
      'Belum ada penambahan pokok. Tambahkan pokok dari salah satu catatan di atas.',
    photoAction: 'Ubah Foto',
    photoRemoveAction: 'Hapus Foto',
    photoEmpty: 'Belum ada foto profil',
    historyTitle: 'Riwayat Pembayaran',
    historyEmpty: 'Belum ada pembayaran untuk utang ini.',
    additionHistoryTitle: 'Riwayat Penambahan Pokok',
    additionHistoryEmpty: 'Belum ada penambahan pokok untuk utang ini.',
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
    listAllPayments: listAllDebtPayments,
    listAdditions: listDebtAdditions,
    addPrincipal: (userId, debtId, payload) =>
      addDebtPrincipal({
        userId,
        debtId,
        amount: payload.amount,
        additionDate: payload.additionDate,
        description: payload.description
      }),
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
    amount:
      record.initial_amount === undefined
        ? record.amount
        : record.initial_amount,
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
