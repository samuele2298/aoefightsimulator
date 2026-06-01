import { initUi } from './ui.js';
import { createResourceChart } from './charts.js';
import { createBattlefieldRenderer } from './battlefield2d.js';

const SIM_SECONDS_PER_TICK = 0.1;
const INITIAL_BATTLEFIELD_ZOOM = 2.5;
const DEFAULT_PLAYBACK_SPEED = 0.5;

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

function stdDev(values) {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'n/a';
  }
  return Number(value).toFixed(digits);
}

function fmtPct(value) {
  return `${fmtNumber(value, 1)}%`;
}

function formatSimSeconds(ticks) {
  if (ticks === null || ticks === undefined || Number.isNaN(Number(ticks))) {
    return 'n/a';
  }

  return `${fmtNumber(Number(ticks) * SIM_SECONDS_PER_TICK, 1)} s`;
}

function buildResultDisplay(resultPayload) {
  if (!resultPayload || typeof resultPayload !== 'object') {
    return resultPayload;
  }

  const display = { ...resultPayload };
  if (typeof display.tick === 'number') {
    display.timeSeconds = Number((display.tick * SIM_SECONDS_PER_TICK).toFixed(1));
    delete display.tick;
  }

  return display;
}

function countAlive(units, team) {
  return units.filter((unit) => unit.team === team && unit.hp > 0).length;
}

