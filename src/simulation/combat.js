'use strict';

function targetMatchesModifier(targetUnit, modifier) {
  if (!modifier || !modifier.target || !Array.isArray(modifier.target.class)) {
    return false;
  }

  const targetClasses = targetUnit.def && Array.isArray(targetUnit.def.classes)
    ? targetUnit.def.classes
    : [];

  return modifier.target.class.some((group) =>
    Array.isArray(group) ? group.every((c) => targetClasses.includes(c)) : false
  );
}

function classBonusDetails(attackerWeapon, targetUnit) {
  if (!attackerWeapon || !Array.isArray(attackerWeapon.modifiers)) {
    return {
      total: 0,
      matched: [],
      unmatchedCount: 0,
    };
  }

  const matched = [];
  let total = 0;
  let unmatchedCount = 0;

  for (const modifier of attackerWeapon.modifiers) {
    if (targetMatchesModifier(targetUnit, modifier)) {
      const value = typeof modifier.value === 'number' ? modifier.value : 0;
      total += value;
      matched.push({
        property: modifier.property || null,
        value,
        effect: modifier.effect || null,
        targetClasses: Array.isArray(modifier.target && modifier.target.class)
          ? modifier.target.class
          : [],
      });
    } else {
      unmatchedCount += 1;
    }
  }

  return {
    total,
    matched,
    unmatchedCount,
  };
}

function isCamelAuraDebuffed(attacker, enemyUnits) {
  if (!attacker || !attacker.isCavalry || !attacker.isCavalry()) {
    return false;
  }

  for (const enemy of enemyUnits || []) {
    if (!enemy || enemy.dead || !enemy.hasClass || !enemy.hasClass('camel')) {
      continue;
    }

    const dx = attacker.x - enemy.x;
    const dy = attacker.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= 5) {
      return true;
    }
  }

  return false;
}

function calculateDamage(attacker, target, context = {}) {
  return calculateDamageDetailed(attacker, target, context).damage;
}

function calculateDamageDetailed(attacker, target, context = {}) {
  const weapon = attacker.primaryWeapon;
  if (!weapon) {
    return {
      damage: 0,
      breakdown: {
        reason: 'no_weapon',
      },
    };
  }

  const baseDamage = typeof weapon.damage === 'number' ? weapon.damage : 0;
  const classBonus = classBonusDetails(weapon, target);
  const chargeBonus = typeof context.chargeFlatBonus === 'number'
    ? context.chargeFlatBonus
    : 0;
  const chargeMultiplier = typeof context.chargeMultiplier === 'number'
    ? context.chargeMultiplier
    : 1;
  const armorType = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const armor = target.armorValue(armorType);
  const camelAuraDebuffed = isCamelAuraDebuffed(attacker, context.enemyUnits);
  const camelPenalty = camelAuraDebuffed ? 0.8 : 1;
  const incomingDamageMultiplier = Number.isFinite(target && target.def && target.def.incomingDamageMultiplier)
    ? Math.max(0, target.def.incomingDamageMultiplier)
    : 1;
  const preArmorDamage = baseDamage + classBonus.total + chargeBonus;
  const rawBeforeMultipliers = preArmorDamage - armor;
  const rawDamage = rawBeforeMultipliers * camelPenalty * chargeMultiplier;
  const finalDamage = Math.max(0, rawDamage * incomingDamageMultiplier);

  return {
    damage: finalDamage,
    breakdown: {
      weaponType: weapon.type || 'unknown',
      baseDamage,
      classBonusTotal: classBonus.total,
      classBonusMatched: classBonus.matched,
      classBonusUnmatchedCount: classBonus.unmatchedCount,
      chargeBonus,
      armorType,
      armor,
      preArmorDamage,
      rawBeforeMultipliers,
      camelAuraDebuffed,
      camelPenalty,
      chargeMultiplier,
      incomingDamageMultiplier,
      rawDamage,
      finalDamage,
    },
  };
}

module.exports = {
  calculateDamage,
  calculateDamageDetailed,
};
