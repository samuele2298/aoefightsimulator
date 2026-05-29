'use strict';

const express = require('express');

const logger = require('../../logger');
const {
  getUnitsRaw,
  getBuildingsRaw,
  getTechnologiesRaw,
  getCivilizationsRaw,
} = require('../data/loader');
const {
  normalizeUnits,
  normalizeBuildings,
  normalizeCivilizations,
  normalizeTechnologies,
} = require('../data/normalizer');
const { refreshAoe4Data } = require('../data/updater');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/units', (req, res) => {
  try {
    const unitsRaw = getUnitsRaw();
    const units = normalizeUnits(unitsRaw, {
      civ: req.query.civ,
      age: req.query.age,
    });
    res.json({ count: units.length, data: units });
  } catch (error) {
    logger.error(error, 'Failed to read units');
    res.status(500).json({ error: 'Failed to load units' });
  }
});

router.get('/buildings', (req, res) => {
  try {
    const raw = getBuildingsRaw();
    const buildings = normalizeBuildings(raw, {
      civ: req.query.civ,
      age: req.query.age,
    });
    res.json({ count: buildings.length, data: buildings });
  } catch (error) {
    logger.error(error, 'Failed to read buildings');
    res.status(500).json({ error: 'Failed to load buildings' });
  }
});

router.get('/civilizations', (_req, res) => {
  try {
    const raw = getCivilizationsRaw();
    const civilizations = normalizeCivilizations(raw);
    res.json({ count: civilizations.length, data: civilizations });
  } catch (error) {
    logger.error(error, 'Failed to read civilizations');
    res.status(500).json({ error: 'Failed to load civilizations' });
  }
});

router.get('/technologies', (req, res) => {
  try {
    const raw = getTechnologiesRaw();
    const technologies = normalizeTechnologies(raw, {
      civ: req.query.civ,
      age: req.query.age,
    });
    res.json({ count: technologies.length, data: technologies });
  } catch (error) {
    logger.error(error, 'Failed to read technologies');
    res.status(500).json({ error: 'Failed to load technologies' });
  }
});

router.post('/refresh', async (_req, res) => {
  try {
    await refreshAoe4Data();
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to refresh aoe4data');
    res.status(500).json({ error: 'Failed to refresh aoe4data package' });
  }
});

module.exports = router;
