'use strict';

/**
 * In-memory tracker for simulation requests.
 *
 * Records stats for the current day and exposes:
 *   - trackSimulation(body)  — call on every /api/simulation/start
 *   - trackMonteCarlo(body)  — call on every /api/simulation/montecarlo
 *   - getDailySnapshot()     — returns stats object for today
 *   - resetDaily()           — clears counters (called by the nightly scheduler)
 */

const logger = require('../logger');

/** @type {{ date: string, simulations: number, monteCarlo: number, uniqueIPs: Set<string>, civsA: Map<string,number>, civsB: Map<string,number>, environments: Map<string,number>, winnerCivs: Map<string,number>, totalUnits: number }} */
let state = createEmptyState();

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function createEmptyState() {
  return {
    date: todayUTC(),
    simulations: 0,
    monteCarlo: 0,
    uniqueIPs: new Set(),
    civsA: new Map(),
    civsB: new Map(),
    environments: new Map(),
    winnerCivs: new Map(),
    totalUnits: 0,
  };
}

function inc(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function mapToRanked(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/**
 * Record a simulation start request.
 * @param {object} body  - req.body from POST /api/simulation/start
 * @param {string} ip    - client IP address
 */
function trackSimulation(body, ip) {
  try {
    state.simulations += 1;
    if (ip) state.uniqueIPs.add(ip);

    const teamA = body?.teamA || {};
    const teamB = body?.teamB || {};

    inc(state.civsA, teamA.civ);
    inc(state.civsB, teamB.civ);

    if (body?.environment) inc(state.environments, body.environment);

    const unitsA = Array.isArray(teamA.units) ? teamA.units.length : 0;
    const unitsB = Array.isArray(teamB.units) ? teamB.units.length : 0;
    state.totalUnits += unitsA + unitsB;
  } catch (err) {
    logger.error(err, 'tracker.trackSimulation error');
  }
}

/**
 * Record a Monte-Carlo run request.
 * @param {object} body - req.body from POST /api/simulation/montecarlo
 * @param {string} ip   - client IP address
 */
function trackMonteCarlo(body, ip) {
  try {
    state.monteCarlo += 1;
    if (ip) state.uniqueIPs.add(ip);

    const teamA = body?.teamA || {};
    const teamB = body?.teamB || {};
    inc(state.civsA, teamA.civ);
    inc(state.civsB, teamB.civ);
  } catch (err) {
    logger.error(err, 'tracker.trackMonteCarlo error');
  }
}

/**
 * Record the winner civilization from a finished simulation result.
 * @param {string} winnerCiv
 */
function trackResult(winnerCiv) {
  try {
    if (winnerCiv) inc(state.winnerCivs, winnerCiv);
  } catch (err) {
    logger.error(err, 'tracker.trackResult error');
  }
}

/**
 * Returns a plain object snapshot of today's stats.
 */
function getDailySnapshot() {
  return {
    date: state.date,
    simulations: state.simulations,
    monteCarlo: state.monteCarlo,
    uniqueClients: state.uniqueIPs.size,
    topCivsTeamA: mapToRanked(state.civsA),
    topCivsTeamB: mapToRanked(state.civsB),
    topWinnerCivs: mapToRanked(state.winnerCivs),
    topEnvironments: mapToRanked(state.environments),
    totalUnitsDeployed: state.totalUnits,
  };
}

/**
 * Reset counters for a new day (called by the nightly scheduler before sending the report).
 */
function resetDaily() {
  state = createEmptyState();
  logger.info('tracker: daily stats reset');
}

module.exports = { trackSimulation, trackMonteCarlo, trackResult, getDailySnapshot, resetDaily };
