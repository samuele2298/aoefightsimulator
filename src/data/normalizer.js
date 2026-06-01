'use strict';

const path = require('path');

const EXCLUDED_TECH_IDS = new Set([
  'greased-axles',
  'greased-axles-improved',
  'siege-works',
  'siege-works-improved',
  'siege-engineering',
  'siege-engineering-improved',
]);

function isExcludedTechnologyId(id) {
  return EXCLUDED_TECH_IDS.has(String(id || '').toLowerCase());
}

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

// Sengoku units have deflective_armor in the raw data but it is a tech unlock
// for that civilisation (not a default trait). Strip it here so the engine
// only grants the ability when the 'sengoku-deflective-armor' tech is selected.
function stripSengokuDefaultClasses(classes, civ) {
  if (civ !== 'sen') {
    return classes;
  }
  return classes.filter((c) => c !== 'deflective_armor');
}

function buildHealingProfile(entry, variation) {
  const id = String(entry && entry.id ? entry.id : '').toLowerCase();
  const description = String(variation && variation.description ? variation.description : '').toLowerCase();
  const classes = [
    ...(Array.isArray(variation && variation.classes) ? variation.classes : []),
    ...(Array.isArray(entry && entry.classes) ? entry.classes : []),
    ...(Array.isArray(variation && variation.displayClasses) ? variation.displayClasses : []),
    ...(Array.isArray(entry && entry.displayClasses) ? entry.displayClasses : []),
  ].map((value) => String(value || '').toLowerCase());

  const hasMonkClass = classes.includes('monk');
  const hasHealerElephantClass = classes.includes('healer_elephant');
  const hasReligiousHealText = description.includes('heals friendly units') || description.includes('heals units');
  const hasMassHealText = description.includes('mass heal') || description.includes('healing aura');
  const cannotHealOthers = description.includes('cannot heal others');
  const isHospitalier = id.includes('hospitalier');

  const healer = {
    enabled: false,
    singleTarget: {
      enabled: false,
      rate: 3,
      range: 3.25,
      acquireRange: 10,
    },
    aura: {
      enabled: false,
      rate: 1.8,
      radius: 3.4,
      requiresAttack: false,
    },
    onAttackHeal: {
      enabled: false,
      amount: 7,
      radius: 3,
    },
  };

  const isReligiousHealer = (hasMonkClass || hasReligiousHealText) && !cannotHealOthers && !isHospitalier;
  if (isReligiousHealer) {
    healer.enabled = true;
    healer.singleTarget.enabled = true;
  }

  if (id === 'dervish') {
    healer.enabled = true;
    healer.singleTarget.enabled = false;
    healer.aura.enabled = true;
    healer.aura.rate = 3.2;
    healer.aura.radius = 4.2;
  }

  if (id === 'imam') {
    healer.enabled = true;
    healer.singleTarget.enabled = true;
    healer.singleTarget.rate = 3.5;
    healer.aura.enabled = true;
    healer.aura.rate = 2.3;
    healer.aura.radius = 3.6;
  }

  if (id === 'warrior-monk' || id === 'khaganate-warrior-monk') {
    healer.enabled = true;
    healer.singleTarget.enabled = true;
    healer.singleTarget.rate = 3.2;
    healer.singleTarget.acquireRange = 11;
  }

  if (id === 'ikko-ikki-monk') {
    healer.enabled = true;
    healer.singleTarget.enabled = false;
    healer.onAttackHeal.enabled = true;
    healer.onAttackHeal.amount = 8;
    healer.onAttackHeal.radius = 3.2;
  }

  if (hasHealerElephantClass || id === 'healer-elephant') {
    healer.enabled = true;
    healer.singleTarget.enabled = true;
    healer.singleTarget.rate = 4.2;
    healer.singleTarget.range = 3.75;
    healer.singleTarget.acquireRange = 12;
    healer.aura.enabled = true;
    healer.aura.rate = 2.5;
    healer.aura.radius = 4.5;
  }

  if (hasMassHealText && !healer.aura.enabled) {
    healer.enabled = true;
    healer.aura.enabled = true;
  }

  if (!healer.enabled) {
    return null;
  }

  return healer;
}

function normalizeUnit(entry, civ, age) {
  const variation = pickVariation(entry, civ, age);
  if (!variation) {
    return null;
  }

  const iconUrl = variation.icon || entry.icon || null;
  const iconKey = toIconKey(iconUrl);

  const healing = buildHealingProfile(entry, variation);

  return {
    id: entry.id,
    baseId: variation.baseId || entry.id,
    variationId: variation.id,
    name: variation.name || entry.name,
    civs: entry.civs || variation.civs || [],
    classes: stripSengokuDefaultClasses(variation.classes || entry.classes || [], civ),
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
    healing,
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
    .filter((t) => !isExcludedTechnologyId(t.id))
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
  isExcludedTechnologyId,
};
