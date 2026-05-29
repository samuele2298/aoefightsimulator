'use strict';

const { findNearestEnemy, distance } = require('../battlefield');

function enemyHasPriorityClass(enemy, priorityClass) {
  if (!priorityClass) {
    return false;
  }
  const classes = enemy.def && Array.isArray(enemy.def.classes) ? enemy.def.classes : [];
  return classes.includes(priorityClass);
}

function selectPriorityUnit(unit, enemies, priorityUnitId) {
  if (!priorityUnitId) {
    return null;
  }

  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.dead || enemy.def.id !== priorityUnitId) {
      continue;
    }

    const d = distance(unit, enemy);
    if (d < bestDist) {
      best = enemy;
      bestDist = d;
    }
  }

  return best;
}

function selectPriorityUnitInRange(unit, enemies, priorityUnitId, range) {
  const inRange = enemies.filter((enemy) => !enemy.dead && distance(unit, enemy) <= range);
  return selectPriorityUnit(unit, inRange, priorityUnitId);
}

function selectTarget(unit, enemies, options = {}) {
  const priorityClass = options.priorityClass || null;
  const priorityUnitId = options.priorityUnitId || null;
  const alive = enemies.filter((e) => !e.dead);

  const explicitPriority = selectPriorityUnit(unit, alive, priorityUnitId);
  if (explicitPriority) {
    return explicitPriority;
  }

  if (priorityClass) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const enemy of alive) {
      if (!enemyHasPriorityClass(enemy, priorityClass)) {
        continue;
      }
      const d = distance(unit, enemy);
      if (d < bestDist) {
        best = enemy;
        bestDist = d;
      }
    }

    if (best) {
      return best;
    }
  }

  return findNearestEnemy(unit, alive).enemy;
}

module.exports = {
  selectTarget,
  selectPriorityUnitInRange,
};
