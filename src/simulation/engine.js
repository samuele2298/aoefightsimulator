'use strict';

const config = require('../../config');
const logger = require('../../logger');
const { calculateDamageDetailed } = require('./combat');
const {
  distance,
  moveToward,
  applySeparation,
  avoidObstacles,
} = require('./battlefield');
const { selectTarget: selectStraight } = require('./strategies/straightFight');

const DEFLECTIVE_ARMOR_RECHARGE_TICKS = Math.round(8 / config.tickDelta);
const CHARGE_ATTACK = 3; // Only in the charge attack
const MIN_REATTACK_SECS = 0.5;
const HEAL_EPSILON = 0.01;

function weaponRange(unit) {
  const weapon = unit.primaryWeapon;
  if (!weapon || !weapon.range) {
    return 1;
  }
  return typeof weapon.range.max === 'number' ? weapon.range.max : 1;
}

function teamForwardDirection(team) {
  return team === 'A' ? 1 : -1;
}

/**
 * Time (seconds) the unit is FROZEN during an attack: aim + windup + attack.
 * Unit cannot move during this phase.
 */
function getImmobileDuration(unit) {
  const weapon = unit.primaryWeapon;
  if (weapon && weapon.durations) {
    const d = weapon.durations;
    return (d.aim || 0) + (d.windup || 0) + (d.attack || 0);
  }
  return 0;
}

/**
 * Time (seconds) the unit can MOVE but cannot attack: winddown + reload + setup + teardown + cooldown.
 */
function getRecoveryDuration(unit) {
  const weapon = unit.primaryWeapon;
  if (weapon && weapon.durations) {
    const d = weapon.durations;
    return (d.winddown || 0) + (d.reload || 0) + (d.setup || 0) + (d.teardown || 0) + (d.cooldown || 0);
  }
  return MIN_REATTACK_SECS;
}

function armorByType(unit) {
  return {
    melee: unit.armorValue('melee'),
    ranged: unit.armorValue('ranged'),
  };
}

function classesFor(unit) {
  return Array.isArray(unit && unit.def && unit.def.classes) ? unit.def.classes : [];
}

function unitDebugSnapshot(unit) {
  const weapon = unit.primaryWeapon;
  return {
    id: unit.id,
    team: unit.team,
    unitId: unit.def && unit.def.id ? unit.def.id : null,
    name: unit.def && unit.def.name ? unit.def.name : unit.id,
    hp: unit.hp,
    maxHp: unit.maxHp,
    classes: classesFor(unit),
    movementSpeed: unit.speed,
    armor: armorByType(unit),
    weapon: weapon
      ? {
          name: weapon.name || null,
          type: weapon.type || null,
          damage: typeof weapon.damage === 'number' ? weapon.damage : 0,
          speed: typeof weapon.speed === 'number' ? weapon.speed : null,
          range: weapon.range || { min: 0, max: 1 },
          modifiers: Array.isArray(weapon.modifiers)
            ? weapon.modifiers.map((modifier) => ({
                property: modifier.property || null,
                value: typeof modifier.value === 'number' ? modifier.value : 0,
                effect: modifier.effect || null,
                targetClasses: modifier.target && modifier.target.class ? modifier.target.class : [],
              }))
            : [],
        }
      : null,
    techContext: unit.def && unit.def.debugTechContext ? unit.def.debugTechContext : null,
    healing: unit.def && unit.def.healing ? unit.def.healing : null,
  };
}

function combatReasonFromBreakdown(breakdown) {
  if (!breakdown || breakdown.reason === 'no_weapon') {
    return 'No valid weapon: damage 0';
  }

  const bonusReasons = (breakdown.classBonusMatched || []).map((entry) => {
    const classes = Array.isArray(entry.targetClasses)
      ? entry.targetClasses.map((group) => Array.isArray(group) ? group.join('&') : String(group)).join(' | ')
      : '';
    return `+${entry.value} vs [${classes}]`;
  });

  return [
    `base=${breakdown.baseDamage}`,
    `bonus=${breakdown.classBonusTotal}${bonusReasons.length ? ` (${bonusReasons.join(', ')})` : ''}`,
    `chargeBonus=${breakdown.chargeBonus}`,
    `armor(${breakdown.armorType})=${breakdown.armor}`,
    `camelPenalty=${breakdown.camelPenalty}`,
    `chargeMultiplier=${breakdown.chargeMultiplier}`,
    `raw=${breakdown.rawDamage}`,
    `final=${breakdown.finalDamage}`,
  ].join(' | ');
}

