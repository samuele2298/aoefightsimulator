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
 *   - sendDailyReport()   — build + send the daily stats report
 *   - startScheduler()    — schedule sendDailyReport every day at 00:00 UTC
 */

const https = require('https');
const config = require('../config');
const logger = require('../logger');
const { getDailySnapshot, resetDaily } = require('./tracker');

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
 * Build the daily recap message and send it, then reset counters.
 */
async function sendDailyReport() {
  const snap = getDailySnapshot();

  // ── Human-readable recap ──────────────────────────────────────────────────
  const fmtRanked = (arr) =>
    arr.length ? arr.map((x) => `  • ${x.name}: ${x.count}`).join('\n') : '  (none)';

  const recap =
    `<b>📊 AoE4 Simulator — Daily Report ${snap.date}</b>\n\n` +
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

  // Reset for next day AFTER sending so the report always contains the full day
  resetDaily();
}

// ── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Schedule sendDailyReport to run every day at 00:00 UTC.
 * Uses a self-adjusting setTimeout (no cron library needed).
 */
function startScheduler() {
  try { 
  if (!config.tgBotToken || !config.tgChatId) {
    logger.warn('tg: tgBotToken or tgChatId missing — daily reporter NOT started');
    return;
  }

    // Test send delayed by 1 minute on boot.
    setTimeout(() => {
      sendDailyReport();
    }, 60 * 1000);

  function scheduleNext() {
    const now = new Date();
    const nextMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    logger.info(`tg: next daily report in ${Math.round(msUntilMidnight / 60000)} minutes`);

    setTimeout(async () => {
      try {
        await sendDailyReport();
      } catch (err) {
        logger.error(err, 'tg: sendDailyReport failed');
      }
      scheduleNext(); // reschedule for the following day
    }, msUntilMidnight);
  }

  scheduleNext();
  logger.info('tg: daily reporter scheduler started');
} catch (err) {
}

module.exports = { sendMessage, sendDailyReport, startScheduler };
