'use strict';

const express = require('express');

const logger = require('../../logger');
const { trackSimulation, trackMonteCarlo } = require('../tracker');
const { sendSimulationStarted, sendSimulationError, sendServerError, tgNotify } = require('../tg');
const {
  startSimulation,
  stopSimulation,
  pauseSimulation,
  resumeSimulation,
  getResult,
  getState,
  runMonteCarlo,
  getEnvironmentPreview,
} = require('../simulation/simulationManager');

const router = express.Router();

router.post('/start', (req, res) => {
  const body = req.body || {};
  const ip = req.ip || req.socket?.remoteAddress;

  // Notify immediately — before the simulation runs so we never miss it.
  tgNotify(() => sendSimulationStarted({
    ip,
    teamA: body.teamA,
    teamB: body.teamB,
    mode: 'start',
  }));

  try {
    trackSimulation(body, ip);
    const result = startSimulation(body);
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to start simulation');
    tgNotify(() => sendSimulationError({
      ip,
      endpoint: '/api/simulation/start',
      teamA: body.teamA,
      teamB: body.teamB,
      error: error.message || 'Failed to start simulation',
    }));
    res.status(400).json({ error: error.message || 'Failed to start simulation' });
  }
});

router.post('/stop', (_req, res) => {
  try {
    const result = stopSimulation();
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to stop simulation');
    tgNotify(() => sendServerError({ type: 'http', where: '/api/simulation/stop', error: error.message || 'Failed to stop simulation', details: error.stack || 'no stack' }));
    res.status(500).json({ error: 'Failed to stop simulation' });
  }
});

router.post('/pause', (_req, res) => {
  try {
    const result = pauseSimulation();
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to pause simulation');
    tgNotify(() => sendServerError({ type: 'http', where: '/api/simulation/pause', error: error.message || 'Failed to pause simulation', details: error.stack || 'no stack' }));
    res.status(400).json({ error: error.message || 'Failed to pause simulation' });
  }
});

router.post('/resume', (_req, res) => {
  try {
    const result = resumeSimulation();
    res.json(result);
  } catch (error) {
    logger.error(error, 'Failed to resume simulation');
    tgNotify(() => sendServerError({ type: 'http', where: '/api/simulation/resume', error: error.message || 'Failed to resume simulation', details: error.stack || 'no stack' }));
    res.status(400).json({ error: error.message || 'Failed to resume simulation' });
  }
});

router.get('/state', (_req, res) => {
  res.json(getState());
});

router.get('/environment-preview', (req, res) => {
  try {
    const environment = req.query.environment || 'forest-belts';
    const seed = req.query.seed || 'default';
    res.json(getEnvironmentPreview(environment, seed));
  } catch (error) {
    logger.error(error, 'Failed to build environment preview');
    tgNotify(() => sendServerError({ type: 'http', where: '/api/simulation/environment-preview', error: error.message || 'Failed to build environment preview', details: error.stack || 'no stack' }));
    res.status(400).json({ error: error.message || 'Failed to build environment preview' });
  }
});

router.get('/result', (_req, res) => {
  const result = getResult();
  if (!result) {
    res.status(404).json({ error: 'No result available yet' });
    return;
  }
  res.json(result);
});

router.post('/monte-carlo', (req, res) => {
  const body = req.body || {};
  const ip = req.ip || req.socket?.remoteAddress;

  // Notify immediately — before the long synchronous Monte Carlo loop.
  tgNotify(() => sendSimulationStarted({
    ip,
    teamA: body.teamA,
    teamB: body.teamB,
    mode: 'monte-carlo',
  }));

  try {
    trackMonteCarlo(body, ip);
    const runs = body.monteCarloRuns || body.runs || 30;
    const summary = runMonteCarlo(body, runs);
    res.json(summary);
  } catch (error) {
    logger.error(error, 'Monte Carlo run failed');
    tgNotify(() => sendSimulationError({
      ip,
      endpoint: '/api/simulation/monte-carlo',
      teamA: body.teamA,
      teamB: body.teamB,
      error: error.message || 'Monte Carlo run failed',
    }));
    res.status(400).json({ error: error.message || 'Monte Carlo run failed' });
  }
});

module.exports = router;
