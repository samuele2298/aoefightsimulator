'use strict';

const config = require('../../config');
const logger = require('../../logger');
const SimUnit = require('./unit');
const SimulationEngine = require('./engine');

const { getUnitsRaw, getTechnologiesRaw } = require('../data/loader');
const {
  normalizeUnits,
  normalizeTechnologies,
  isExcludedTechnologyId,
} = require('../data/normalizer');
const { buildLinePositions } = require('./formations/line');
const { buildNormalPositions } = require('./formations/normal');
const { createObstacleEnvironment } = require('./environment/obstaclePresets');
const { applyTechTreeToUnitDef } = require('./techTree');

let currentEngine = null;
let lastResult = null;
let wsBroadcaster = null;

const SPAWN_JITTER_RADIUS = 0.25;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomSpawnJitter(radius = SPAWN_JITTER_RADIUS) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * radius;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
  };
}

function setBroadcaster(fn) {
  wsBroadcaster = fn;
}

function broadcast(type, payload) {
  if (typeof wsBroadcaster === 'function') {
    wsBroadcaster({ type, payload });
  }
}

function buildUnitPool({ civ, age }) {
  const units = normalizeUnits(getUnitsRaw(), { civ, age });
  const map = new Map();
  for (const unit of units) {
    map.set(unit.id, unit);
  }
  return map;
}

function createUnitsForTeam(team, teamConfig, mapWidth, mapHeight, defaultStartX) {
  const pool = buildUnitPool({ civ: teamConfig.civ, age: teamConfig.age });
  const requested = Array.isArray(teamConfig.units) ? teamConfig.units : [];
  const selectedTechs = (Array.isArray(teamConfig.techs) ? teamConfig.techs : [])
    .filter((techId) => !isExcludedTechnologyId(techId));
  const defaultUnitTechIds = (Array.isArray(teamConfig.unitTechs) ? teamConfig.unitTechs : [])
    .filter((techId) => !isExcludedTechnologyId(techId));
  const availableTechs = normalizeTechnologies(getTechnologiesRaw(), {
    civ: teamConfig.civ,
    age: teamConfig.age,
  });
  const unitTechsById = new Map(availableTechs.map((tech) => [tech.id, tech]));
  const techCache = new Map();

  const expandedUnits = [];
  for (const item of requested) {
    const baseDef = pool.get(item.unitId);
    const requestedMode = item && (item.attackMode === 'melee' || item.attackMode === 'ranged')
      ? item.attackMode
      : null;
    const selectedUnitTechIds = Array.isArray(item && item.unitTechs)
      ? item.unitTechs.filter((techId) => !isExcludedTechnologyId(techId))
      : defaultUnitTechIds;
    const selectedUnitTechs = selectedUnitTechIds
      .map((techId) => unitTechsById.get(techId))
      .filter(Boolean);
    const allowModeOverride = String(item.unitId || '').toLowerCase() === 'desert-raider';
    const appliedMode = allowModeOverride ? requestedMode : null;

    const cacheKey = `${item.unitId}::${selectedTechs.join('|')}::${selectedUnitTechIds.join('|')}::${appliedMode || 'default'}`;
    let def = techCache.get(cacheKey);
    if (!def && baseDef) {
      def = applyTechTreeToUnitDef(baseDef, selectedTechs, {
        civ: teamConfig.civ,
        age: teamConfig.age,
        unitTechs: selectedUnitTechs,
      });
      def.debugTechContext = {
        civ: teamConfig.civ,
        age: teamConfig.age,
        teamTechIds: [...selectedTechs],
        unitTechIds: [...selectedUnitTechIds],
        unitTechNames: selectedUnitTechs.map((tech) => tech.name || tech.id),
      };
      if (appliedMode) {
        def = {
          ...def,
          preferredWeaponType: appliedMode,
        };
      }
      techCache.set(cacheKey, def);
    }
    if (!def) {
      continue;
    }

    const chargeEnabled = item && typeof item.chargeEnabled === 'boolean'
      ? item.chargeEnabled
      : true;
    const deflectiveArmorEnabled = item && typeof item.deflectiveArmorEnabled === 'boolean'
      ? item.deflectiveArmorEnabled
      : true;
    const itemStrategy = (item && item.strategy) || { type: 'straight' };
    const count = Math.max(1, parseInt(item.count || 0, 10));
    for (let i = 0; i < count; i += 1) {
      expandedUnits.push({ def, chargeEnabled, deflectiveArmorEnabled, strategy: itemStrategy });
    }
  }

  // Default: ranged in back, melee in front.
  expandedUnits.sort((a, b) => {
    const left = a.def;
    const right = b.def;
    const aRanged = Array.isArray(left.weapons)
      ? left.weapons.some((w) => w.type === 'ranged' && w.range && w.range.max > 1)
      : false;
    const bRanged = Array.isArray(right.weapons)
      ? right.weapons.some((w) => w.type === 'ranged' && w.range && w.range.max > 1)
      : false;

    if (aRanged === bRanged) {
      return 0;
    }
    return aRanged ? -1 : 1;
  });

  const formation = teamConfig.formation === 'line' ? 'line' : 'normal';
  const positions = formation === 'line'
    ? buildLinePositions({
        team,
        count: expandedUnits.length,
        mapWidth,
        mapHeight,
        startX: defaultStartX,
      })
    : buildNormalPositions({
        team,
        count: expandedUnits.length,
        mapWidth,
        mapHeight,
        startX: defaultStartX,
      });

  return expandedUnits.map((entry, idx) => {
    const baseX = positions[idx] ? positions[idx].x : defaultStartX;
    const baseY = positions[idx] ? positions[idx].y : mapHeight / 2;
    const jitter = randomSpawnJitter();

    return new SimUnit({
      id: `${team}-${idx + 1}`,
      team,
      def: entry.def,
      chargeEnabled: entry.chargeEnabled,
      deflectiveArmorEnabled: entry.deflectiveArmorEnabled,
      strategy: entry.strategy || { type: 'straight' },
      x: clamp(baseX + jitter.dx, 0, mapWidth),
      y: clamp(baseY + jitter.dy, 0, mapHeight),
    });
  });
}