function emitCombatDebugLog({ tick, blocked, attacker, target, damage, breakdown }) {
  if (!config.combatDebugLog) {
    return;
  }

  const payload = {
    event: 'combat_attack',
    tick,
    blocked,
    attacker: unitDebugSnapshot(attacker),
    defender: unitDebugSnapshot(target),
    result: {
      inflictedDamage: damage,
      breakdown,
      reason: blocked
        ? 'Attack blocked by deflective armor (no HP damage)'
        : combatReasonFromBreakdown(breakdown),
      defenderHpAfter: target.hp,
    },
  };

  logger.debug(`[COMBAT_DEBUG] ${JSON.stringify(payload)}`);
}

function normalizeFocusFire(focusFire) {
  const parsedGroupSplit = parseInt((focusFire && focusFire.groupSplit) || 1, 10);
  const parsedReattack = parseFloat(focusFire && focusFire.reattackTime);
  return {
    targetUnitId: (focusFire && focusFire.targetUnitId) || null,
    groupSplit: Math.max(1, Number.isFinite(parsedGroupSplit) ? parsedGroupSplit : 1),
    reattackTime: Number.isFinite(parsedReattack)
      ? Math.max(MIN_REATTACK_SECS, parsedReattack)
      : MIN_REATTACK_SECS,
  };
}

function focusStrategySignature(strategy, normalizedFocus = null) {
  const stratType = (strategy && strategy.type) || 'straight';
  const ff = normalizedFocus || normalizeFocusFire(strategy && strategy.focusFire);
  return `${stratType}|${ff.targetUnitId || '*'}|${ff.groupSplit}|${ff.reattackTime}`;
}

function sameFocusStrategy(left, right) {
  return focusStrategySignature(left) === focusStrategySignature(right);
}

function buildFocusGroupContext(unit, allies, unitStrategy, normalizedFocus = null) {
  const ff = normalizedFocus || normalizeFocusFire(unitStrategy && unitStrategy.focusFire);
  const cohort = allies.filter((ally) => {
    if (ally.dead || !ally.def || ally.def.id !== unit.def.id) {
      return false;
    }
    return sameFocusStrategy(ally.strategy || { type: 'straight' }, unitStrategy || { type: 'straight' });
  });

  if (!cohort.length) {
    const fallbackSignature = focusStrategySignature(unitStrategy || { type: 'straight' }, ff);
    return {
      cohort: [unit],
      members: [unit],
      groupSplit: ff.groupSplit,
      groupIndex: 0,
      groupKey: `${unit.team}|${unit.def.id}|${fallbackSignature}|0`,
    };
  }

  cohort.sort((a, b) => a.y - b.y);
  const rank = cohort.findIndex((ally) => ally.id === unit.id);
  const effectiveRank = rank >= 0 ? rank : 0;
  const groupSize = Math.ceil(Math.max(1, cohort.length) / ff.groupSplit);
  const groupIndex = Math.floor(effectiveRank / Math.max(1, groupSize));
  const start = groupIndex * groupSize;
  const members = cohort.slice(start, start + groupSize);
  const signature = focusStrategySignature(unitStrategy || { type: 'straight' }, ff);

  return {
    cohort,
    members: members.length ? members : [unit],
    groupSplit: ff.groupSplit,
    groupIndex,
    groupKey: `${unit.team}|${unit.def.id}|${signature}|${groupIndex}`,
  };
}

/**
 * Select target for a focus-fire strategy (kiting or straightFocusFire).
 * Prefers the specified targetUnitId if any, falls back to any alive enemy.
 * Group split divides same-type allies by Y into N groups, each group targets
 * a different Y-sorted enemy.
 */
