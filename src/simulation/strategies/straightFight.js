'use strict';

const { findNearestEnemy } = require('../battlefield');

function selectTarget(unit, enemies) {
  return findNearestEnemy(unit, enemies).enemy;
}

module.exports = {
  selectTarget,
};
