import {
  calcProgress,
  calcProgressRaw,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatSignedCurrency,
  formatLongDate,
  getCategoryMeta,
  getErrorMessage,
  greetingForHour
} from './utils.js';
import { icon, refreshIcons } from './icons.js';
import { loadDashboardData } from './services/dashboard.service.js';
import {
  renderComparisonChart,
  renderSavingsChart
} from './components/charts.js';
import { renderSummaryCards, summaryLoading } from './components/summary.js';
import { errorState, tableSkeleton } from './components/states.js';
import { showToast } from './components/toast.js';

const elements = {
  greeting: document.getElementById('dashboard-greeting'),
  date: document.getElementById('dashboard-date'),
  summary: document.getElementById('dashboard-summary'),
  chartCanvas: document.getElementById('savings-chart'),
  chartRangeButtons: document.querySelectorAll('[data-chart-range]'),
  comparison: document.getElementById('comparison-body'),
  activeSavings: document.getElementById('active-savings'),
  recent: document.getElementById('dashboard-recent')
};

let dashboardData = null;
let currentRange = 'monthly';
let currentUser = null;

export async function initPage({ user }) {
  currentUser = user;
  elements.greeting.textContent = `${greetingForHour()}`;
  elements.date.textContent = `${formatLongDate()} · Berikut ringkasan keuanganmu hari ini.`;
  bindRangeButtons();
  renderLoadingState();
  await loadData();
}

function bindRangeButtons() {
  elements.chartRangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const range = button.dataset.chartRange;

      if (!dashboardData || range === currentRange) {
        return;
      }

      currentRange = range;
      elements.chartRangeButtons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      renderSavingsChart(
        elements.chartCanvas,
        dashboardData.charts[currentRange]
      );
    });
  });
}

function renderLoadingState() {
  summaryLoading(elements.summary, 4);
  elements.comparison.innerHTML = `
    <div class="skeleton skeleton-circle" style="--skeleton-size: 150px; --skeleton-radius: 50px"></div>
    <div class="comparison-legend">
      <span class="skeleton skeleton-text" style="--skeleton-width: 80%"></span>
      <span class="skeleton skeleton-text" style="--skeleton-width: 60%"></span>
      <span class="skeleton skeleton-text" style="--skeleton-width: 70%"></span>
    </div>
  `;
  elements.activeSavings.innerHTML = `
    <span class="skeleton skeleton-text" style="--skeleton-width: 90%"></span>
    <span class="skeleton skeleton-block"></span>
    <span class="skeleton skeleton-text" style="--skeleton-width: 70%; --skeleton-margin-top: 10px"></span>
    <span class="skeleton skeleton-block"></span>
  `;
  elements.recent.innerHTML = tableSkeleton(4, 4);

  const wrapper =
    elements.chartCanvas?.closest('.chart-wrap') ||
    document.querySelector('.chart-card .chart-wrap');

  if (wrapper) {
    wrapper.innerHTML = `
      <div class="chart-skeleton" role="status" aria-label="Memuat grafik">
        <span class="skeleton skeleton-chart"></span>
      </div>
    `;
  }
}

async function loadData() {
  try {
    dashboardData = await loadDashboardData(currentUser.id);
    ensureChartCanvas();
    renderSummary(dashboardData);
    renderCharts(dashboardData);
    renderActiveSavings(dashboardData.activeSavings);
    renderRecent(dashboardData.recent);
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    renderLoadError(
      getErrorMessage(error, 'Data dashboard gagal dimuat. Silakan coba lagi.')
    );
  }
}

function ensureChartCanvas() {
  const wrapper = elements.chartCanvas?.closest('.chart-wrap') || document.querySelector('.chart-card .chart-wrap');

  if (!wrapper) {
    return;
  }

  if (!wrapper.querySelector('#savings-chart')) {
    wrapper.innerHTML =
      '<canvas id="savings-chart" aria-label="Grafik perkembangan tabungan" role="img"></canvas>';
  }

  elements.chartCanvas = document.getElementById('savings-chart');
}