function selectTargetFocusFire(unit, enemies, focusFire, allies, groupContext = null, preferredLaneY = null) {
  const aliveEnemies = enemies.filter((e) => !e.dead);
  if (!aliveEnemies.length) {
    return null;
  }

  const normalizedFocus = normalizeFocusFire(focusFire);
  const targetUnitId = normalizedFocus.targetUnitId;
  const groupSplit = normalizedFocus.groupSplit;

  const preferred = targetUnitId
    ? aliveEnemies.filter((e) => e.def && e.def.id === targetUnitId)
    : aliveEnemies;
  const pool = preferred.length ? preferred : aliveEnemies;

  const pickClosestToPoint = (candidates, point) => {
    if (!candidates.length) {
      return null;
    }
    let best = candidates[0];
    let bestDist = distance(point, best);
    for (let i = 1; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const d = distance(point, candidate);
      if (d < bestDist) {
        best = candidate;
        bestDist = d;
      }
    }
    return best;
  };

  // Group split: divide own units of same type by Y, each group targets different Y-sorted enemy
  const sameTypeAllies = groupContext
    ? [...groupContext.cohort]
    : allies.filter((a) => !a.dead && a.def && a.def.id === unit.def.id);
  const allySet = groupContext
    ? [...groupContext.members]
    : (sameTypeAllies.length ? sameTypeAllies : [unit]);

  if (groupSplit <= 1) {
    // One shared focus target for the whole platoon.
    // Keep a stable lane anchor when available so groups do not drift upward/downward over time.
    const center = allySet.reduce(
      (acc, ally) => ({ x: acc.x + ally.x, y: acc.y + ally.y }),
      { x: 0, y: 0 }
    );
    center.x /= allySet.length;
    center.y /= allySet.length;
    const laneY = typeof preferredLaneY === 'number' ? preferredLaneY : center.y;
    const sortedByLane = [...pool].sort((a, b) => {
      const laneDiffA = Math.abs(a.y - laneY);
      const laneDiffB = Math.abs(b.y - laneY);
      if (laneDiffA !== laneDiffB) {
        return laneDiffA - laneDiffB;
      }
      const forwardDiffA = Math.abs(a.x - center.x);
      const forwardDiffB = Math.abs(b.x - center.x);
      return forwardDiffA - forwardDiffB;
    });
    return sortedByLane[0] || pickClosestToPoint(pool, center);
  }

  let groupIndex = 0;
  if (groupContext) {
    groupIndex = groupContext.groupIndex;
  } else {
    sameTypeAllies.sort((a, b) => a.y - b.y);
    const rank = sameTypeAllies.findIndex((a) => a.id === unit.id);
    const effectiveRank = rank >= 0 ? rank : 0;
    const groupSize = Math.ceil(Math.max(1, sameTypeAllies.length) / groupSplit);
    groupIndex = Math.floor(effectiveRank / Math.max(1, groupSize));
  }

  const sortedPool = [...pool].sort((a, b) => a.y - b.y);
  const preferredByIndex = sortedPool[groupIndex % sortedPool.length];
  if (!preferredByIndex) {
    return pool[0] || null;
  }

  // Keep each split group in its own lane whenever possible.
  const laneY = typeof preferredLaneY === 'number' ? preferredLaneY : preferredByIndex.y;
  const bandSize = Math.ceil(Math.max(1, sortedPool.length) / groupSplit);
  const bandStart = groupIndex * bandSize;
  const band = sortedPool.slice(bandStart, bandStart + bandSize);
  const source = band.length ? band : sortedPool;
  const sortedByLane = [...source].sort((a, b) => {
    const laneDiffA = Math.abs(a.y - laneY);
    const laneDiffB = Math.abs(b.y - laneY);
    if (laneDiffA !== laneDiffB) {
      return laneDiffA - laneDiffB;
    }
    const forwardDiffA = Math.abs(a.x - unit.x);
    const forwardDiffB = Math.abs(b.x - unit.x);
    return forwardDiffA - forwardDiffB;
  });
  return sortedByLane[0] || preferredByIndex;
}

class SimulationEngine {
  constructor({ unitsA, unitsB, environment, onTick, onEnd }) {
    this.unitsA = unitsA;
    this.unitsB = unitsB;
    this.environment = environment || { obstacles: [], buildingAttackers: [] };
    this.onTick = onTick;
    this.onEnd = onEnd;

    this.tick = 0;
    this.running = false;
    this.paused = false;
    this.finished = false;
    this.result = null;

    this.lastSnapshots = [];
    this.focusGroupStates = new Map();
  }

  allUnits() {
    return [...this.unitsA, ...this.unitsB];
  }

  aliveUnits(team) {
    const source = team === 'A' ? this.unitsA : this.unitsB;
    return source.filter((u) => !u.dead);
  }

  aliveRangedUnits(team) {
    return this.aliveUnits(team).filter((u) => u.isRanged());
  }

