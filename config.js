'use strict';

const config = {
  port: process.env.PORT || '4000',
  nodeEnv: process.env.NODE_ENV || 'development',
  log_level: process.env.LOG_LEVEL || 'debug',

  // Enable detailed combat logs (damage breakdowns, class interactions, etc.) in the server console.
  combatDebugLog: false, // Set to true to enable

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

  // Telegram daily reporter
  // tgBotToken: token from @BotFather  (set via env var TG_BOT_TOKEN)
  // tgChatId:   your personal chat_id  (set via env var TG_CHAT_ID)
  // TG_REPORT_INTERVAL_HOURS: report cadence in UTC hours (default: 6)
  tgBotToken: process.env.TG_BOT_TOKEN || '8943453175:AAEVXwxYr3J1wvWXYDNQ_7BWB_fDB3QAREw',
  tgChatId:   process.env.TG_CHAT_ID   || '893285969',
};

module.exports = config;
