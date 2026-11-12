import { createLedgerPage } from './components/ledger.js';
import {
  computeReceivableSummary,
  createReceivable,
  deleteReceivable,
  listReceivablePayments,
  listReceivables,
  recordReceivablePayment,
  updateReceivable
} from './services/receivable.service.js';
import { formatCurrency } from './utils.js';

const ledger = createLedgerPage({
  kind: 'receivable',
  entityName: 'piutang',
  entityLabel: 'Piutang',
  icons: {
    person: 'user-round',
    empty: 'hand-coins'
  },
  labels: {
    addTitle: 'Tambah Piutang',
    editTitle: 'Edit Piutang',
    detailTitle: 'Detail Piutang',
    addAction: 'Tambah Piutang',
    formDescription:
      'Catat piutang baru. Status dan sisa dihitung otomatis oleh aplikasi.',
    personHeader: 'Peminjam',
    personLabel: 'Nama peminjam',
    personPlaceholder: 'Contoh: Siti Aminah',
    amountLabel: 'Nominal piutang',
    paidLabel: 'Sudah dikembalikan',
    remainingLabel: 'Sisa piutang',
    dateLabel: 'Tanggal piutang',
    dueLabel: 'Tanggal pengembalian',
    paymentNoun: 'pengembalian',
    paymentAction: 'Catat Pengembalian',
    paymentTitle: 'Catat Pengembalian Piutang',
    paymentDescription:
      'Pengembalian disimpan secara atomik di perangkat dan tidak dapat melebihi sisa piutang.',
    historyTitle: 'Riwayat Pengembalian',
    historyEmpty: 'Belum ada pengembalian untuk piutang ini.',
    emptyTitle: 'Belum ada piutang',
    emptyDescription:
      'Catat uang yang kamu pinjamkan agar pengembaliannya mudah dipantau.',
    emptyAction: 'Tambah Piutang',
    deleteTitle: 'Hapus piutang ini?',
    deleteMessage: (record) =>
      `Piutang kepada ${record.borrower_name} beserta seluruh riwayat pengembaliannya akan dihapus permanen.`
  },
  services: {
    list: listReceivables,
    create: createReceivable,
    update: updateReceivable,
    remove: deleteReceivable,
    listPayments: listReceivablePayments,
    recordPayment: (userId, receivableId, payload) =>
      recordReceivablePayment({
        userId,
        receivableId,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        description: payload.description
      })
  },
  computeSummary: computeReceivableSummary,
  read: {
    person: (record) => record.borrower_name,
    amount: (record) => record.amount,
    paid: (record) => record.received_amount
  },
  toForm: (record) => ({
    person: record.borrower_name,
    amount: record.amount,
    transactionDate: record.transaction_date,
    dueDate: record.due_date || '',
    description: record.description || ''
  }),
  toPayload: (values) => ({
    borrowerName: values.person,
    amount: values.amount,
    transactionDate: values.transactionDate,
    dueDate: values.dueDate,
    description: values.description
  }),
  summaryCards: (summary) => {
    const receivedPercent =
      summary.totalAmount > 0
        ? Math.round((summary.totalReceived / summary.totalAmount) * 100)
        : 0;

    return [
      {
        label: 'Total Piutang',
        value: formatCurrency(summary.totalAmount),
        meta:
          summary.activeCount > 0
            ? `${summary.activeCount} piutang aktif`
            : 'Tidak ada piutang aktif',
        iconName: 'hand-coins',
        tone: 'info',
        metaIcon: 'arrow-up-right'
      },
      {
        label: 'Sudah Dikembalikan',
        value: formatCurrency(summary.totalReceived),
        meta: `${receivedPercent}% dari total piutang`,
        iconName: 'circle-check-big',
        tone: 'success',
        metaIcon: 'trending-up'
      },
      {
        label: 'Sisa Piutang',
        value: formatCurrency(summary.totalRemaining),
        meta:
          summary.activeCount > 0
            ? 'Menunggu pengembalian'
            : 'Semua piutang sudah lunas',
        iconName: 'clock-3',
        tone: 'primary',
        metaIcon: 'circle-dot'
      }
    ];
  }
});

export function initPage({ user }) {
  return ledger.init(user);
}
