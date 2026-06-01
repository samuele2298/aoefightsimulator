export function createResourceChart(canvas) {
  const SIM_SECONDS_PER_TICK = 0.1;

  function formatTickLabel(tick) {
    if (tick === null || tick === undefined || Number.isNaN(Number(tick))) {
      return 'n.d.';
    }

    return `${(Number(tick) * SIM_SECONDS_PER_TICK).toFixed(1)} s`;
  }

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Team A Resources',
          data: [],
          borderColor: '#4aa3ff',
          backgroundColor: 'rgba(74, 163, 255, 0.2)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
        },
        {
          label: 'Team B Resources',
          data: [],
          borderColor: '#ff6b5d',
          backgroundColor: 'rgba(255, 107, 93, 0.2)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time (s)',
            color: '#f1ebde',
          },
          ticks: { color: '#cabfa8', maxTicksLimit: 10 },
          grid: { color: 'rgba(200, 168, 75, 0.2)' },
        },
        y: {
          ticks: { color: '#cabfa8' },
          grid: { color: 'rgba(200, 168, 75, 0.2)' },
        },
      },
      plugins: {
        legend: {
          labels: { color: '#f1ebde' },
        },
      },
    },
  });

  function reset() {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update('none');
  }

  function pushPoint(tick, resources) {
    chart.data.labels.push(formatTickLabel(tick));
    chart.data.datasets[0].data.push(resources.A || 0);
    chart.data.datasets[1].data.push(resources.B || 0);

    if (chart.data.labels.length > 300) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
      chart.data.datasets[1].data.shift();
    }

    chart.update('none');
  }

  function renderPlayback(snapshots, upToIndex) {
    const safeSnapshots = Array.isArray(snapshots) ? snapshots.slice(0, upToIndex + 1) : [];
    chart.data.labels = safeSnapshots.map((snapshot) => formatTickLabel(snapshot.tick || 0));
    chart.data.datasets[0].data = safeSnapshots.map((snapshot) => snapshot.resources && snapshot.resources.A ? snapshot.resources.A : 0);
    chart.data.datasets[1].data = safeSnapshots.map((snapshot) => snapshot.resources && snapshot.resources.B ? snapshot.resources.B : 0);
    chart.update('none');
  }

  return {
    reset,
    pushPoint,
    renderPlayback,
  };
}
