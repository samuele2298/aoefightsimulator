'use strict';

/**
 * Telegram notifications for simulation events.
 *
 * Uses the Telegram Bot HTTP API directly (no external library).
 * Requires in config:
 *   - tgBotToken  : string  — bot token from @BotFather
 *   - tgChatId    : string  — your personal chat_id (get it via @userinfobot)
 *
 * Exports:
 *   - sendMessage(text)            — send any text message
 *   - sendSimulationStarted(info)  — notify when a simulation starts
 *   - sendSimulationError(info)    — notify when simulation endpoints fail
 */

const https = require('https');
const config = require('../config');
const logger = require('../logger');

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

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getSafeCiv(team) {
  return team && team.civ ? team.civ : 'unknown';
}

function toUtcIsoNow() {
  return new Date().toISOString();
}

function truncate(value, max = 1200) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

async function sendSimulationStarted(info) {
  const payload = info || {};
  const teamA = payload.teamA || {};
  const teamB = payload.teamB || {};
  const mode = payload.mode || 'start';
  const text =
    '<b>Simulation Started</b>\n' +
    `time_utc: <b>${esc(toUtcIsoNow())}</b>\n` +
    `ip: <b>${esc(payload.ip || 'unknown')}</b>\n` +
    `mode: <b>${esc(mode)}</b>\n` +
    `teamA_civ: <b>${esc(getSafeCiv(teamA))}</b>\n` +
    `teamB_civ: <b>${esc(getSafeCiv(teamB))}</b>`;

  await sendMessage(text);
}

async function sendSimulationError(info) {
  const payload = info || {};
  const teamA = payload.teamA || {};
  const teamB = payload.teamB || {};

  const text =
    '<b>Simulation Error</b>\n' +
    `time_utc: <b>${esc(toUtcIsoNow())}</b>\n` +
    `ip: <b>${esc(payload.ip || 'unknown')}</b>\n` +
    `endpoint: <b>${esc(payload.endpoint || 'unknown')}</b>\n` +
    `teamA_civ: <b>${esc(getSafeCiv(teamA))}</b>\n` +
    `teamB_civ: <b>${esc(getSafeCiv(teamB))}</b>\n` +
    `error: <b>${esc(payload.error || 'unknown')}</b>`;

  await sendMessage(text);
}

async function sendServerError(info) {
  const payload = info || {};
  const text =
    '<b>Server Error</b>\n' +
    `time_utc: <b>${esc(toUtcIsoNow())}</b>\n` +
    `type: <b>${esc(payload.type || 'unknown')}</b>\n` +
    `where: <b>${esc(payload.where || 'unknown')}</b>\n` +
    `ip: <b>${esc(payload.ip || 'unknown')}</b>\n` +
    `error: <b>${esc(truncate(payload.error || 'unknown'))}</b>\n` +
    `details: <b>${esc(truncate(payload.details || 'none'))}</b>`;

  await sendMessage(text);
}

/**
 * Fire-and-forget wrapper: calls fn(), catches any error, never throws.
 * Use this whenever you want a Telegram notification that must never block
 * or crash the caller.
 * @param {() => Promise<any>} fn
 */
function tgNotify(fn) {
  try {
    Promise.resolve(fn()).catch((err) => {
      logger.error(err, 'tg: background notification failed');
    });
  } catch (err) {
    logger.error(err, 'tg: notification setup failed');
  }
}

module.exports = {
  sendMessage,
  sendSimulationStarted,
  sendSimulationError,
  sendServerError,
  tgNotify,
};