function renderSummary(data) {
  const { summary } = data;
  renderSummaryCards(elements.summary, [
    {
      label: 'Total Utang',
      value: formatCurrency(summary.totalDebt),
      meta:
        summary.activeDebtCount > 0
          ? `${summary.activeDebtCount} utang aktif`
          : 'Tidak ada utang aktif',
      iconName: 'wallet',
      tone: 'danger',
      metaIcon: 'arrow-down-left',
      href: 'debts.html',
      linkLabel: 'Buka halaman utang'
    },
    {
      label: 'Total Piutang',
      value: formatCurrency(summary.totalReceivable),
      meta:
        summary.activeReceivableCount > 0
          ? `${summary.activeReceivableCount} piutang aktif`
          : 'Tidak ada piutang aktif',
      iconName: 'hand-coins',
      tone: 'info',
      metaIcon: 'arrow-up-right',
      href: 'receivables.html',
      linkLabel: 'Buka halaman piutang'
    },
    {
      label: 'Total Tabungan',
      value: formatCurrency(summary.totalSavings),
      meta:
        summary.savingsCount > 0
          ? `${summary.savingsCount} target tabungan`
          : 'Belum ada target tabungan',
      iconName: 'piggy-bank',
      tone: 'primary',
      metaIcon: 'circle-dollar-sign',
      href: 'savings.html',
      linkLabel: 'Buka halaman tabungan'
    },
    {
      label: 'Target Tabungan',
      value: formatCurrency(summary.totalTarget),
      meta:
        summary.totalTarget > 0
          ? `${Math.round(
              calcProgress(summary.totalSavings, summary.totalTarget)
            )}% target terkumpul`
          : 'Target belum ditentukan',
      iconName: 'target',
      tone: 'lavender',
      metaIcon: 'flag',
      href: 'savings.html',
      linkLabel: 'Lihat target tabungan'
    }
  ]);
}

function renderCharts(data) {
  renderSavingsChart(elements.chartCanvas, data.charts[currentRange]);
  renderComparison(data.comparison);
}

function renderComparison(comparison) {
  const net = Number(comparison.receivable) - Number(comparison.debt);
  const netLabel =
    net > 0
      ? 'Piutang lebih besar dari utang'
      : net < 0
        ? 'Utang lebih besar dari piutang'
        : 'Utang dan piutang seimbang';

  elements.comparison.innerHTML = `
    <div class="comparison-chart-wrap">
      <canvas id="comparison-chart" aria-label="Grafik perbandingan utang dan piutang" role="img"></canvas>
    </div>
    <div class="comparison-legend">
      <div class="legend-item">
        <span class="legend-dot legend-dot-danger" aria-hidden="true"></span>
        <div>
          <strong>${formatCurrency(comparison.debt)}</strong>
          <small>Sisa utang</small>
        </div>
      </div>
      <div class="legend-item">
        <span class="legend-dot legend-dot-info" aria-hidden="true"></span>
        <div>
          <strong>${formatCurrency(comparison.receivable)}</strong>
          <small>Sisa piutang</small>
        </div>
      </div>
      <div class="comparison-net">
        ${netLabel}
        <strong>${formatCurrency(Math.abs(net))}</strong>
      </div>
    </div>
  `;

  renderComparisonChart(
    document.getElementById('comparison-chart'),
    comparison
  );
}