  aliveMeleeUnits(team) {
    return this.aliveUnits(team).filter((u) => !u.isRanged());
  }

  postMove(unit, allies) {
    applySeparation(
      unit,
      allies,
      config.separationStrength,
      config.unitRadius,
      config.mapWidth,
      config.mapHeight
    );
    avoidObstacles(unit, this.environment.obstacles, config.mapWidth, config.mapHeight);
  }

  moveToPoint(unit, point, allies) {
    const step = unit.speed * config.tickDelta;
    moveToward(unit, point, step, config.mapWidth, config.mapHeight);
    this.postMove(unit, allies);
  }

  moveForwardAclick(unit, allies) {
    const dir = teamForwardDirection(unit.team);
    this.moveToPoint(
      unit,
      {
        x: unit.x + dir * 8,
        y: unit.y,
      },
      allies
    );
  }

  hasEnemyInRange(unit, enemies) {
    const range = weaponRange(unit);
    for (const enemy of enemies) {
      if (enemy.dead) {
        continue;
      }
      if (distance(unit, enemy) <= range) {
        return true;
      }
    }
    return false;
  }

  buildHealerLines(unit, allies) {
    const dir = teamForwardDirection(unit.team);
    const aliveAllies = allies.filter((ally) => ally && !ally.dead && ally.id !== unit.id);
    if (!aliveAllies.length) {
      return null;
    }

    const combatAllies = aliveAllies.filter((ally) => ally.hasWeapon && ally.hasWeapon());
    const refs = combatAllies.length ? combatAllies : aliveAllies;
    if (!refs.length) {
      return null;
    }

    const xs = refs.map((ally) => ally.x);
    const ys = refs.map((ally) => ally.y);
    const frontlineX = dir > 0 ? Math.max(...xs) : Math.min(...xs);
    const rearlineX = dir > 0 ? Math.min(...xs) : Math.max(...xs);
    const supportX = rearlineX - (dir * 1.4);
    const offsideX = frontlineX - (dir * 0.6);

    return {
      dir,
      frontlineX,
      rearlineX,
      supportX,
      offsideX,
      centerY: ys.reduce((sum, y) => sum + y, 0) / ys.length,
    };
  }

  clampHealerTargetX(unit, x, lines) {
    if (!lines) {
      return x;
    }
    if (lines.dir > 0) {
      return Math.min(x, lines.offsideX);
    }
    return Math.max(x, lines.offsideX);
  }

  findHealTarget(unit, allies) {
    const healing = unit.healingProfile ? unit.healingProfile() : null;
    const single = healing && healing.singleTarget && healing.singleTarget.enabled
      ? healing.singleTarget
      : null;
    if (!single) {
      return null;
    }

    const maxAcquireRange = typeof single.acquireRange === 'number' ? single.acquireRange : 10;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const ally of allies) {
      if (!ally || ally.dead || ally.hp >= ally.maxHp - HEAL_EPSILON || ally.id === unit.id) {
        continue;
      }
      const d = distance(unit, ally);
      if (d > maxAcquireRange) {
        continue;
      }
      if (!best || d < bestDist || (Math.abs(d - bestDist) < 0.0001 && (ally.maxHp - ally.hp) > (best.maxHp - best.hp))) {
        best = ally;
        bestDist = d;
      }
    }

