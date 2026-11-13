import { formatCurrency, parseDate } from '../utils.js';
import { icon, refreshIcons } from '../icons.js';

const chartInstances = new WeakMap();
const chartRenderers = new Map();
const compactCurrency = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1
});

function hasChartLibrary() {
  return typeof window !== 'undefined' && typeof window.Chart === 'function';
}

function formatCompact(value) {
  return `Rp${compactCurrency.format(Number(value) || 0)}`;
}

function readToken(name, fallback) {
  if (typeof document === 'undefined') {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

function chartColors() {
  return {
    text: readToken('--chart-text', '#817B91'),
    grid: readToken('--chart-grid', 'rgba(236, 232, 243, 0.8)'),
    tooltipBg: readToken('--chart-tooltip-bg', '#25213A'),
    tooltipText: readToken('--chart-tooltip-text', '#ffffff'),
    line: readToken('--chart-line', '#7C3AED'),
    area: readToken('--chart-area', 'rgba(124, 58, 237, 0.22)'),
    areaSoft: readToken('--chart-area-soft', 'rgba(124, 58, 237, 0.1)'),
    areaFade: readToken('--chart-area-fade', 'rgba(124, 58, 237, 0)'),
    pointBg: readToken('--chart-point-bg', '#ffffff'),
    danger: readToken('--chart-danger', '#EF4444'),
    dangerHover: readToken('--chart-danger-hover', '#DC2626'),
    info: readToken('--chart-info', '#3B82F6'),
    infoHover: readToken('--chart-info-hover', '#2563EB'),
    doughnutBorder: readToken('--chart-doughnut-border', '#ffffff')
  };
}

function destroyChart(canvas) {
  const existing = chartInstances.get(canvas);

  if (existing) {
    existing.destroy();
    chartInstances.delete(canvas);
  }
}

function clearEmptyState(canvas) {
  const wrapper = canvas.closest('.chart-wrap, .detail-chart-wrap');
  wrapper?.querySelector('.chart-empty')?.remove();
  canvas.hidden = false;
}

function showEmptyState(canvas, message) {
  const wrapper = canvas.closest('.chart-wrap, .detail-chart-wrap');

  if (!wrapper) {
    return;
  }

  canvas.hidden = true;
  wrapper.querySelector('.chart-empty')?.remove();

  const empty = document.createElement('div');
  empty.className = 'chart-empty';
  empty.innerHTML = `${icon('chart-no-axes-combined')}<span>${message}</span>`;
  wrapper.appendChild(empty);
  refreshIcons();
}

function applyChartDefaults() {
  if (!hasChartLibrary()) {
    return;
  }

  if (!applyChartDefaults.done) {
    applyChartDefaults.done = true;
    window.Chart.defaults.font.family =
      '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
    window.Chart.defaults.font.size = 11;
  }

  window.Chart.defaults.color = chartColors().text;
}

function baseOptions(extra = {}) {
  const colors = chartColors();
  const { scales: extraScales, ...rest } = extra;
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    devicePixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2),
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.tooltipText,
        bodyColor: colors.tooltipText,
        padding: 11,
        cornerRadius: 9,
        titleFont: { size: 11, weight: '600' },
        bodyFont: { size: 11 },
        displayColors: false,
        callbacks: {
          label: (context) => formatCurrency(context.parsed.y)
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        ...extraScales?.x
      },
      y: {
        beginAtZero: true,
        grid: { color: colors.grid },
        border: { display: false },
        ticks: {
          maxTicksLimit: 5,
          callback: (value) => formatCompact(value)
        },
        ...extraScales?.y
      }
    },
    ...rest
  };

  return options;
}

function trackRenderer(canvas, render) {
  chartRenderers.set(canvas, render);
}

