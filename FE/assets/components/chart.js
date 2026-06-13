const chartStore = new Map();

export function destroyChart(id) {
  const existing = chartStore.get(id);
  if (existing) {
    existing.destroy();
    chartStore.delete(id);
  }
}

export function renderBarChart({ id, labels, values, label }) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;

  destroyChart(id);
  const ctx = canvas.getContext("2d");

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, "rgba(13, 148, 136, 0.95)");
  gradient.addColorStop(1, "rgba(20, 184, 166, 0.55)");

  const textColor = window.getComputedStyle(document.body).getPropertyValue('--muted') || "#94a3b8";
  const gridColor = window.getComputedStyle(document.body).getPropertyValue('--border-light') || "rgba(255,255,255,0.05)";

  const chart = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        borderRadius: 8,
        backgroundColor: gradient,
        hoverBackgroundColor: "rgba(13, 148, 136, 1)",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: 600 } } },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#f1f5f9",
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' }
        }
      },
      scales: {
        x: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } }, grid: { color: gridColor }, border: { dash: [4, 4] } },
      },
    },
  });

  chartStore.set(id, chart);
}
