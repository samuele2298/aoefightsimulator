'use strict';

function createGarrisonedBuilding({ buildingType, buildings }) {
  const targetIdMap = {
    tower: 'stone-wall-tower',
    castle: 'castle',
    town_center: 'town-center',
    tc: 'town-center',
  };

  const targetId = targetIdMap[buildingType] || 'stone-wall-tower';
  const building = buildings.find((b) => b.id === targetId) || null;

  if (!building) {
    return { obstacles: [], buildingAttackers: [] };
  }

  const weapon = Array.isArray(building.weapons) && building.weapons.length
    ? building.weapons[0]
    : {
        type: 'ranged',
        damage: buildingType === 'castle' ? 80 : 30,
        speed: buildingType === 'castle' ? 4.0 : 3.0,
        range: { min: 0, max: buildingType === 'castle' ? 12 : 9 },
      };

  return {
    obstacles: [],
    buildingAttackers: [
      {
        id: `${targetId}-sim`,
        name: building.name,
        x: 40,
        y: 25,
        weapon,
        cooldown: 0,
      },
    ],
  };
}

module.exports = {
  createGarrisonedBuilding,
};