    return best;
  }

  applyAuraHealing(unit, allies, requireAttackTrigger = false) {
    const healing = unit.healingProfile ? unit.healingProfile() : null;
    const aura = healing && healing.aura && healing.aura.enabled ? healing.aura : null;
    if (!aura) {
      return false;
    }
    if (requireAttackTrigger && !aura.requiresAttack) {
      return false;
    }
    if (!requireAttackTrigger && aura.requiresAttack) {
      return false;
    }

    const radius = typeof aura.radius === 'number' ? aura.radius : 3.4;
    const perTick = Math.max(0, (typeof aura.rate === 'number' ? aura.rate : 0) * config.tickDelta);
    if (perTick <= 0) {
      return false;
    }

    let healedAny = false;
    for (const ally of allies) {
      if (!ally || ally.id === unit.id || ally.dead || ally.hp >= ally.maxHp - HEAL_EPSILON) {
        continue;
      }
      if (distance(unit, ally) <= radius) {
        ally.applyHealing(perTick);
        healedAny = true;
      }
    }

    return healedAny;
  }

  applySingleTargetHealing(unit, target) {
    const healing = unit.healingProfile ? unit.healingProfile() : null;
    const single = healing && healing.singleTarget && healing.singleTarget.enabled
      ? healing.singleTarget
      : null;
    if (!single || !target || target.dead) {
      return false;
    }

    const range = typeof single.range === 'number' ? single.range : 3.25;
    if (distance(unit, target) > range) {
      return false;
    }

    const perTick = Math.max(0, (typeof single.rate === 'number' ? single.rate : 0) * config.tickDelta);
    if (perTick <= 0) {
      return false;
    }

    target.applyHealing(perTick);
    return true;
  }

  applyOnAttackHealing(unit, allies) {
    const healing = unit.healingProfile ? unit.healingProfile() : null;
    const onAttack = healing && healing.onAttackHeal && healing.onAttackHeal.enabled
      ? healing.onAttackHeal
      : null;
    if (!onAttack) {
      return;
    }

    const amount = Math.max(0, typeof onAttack.amount === 'number' ? onAttack.amount : 0);
    const radius = typeof onAttack.radius === 'number' ? onAttack.radius : 3;
    if (amount <= 0) {
      return;
    }

    for (const ally of allies) {
      if (!ally || ally.dead || ally.hp >= ally.maxHp - HEAL_EPSILON) {
        continue;
      }
      if (distance(unit, ally) <= radius) {
        ally.applyHealing(amount);
      }
    }
  }

  updateUnitHealer(unit, allies, enemies) {
    const healing = unit.healingProfile ? unit.healingProfile() : null;
    if (!healing || !unit.canHeal || !unit.canHeal()) {
      return false;
    }

    const canAttack = unit.hasWeapon && unit.hasWeapon();

    // Healer units that can fight are handled by normal combat logic/strategy.
    if (canAttack) {
      this.applyAuraHealing(unit, allies, false);
      return false;
    }

    this.applyAuraHealing(unit, allies, false);

    const healTarget = this.findHealTarget(unit, allies);
    const lines = this.buildHealerLines(unit, allies);

    if (healTarget) {
      const single = healing.singleTarget && healing.singleTarget.enabled ? healing.singleTarget : null;
      if (single) {
        const inRange = distance(unit, healTarget) <= (typeof single.range === 'number' ? single.range : 3.25);
        if (inRange) {
          unit.state = 'HEALING';
          unit.targetId = healTarget.id;
          this.applySingleTargetHealing(unit, healTarget);
          return true;
        }

        const advancePoint = {
          x: this.clampHealerTargetX(unit, healTarget.x, lines),
          y: healTarget.y,
        };

        unit.state = 'MOVING';
        unit.targetId = healTarget.id;
        this.moveToPoint(unit, advancePoint, allies);
        return true;
      }
    }

    if (lines) {
      const holdPoint = {
        x: lines.supportX,
        y: lines.centerY,
      };

      const holdDist = distance(unit, holdPoint);
      if (holdDist > 0.7) {
        unit.state = 'MOVING';
        unit.targetId = null;
        this.moveToPoint(unit, holdPoint, allies);
      } else {
        unit.state = 'IDLE';
        unit.targetId = null;
      }
      return true;
    }

    unit.state = 'IDLE';
    unit.targetId = null;
    return true;
  }

  fireAttack(unit, target, enemies, allies) {
    unit.registerCombat(this.tick);
    target.registerCombat(this.tick);

    let chargeMultiplier = 1;
    let chargeFlatBonus = 0;
    if (unit.chargeApproachActive && unit.consumeCharge) {
      const consumedCharge = unit.consumeCharge(this.tick);
      if (consumedCharge) {
        chargeMultiplier = unit.getChargeMultiplier ? unit.getChargeMultiplier() : 1;
        chargeFlatBonus = CHARGE_ATTACK;
      }
    }

    const blocked = target.consumeDeflectiveArmor(this.tick);

    if (!blocked) {
      const detailed = calculateDamageDetailed(unit, target, {
        enemyUnits: enemies,
        chargeMultiplier,
        chargeFlatBonus,
      });
      const damage = detailed.damage;
      target.applyDamage(damage);

      emitCombatDebugLog({
        tick: this.tick,
        blocked: false,
        attacker: unit,
        target,
        damage,
        breakdown: detailed.breakdown,
      });

      if (unit.hasClass && unit.hasClass('landsknecht') && unit.primaryWeapon && unit.primaryWeapon.type === 'melee') {
        for (const enemy of enemies) {
          if (enemy.dead || enemy.id === target.id) {
            continue;
          }
          if (distance(target, enemy) <= weaponRange(unit)) {
            enemy.applyDamage(damage);
            enemy.registerCombat(this.tick);
          }
        }
      }

      if (Array.isArray(allies) && allies.length) {
        this.applyOnAttackHealing(unit, allies);
      }
    } else {
      emitCombatDebugLog({
        tick: this.tick,
        blocked: true,
        attacker: unit,
        target,
        damage: 0,
        breakdown: {
          reason: 'deflective_armor_block',
          chargeMultiplier,
        },
      });
    }

    const weapon = unit.primaryWeapon;
    return weapon && typeof weapon.speed === 'number' ? weapon.speed : 1;
  }

  getFocusGroupState(groupKey) {
    let state = this.focusGroupStates.get(groupKey);
    if (!state) {
      state = {
        phase: 'approach',
        phaseUntilTick: 0,
        volleyTick: -1,
        targetId: null,
        lastAdvancedTick: -1,
        laneY: null,
      };
      this.focusGroupStates.set(groupKey, state);
    }
    return state;
  }

  updateUnitFocusFireGrouped(unit, allies, enemies, unitStrategy, mode) {
    const focusFire = normalizeFocusFire(unitStrategy.focusFire || {});
    const groupContext = buildFocusGroupContext(unit, allies, unitStrategy, focusFire);
    const groupState = this.getFocusGroupState(groupContext.groupKey);

    if (typeof groupState.laneY !== 'number') {
      const members = groupContext.members.length ? groupContext.members : [unit];
      groupState.laneY = members.reduce((sum, member) => sum + member.y, 0) / members.length;
    }

    if (groupState.lastAdvancedTick !== this.tick) {
      if (groupState.phase === 'firing' && this.tick >= groupState.phaseUntilTick) {
        groupState.phase = mode === 'kiting' ? 'retreat' : 'waiting';
        const recoveryDuration = getRecoveryDuration(unit);
        groupState.phaseUntilTick = this.tick + Math.max(1, Math.ceil(recoveryDuration / config.tickDelta));
      } else if ((groupState.phase === 'retreat' || groupState.phase === 'waiting') && this.tick >= groupState.phaseUntilTick) {
        groupState.phase = 'approach';
        groupState.phaseUntilTick = 0;
      }
      groupState.lastAdvancedTick = this.tick;
    }

    let target = null;
    if (groupState.targetId) {
      target = enemies.find((enemy) => !enemy.dead && enemy.id === groupState.targetId) || null;
    }
    if (!target) {
      target = selectTargetFocusFire(unit, enemies, focusFire, allies, groupContext, groupState.laneY);
      groupState.targetId = target ? target.id : null;
    }

    if (!target) {
      unit.state = 'MOVING';
      unit.targetId = null;
      this.moveForwardAclick(unit, allies);
      return;
    }

    unit.targetId = target.id;
    const dist = distance(unit, target);
    const range = weaponRange(unit);

    if (groupState.phase === 'firing') {
      unit.state = 'ATTACKING';
      if (groupState.volleyTick === this.tick && unit.lastGroupVolleyTick !== groupState.volleyTick) {
        if (dist <= range) {
          this.fireAttack(unit, target, enemies, allies);
        }
        unit.lastGroupVolleyTick = groupState.volleyTick;
      }
      return;
    }

    if (groupState.phase === 'retreat') {
      const retreatDir = unit.team === 'A' ? -1 : 1;
      unit.state = 'MOVING';
      this.moveToPoint(unit, { x: unit.x + retreatDir * 10, y: unit.y }, allies);
      return;
    }

    if (groupState.phase === 'waiting') {
      unit.state = 'IDLE';
      return;
    }

    // Approach phase: if one member reaches range, whole group starts a shared volley timer.
    if (dist > range) {
      unit.state = 'MOVING';
      this.moveToPoint(unit, target, allies);
      return;
    }

    if (groupState.volleyTick !== this.tick) {
      const immobileDuration = getImmobileDuration(unit);
      groupState.phase = 'firing';
      groupState.phaseUntilTick = this.tick + Math.max(1, Math.ceil(immobileDuration / config.tickDelta));
      groupState.volleyTick = this.tick;
    }

    unit.state = 'ATTACKING';
    if (unit.lastGroupVolleyTick !== groupState.volleyTick) {
      if (dist <= range) {
        this.fireAttack(unit, target, enemies, allies);
      }
      unit.lastGroupVolleyTick = groupState.volleyTick;
    }
  }

  /**
   * Straight Fight – pure a-click.
   * Move toward nearest enemy, attack when in range.
   * Attack cycle:
   *   1. aim+windup+attack  → FROZEN (ATTACKING state, cannot move)
   *   2. winddown+reload+setup+teardown+cooldown → RECOVERY (can move, cannot attack)
   *   3. cycle complete → repeat
   */
  updateUnitStraight(unit, allies, enemies) {
    const range = weaponRange(unit);
    const target = selectStraight(unit, enemies);

    if (!target) {
      unit.chargeApproachActive = false;
      unit.state = 'MOVING';
      unit.targetId = null;
      this.moveForwardAclick(unit, allies);
      return;
    }

    unit.targetId = target.id;
    const dist = distance(unit, target);

    // Phase 1 – FROZEN: aim + windup + attack
    if (this.tick < unit.attackAnimEndTick) {
      unit.state = 'ATTACKING';
      return;
    }

    // Phase 2 – RECOVERY: winddown + reload + setup + teardown + cooldown
    if (this.tick < unit.reattackReadyTick) {
      unit.state = 'MOVING';
      if (dist > range) {
        if (unit.canUseCharge && unit.canUseCharge() && unit.chargeReady) {
          unit.chargeApproachActive = true;
        }
        this.moveToPoint(unit, target, allies);
      }
      return;
    }

    // Phase 3 – READY to attack again
    if (dist > range) {
      if (unit.canUseCharge && unit.canUseCharge() && unit.chargeReady) {
        unit.chargeApproachActive = true;
      }
      unit.state = 'MOVING';
      this.moveToPoint(unit, target, allies);
    } else {
      unit.state = 'ATTACKING';
      unit.chargeApproachActive = false;
      const immobileTicks = Math.max(1, Math.ceil(getImmobileDuration(unit) / config.tickDelta));
      const recoveryTicks = Math.max(1, Math.ceil(getRecoveryDuration(unit) / config.tickDelta));
      unit.attackAnimEndTick = this.tick + immobileTicks;
      unit.reattackReadyTick = this.tick + immobileTicks + recoveryTicks;
      this.fireAttack(unit, target, enemies, allies);
    }
  }

  /**
   * Kiting – ranged only.
   * Phase 'approach': move toward focus-fire target until in range.
   * In range: STOP, fire, enter 'firing' phase (frozen for attack animation duration).
   * When animation ends: enter 'retreat' phase, move toward own spawn for reattackTime seconds.
   * When retreat ends: return to 'approach'.
   */
  updateUnitKiting(unit, allies, enemies, unitStrategy) {
    this.updateUnitFocusFireGrouped(unit, allies, enemies, unitStrategy, 'kiting');
  }

  /**
   * Straight Focus Fire – ranged only.
   * Find focus-fire target and approach it. When in range: STOP, fire, freeze for
   * attack animation, then wait reattackTime in place, then repeat.
   */
  updateUnitStraightFocusFire(unit, allies, enemies, unitStrategy) {
    this.updateUnitFocusFireGrouped(unit, allies, enemies, unitStrategy, 'straightFocusFire');
  }

  updateUnit(unit, allies, enemies) {
    if (unit.dead) {
      return;
    }

    if (this.updateUnitHealer(unit, allies, enemies)) {
      return;
    }

    const unitStrategy = unit.strategy || { type: 'straight' };
    const stratType = unitStrategy.type;

    // Ranged-only strategies fall back to straight if unit is not actually ranged
    if (stratType === 'kiting' && unit.isRanged()) {
      this.updateUnitKiting(unit, allies, enemies, unitStrategy);
    } else if (stratType === 'straightFocusFire' && unit.isRanged()) {
      this.updateUnitStraightFocusFire(unit, allies, enemies, unitStrategy);
    } else {
      this.updateUnitStraight(unit, allies, enemies);
    }
  }

  updateBuildingAttackers() {
    const buildingAttackers = this.environment.buildingAttackers || [];
    if (!buildingAttackers.length) {
      return;
    }

    const aliveB = this.aliveUnits('B');
    if (!aliveB.length) {
      return;
    }

    for (const attacker of buildingAttackers) {
      attacker.cooldown = Math.max(0, attacker.cooldown - config.tickDelta);
      if (attacker.cooldown > 0) {
        continue;
      }

      let best = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const target of aliveB) {
        const d = distance(attacker, target);
        if (d < bestDist) {
          best = target;
          bestDist = d;
        }
      }

      if (!best) {
        continue;
      }

      const range = attacker.weapon && attacker.weapon.range ? attacker.weapon.range.max : 9;
      if (bestDist <= range) {
        const baseDamage = attacker.weapon && typeof attacker.weapon.damage === 'number'
          ? attacker.weapon.damage
          : 25;
        const armor = best.armorValue('ranged');
        const damage = Math.max(0, baseDamage - armor);
        best.applyDamage(damage);

        const speed = attacker.weapon && typeof attacker.weapon.speed === 'number'
          ? attacker.weapon.speed
          : 3.0;
        attacker.cooldown = Math.max(0.3, speed);
      }
    }
  }

  computeResources() {
    const resourceValue = (units) =>
      units
        .filter((u) => !u.dead)
        .reduce((sum, u) => sum + (u.def.costs && u.def.costs.total ? u.def.costs.total : 0), 0);

    return {
      A: resourceValue(this.unitsA),
      B: resourceValue(this.unitsB),
    };
  }

  createSnapshot() {
    return {
      tick: this.tick,
      units: this.allUnits().map((u) => u.toSnapshot()),
      resources: this.computeResources(),
      finished: this.finished,
    };
  }

  step() {
    this.tick += 1;

    for (const unit of this.allUnits()) {
      unit.tickSpecialState(
        this.tick,
        DEFLECTIVE_ARMOR_RECHARGE_TICKS
      );
    }

    const aliveA = this.aliveUnits('A');
    const aliveB = this.aliveUnits('B');

    for (const unit of aliveA) {
      this.updateUnit(unit, aliveA, aliveB);
    }

    for (const unit of aliveB) {
      this.updateUnit(unit, aliveB, aliveA);
    }

    this.updateBuildingAttackers();

    const snapshot = this.createSnapshot();
    this.lastSnapshots.push(snapshot);

    if (this.lastSnapshots.length >= config.wsBatchSize && typeof this.onTick === 'function') {
      const last = this.lastSnapshots[this.lastSnapshots.length - 1];
      this.onTick(last);
      this.lastSnapshots = [];
    }

    const nowAliveA = this.aliveUnits('A').length;
    const nowAliveB = this.aliveUnits('B').length;

    if (nowAliveA === 0 || nowAliveB === 0 || this.tick >= config.maxTicks) {
      this.finished = true;
      this.running = false;
      const resources = this.computeResources();
      const winner = resources.A === resources.B ? 'draw' : resources.A > resources.B ? 'A' : 'B';

      const totalA = this.unitsA.length;
      const totalB = this.unitsB.length;
      this.result = {
        winner,
        tick: this.tick,
        resourcesA: resources.A,
        resourcesB: resources.B,
        ratio: resources.B > 0 ? resources.A / resources.B : null,
        kills: {
          A: totalB - nowAliveB,
          B: totalA - nowAliveA,
        },
      };

      if (typeof this.onTick === 'function' && this.lastSnapshots.length) {
        this.onTick(this.lastSnapshots[this.lastSnapshots.length - 1]);
      }

      if (typeof this.onEnd === 'function') {
        this.onEnd(this.result);
      }
    }
  }

  run() {
    if (this.finished) {
      return;
    }

    if (this.running) {
      return;
    }

    this.running = true;
    this.paused = false;
    const chunkSize = 50;

    const loopChunk = () => {
      if (!this.running || this.finished || this.paused) {
        return;
      }

      for (let i = 0; i < chunkSize && this.running && !this.finished; i += 1) {
        this.step();
      }

      if (this.running && !this.finished && !this.paused) {
        setImmediate(loopChunk);
      }
    };

    setImmediate(loopChunk);
  }

  pause() {
    if (this.finished || !this.running) {
      return false;
    }

    this.running = false;
    this.paused = true;
    return true;
  }

  resume() {
    if (this.finished || this.running || !this.paused) {
      return false;
    }

    this.paused = false;
    this.run();
    return true;
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.finished = true;
  }
}

module.exports = SimulationEngine;
