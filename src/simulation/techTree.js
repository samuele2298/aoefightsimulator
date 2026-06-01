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
    classes: Array.isArray(def.classes) ? [...def.classes] : [],
    displayClasses: Array.isArray(def.displayClasses) ? [...def.displayClasses] : [],
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

function allUnitClasses(def) {
  return [
    ...(Array.isArray(def.classes) ? def.classes : []),
    ...(Array.isArray(def.displayClasses) ? def.displayClasses : []),
  ].map((entry) => String(entry).toLowerCase());
}

function unitMatchesClassSelector(def, classGroups) {
  if (!Array.isArray(classGroups) || classGroups.length === 0) {
    return false;
  }

  const classes = allUnitClasses(def);
  return classGroups.some((group) =>
    Array.isArray(group)
      && group.every((value) => classes.some((entry) => entry.includes(String(value).toLowerCase())))
  );
}

function unitMatchesSelector(def, select) {
  if (!select || typeof select !== 'object') {
    return false;
  }

  const idMatches = Array.isArray(select.id)
    ? select.id.some((id) => String(id).toLowerCase() === String(def.id || '').toLowerCase())
    : false;
  const classMatches = unitMatchesClassSelector(def, select.class);

  return idMatches || classMatches;
}

function hasExplicitSelector(select) {
  if (!select || typeof select !== 'object') {
    return false;
  }

  const hasId = Array.isArray(select.id) && select.id.length > 0;
  const hasClass = Array.isArray(select.class) && select.class.length > 0;
  return hasId || hasClass;
}

function applyArmorEffect(def, armorType, effect, value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  if (effect === 'multiply') {
    const found = (Array.isArray(def.armor) ? def.armor : []).find((entry) => entry.type === armorType);
    if (found) {
      found.value = roundStat(found.value * amount);
    } else {
      addArmor(def, armorType, 0);
      const created = def.armor.find((entry) => entry.type === armorType);
      if (created) {
        created.value = roundStat(created.value * amount);
      }
    }
    return;
  }

  addArmor(def, armorType, amount);
}

function applyAttackEffect(def, weaponMatcher, effect, value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  for (const weapon of def.weapons) {
    if (!weaponMatcher(weapon)) {
      continue;
    }
    if (effect === 'multiply') {
      weapon.damage = roundStat(weapon.damage * amount);
    } else if (effect === 'change') {
      weapon.damage = roundStat(weapon.damage + amount);
    }
  }
}

function applyAttackSpeedEffect(def, effect, value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  for (const weapon of def.weapons) {
    if (effect === 'multiply') {
      weapon.speed = Math.max(0.2, roundStat(weapon.speed * amount));
    } else if (effect === 'change') {
      weapon.speed = Math.max(0.2, roundStat(weapon.speed + amount));
    }
  }
}

function applyMoveSpeedEffect(def, effect, value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  const current = def.movement && typeof def.movement.speed === 'number' ? def.movement.speed : 1;
  if (effect === 'multiply') {
    def.movement.speed = roundStat(current * amount);
  } else if (effect === 'change') {
    def.movement.speed = roundStat(current + amount);
  }
}

function applyHitpointsEffect(def, effect, value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  if (effect === 'multiply') {
    def.hitpoints = roundStat(def.hitpoints * amount);
  } else if (effect === 'change') {
    def.hitpoints = roundStat(def.hitpoints + amount);
  }
}

function applyRangeEffect(def, effect, value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  for (const weapon of def.weapons) {
    if (!weapon.range || typeof weapon.range.max !== 'number') {
      continue;
    }
    if (effect === 'multiply') {
      weapon.range.max = roundStat(weapon.range.max * amount);
    } else if (effect === 'change') {
      weapon.range.max = roundStat(weapon.range.max + amount);
    }
  }
}

function applyUnknownEffectToUnit(def, rawEffect) {
  const techId = String(rawEffect && rawEffect._techId ? rawEffect._techId : '').toLowerCase();
  const amount = Number(rawEffect && rawEffect.value);
  if (!Number.isFinite(amount)) {
    return;
  }

  // OTD Meinwerk unique: Golden Cuirass. In data it is encoded as property
  // "unknown" + multiply 0.8 on Gilded Man-at-Arms. Model it as reduced
  // incoming damage.
  if (techId === 'golden-cuirass' && amount > 0) {
    const current = Number.isFinite(def.incomingDamageMultiplier)
      ? def.incomingDamageMultiplier
      : 1;
    def.incomingDamageMultiplier = roundStat(current * amount);
    return;
  }

  // OTD Meinwerk unique: Zornhau. Data encodes this as unknown ability with
  // +2 value for Gilded Landsknecht. Model it as flat melee damage increase.
  if (techId === 'zornhau') {
    applyAttackEffect(def, isMeleeWeapon, 'change', amount);
  }
}