function createEnvironmentWithSeed(environmentType, seed) {
  const types = new Set([
    'dry-arabia',
    'forest-belts',
    'random-clusters',
    'mini-hideout',
    'around-landmark',
  ]);

  const type = types.has(environmentType) ? environmentType : 'dry-arabia';
  return createObstacleEnvironment(type, seed || 'default', config.mapWidth, config.mapHeight);
}

function buildSimulationFromConfig(simConfig, hooks = {}) {
  const teamA = simConfig.teamA || {};
  const teamB = simConfig.teamB || {};

  const unitsA = createUnitsForTeam('A', teamA, config.mapWidth, config.mapHeight, config.teamASpawnX);
  const unitsB = createUnitsForTeam('B', teamB, config.mapWidth, config.mapHeight, config.teamBSpawnX);

  if (!unitsA.length || !unitsB.length) {
    throw new Error('Both teams must contain at least one valid unit');
  }

  const environment = createEnvironmentWithSeed(simConfig.environment || 'forest-belts', simConfig.environmentSeed || 'default');

  return new SimulationEngine({
    unitsA,
    unitsB,
    environment,
    onTick: hooks.onTick,
    onEnd: hooks.onEnd,
  });
}

function startSimulation(simConfig) {
  if (currentEngine && (currentEngine.running || currentEngine.paused)) {
    throw new Error('Simulation already running');
  }

  logger.info(
    {
      teamA: simConfig.teamA,
      teamB: simConfig.teamB,
      environment: simConfig.environment || 'open',
    },
    'Simulation starting'
  );

  currentEngine = buildSimulationFromConfig(simConfig, {
    onTick: (snapshot) => broadcast('sim:tick', snapshot),
    onEnd: (result) => {
      lastResult = result;
      broadcast('sim:end', result);
      logger.info({ result }, 'Simulation completed');
    },
  });

  lastResult = null;
  broadcast('sim:start', {
    mapSize: { width: config.mapWidth, height: config.mapHeight },
    obstacles: currentEngine.environment && Array.isArray(currentEngine.environment.obstacles)
      ? currentEngine.environment.obstacles
      : [],
    config: simConfig,
  });
  currentEngine.run();

  return { ok: true };
}

