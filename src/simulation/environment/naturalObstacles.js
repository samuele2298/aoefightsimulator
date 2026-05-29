'use strict';

function createNaturalObstacles(mapWidth, mapHeight) {
  const midX = mapWidth / 2;
  const midY = mapHeight / 2;

  return {
    obstacles: [
      { x: midX, y: midY, radius: 5 },
      { x: midX - 12, y: midY - 8, radius: 4 },
      { x: midX + 12, y: midY + 8, radius: 4 },
    ],
    buildingAttackers: [],
  };
}

module.exports = {
  createNaturalObstacles,
};
