'use strict';

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seedValue) {
  const seedText = String(seedValue || 'aoe4-default-seed');
  const seedFn = xmur3(seedText);
  return mulberry32(seedFn());
}

function randomInRange(rng, min, max) {
  return min + (max - min) * rng();
}

function toCircle(x, y, radius, style) {
  return {
    shape: 'circle',
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    radius: Number(radius.toFixed(2)),
    style: style || 'forest',
  };
}

function toSquare(x, y, size, style) {
  return {
    shape: 'square',
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    size: Number(size.toFixed(2)),
    style: style || 'ruin',
  };
}

function isSquare(obstacle) {
  return obstacle && obstacle.shape === 'square' && typeof obstacle.size === 'number';
}

function obstacleBounds(obstacle, padding = 0) {
  if (isSquare(obstacle)) {
    const half = obstacle.size / 2 + padding;
    return {
      left: obstacle.x - half,
      right: obstacle.x + half,
      top: obstacle.y - half,
      bottom: obstacle.y + half,
    };
  }

  const radius = (obstacle && obstacle.radius) || 0;
  return {
    left: obstacle.x - radius - padding,
    right: obstacle.x + radius + padding,
    top: obstacle.y - radius - padding,
    bottom: obstacle.y + radius + padding,
  };
}

function clampObstacleInsideMap(obstacle, mapWidth, mapHeight, margin = 1.5) {
  if (isSquare(obstacle)) {
    const half = obstacle.size / 2;
    obstacle.x = Math.max(margin + half, Math.min(mapWidth - margin - half, obstacle.x));
    obstacle.y = Math.max(margin + half, Math.min(mapHeight - margin - half, obstacle.y));
    return obstacle;
  }

  const radius = obstacle.radius || 0;
  obstacle.x = Math.max(margin + radius, Math.min(mapWidth - margin - radius, obstacle.x));
  obstacle.y = Math.max(margin + radius, Math.min(mapHeight - margin - radius, obstacle.y));
  return obstacle;
}

function overlapsCircleCircle(a, b, padding) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minDist = (a.radius || 0) + (b.radius || 0) + padding;
  return dx * dx + dy * dy < minDist * minDist;
}

function overlapsSquareSquare(a, b, padding) {
  const ab = obstacleBounds(a, padding / 2);
  const bb = obstacleBounds(b, padding / 2);
  return !(ab.right <= bb.left || ab.left >= bb.right || ab.bottom <= bb.top || ab.top >= bb.bottom);
}

function overlapsCircleSquare(circle, square, padding) {
  const half = square.size / 2 + padding / 2;
  const nearestX = Math.max(square.x - half, Math.min(circle.x, square.x + half));
  const nearestY = Math.max(square.y - half, Math.min(circle.y, square.y + half));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const radius = (circle.radius || 0) + padding / 2;
  return dx * dx + dy * dy < radius * radius;
}

function obstaclesOverlap(a, b, padding = 0.8) {
  if (isSquare(a) && isSquare(b)) {
    return overlapsSquareSquare(a, b, padding);
  }

  if (!isSquare(a) && !isSquare(b)) {
    return overlapsCircleCircle(a, b, padding);
  }

  return isSquare(a)
    ? overlapsCircleSquare(b, a, padding)
    : overlapsCircleSquare(a, b, padding);
}

function isValidPlacement(candidate, existing, mapWidth, mapHeight, padding = 1.1) {
  const bounds = obstacleBounds(candidate, 0.4);
  if (bounds.left < 0 || bounds.right > mapWidth || bounds.top < 0 || bounds.bottom > mapHeight) {
    return false;
  }

  for (const current of existing) {
    if (obstaclesOverlap(candidate, current, padding)) {
      return false;
    }
  }

  return true;
}

function placeNonOverlapping(existing, createCandidate, rng, mapWidth, mapHeight, maxTries = 180) {
  for (let i = 0; i < maxTries; i += 1) {
    const candidate = clampObstacleInsideMap(createCandidate(rng), mapWidth, mapHeight);
    if (isValidPlacement(candidate, existing, mapWidth, mapHeight)) {
      existing.push(candidate);
      return candidate;
    }
  }
  return null;
}

function buildForestBelts(rng, mapWidth, mapHeight) {
  const obstacles = [];
  const laneCount = 3;
  const centerX = mapWidth / 2;

  for (let i = 0; i < laneCount; i += 1) {
    placeNonOverlapping(
      obstacles,
      () => {
        const x = centerX + randomInRange(rng, -16, 16);
        const y = mapHeight * 0.14 + ((mapHeight * 0.72) / Math.max(1, laneCount - 1)) * i + randomInRange(rng, -2, 2);
        return toCircle(x, y, randomInRange(rng, 4.8, 7.1), 'forest');
      },
      rng,
      mapWidth,
      mapHeight
    );
  }

  return obstacles;
}

