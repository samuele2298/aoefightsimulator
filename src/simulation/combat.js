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

function classBonusDamage(attackerWeapon, targetUnit) {
  if (!attackerWeapon || !Array.isArray(attackerWeapon.modifiers)) {
    return 0;
  }

  return attackerWeapon.modifiers.reduce((sum, modifier) => {
    if (targetMatchesModifier(targetUnit, modifier)) {
      return sum + (typeof modifier.value === 'number' ? modifier.value : 0);
    }
    return sum;
  }, 0);
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
  const weapon = attacker.primaryWeapon;
  if (!weapon) {
    return 0;
  }

  const baseDamage = typeof weapon.damage === 'number' ? weapon.damage : 0;
  const bonus = classBonusDamage(weapon, target);
  const royalKnightBonus = attacker && attacker.getRoyalKnightChargeFlatBonus
    ? attacker.getRoyalKnightChargeFlatBonus()
    : 0;
  const chargeMultiplier = typeof context.chargeMultiplier === 'number'
    ? context.chargeMultiplier
    : 1;
  const armorType = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const armor = target.armorValue(armorType);
  const camelPenalty = isCamelAuraDebuffed(attacker, context.enemyUnits) ? 0.8 : 1;
  const rawDamage = (baseDamage + bonus + royalKnightBonus - armor) * camelPenalty * chargeMultiplier;

  return Math.max(0, rawDamage);
}

module.exports = {
  calculateDamage,
};
