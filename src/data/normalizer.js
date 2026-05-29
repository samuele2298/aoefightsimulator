'use strict';

const path = require('path');

function toIconKey(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string') {
    return null;
  }
  const clean = iconUrl.split('?')[0];
  return path.basename(clean);
}

function pickVariation(entry, civ, age) {
  if (!entry || !Array.isArray(entry.variations)) {
    return null;
  }

  const byCiv = entry.variations.filter((v) => {
    if (!Array.isArray(v.civs)) {
      return true;
    }
    return civ ? v.civs.includes(civ) : true;
  });

  if (!byCiv.length) {
    return null;
  }

  const maxAge = Number.isFinite(age) ? age : 4;
  const ageCandidates = byCiv
    .filter((v) => typeof v.age === 'number' && v.age <= maxAge)
    .sort((a, b) => b.age - a.age);

  if (ageCandidates.length) {
    return ageCandidates[0];
  }

  return byCiv[0];
}

function normalizeWeapon(weapon) {
  return {
    name: weapon.name || 'Attack',
    type: weapon.type || 'melee',
    damage: typeof weapon.damage === 'number' ? weapon.damage : 0,
    speed: typeof weapon.speed === 'number' ? weapon.speed : 1,
    range: {
      min: weapon.range && typeof weapon.range.min === 'number' ? weapon.range.min : 0,
      max: weapon.range && typeof weapon.range.max === 'number' ? weapon.range.max : 1,
    },
    modifiers: Array.isArray(weapon.modifiers) ? weapon.modifiers : [],
    durations: weapon.durations || null,
  };
}

function normalizeArmorList(armorList) {
  if (!Array.isArray(armorList)) {
    return [];
  }
  return armorList.map((armor) => ({
    type: armor.type || 'unknown',
    value: typeof armor.value === 'number' ? armor.value : 0,
  }));
}

function normalizeUnit(entry, civ, age) {
  const variation = pickVariation(entry, civ, age);
  if (!variation) {
    return null;
  }

  const iconUrl = variation.icon || entry.icon || null;
  const iconKey = toIconKey(iconUrl);

  return {
    id: entry.id,
    baseId: variation.baseId || entry.id,
    variationId: variation.id,
    name: variation.name || entry.name,
    civs: entry.civs || variation.civs || [],
    classes: variation.classes || entry.classes || [],
    displayClasses: variation.displayClasses || entry.displayClasses || [],
    age: variation.age || entry.minAge || 1,
    hitpoints: typeof variation.hitpoints === 'number' ? variation.hitpoints : 1,
    movement: {
      speed:
        variation.movement && typeof variation.movement.speed === 'number'
          ? variation.movement.speed
          : 1,
    },
    costs: variation.costs || { food: 0, wood: 0, gold: 0, stone: 0, total: 0, popcap: 1 },
    weapons: Array.isArray(variation.weapons) ? variation.weapons.map(normalizeWeapon) : [],
    armor: normalizeArmorList(variation.armor),
    icon: iconUrl,
    iconKey,
  };
}

function normalizeUnits(unitsRaw, options = {}) {
  const civ = options.civ || null;
  const age = options.age ? parseInt(options.age, 10) : null;
  const data = Array.isArray(unitsRaw && unitsRaw.data) ? unitsRaw.data : [];

  return data
    .map((entry) => normalizeUnit(entry, civ, age))
    .filter(Boolean)
    .filter((u) => {
      if (civ && !u.civs.includes(civ)) {
        return false;
      }
      if (age && u.age > age) {
        return false;
      }
      return true;
    })
    .filter((u) => u.weapons.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeCivilizations(civsRaw) {
  const civEntries = Object.entries(civsRaw || {});
  return civEntries
    .map(([abbr, data]) => ({
      abbr,
      id: data.id,
      name: data.name,
      slug: data.slug,
      expansion: data.expansion || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeTechnologies(techRaw, options = {}) {
  const civ = options.civ || null;
  const age = options.age ? parseInt(options.age, 10) : null;
  const data = Array.isArray(techRaw && techRaw.data) ? techRaw.data : [];

  return data
    .map((entry) => {
      const variation = pickVariation(entry, civ, age);
      if (!variation) {
        return null;
      }
      return {
        id: entry.id,
        variationId: variation.id,
        name: entry.name,
        age: variation.age || entry.minAge || 1,
        civs: entry.civs || variation.civs || [],
        description: variation.description || entry.description || '',
        classes: entry.classes || [],
        displayClasses: variation.displayClasses || entry.displayClasses || [],
        producedBy: Array.isArray(variation.producedBy) ? variation.producedBy : [],
        effects: Array.isArray(variation.effects) ? variation.effects : [],
      };
    })
    .filter(Boolean)
    .filter((t) => {
      if (civ && !t.civs.includes(civ)) {
        return false;
      }
      if (age && t.age > age) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeBuildings(buildingsRaw, options = {}) {
  const civ = options.civ || null;
  const age = options.age ? parseInt(options.age, 10) : null;
  const data = Array.isArray(buildingsRaw && buildingsRaw.data) ? buildingsRaw.data : [];

  return data
    .map((entry) => {
      const variation = pickVariation(entry, civ, age);
      if (!variation) {
        return null;
      }
      return {
        id: entry.id,
        name: entry.name,
        age: variation.age || entry.minAge || 1,
        civs: entry.civs || variation.civs || [],
        hitpoints: variation.hitpoints || 0,
        garrison: variation.garrison || null,
        weapons: Array.isArray(variation.weapons) ? variation.weapons.map(normalizeWeapon) : [],
        icon: variation.icon || entry.icon || null,
        iconKey: toIconKey(variation.icon || entry.icon || null),
      };
    })
    .filter(Boolean)
    .filter((b) => {
      if (civ && !b.civs.includes(civ)) {
        return false;
      }
      if (age && b.age > age) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  normalizeUnits,
  normalizeCivilizations,
  normalizeTechnologies,
  normalizeBuildings,
};