function applyRawEffectToUnit(def, rawEffect) {
  if (!rawEffect || typeof rawEffect !== 'object') {
    return;
  }

  const property = String(rawEffect.property || '');
  const effect = String(rawEffect.effect || '').toLowerCase();
  if (effect !== 'change' && effect !== 'multiply') {
    return;
  }

  // Cantled Saddles does not increase Royal Knight's permanent melee damage.
  // It upgrades the temporary post-charge bonus from +3 to +10.
  if (
    property === 'meleeAttack'
    && effect === 'change'
    && rawEffect.type === 'bonus'
    && unitMatchesSelector(def, rawEffect.select)
    && Array.isArray(rawEffect.target && rawEffect.target.class)
    && def.id === 'royal-knight'
  ) {
    const amount = Number(rawEffect.value || 0);
    if (Number.isFinite(amount) && amount > 0) {
      def.chargeBonusDamage = amount;
    }
    return;
  }

  const value = rawEffect.value;
  switch (property) {
    case 'hitpoints':
      applyHitpointsEffect(def, effect, value);
      break;
    case 'moveSpeed':
    case 'movementSpeed':
      applyMoveSpeedEffect(def, effect, value);
      break;
    case 'meleeArmor':
      applyArmorEffect(def, 'melee', effect, value);
      break;
    case 'rangedArmor':
      applyArmorEffect(def, 'ranged', effect, value);
      break;
    case 'meleeAttack':
      applyAttackEffect(def, isMeleeWeapon, effect, value);
      break;
    case 'rangedAttack':
      applyAttackEffect(def, isRangedWeapon, effect, value);
      break;
    case 'attack':
      applyAttackEffect(def, () => true, effect, value);
      break;
    case 'attackSpeed':
      applyAttackSpeedEffect(def, effect, value);
      break;
    case 'maxRange':
      applyRangeEffect(def, effect, value);
      break;
    case 'unknown':
      applyUnknownEffectToUnit(def, rawEffect);
      break;
    default:
      break;
  }
}

function applyCivilizationPassiveBonuses(def, civ) {
  const civKey = String(civ || '').toLowerCase();

  // HRE passive: infantry units move 10% faster.
  if (civKey === 'hr' && unitIsInfantry(def)) {
    const speed = def.movement && typeof def.movement.speed === 'number' ? def.movement.speed : 1;
    def.movement.speed = roundStat(speed * 1.1);
  }
}

function applyTechTreeToUnitDef(def, selectedTechs = [], context = {}) {
  if (!Array.isArray(selectedTechs) || selectedTechs.length === 0) {
    const baseOnly = cloneUnitDef(def);
    applyCivilizationPassiveBonuses(baseOnly, context.civ);

    const rawTechs = Array.isArray(context.unitTechs) ? context.unitTechs : [];
    for (const tech of rawTechs) {
      const effects = Array.isArray(tech.effects) ? tech.effects : [];
      for (const rawEffect of effects) {
        const effectWithSource = { ...rawEffect, _techId: tech.id };
        const hasSelector = hasExplicitSelector(rawEffect.select);
        if (hasSelector && !unitMatchesSelector(baseOnly, rawEffect.select)) {
          continue;
        }
        applyRawEffectToUnit(baseOnly, effectWithSource);
      }
    }

    return baseOnly;
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

  // Custom Sengoku tech: grants deflective_armor to samurai units that don't
  // have it by default (stripped during normalisation for the 'sen' civilisation).
  if (hasTech(selectedTechs, 'sengoku-deflective-armor')) {
    const isSengokuSamurai = unitHasClass(next, 'samurai_jpn')
      || unitHasClass(next, 'daimyo_retainer');
    if (isSengokuSamurai && !next.classes.includes('deflective_armor')) {
      next.classes.push('deflective_armor');
    }
  }

  applyCivilizationPassiveBonuses(next, context.civ);

  const rawTechs = Array.isArray(context.unitTechs) ? context.unitTechs : [];
  for (const tech of rawTechs) {
    const effects = Array.isArray(tech.effects) ? tech.effects : [];
    for (const rawEffect of effects) {
      const effectWithSource = { ...rawEffect, _techId: tech.id };
      const hasSelector = hasExplicitSelector(rawEffect.select);
      if (hasSelector && !unitMatchesSelector(next, rawEffect.select)) {
        continue;
      }
      applyRawEffectToUnit(next, effectWithSource);
    }
  }

  return next;
}

module.exports = {
  applyTechTreeToUnitDef,
};
