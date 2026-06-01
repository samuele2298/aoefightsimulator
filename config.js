'use strict';

const config = {
  port: process.env.PORT || '4000',
  nodeEnv: process.env.NODE_ENV || 'development',
  log_level: process.env.LOG_LEVEL || 'debug',
  combatDebugLog: true,

  // Simulation
  tickDelta: 0.1,          // simulated seconds per tick
  maxTicks: 6000,          // ~10 min simulation max (6000 × 0.1s)
  wsBatchSize: 5,          // ticks bundled per WS snapshot push

  // Battlefield dimensions (tiles)
  mapWidth: 120,
  mapHeight: 72,
  unitRadius: 0.6,         // tiles — separation radius
  separationStrength: 0.05,// steering force

  // Team spawn zones (x tiles)
  spawnMarginX: 4,
  spawnMarginY: 2,
  teamASpawnX: 35,         // left edge of spawn zone A
  teamBSpawnX: 65,         // left edge of spawn zone B

  // Data package path (relative to project root)
  aoe4dataPath: './node_modules/aoe4data',
};

module.exports = config;
