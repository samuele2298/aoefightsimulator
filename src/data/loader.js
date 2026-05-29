'use strict';

const fs = require('fs');
const path = require('path');

const config = require('../../config');

const cache = {
  loaded: false,
  units: null,
  buildings: null,
  technologies: null,
  civilizations: null,
};

function readJson(relativePath) {
  const filePath = path.join(process.cwd(), config.aoe4dataPath, relativePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function loadAllData() {
  cache.units = readJson('units/all-unified.json');
  cache.buildings = readJson('buildings/all-unified.json');
  cache.technologies = readJson('technologies/all-unified.json');
  cache.civilizations = readJson('civilizations/civs-index.json');
  cache.loaded = true;
  return cache;
}

function ensureLoaded() {
  if (!cache.loaded) {
    loadAllData();
  }
}

function reloadAllData() {
  cache.loaded = false;
  return loadAllData();
}

function getUnitsRaw() {
  ensureLoaded();
  return cache.units;
}

function getBuildingsRaw() {
  ensureLoaded();
  return cache.buildings;
}

function getTechnologiesRaw() {
  ensureLoaded();
  return cache.technologies;
}

function getCivilizationsRaw() {
  ensureLoaded();
  return cache.civilizations;
}

module.exports = {
  getUnitsRaw,
  getBuildingsRaw,
  getTechnologiesRaw,
  getCivilizationsRaw,
  loadAllData,
  reloadAllData,
};
