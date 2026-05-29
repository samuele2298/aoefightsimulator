'use strict';

function isRangedWeapon(weapon) {
  return weapon && weapon.type === 'ranged' && weapon.range && weapon.range.max > 1;
}

function isMeleeWeapon(weapon) {
  return weapon && weapon.type === 'melee';
}

function countPrefix(selectedTechs, prefix) {
  return selectedTechs.reduce((sum, key) => (key.startsWith(prefix) ? sum + 1 : sum), 0);
}

function hasTech(selectedTechs, key) {
  return selectedTechs.includes(key);
}

function cloneUnitDef(def) {
  return {
    ...def,
    movement: def.movement ? { ...def.movement } : { speed: 1 },
    costs: def.costs ? { ...def.costs } : { food: 0, wood: 0, gold: 0, stone: 0, total: 0, popcap: 1 },
    armor: Array.isArray(def.armor) ? def.armor.map((entry) => ({ ...entry })) : [],
    weapons: Array.isArray(def.weapons)
      ? def.weapons.map((weapon) => ({
          ...weapon,
          range: weapon.range ? { ...weapon.range } : { min: 0, max: 1 },
          modifiers: Array.isArray(weapon.modifiers) ? [...weapon.modifiers] : [],
        }))
      : [],
  };
}

function addArmor(def, type, amount) {
  if (amount <= 0) {
    return;
  }

  const armor = Array.isArray(def.armor) ? def.armor : [];
  const found = armor.find((entry) => entry.type === type);
  if (found) {
    found.value += amount;
    def.armor = armor;
    return;
  }

  armor.push({ type, value: amount });
  def.armor = armor;
}

function unitIsCavalry(def) {
  const classes = [
    ...(Array.isArray(def.classes) ? def.classes : []),
    ...(Array.isArray(def.displayClasses) ? def.displayClasses : []),
  ].map((entry) => String(entry).toLowerCase());

  return classes.some((entry) => entry.includes('cavalry') || entry.includes('horse'));
}

function unitHasClass(def, className) {
  const target = String(className || '').toLowerCase();
  const classes = [
    ...(Array.isArray(def.classes) ? def.classes : []),
    ...(Array.isArray(def.displayClasses) ? def.displayClasses : []),
  ].map((entry) => String(entry).toLowerCase());

  return classes.includes(target) || classes.some((entry) => entry.includes(target));
}

function unitIsInfantry(def) {
  return unitHasClass(def, 'infantry');
}

function unitIsMeleeInfantry(def) {
  return unitIsInfantry(def) && unitHasClass(def, 'melee');
}

function unitUsesGunpowder(def) {
  return unitHasClass(def, 'gunpowder');
}

function roundStat(value) {
  return Math.round(value * 1000) / 1000;
}

function applyTechTreeToUnitDef(def, selectedTechs = []) {
  if (!Array.isArray(selectedTechs) || selectedTechs.length === 0) {
    return def;
  }

  const next = cloneUnitDef(def);
  const meleeAttackLevels = countPrefix(selectedTechs, 'melee-attack-');
  const meleeDefenseLevels = countPrefix(selectedTechs, 'melee-defense-');
  const rangedAttackLevels = countPrefix(selectedTechs, 'ranged-attack-');
  const rangedDefenseLevels = countPrefix(selectedTechs, 'ranged-defense-');

  for (const weapon of next.weapons) {
    if (isMeleeWeapon(weapon)) {
      weapon.damage += meleeAttackLevels;
    }
    if (isRangedWeapon(weapon) && !unitUsesGunpowder(next)) {
      weapon.damage += rangedAttackLevels;
    }
  }

  addArmor(next, 'melee', meleeDefenseLevels);
  addArmor(next, 'ranged', rangedDefenseLevels);

  if (hasTech(selectedTechs, 'university-incendiary-arrows')) {
    for (const weapon of next.weapons) {
      if (isRangedWeapon(weapon) && !unitUsesGunpowder(next)) {
        weapon.damage = roundStat(weapon.damage * 1.2);
      }
    }
  }

  if (hasTech(selectedTechs, 'university-cavalry-biology') && unitIsCavalry(next)) {
    next.hitpoints = roundStat(next.hitpoints * 1.25);
  }

  if (hasTech(selectedTechs, 'university-elite-army-tactics') && unitIsMeleeInfantry(next)) {
    next.hitpoints = roundStat(next.hitpoints * 1.15);
    for (const weapon of next.weapons) {
      if (isMeleeWeapon(weapon)) {
        weapon.damage = roundStat(weapon.damage * 1.15);
      }
    }
  }

  if (hasTech(selectedTechs, 'university-archer-speed')) {
    for (const weapon of next.weapons) {
      if (isRangedWeapon(weapon)) {
        weapon.speed = Math.max(0.2, weapon.speed * 0.85);
      }
    }
  }

  return next;
}

module.exports = {
  applyTechTreeToUnitDef,
};
