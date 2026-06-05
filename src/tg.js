'use strict';

/**
 * Telegram bot reporter.
 *
 * Uses the Telegram Bot HTTP API directly (no external library).
 * Requires in config:
 *   - tgBotToken  : string  — bot token from @BotFather
 *   - tgChatId    : string  — your personal chat_id (get it via @userinfobot)
 *
 * Exports:
 *   - sendMessage(text)   — send any text message
 *   - sendDailyReport()   — build + send the stats report
 *   - startScheduler()    — schedule sendDailyReport at fixed UTC intervals
 */

const https = require('https');
const config = require('../config');
const logger = require('../logger');
const { getDailySnapshot, resetDaily } = require('./tracker');

let dailyTimer = null;
let schedulerStarted = false;

// ── Low-level Telegram API call ──────────────────────────────────────────────

/**
 * POST to Telegram Bot API.
 * @param {string} method   - Telegram API method (e.g. 'sendMessage')
 * @param {object} payload  - JSON body
 * @returns {Promise<object>}
 */
function callTelegramApi(method, payload) {
  return new Promise((resolve, reject) => {
    const token = config.tgBotToken;
    if (!token) {
      return reject(new Error('tgBotToken not set in config'));
    }

    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            reject(new Error(`Telegram API error: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Telegram API request timed out'));
    });
    req.write(body);
    req.end();
  });
}

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Send a plain text message to the configured chat.
 * @param {string} text
 */
async function sendMessage(text) {
  const chatId = config.tgChatId;
  if (!chatId) {
    logger.warn('tg: tgChatId not set, skipping message');
    return;
  }
  try {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });
    logger.info('tg: message sent');
  } catch (err) {
    logger.error(err, 'tg: sendMessage failed');
  }
}

/**
 * Build the recap message and send it, then reset counters.
 */
async function sendDailyReport() {
  const snap = getDailySnapshot();

  // ── Human-readable recap ──────────────────────────────────────────────────
  const fmtRanked = (arr) =>
    arr.length ? arr.map((x) => `  • ${x.name}: ${x.count}`).join('\n') : '  (none)';

  const recap =
    `<b>📊 AoE4 Simulator — Report ${snap.date}</b>\n\n` +
    `🎮 Simulations started: <b>${snap.simulations}</b>\n` +
    `🎲 Monte-Carlo runs: <b>${snap.monteCarlo}</b>\n` +
    `👥 Unique clients: <b>${snap.uniqueClients}</b>\n` +
    `⚔️  Total units deployed: <b>${snap.totalUnitsDeployed}</b>\n\n` +
    `🏆 Top civs — Team A:\n${fmtRanked(snap.topCivsTeamA)}\n\n` +
    `🛡️  Top civs — Team B:\n${fmtRanked(snap.topCivsTeamB)}\n\n` +
    `🥇 Most winning civs:\n${fmtRanked(snap.topWinnerCivs)}\n\n` +
    `🗺️  Top environments:\n${fmtRanked(snap.topEnvironments)}`;

  // ── Raw JSON block ────────────────────────────────────────────────────────
  const jsonBlock =
    `<b>Raw JSON:</b>\n<pre>${JSON.stringify(snap, null, 2)}</pre>`;

  await sendMessage(recap);
  await sendMessage(jsonBlock);

  // Reset after sending so each report covers only the latest interval window.
  resetDaily();
}

// ── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Schedule sendDailyReport to run at fixed UTC intervals.
 * Uses a self-adjusting setTimeout (no cron library needed).
 */
function startScheduler() {
  try {
    if (schedulerStarted) {
      logger.warn('tg: reporter scheduler already started, skipping duplicate start');
      return;
    }

    if (!config.tgBotToken || !config.tgChatId) {
      logger.warn('tg: tgBotToken or tgChatId missing — reporter NOT started');
      return;
    }

    schedulerStarted = true;
    const intervalHours = Math.max(1, Number(process.env.TG_REPORT_INTERVAL_HOURS) || 6);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    function scheduleNext() {
      const now = new Date();
      const elapsedMsToday =
        now.getUTCHours() * 60 * 60 * 1000 +
        now.getUTCMinutes() * 60 * 1000 +
        now.getUTCSeconds() * 1000 +
        now.getUTCMilliseconds();

      const nextSlotMsToday =
        Math.ceil((elapsedMsToday + 1) / intervalMs) * intervalMs;

      const startOfDayUtc = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0
      );

      const nextRun = new Date(startOfDayUtc + nextSlotMsToday);
      const msUntilNextRun = nextRun.getTime() - now.getTime();

      logger.info(
        `tg: next report at ${nextRun.toISOString()} UTC ` +
        `(every ${intervalHours}h, in ${Math.round(msUntilNextRun / 60000)} minutes)`
      );

      dailyTimer = setTimeout(async () => {
        try {
          await sendDailyReport();
        } catch (err) {
          logger.error(err, 'tg: sendDailyReport failed');
        } finally {
          // Always schedule the next run, even if sending failed.
          scheduleNext();
        }
      }, msUntilNextRun);
    }

    scheduleNext();
    logger.info(`tg: reporter scheduler started (interval ${intervalHours}h, UTC aligned)`);
  } catch (e) {
    logger.error(e, 'tg: failed to start scheduler');
  }
}

module.exports = { sendMessage, sendDailyReport, startScheduler };
