'use strict';

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function moveToward(unit, targetPoint, step, mapWidth, mapHeight) {
  const dx = targetPoint.x - unit.x;
  const dy = targetPoint.y - unit.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= 0.0001) {
    return;
  }

  const ratio = Math.min(1, step / dist);
  unit.x = clamp(unit.x + dx * ratio, 0, mapWidth);
  unit.y = clamp(unit.y + dy * ratio, 0, mapHeight);
}

function applySeparation(unit, allies, separationStrength, unitRadius, mapWidth, mapHeight) {
  let pushX = 0;
  let pushY = 0;

  for (const other of allies) {
    if (other.id === unit.id || other.dead) {
      continue;
    }

    const dx = unit.x - other.x;
    const dy = unit.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = unitRadius * 2;

    if (dist > 0 && dist < minDist) {
      const force = (minDist - dist) / minDist;
      pushX += (dx / dist) * force;
      pushY += (dy / dist) * force;
    }
  }

  unit.x = clamp(unit.x + pushX * separationStrength, 0, mapWidth);
  unit.y = clamp(unit.y + pushY * separationStrength, 0, mapHeight);
}

function pointInsideCircle(point, obstacle) {
  const dx = point.x - obstacle.x;
  const dy = point.y - obstacle.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d <= obstacle.radius;
}

function pointInsideSquare(point, obstacle) {
  const half = obstacle.size / 2;
  return (
    point.x >= obstacle.x - half &&
    point.x <= obstacle.x + half &&
    point.y >= obstacle.y - half &&
    point.y <= obstacle.y + half
  );
}

function avoidSquareObstacle(unit, obstacle, mapWidth, mapHeight) {
  const half = obstacle.size / 2;
  const dx = unit.x - obstacle.x;
  const dy = unit.y - obstacle.y;

  const overlapX = half - Math.abs(dx);
  const overlapY = half - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) {
    return;
  }

  if (overlapX < overlapY) {
    const push = overlapX + 0.25;
    unit.x = clamp(unit.x + (dx >= 0 ? push : -push), 0, mapWidth);
  } else {
    const push = overlapY + 0.25;
    unit.y = clamp(unit.y + (dy >= 0 ? push : -push), 0, mapHeight);
  }
}

function avoidObstacles(unit, obstacles, mapWidth, mapHeight) {
  if (!Array.isArray(obstacles) || obstacles.length === 0) {
    return;
  }

  for (const obstacle of obstacles) {
    if (obstacle && obstacle.shape === 'square' && typeof obstacle.size === 'number') {
      if (pointInsideSquare({ x: unit.x, y: unit.y }, obstacle)) {
        avoidSquareObstacle(unit, obstacle, mapWidth, mapHeight);
      }
      continue;
    }

    if (obstacle && typeof obstacle.radius === 'number' && pointInsideCircle({ x: unit.x, y: unit.y }, obstacle)) {
      const dx = unit.x - obstacle.x;
      const dy = unit.y - obstacle.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const desired = obstacle.radius + 0.2;

      unit.x = clamp(obstacle.x + (dx / dist) * desired, 0, mapWidth);
      unit.y = clamp(obstacle.y + (dy / dist) * desired, 0, mapHeight);
    }
  }
}

function findNearestEnemy(unit, enemies) {
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.dead) {
      continue;
    }
    const d = distance(unit, enemy);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }

  return { enemy: best, distance: bestDist };
}

module.exports = {
  distance,
  moveToward,
  applySeparation,
  avoidObstacles,
  findNearestEnemy,
};