export function renderSavingsChart(canvas, series) {
  if (!canvas) {
    return;
  }

  trackRenderer(canvas, () => renderSavingsChart(canvas, series));
  destroyChart(canvas);

  if (!hasChartLibrary() || !series?.hasTransactions) {
    showEmptyState(
      canvas,
      !hasChartLibrary()
        ? 'Library grafik tidak dapat dimuat. Periksa koneksi internet.'
        : 'Grafik akan muncul setelah ada setoran atau penarikan tabungan.'
    );
    return;
  }

  applyChartDefaults();
  clearEmptyState(canvas);
  const colors = chartColors();
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, colors.area);
  gradient.addColorStop(1, colors.areaFade);

  const chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [
        {
          data: series.values,
          borderColor: colors.line,
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: colors.pointBg,
          pointBorderColor: colors.line,
          pointBorderWidth: 2,
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: baseOptions()
  });

  chartInstances.set(canvas, chart);
}

export function renderComparisonChart(canvas, comparison) {
  if (!canvas) {
    return;
  }

  trackRenderer(canvas, () => renderComparisonChart(canvas, comparison));
  destroyChart(canvas);

  const debt = Number(comparison?.debt) || 0;
  const receivable = Number(comparison?.receivable) || 0;

  if (!hasChartLibrary() || (debt <= 0 && receivable <= 0)) {
    showEmptyState(
      canvas,
      !hasChartLibrary()
        ? 'Library grafik tidak dapat dimuat.'
        : 'Belum ada utang atau piutang untuk dibandingkan.'
    );
    return;
  }

  applyChartDefaults();
  clearEmptyState(canvas);
  const colors = chartColors();

  const chart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Sisa utang', 'Sisa piutang'],
      datasets: [
        {
          data: [debt, receivable],
          backgroundColor: [colors.danger, colors.info],
          hoverBackgroundColor: [colors.dangerHover, colors.infoHover],
          borderWidth: 3,
          borderColor: colors.doughnutBorder,
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      devicePixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2),
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          padding: 11,
          cornerRadius: 9,
          displayColors: false,
          callbacks: {
            label: (context) =>
              `${context.label}: ${formatCurrency(context.parsed)}`
          }
        }
      }
    }
  });

  chartInstances.set(canvas, chart);
}

export function renderSavingsDetailChart(canvas, transactions) {
  if (!canvas) {
    return;
  }

  trackRenderer(canvas, () => renderSavingsDetailChart(canvas, transactions));
  destroyChart(canvas);

  const sorted = (transactions || [])
    .map((transaction) => ({
      ...transaction,
      parsedDate: parseDate(transaction.transaction_date)
    }))
    .filter((transaction) => transaction.parsedDate)
    .sort((first, second) => first.parsedDate - second.parsedDate);

  if (!hasChartLibrary() || sorted.length === 0) {
    showEmptyState(
      canvas,
      !hasChartLibrary()
        ? 'Library grafik tidak dapat dimuat.'
        : 'Belum ada transaksi untuk digambarkan.'
    );
    return;
  }

  let running = 0;
  const labels = [];
  const values = [];

  sorted.forEach((transaction) => {
    running +=
      transaction.type === 'deposit'
        ? Number(transaction.amount)
        : -Number(transaction.amount);
    labels.push(
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short'
      }).format(transaction.parsedDate)
    );
    values.push(running);
  });

  applyChartDefaults();
  clearEmptyState(canvas);
  const colors = chartColors();

  const chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: colors.line,
          backgroundColor: colors.areaSoft,
          borderWidth: 2,
          pointRadius: 2.5,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: baseOptions({
      scales: {
        x: { ticks: { maxRotation: 0, maxTicksLimit: 6 } },
        y: { ticks: { maxTicksLimit: 4 } }
      }
    })
  });

  chartInstances.set(canvas, chart);
}

function refreshChartsForTheme() {
  if (!hasChartLibrary()) {
    return;
  }

  applyChartDefaults();

  Array.from(chartRenderers.entries()).forEach(([canvas, render]) => {
    if (!canvas.isConnected) {
      chartRenderers.delete(canvas);
      return;
    }

    render();
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('finora:themechange', refreshChartsForTheme);
}

export function destroyAllCharts() {
  Array.from(chartRenderers.keys()).forEach((canvas) => {
    destroyChart(canvas);
  });
  chartRenderers.clear();
}
