import { formatCurrency, parseDate } from '../utils.js';
import { icon, refreshIcons } from '../icons.js';

const chartInstances = new WeakMap();
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
  if (!hasChartLibrary() || applyChartDefaults.done) {
    return;
  }

  applyChartDefaults.done = true;
  window.Chart.defaults.font.family =
    '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
  window.Chart.defaults.font.size = 11;
  window.Chart.defaults.color = '#817B91';
}

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#25213A',
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
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(236, 232, 243, 0.8)' },
        border: { display: false },
        ticks: {
          maxTicksLimit: 5,
          callback: (value) => formatCompact(value)
        }
      }
    },
    ...extra
  };
}

export function renderSavingsChart(canvas, series) {
  if (!canvas) {
    return;
  }

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
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(124, 58, 237, 0.22)');
  gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');

  const chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [
        {
          data: series.values,
          borderColor: '#7C3AED',
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#7C3AED',
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

  const chart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Sisa utang', 'Sisa piutang'],
      datasets: [
        {
          data: [debt, receivable],
          backgroundColor: ['#EF4444', '#3B82F6'],
          hoverBackgroundColor: ['#DC2626', '#2563EB'],
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#25213A',
          padding: 11,
          cornerRadius: 9,
          displayColors: false,
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`
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

  const chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          borderWidth: 2,
          pointRadius: 2.5,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: baseOptions({
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { maxRotation: 0, maxTicksLimit: 6 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(236, 232, 243, 0.8)' },
          border: { display: false },
          ticks: {
            maxTicksLimit: 4,
            callback: (value) => formatCompact(value)
          }
        }
      }
    })
  });

  chartInstances.set(canvas, chart);
}

export function destroyAllCharts() {
  // Chart instances are released when their canvas leaves the DOM.
  // Explicit destruction happens per canvas before re-render.
}
