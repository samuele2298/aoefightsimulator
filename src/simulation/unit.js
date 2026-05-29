'use strict';

const KNIGHT_CHARGE_MULTIPLIER = 1.5;
const HORSEMAN_CHARGE_MULTIPLIER = 1.35;
const ROYAL_KNIGHT_CHARGE_FLAT_BONUS = 3;

class SimUnit {
  constructor({ id, team, def, x, y }) {
    this.id = id;
    this.team = team;
    this.def = def;
    this.x = x;
    this.y = y;

    this.maxHp = def.hitpoints;
    this.hp = def.hitpoints;
    this.state = 'IDLE';

    this.attackCooldown = 0;
    this.targetId = null;
    this.dead = false;

    this.lastCombatTick = Number.NEGATIVE_INFINITY;
    this.deflectiveArmorCharge = this.hasDeflectiveArmor();
    this.chargeReady = this.canUseCharge();
    this.chargeApproachActive = false;
    this.royalKnightChargeBonusTicks = 0;
  }

  get speed() {
    return this.def.movement && typeof this.def.movement.speed === 'number'
      ? this.def.movement.speed
      : 1;
  }

  get primaryWeapon() {
    if (!Array.isArray(this.def.weapons) || this.def.weapons.length === 0) {
      return null;
    }

    if (this.def.preferredWeaponType === 'melee' || this.def.preferredWeaponType === 'ranged') {
      const preferred = this.def.weapons.find((w) => w.type === this.def.preferredWeaponType);
      if (preferred) {
        return preferred;
      }
    }

    // Prefer combat weapons over fire/siege torch fallback.
    const rangedOrMelee = this.def.weapons.find(
      (w) => w.type === 'ranged' || w.type === 'melee'
    );
    return rangedOrMelee || this.def.weapons[0];
  }

  isRanged() {
    const weapon = this.primaryWeapon;
    if (!weapon) {
      return false;
    }
    return weapon.type === 'ranged' && weapon.range && weapon.range.max > 1;
  }

  hasClass(className) {
    return Array.isArray(this.def.classes) && this.def.classes.includes(className);
  }

  isCavalry() {
    return this.hasClass('cavalry') || this.hasClass('horse') || this.hasClass('camel');
  }

  hasDeflectiveArmor() {
    return this.hasClass('deflective_armor');
  }

  isRoyalKnight() {
    return String(this.def.id || '').toLowerCase() === 'royal-knight';
  }

  canUseCharge() {
    const id = String(this.def.id || '').toLowerCase();
    const isCamelRaider = id.includes('camel') && id.includes('raider');
    if (id === 'sofa' || id === 'camel-rider' || id === 'camel-raider' || isCamelRaider) {
      return false;
    }

    // Charge is available to all cavalry and knight-type units except explicit exclusions.
    return this.isCavalry() || id.includes('knight');
  }

  getChargeMultiplier() {
    const id = String(this.def.id || '').toLowerCase();
    if (id.includes('horseman')) {
      return HORSEMAN_CHARGE_MULTIPLIER;
    }
    if (id.includes('knight')) {
      return KNIGHT_CHARGE_MULTIPLIER;
    }
    if (this.isCavalry()) {
      return HORSEMAN_CHARGE_MULTIPLIER;
    }
    return 1;
  }

  getRoyalKnightChargeFlatBonus() {
    return this.royalKnightChargeBonusTicks > 0 ? ROYAL_KNIGHT_CHARGE_FLAT_BONUS : 0;
  }

  tickSpecialState(currentTick, deflectiveRechargeTicks) {
    if (this.dead) {
      return;
    }

    if (this.hasDeflectiveArmor() && !this.deflectiveArmorCharge
      && currentTick - this.lastCombatTick >= deflectiveRechargeTicks) {
      this.deflectiveArmorCharge = true;
    }

    if (this.royalKnightChargeBonusTicks > 0) {
      this.royalKnightChargeBonusTicks -= 1;
    }

    // Charge is one-time only: after first consume it never recharges.
  }

  consumeDeflectiveArmor(currentTick) {
    if (!this.hasDeflectiveArmor() || !this.deflectiveArmorCharge) {
      return false;
    }

    this.deflectiveArmorCharge = false;
    this.lastCombatTick = currentTick;
    return true;
  }

  consumeCharge(currentTick, royalKnightChargeBonusTicks) {
    if (!this.canUseCharge() || !this.chargeReady) {
      return false;
    }

    this.chargeReady = false;
    this.chargeApproachActive = false;
    this.lastCombatTick = currentTick;

    if (this.isRoyalKnight() && royalKnightChargeBonusTicks > 0) {
      this.royalKnightChargeBonusTicks = royalKnightChargeBonusTicks;
    }

    return true;
  }

  registerCombat(currentTick) {
    this.lastCombatTick = currentTick;
  }

  armorValue(attackType) {
    if (!Array.isArray(this.def.armor)) {
      return 0;
    }
    const found = this.def.armor.find((a) => a.type === attackType);
    return found ? found.value : 0;
  }

  applyDamage(value) {
    this.hp -= value;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.state = 'DEAD';
    }
  }

  toSnapshot() {
    return {
      id: this.id,
      team: this.team,
      unitId: this.def.id,
      name: this.def.name,
      x: this.x,
      y: this.y,
      hp: this.hp,
      maxHp: this.maxHp,
      state: this.state,
      isRanged: this.isRanged(),
      iconKey: this.def.iconKey,
      chargeActive: Boolean(this.chargeApproachActive),
      deflectiveArmorActive: Boolean(this.deflectiveArmorCharge),
      resourceValue: this.def.costs && this.def.costs.total ? this.def.costs.total : 0,
    };
  }
}

module.exports = SimUnit;