function renderActiveSavings(activeSavings) {
  if (!elements.activeSavings) {
    return;
  }

  if (!activeSavings || activeSavings.length === 0) {
    elements.activeSavings.innerHTML = `
      <div class="empty-state empty-state-inline">
        <span class="empty-state-icon">${icon('target')}</span>
        <h3>Belum ada target aktif</h3>
        <p>Buat target tabungan pertamamu untuk mulai memantau progress.</p>
        <a class="btn btn-secondary btn-sm empty-state-action" href="savings.html?action=create">Buat Tabungan</a>
      </div>
    `;
    refreshIcons();
    return;
  }

  elements.activeSavings.innerHTML = activeSavings
    .map((item) => {
      const percentage = Math.round(
        calcProgressRaw(item.current_amount, item.target_amount)
      );
      const visualProgress = calcProgress(
        item.current_amount,
        item.target_amount
      );

      return `
        <div class="active-saving-item">
          <div class="active-saving-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${percentage}%</span>
          </div>
          <div class="progress">
            <div class="progress-bar" style="--progress: ${visualProgress}%"></div>
          </div>
          <div class="active-saving-meta">
            <span>${formatCurrency(item.current_amount)} / ${formatCurrency(
              item.target_amount
            )}</span>
            <span>${item.target_date ? formatDate(item.target_date) : 'Tanpa tenggat'}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderRecent(recent) {
  if (!elements.recent) {
    return;
  }

  if (!recent || recent.length === 0) {
    elements.recent.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">${icon('history')}</span>
        <h3>Belum ada transaksi</h3>
        <p>Transaksi utang, piutang, dan tabungan akan muncul di sini setelah dicatat.</p>
        <a class="btn btn-primary empty-state-action" href="history.html">Lihat Riwayat</a>
      </div>
    `;
    refreshIcons();
    return;
  }

  elements.recent.innerHTML = `
    <div class="table-wrap">
      <table class="data-table table-stack recent-table">
        <thead>
          <tr>
            <th scope="col">Transaksi</th>
            <th scope="col">Kategori</th>
            <th scope="col">Tanggal</th>
            <th scope="col" class="text-right">Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(renderRecentRow).join('')}
        </tbody>
      </table>
    </div>
  `;

  refreshIcons();
}

function renderRecentRow(transaction) {
  const meta = getCategoryMeta(transaction.category);

  return `
    <tr>
      <td data-label="Transaksi">
        <div class="recent-category">
          <span class="recent-category-icon">${icon(meta.icon)}</span>
          <span>
            <strong>${escapeHtml(transaction.title)}</strong>
            <small>${escapeHtml(transaction.description || meta.label)}</small>
          </span>
        </div>
      </td>
      <td data-label="Kategori">
        <span class="${meta.badgeClass}">${escapeHtml(meta.label)}</span>
      </td>
      <td data-label="Tanggal">${formatDate(transaction.transaction_date)}</td>
      <td data-label="Nominal" class="text-right ${meta.amountClass}">
        ${formatSignedCurrency(transaction.amount, transaction.direction)}
      </td>
    </tr>
  `;
}

function renderLoadError(message) {
  renderSummaryCards(elements.summary, [
    {
      label: 'Total Utang',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'wallet',
      tone: 'danger'
    },
    {
      label: 'Total Piutang',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'hand-coins',
      tone: 'info'
    },
    {
      label: 'Total Tabungan',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'piggy-bank',
      tone: 'primary'
    },
    {
      label: 'Target Tabungan',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'target',
      tone: 'lavender'
    }
  ]);
  const chartWrapper = document.querySelector('.chart-card .chart-wrap');

  if (chartWrapper) {
    chartWrapper.innerHTML = `
      <div class="chart-empty">
        ${icon('cloud-off')}
        <span>Grafik tidak dapat dimuat.</span>
      </div>
    `;
  }

  elements.comparison.innerHTML = `
    <div class="inline-empty">Data perbandingan tidak dapat dimuat.</div>
  `;
  elements.activeSavings.innerHTML = `
    <div class="inline-empty">Data target tabungan tidak dapat dimuat.</div>
  `;
  elements.recent.innerHTML = errorState({ message });

  document
    .querySelector('#dashboard-recent .state-retry')
    ?.addEventListener('click', () => {
      renderLoadingState();
      loadData();
    });

  showToast(message, 'error');
}
