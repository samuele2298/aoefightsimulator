'use strict';

function buildNormalPositions({ team, count, mapWidth, mapHeight, startX }) {
  const rowSize = Math.max(8, Math.min(20, Math.round(Math.sqrt(Math.max(1, count)) * 1.6)));
  const spacingX = 1.4;
  const spacingY = 1.4;

  const positions = [];
  const centerY = mapHeight / 2;

  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / rowSize);
    const col = i % rowSize;
    const xOffset = row * spacingX * (team === 'A' ? 1 : -1);
    const yOffset = (col - rowSize / 2) * spacingY;

    positions.push({
      x: startX + xOffset,
      y: centerY + yOffset,
    });
  }

  return positions;
}

module.exports = {
  buildNormalPositions,
};
