'use strict';

function computeRetreatPoint(unit, target, distance) {
  const dx = unit.x - target.x;
  const dy = unit.y - target.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 0.0001;

  return {
    x: unit.x + (dx / length) * distance,
    y: unit.y + (dy / length) * distance,
  };
}

module.exports = {
  computeRetreatPoint,
};