function byUnitType(units, team, aliveOnly = false) {
  const map = new Map();
  for (const unit of units) {
    if (unit.team !== team) {
      continue;
    }
    if (aliveOnly && unit.hp <= 0) {
      continue;
    }
    const key = unit.unitId || unit.name || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function sumResourceValue(units, team, aliveOnly = false) {
  return units
    .filter((unit) => unit.team === team && (!aliveOnly || unit.hp > 0))
    .reduce((sum, unit) => sum + (unit.resourceValue || 0), 0);
}

function findFirstContactTick(snapshots) {
  for (const snapshot of snapshots) {
    const hasAttack = (snapshot.units || []).some((unit) => unit.state === 'ATTACKING');
    if (hasAttack) {
      return snapshot.tick || 0;
    }
  }
  return null;
}

function computeTeamTempoStats(snapshots, team) {
  let movingAlive = 0;
  let totalAlive = 0;
  let rangedAttacking = 0;
  let rangedAlive = 0;

  for (const snapshot of snapshots) {
    const alive = (snapshot.units || []).filter((unit) => unit.team === team && unit.hp > 0);
    totalAlive += alive.length;
    movingAlive += alive.filter((unit) => unit.state === 'MOVING').length;

    const ranged = alive.filter((unit) => unit.isRanged);
    rangedAlive += ranged.length;
    rangedAttacking += ranged.filter((unit) => unit.state === 'ATTACKING').length;
  }

  return {
    pathingFrictionPct: totalAlive > 0 ? (movingAlive / totalAlive) * 100 : 0,
    rangedUptimePct: rangedAlive > 0 ? (rangedAttacking / rangedAlive) * 100 : 0,
  };
}

function computeFrontlineBreakTick(snapshots, team) {
  if (!snapshots.length) {
    return null;
  }

  const initialMelee = (snapshots[0].units || []).filter(
    (unit) => unit.team === team && unit.hp > 0 && !unit.isRanged
  ).length;

  if (!initialMelee) {
    return null;
  }

  const threshold = initialMelee * 0.5;
  for (const snapshot of snapshots) {
    const aliveMelee = (snapshot.units || []).filter(
      (unit) => unit.team === team && unit.hp > 0 && !unit.isRanged
    ).length;
    if (aliveMelee <= threshold) {
      return snapshot.tick || 0;
    }
  }

  return null;
}

function computeFormationSpread(snapshot, team) {
  const alive = (snapshot.units || []).filter((unit) => unit.team === team && unit.hp > 0);
  if (!alive.length) {
    return { width: 0, depth: 0 };
  }
  const xs = alive.map((unit) => unit.x);
  const ys = alive.map((unit) => unit.y);
  return {
    width: Math.max(...ys) - Math.min(...ys),
    depth: Math.max(...xs) - Math.min(...xs),
  };
}

function renderAnalyticsCards(cards) {
  return cards
    .map((card) => {
      const rows = card.rows
        .map(
          (row) => `<li class="analytics-item"><span class="analytics-key">${row.key}</span><span class="analytics-value">${row.value}</span></li>`
        )
        .join('');

      return `<section class="analytics-card"><h3>${card.title}</h3><ul class="analytics-list">${rows}</ul>${card.note ? `<div class="analytics-note">${card.note}</div>` : ''}</section>`;
    })
    .join('');
}

function buildAnalyticsModel({ snapshots, result, config, obstacles, batchStats }) {
  if (!snapshots.length) {
    return [];
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const initialA = first.resources && typeof first.resources.A === 'number' ? first.resources.A : sumResourceValue(first.units || [], 'A');
  const initialB = first.resources && typeof first.resources.B === 'number' ? first.resources.B : sumResourceValue(first.units || [], 'B');
  const finalA = last.resources && typeof last.resources.A === 'number' ? last.resources.A : sumResourceValue(last.units || [], 'A', true);
  const finalB = last.resources && typeof last.resources.B === 'number' ? last.resources.B : sumResourceValue(last.units || [], 'B', true);

  const lossA = Math.max(0, initialA - finalA);
  const lossB = Math.max(0, initialB - finalB);
  const damageEfficiencyA = initialA > 0 ? ((initialB - finalB) / initialA) * 100 : 0;
  const damageEfficiencyB = initialB > 0 ? ((initialA - finalA) / initialB) * 100 : 0;

  const contactTick = findFirstContactTick(snapshots);
  const tempoA = computeTeamTempoStats(snapshots, 'A');
  const tempoB = computeTeamTempoStats(snapshots, 'B');
  const breakA = computeFrontlineBreakTick(snapshots, 'A');
  const breakB = computeFrontlineBreakTick(snapshots, 'B');
  const spreadA = computeFormationSpread(first, 'A');
  const spreadB = computeFormationSpread(first, 'B');

  const initialTypesA = byUnitType(first.units || [], 'A');
  const initialTypesB = byUnitType(first.units || [], 'B');
  const finalTypesA = byUnitType(last.units || [], 'A', true);
  const finalTypesB = byUnitType(last.units || [], 'B', true);
  const lossesByTypeA = [...initialTypesA.entries()]
    .map(([unitId, count]) => ({ unitId, losses: count - (finalTypesA.get(unitId) || 0) }))
    .filter((entry) => entry.losses > 0)
    .sort((a, b) => b.losses - a.losses)
    .slice(0, 3)
    .map((entry) => `${entry.unitId} -${entry.losses}`)
    .join(' | ') || 'n.d.';
  const lossesByTypeB = [...initialTypesB.entries()]
    .map(([unitId, count]) => ({ unitId, losses: count - (finalTypesB.get(unitId) || 0) }))
    .filter((entry) => entry.losses > 0)
    .sort((a, b) => b.losses - a.losses)
    .slice(0, 3)
    .map((entry) => `${entry.unitId} -${entry.losses}`)
    .join(' | ') || 'n.d.';

  const resourceDiffSeries = snapshots.map((snapshot) => {
    const resources = snapshot.resources || {};
    return (resources.A || 0) - (resources.B || 0);
  });
  const avgDiff = mean(resourceDiffSeries);
  const stdevDiff = stdDev(resourceDiffSeries);

  const obstacleArea = (obstacles || []).reduce((sum, obstacle) => {
    if (obstacle && typeof obstacle.radius === 'number') {
      return sum + Math.PI * obstacle.radius * obstacle.radius;
    }
    if (obstacle && typeof obstacle.size === 'number') {
      return sum + obstacle.size * obstacle.size;
    }
    return sum;
  }, 0);
  const mapArea = 120 * 72;
  const obstaclePressurePct = mapArea > 0 ? (obstacleArea / mapArea) * 100 : 0;

  const winner = result && result.winner ? result.winner : 'draw';

  const cards = [
    {
      title: 'Core KPI',
      rows: [
        { key: 'Winner', value: winner },
        { key: 'Win Rate (single run)', value: winner === 'A' ? 'A 100% | B 0%' : winner === 'B' ? 'A 0% | B 100%' : 'A 50% | B 50%' },
        { key: 'Trade Ratio A/B', value: finalB > 0 ? fmtNumber(finalA / finalB, 3) : 'inf' },
        { key: 'Resource Swing', value: fmtNumber(finalA - finalB, 2) },
        { key: 'Survivor Count', value: `A ${countAlive(last.units || [], 'A')} | B ${countAlive(last.units || [], 'B')}` },
        { key: 'Fight Duration (s)', value: formatSimSeconds(typeof result.tick === 'number' ? result.tick : last.tick || 0) },
      ],
    },
    {
      title: 'Unit & Tech Impact',
      rows: [
        { key: 'Damage / 100 res spent', value: `A ${fmtNumber(damageEfficiencyA, 1)} | B ${fmtNumber(damageEfficiencyB, 1)}` },
        { key: 'Kill Efficiency (enemy loss/own loss)', value: `A ${fmtNumber(lossA > 0 ? lossB / lossA : 0, 2)} | B ${fmtNumber(lossB > 0 ? lossA / lossB : 0, 2)}` },
        {
          key: 'Tech Count',
          value: `A ${(config.teamA && config.teamA.techs ? config.teamA.techs.length : 0) + ((config.teamA && Array.isArray(config.teamA.units)) ? config.teamA.units.reduce((sum, unit) => sum + (Array.isArray(unit.unitTechs) ? unit.unitTechs.length : 0), 0) : 0)} | B ${(config.teamB && config.teamB.techs ? config.teamB.techs.length : 0) + ((config.teamB && Array.isArray(config.teamB.units)) ? config.teamB.units.reduce((sum, unit) => sum + (Array.isArray(unit.unitTechs) ? unit.unitTechs.length : 0), 0) : 0)}`,
        },
        { key: 'Top Loss Types A', value: lossesByTypeA },
        { key: 'Top Loss Types B', value: lossesByTypeB },
      ],
      note: batchStats
        ? `Tech uplift (MC): A ${fmtNumber(batchStats.techUpliftA, 2)} | B ${fmtNumber(batchStats.techUpliftB, 2)} ; Marginal gain avg: A ${fmtNumber(batchStats.marginalA, 2)} | B ${fmtNumber(batchStats.marginalB, 2)}`
        : 'MC batch running for tech uplift / marginal gain...',
    },
    {
      title: 'Formation & Environment',
      rows: [
        { key: 'Time to First Contact', value: formatSimSeconds(contactTick) },
        { key: 'Ranged Uptime %', value: `A ${fmtPct(tempoA.rangedUptimePct)} | B ${fmtPct(tempoB.rangedUptimePct)}` },
        { key: 'Pathing Friction %', value: `A ${fmtPct(tempoA.pathingFrictionPct)} | B ${fmtPct(tempoB.pathingFrictionPct)}` },
        { key: 'Frontline Break Time', value: `A ${formatSimSeconds(breakA)} | B ${formatSimSeconds(breakB)}` },
        { key: 'Formation Spread W/D', value: `A ${fmtNumber(spreadA.width, 2)}/${fmtNumber(spreadA.depth, 2)} | B ${fmtNumber(spreadB.width, 2)}/${fmtNumber(spreadB.depth, 2)}` },
        { key: 'Obstacle Pressure', value: `${(obstacles || []).length} obs | ${fmtPct(obstaclePressurePct)}` },
      ],
      note: batchStats
        ? `Map sensitivity (MC win delta): ${fmtNumber(batchStats.mapSensitivity, 2)} | Formation delta: ${fmtNumber(batchStats.formationDelta, 2)}`
        : 'Map sensitivity and formation delta will be updated by the statistical batch.',
    },
    {
      title: 'Statistical View',
      rows: [
        { key: 'Resource Diff Mean', value: fmtNumber(avgDiff, 2) },
        { key: 'Resource Diff Median', value: fmtNumber(median(resourceDiffSeries), 2) },
        { key: 'Resource Diff P10/P90', value: `${fmtNumber(percentile(resourceDiffSeries, 10), 2)} / ${fmtNumber(percentile(resourceDiffSeries, 90), 2)}` },
        { key: 'Volatility (StdDev)', value: fmtNumber(stdevDiff, 2) },
        { key: '95% CI (single run)', value: 'requires MC batch' },
        { key: 'Effect Size proxy', value: fmtNumber(stdevDiff > 0 ? avgDiff / stdevDiff : 0, 2) },
      ],
      note: batchStats
        ? `Monte Carlo ${batchStats.runs} run | win A ${fmtPct(batchStats.winRateA)} | win B ${fmtPct(100 - batchStats.winRateA)} | CI95 +/- ${fmtNumber(batchStats.ci95, 2)}`
        : 'CI and robustness are computed in the Monte Carlo batch.',
    },
  ];

  return cards;
}

function renderAnalytics(root, cards) {
  if (!root) {
    return;
  }
  root.innerHTML = cards.length
    ? renderAnalyticsCards(cards)
    : '<div class="analytics-empty">Start a simulation to see the full panel.</div>';
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function openWs(onMessage, onStatus) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

  ws.addEventListener('open', () => onStatus('WebSocket connected'));
  ws.addEventListener('close', () => onStatus('WebSocket disconnected'));
  ws.addEventListener('error', () => onStatus('WebSocket error'));
  ws.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (_err) {
      // Ignore malformed message.
    }
  });

  return ws;
}

function createReplayController({ battlefield, chart, ui, setPlaybackButtonState }) {
  const replay = {
    snapshots: [],
    speed: DEFAULT_PLAYBACK_SPEED,
    currentIndex: 0,
    playing: false,
    recording: false,
    rafId: null,
    lastFrameTime: 0,
  };

  function renderSnapshot(index) {
    const snapshot = replay.snapshots[index];
    if (!snapshot) {
      return;
    }

    replay.currentIndex = index;
    battlefield.setUnits(snapshot.units || []);
    chart.renderPlayback(replay.snapshots, index);
    ui.setPlaybackInfo(
      `Frame ${index + 1}/${replay.snapshots.length} | Time ${formatSimSeconds(snapshot.tick || 0)} | Speed x${replay.speed}`
    );
  }

  function stopLoop() {
    replay.playing = false;
    setPlaybackButtonState(false);
    if (replay.rafId) {
      cancelAnimationFrame(replay.rafId);
      replay.rafId = null;
    }
  }

  function loop(timestamp) {
    if (!replay.playing) {
      return;
    }

    if (!replay.lastFrameTime) {
      replay.lastFrameTime = timestamp;
    }

    const frameMs = 120 / replay.speed;
    if (timestamp - replay.lastFrameTime >= frameMs) {
      const steps = Math.max(1, Math.floor((timestamp - replay.lastFrameTime) / frameMs));
      const nextIndex = Math.min(replay.snapshots.length - 1, replay.currentIndex + steps);
      replay.lastFrameTime = timestamp;
      renderSnapshot(nextIndex);

      if (nextIndex >= replay.snapshots.length - 1) {
        stopLoop();
        ui.setPlaybackInfo(`Replay complete | ${replay.snapshots.length} frames`);
        return;
      }
    }

    replay.rafId = requestAnimationFrame(loop);
  }

  return {
    startRecording() {
      stopLoop();
      replay.snapshots = [];
      replay.currentIndex = 0;
      replay.lastFrameTime = 0;
      replay.recording = true;
      chart.reset();
      ui.setPlaybackInfo('Downloading simulation into RAM...');
    },
    pushSnapshot(snapshot) {
      replay.snapshots.push(snapshot);
      if (replay.recording) {
        const n = replay.snapshots.length;
        if (n % 20 === 0 || n <= 3) {
          ui.setPlaybackInfo(`Download RAM | frame ${n} | time ${formatSimSeconds(snapshot.tick || 0)}`);
        }
      }
    },
    finishRecording({ autoPlay = true } = {}) {
      replay.recording = false;
      stopLoop();
      if (replay.snapshots.length > 0) {
        renderSnapshot(0);
      }
      replay.speed = DEFAULT_PLAYBACK_SPEED;
      ui.setPlaybackInfo(`Preloaded in RAM: ${replay.snapshots.length} frames.`);
      if (autoPlay && replay.snapshots.length > 0) {
        replay.playing = true;
        setPlaybackButtonState(true);
        replay.lastFrameTime = 0;
        replay.rafId = requestAnimationFrame(loop);
        ui.setPlaybackInfo(`Replay auto-started at x${DEFAULT_PLAYBACK_SPEED}`);
      }
    },
    togglePlay() {
      if (replay.recording || replay.snapshots.length === 0) {
        return;
      }

      if (replay.playing) {
        stopLoop();
        ui.setPlaybackInfo(`Replay paused | frame ${replay.currentIndex + 1}/${replay.snapshots.length}`);
        return;
      }

      if (replay.currentIndex >= replay.snapshots.length - 1) {
        replay.currentIndex = 0;
        renderSnapshot(0);
      }

      replay.playing = true;
      setPlaybackButtonState(true);
      replay.lastFrameTime = 0;
      replay.rafId = requestAnimationFrame(loop);
      ui.setPlaybackInfo(`Replay playing | Speed x${replay.speed}`);
    },
    restart() {
      if (!replay.snapshots.length) {
        return;
      }
      stopLoop();
      renderSnapshot(0);
      ui.setPlaybackInfo('Replay reset to start');
    },
    setSpeed(speed) {
      replay.speed = speed;
      ui.setPlaybackInfo(
        replay.recording
          ? `Live recording | replay speed set to x${speed}`
          : `Replay ready | speed x${speed}`
      );
    },
    getSnapshots() {
      return replay.snapshots;
    },
  };
}

async function main() {
  const ui = await initUi();
  const chart = createResourceChart(document.getElementById('resource-chart'));
  const battlefield = createBattlefieldRenderer(document.getElementById('battlefield'));
  const playbackToggleButton = ui.getPlaybackToggleButton();
  const zoomSlider = ui.getZoomSlider();
  const environmentSeedInput = ui.getEnvironmentSeedInput();
  const advancedAnalyticsRoot = document.getElementById('advanced-analytics');
  let activeConfig = null;
  let activeObstacles = [];
  let batchStats = null;

  async function computeBatchStats(baseConfig) {
    const runs = 30;
    const baseline = await postJson('/api/simulation/monte-carlo', { ...baseConfig, runs });
    const noTechAConfig = {
      ...baseConfig,
      teamA: { ...baseConfig.teamA, techs: [] },
    };
    const noTechBConfig = {
      ...baseConfig,
      teamB: { ...baseConfig.teamB, techs: [] },
    };
    const normalFormationConfig = {
      ...baseConfig,
      teamA: { ...baseConfig.teamA, formation: 'normal' },
      teamB: { ...baseConfig.teamB, formation: 'normal' },
    };
    const openMapConfig = {
      ...baseConfig,
      environment: 'dry-arabia',
    };

    const [noTechA, noTechB, normalFormation, openMap] = await Promise.all([
      postJson('/api/simulation/monte-carlo', { ...noTechAConfig, runs }),
      postJson('/api/simulation/monte-carlo', { ...noTechBConfig, runs }),
      postJson('/api/simulation/monte-carlo', { ...normalFormationConfig, runs }),
      postJson('/api/simulation/monte-carlo', { ...openMapConfig, runs }),
    ]);

    const p = baseline.winRateA / 100;
    const ci95 = 1.96 * Math.sqrt((p * (1 - p)) / runs) * 100;

    return {
      runs,
      winRateA: baseline.winRateA,
      ci95,
      techUpliftA: baseline.avgTradeRatio - noTechA.avgTradeRatio,
      techUpliftB: (1 / baseline.avgTradeRatio) - (1 / noTechB.avgTradeRatio),
      marginalA: baseline.winRateA - noTechA.winRateA,
      marginalB: (100 - baseline.winRateA) - (100 - noTechB.winRateA),
      formationDelta: baseline.avgTradeRatio - normalFormation.avgTradeRatio,
      mapSensitivity: baseline.avgTradeRatio - openMap.avgTradeRatio,
    };
  }

  function updateAnalytics(resultPayload) {
    const cards = buildAnalyticsModel({
      snapshots: replay.getSnapshots(),
      result: resultPayload || {},
      config: activeConfig || { teamA: {}, teamB: {} },
      obstacles: activeObstacles,
      batchStats,
    });
    renderAnalytics(advancedAnalyticsRoot, cards);
  }

  battlefield.start();
  battlefield.setZoom(INITIAL_BATTLEFIELD_ZOOM);
  battlefield.setTeamMeta(ui.getTeamsMeta());

  function activateSpeedButton(speed) {
    for (const current of ui.getSpeedButtons()) {
      current.classList.toggle('is-active', Number(current.dataset.speed || DEFAULT_PLAYBACK_SPEED) === speed);
    }
  }

  function setPlaybackButtonState(isPlaying) {
    playbackToggleButton.textContent = isPlaying ? '❚❚' : '▶';
    playbackToggleButton.title = isPlaying ? 'Pause' : 'Play';
    playbackToggleButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }

  const replay = createReplayController({
    battlefield,
    chart,
    ui,
    setPlaybackButtonState,
  });

  const ws = openWs(handleWsMessage, ui.setStatus);

  async function refreshEnvironmentPreview() {
    try {
      const environment = ui.getEnvironmentSelect().value;
      const seed = environmentSeedInput ? (environmentSeedInput.value || 'default') : 'default';
      const preview = await getJson(
        `/api/simulation/environment-preview?environment=${encodeURIComponent(environment)}&seed=${encodeURIComponent(seed)}`
      );
      battlefield.setMapSize(preview.mapSize || { width: 120, height: 72 });
      battlefield.setObstacles(preview.obstacles || []);
      if (!preview.obstacles || preview.obstacles.length === 0) {
        ui.setPlaybackInfo('No obstacles in the selected preset');
      } else {
        ui.setPlaybackInfo(`Environment preview: ${preview.environment} | obstacles: ${preview.obstacles.length} | seed: ${preview.seed}`);
      }
    } catch (error) {
      ui.setPlaybackInfo(`Environment preview failed: ${error.message}`);
    }
  }

  let previewDebounce = null;
  function queuePreviewRefresh() {
    if (previewDebounce) {
      clearTimeout(previewDebounce);
    }
    previewDebounce = setTimeout(refreshEnvironmentPreview, 220);
  }

  function handleWsMessage(message) {
    if (!message || !message.type) {
      return;
    }

    if (message.type === 'ws:ready') {
      ui.setStatus('Ready');
      return;
    }

    if (message.type === 'sim:start') {
      replay.startRecording();
      battlefield.reset();
      battlefield.setTeamMeta(ui.getTeamsMeta());
      battlefield.setMapSize(message.payload.mapSize || { width: 120, height: 72 });
      activeObstacles = message.payload.obstacles || [];
      battlefield.setObstacles(activeObstacles);
      activeConfig = message.payload.config || activeConfig;
      batchStats = null;
      renderAnalytics(advancedAnalyticsRoot, []);
      replay.setSpeed(DEFAULT_PLAYBACK_SPEED);
      activateSpeedButton(DEFAULT_PLAYBACK_SPEED);
      ui.setResult('Simulation in progress: frames are being saved in RAM...');
      ui.setStatus('Simulation started');
      return;
    }

    if (message.type === 'sim:tick') {
      const payload = message.payload || {};
      replay.pushSnapshot(payload);
      ui.setStatus(`Time ${formatSimSeconds(payload.tick || 0)}`);
      return;
    }

    if (message.type === 'sim:end') {
      replay.finishRecording({ autoPlay: true });
      activateSpeedButton(DEFAULT_PLAYBACK_SPEED);
      ui.setResult(buildResultDisplay(message.payload || {}));
      updateAnalytics(message.payload || {});
      ui.setStatus('Simulation ended');

      if (activeConfig) {
        ui.setPlaybackInfo('Computing advanced statistical batch...');
        computeBatchStats(activeConfig)
          .then((stats) => {
            batchStats = stats;
            updateAnalytics(message.payload || {});
            ui.setPlaybackInfo(`Statistical batch ready (${stats.runs} baseline runs)`);
          })
          .catch((error) => {
            ui.setPlaybackInfo(`Statistical batch failed: ${error.message}`);
          });
      }
      return;
    }

    if (message.type === 'sim:error') {
      ui.setStatus(
        `Simulation error: ${message.payload && message.payload.message ? message.payload.message : 'unknown'}`
      );
    }
  }

  ui.getStartButton().addEventListener('click', async () => {
    try {
      setPlaybackButtonState(false);
      const config = ui.readConfig();
      activeConfig = config;
      ui.setStatus('Starting simulation...');
      await postJson('/api/simulation/start', config);
    } catch (error) {
      ui.setStatus(`Start failed: ${error.message}`);
    }
  });

  ui.getPlaybackToggleButton().addEventListener('click', () => {
    replay.togglePlay();
  });

  ui.getReplayResetButton().addEventListener('click', () => {
    replay.restart();
    setPlaybackButtonState(false);
  });

  for (const button of ui.getSpeedButtons()) {
    button.addEventListener('click', () => {
      const selected = Number(button.dataset.speed || DEFAULT_PLAYBACK_SPEED);
      activateSpeedButton(selected);
      replay.setSpeed(selected);
    });
  }

  if (zoomSlider) {
    zoomSlider.addEventListener('input', (event) => {
      battlefield.setZoom(event.target.value);
    });
  }

  ui.getZoomInButton().addEventListener('click', () => {
    const next = Math.min(7.5, battlefield.getZoom() + 0.1);
    battlefield.setZoom(next);
    if (zoomSlider) {
      zoomSlider.value = String(next);
    }
  });

  ui.getZoomOutButton().addEventListener('click', () => {
    const next = Math.max(0.6, battlefield.getZoom() - 0.08);
    battlefield.setZoom(next);
    if (zoomSlider) {
      zoomSlider.value = String(next);
    }
  });

  ui.getBattlefieldCanvas().addEventListener('wheel', (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const step = event.ctrlKey ? 0.04 : 0.1;
    const next = Math.max(0.6, Math.min(7.5, battlefield.getZoom() + direction * step));
    battlefield.setZoom(next);
    if (zoomSlider) {
      zoomSlider.value = String(next);
    }
  }, { passive: false });

  ui.getEnvironmentSelect().addEventListener('change', queuePreviewRefresh);
  if (environmentSeedInput) {
    environmentSeedInput.addEventListener('input', queuePreviewRefresh);
  }

  await refreshEnvironmentPreview();

  window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === 1) {
      ws.close();
    }
    battlefield.stop();
  });
}

main().catch((error) => {
  console.error(error);
});