function stopSimulation() {
  if (currentEngine) {
    currentEngine.stop();
    currentEngine = null;
  }
  return { ok: true };
}

function pauseSimulation() {
  if (!currentEngine || currentEngine.finished) {
    throw new Error('No simulation available to pause');
  }

  if (!currentEngine.pause()) {
    throw new Error('Simulation is not running');
  }

  return { ok: true, paused: true };
}

function resumeSimulation() {
  if (!currentEngine || currentEngine.finished) {
    throw new Error('No simulation available to resume');
  }

  if (!currentEngine.resume()) {
    throw new Error('Simulation is not paused');
  }

  return { ok: true, paused: false };
}

function getResult() {
  return lastResult;
}

function getState() {
  if (!currentEngine) {
    return { running: false, tick: 0 };
  }
  return {
    running: currentEngine.running,
    paused: Boolean(currentEngine.paused),
    finished: currentEngine.finished,
    tick: currentEngine.tick,
  };
}

function runSingleSimulationSync(simConfig) {
  const engine = buildSimulationFromConfig(simConfig, {});
  while (!engine.finished && engine.tick < config.maxTicks) {
    engine.step();
  }
  return engine.result;
}

function getEnvironmentPreview(environmentType, seed) {
  const env = createEnvironmentWithSeed(environmentType, seed);
  return {
    mapSize: { width: config.mapWidth, height: config.mapHeight },
    environment: env.type,
    seed: String(seed || 'default'),
    obstacles: env.obstacles,
  };
}

function runMonteCarlo(simConfig, runs) {
  const safeRuns = Math.max(2, Math.min(500, parseInt(runs || 30, 10)));

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let sumA = 0;
  let sumB = 0;
  const tradeRatios = [];
  const samples = [];

  for (let i = 0; i < safeRuns; i += 1) {
    const result = runSingleSimulationSync(simConfig);
    if (!result) {
      continue;
    }

    if (result.winner === 'A') {
      winsA += 1;
    } else if (result.winner === 'B') {
      winsB += 1;
    } else {
      draws += 1;
    }

    sumA += result.resourcesA;
    sumB += result.resourcesB;
    const ratio = result.resourcesB > 0 ? result.resourcesA / result.resourcesB : result.resourcesA > 0 ? 999 : 1;
    tradeRatios.push(Number(ratio.toFixed(3)));

    samples.push({
      run: i + 1,
      winner: result.winner,
      resourcesA: result.resourcesA,
      resourcesB: result.resourcesB,
      ratio: Number(ratio.toFixed(3)),
      tick: result.tick,
    });
  }

  return {
    runs: safeRuns,
    winsA,
    winsB,
    draws,
    winRateA: (winsA / safeRuns) * 100,
    winRateB: (winsB / safeRuns) * 100,
    drawRate: (draws / safeRuns) * 100,
    avgResourcesA: sumA / safeRuns,
    avgResourcesB: sumB / safeRuns,
    avgTradeRatio: sumB > 0 ? sumA / sumB : null,
    tradeRatios,
    samples,
  };
}

module.exports = {
  setBroadcaster,
  startSimulation,
  stopSimulation,
  pauseSimulation,
  resumeSimulation,
  getResult,
  getState,
  runMonteCarlo,
  getEnvironmentPreview,
};
