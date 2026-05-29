'use strict';

function buildLinePositions({ team, count, mapWidth, mapHeight, startX }) {
  const safeCount = Math.max(1, count);
  const spacingX = 0.75;
  const spacingY = 0.95;
  const verticalMargin = 4;
  const maxUnitsPerRow = Math.max(8, Math.floor((Math.max(12, mapHeight - verticalMargin * 2)) / spacingY));

  const positions = [];
  const centerY = mapHeight / 2;

  for (let i = 0; i < safeCount; i += 1) {
    const row = Math.floor(i / maxUnitsPerRow);
    const col = i % maxUnitsPerRow;
    const rowUnits = Math.min(maxUnitsPerRow, safeCount - row * maxUnitsPerRow);
    const xOffset = row * spacingX * (team === 'A' ? 1 : -1);
    const yOffset = (col - (rowUnits - 1) / 2) * spacingY;

    positions.push({
      x: startX + xOffset,
      y: centerY + yOffset,
    });
  }

  return positions;
}

module.exports = {
  buildLinePositions,
};