function buildCentralRidge(rng, mapWidth, mapHeight) {
  const obstacles = [];
  const centerX = mapWidth / 2;

  for (let i = 0; i < 5; i += 1) {
    placeNonOverlapping(
      obstacles,
      () => {
        const y = mapHeight * 0.14 + ((mapHeight * 0.72) / 4) * i;
        const x = centerX + Math.sin(i * 1.1) * randomInRange(rng, 2.5, 6.5);
        return toCircle(x, y, randomInRange(rng, 4.6, 6.8), 'rock');
      },
      rng,
      mapWidth,
      mapHeight
    );
  }

  return obstacles;
}

function buildRiverFords(rng, mapWidth, mapHeight) {
  const obstacles = [];
  const segments = 6;
  const baseX = mapWidth * 0.5;

  for (let i = 0; i < segments; i += 1) {
    if (i === 2 || i === 4) {
      continue;
    }
    placeNonOverlapping(
      obstacles,
      () => {
        const y = mapHeight * 0.1 + ((mapHeight * 0.8) / (segments - 1)) * i;
        const x = baseX + randomInRange(rng, -2.8, 2.8);
        return toCircle(x, y, randomInRange(rng, 5.1, 7.4), 'water');
      },
      rng,
      mapWidth,
      mapHeight
    );
  }
  return obstacles;
}

function buildBrokenRuins(rng, mapWidth, mapHeight) {
  const obstacles = [];
  const chunks = 7;

  for (let i = 0; i < chunks; i += 1) {
    placeNonOverlapping(
      obstacles,
      () =>
        toCircle(
          randomInRange(rng, mapWidth * 0.15, mapWidth * 0.85),
          randomInRange(rng, mapHeight * 0.12, mapHeight * 0.88),
          randomInRange(rng, 4.0, 6.2),
          'ruin'
        ),
      rng,
      mapWidth,
      mapHeight
    );
  }

  return obstacles;
}

function buildRandomClusters(rng, mapWidth, mapHeight) {
  const obstacles = [];
  const amount = 4;

  for (let i = 0; i < amount; i += 1) {
    placeNonOverlapping(
      obstacles,
      () =>
        toCircle(
          randomInRange(rng, mapWidth * 0.12, mapWidth * 0.88),
          randomInRange(rng, mapHeight * 0.12, mapHeight * 0.88),
          randomInRange(rng, 7.2, 10.8),
          i % 2 === 0 ? 'forest' : 'rock'
        ),
      rng,
      mapWidth,
      mapHeight
    );
  }

  return obstacles;
}

function buildAroundLandmark(rng, mapWidth, mapHeight) {
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;
  return [toSquare(centerX, centerY, 10, 'landmark')];
}

function buildMiniHideout(rng, mapWidth, mapHeight) {
  const obstacles = [];
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;

  obstacles.push(toCircle(centerX, centerY, 10.5, 'forest'));

  const ringCount = 8;
  const radius = Math.min(mapWidth, mapHeight) * 0.18;
  for (let i = 0; i < ringCount; i += 1) {
    const angle = (Math.PI * 2 * i) / ringCount + randomInRange(rng, -0.12, 0.12);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    placeNonOverlapping(
      obstacles,
      () => toCircle(x, y, randomInRange(rng, 5.8, 8.0), 'forest'),
      rng,
      mapWidth,
      mapHeight
    );
  }

  return obstacles;
}

function buildObstaclesByType(type, seed, mapWidth, mapHeight) {
  const rng = rngFromSeed(`${type}:${seed}`);

  if (type === 'forest-belts') {
    return buildForestBelts(rng, mapWidth, mapHeight);
  }

  if (type === 'dry-arabia') {
    return [];
  }

  if (type === 'around-landmark') {
    return buildAroundLandmark(rng, mapWidth, mapHeight);
  }

  if (type === 'mini-hideout') {
    return buildMiniHideout(rng, mapWidth, mapHeight);
  }

  return buildRandomClusters(rng, mapWidth, mapHeight);
}

function createObstacleEnvironment(type, seed, mapWidth, mapHeight) {
  return {
    type,
    seed,
    obstacles: buildObstaclesByType(type, seed, mapWidth, mapHeight),
    buildingAttackers: [],
  };
}

module.exports = {
  createObstacleEnvironment,
};
