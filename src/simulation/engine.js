'use strict';

const config = require('../../config');
const { calculateDamage } = require('./combat');
const {
  distance,
  moveToward,
  applySeparation,
  avoidObstacles,
} = require('./battlefield');
const { selectTarget: selectStraight } = require('./strategies/straightFight');
const { selectTarget: selectFocusFire, selectPriorityUnitInRange } = require('./strategies/focusFire');
const { computeRetreatPoint } = require('./strategies/kiting');

const DEFLECTIVE_ARMOR_RECHARGE_TICKS = Math.round(15 / config.tickDelta);
const ROYAL_KNIGHT_CHARGE_BONUS_TICKS = Math.round(5 / config.tickDelta);
const LANDSKNECHT_SPLASH_RADIUS = 0.75;

function weaponRange(unit) {
  const weapon = unit.primaryWeapon;
  if (!weapon || !weapon.range) {
    return 1;
  }
  return typeof weapon.range.max === 'number' ? weapon.range.max : 1;
}

class SimulationEngine {
  constructor({ unitsA, unitsB, environment, strategyA, strategyB, onTick, onEnd }) {
    this.unitsA = unitsA;
    this.unitsB = unitsB;
    this.environment = environment || { obstacles: [], buildingAttackers: [] };
    this.strategyA = strategyA || { type: 'straight' };
    this.strategyB = strategyB || { type: 'straight' };
    this.onTick = onTick;
    this.onEnd = onEnd;

    this.tick = 0;
    this.running = false;
    this.paused = false;
    this.finished = false;
    this.result = null;

    this.lastSnapshots = [];
    this.initialRangedByTeam = {
      A: this.unitsA.filter((u) => u.isRanged()).length,
      B: this.unitsB.filter((u) => u.isRanged()).length,
    };
    this.kitingActivatedByTeam = {
      A: false,
      B: false,
    };
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
    const dir = unit.team === 'A' ? 1 : -1;
    this.moveToPoint(
      unit,
      {
        x: unit.x + dir * 8,
        y: unit.y,
      },
      allies
    );
  }

  selectTargetForUnit(unit, enemies, teamStrategy) {
    if (!enemies.length) {
      return null;
    }

    const focus = teamStrategy.focusFire || {};
    const isFocusEnabled = Boolean(focus.enabled) && unit.isRanged();

    if (isFocusEnabled) {
      const inRangeEnemies = enemies.filter((enemy) => !enemy.dead && distance(unit, enemy) <= weaponRange(unit));
      const prioritized = selectFocusFire(unit, inRangeEnemies, {
        priorityUnitId: focus.targetUnitId || null,
      });
      if (prioritized) {
        return prioritized;
      }
    }

    return selectStraight(unit, enemies);
  }

  shouldMeleeRetreatForKiting(team) {
    const initial = this.initialRangedByTeam[team] || 0;
    if (initial <= 0) {
      return false;
    }
    const aliveRanged = this.aliveRangedUnits(team).length;
    return aliveRanged > Math.max(1, Math.floor(initial * 0.05));
  }

  getRangedAnchor(team) {
    const ranged = this.aliveRangedUnits(team);
    if (!ranged.length) {
      return null;
    }

    const xValues = ranged.map((u) => u.x);
    const avgY = ranged.reduce((sum, u) => sum + u.y, 0) / ranged.length;

    return {
      x: team === 'A' ? Math.min(...xValues) : Math.max(...xValues),
      y: avgY,
    };
  }

  getFrontlineX(team) {
    const melee = this.aliveMeleeUnits(team);
    if (!melee.length) {
      return null;
    }

    const values = melee.map((u) => u.x);
    return team === 'A' ? Math.max(...values) : Math.min(...values);
  }

  isRangedAheadOfFrontline(unit) {
    const frontX = this.getFrontlineX(unit.team);
    if (frontX === null) {
      return false;
    }

    const maxLead = 0.55;
    if (unit.team === 'A') {
      return unit.x > frontX + maxLead;
    }
    return unit.x < frontX - maxLead;
  }

  updateUnit(unit, allies, enemies, teamStrategy) {
    if (unit.dead) {
      return;
    }

    const range = weaponRange(unit);
    let strategyForUnit = teamStrategy || { type: 'straight' };

    const kitingIsActive = teamStrategy.type === 'kiting' && this.kitingActivatedByTeam[unit.team];

    if (teamStrategy.type === 'kiting' && !kitingIsActive) {
      strategyForUnit = { type: 'straight' };
    }

    if (kitingIsActive && !unit.isRanged()) {
      if (this.shouldMeleeRetreatForKiting(unit.team)) {
        const anchor = this.getRangedAnchor(unit.team);
        if (anchor) {
          unit.state = 'MOVING';
          unit.targetId = null;
          const offset = unit.team === 'A' ? -1.8 : 1.8;
          this.moveToPoint(
            unit,
            {
              x: anchor.x + offset,
              y: anchor.y,
            },
            allies
          );
          unit.attackCooldown = Math.max(0, unit.attackCooldown - config.tickDelta);
          return;
        }
      }
      strategyForUnit = { type: 'straight' };
    }

    const focus = teamStrategy.focusFire || {};
    const kitingFocusActiveForUnit = Boolean(focus.enabled)
      && unit.isRanged()
      && (!focus.sourceUnitId || unit.def.id === focus.sourceUnitId);

    if (kitingIsActive && kitingFocusActiveForUnit && this.isRangedAheadOfFrontline(unit)) {
      const frontX = this.getFrontlineX(unit.team);
      const fallback = unit.team === 'A' ? frontX - 0.5 : frontX + 0.5;
      unit.state = 'MOVING';
      unit.targetId = null;
      this.moveToPoint(
        unit,
        {
          x: fallback,
          y: unit.y,
        },
        allies
      );
      unit.attackCooldown = Math.max(0, unit.attackCooldown - config.tickDelta);
      return;
    }

    const target = this.selectTargetForUnit(unit, enemies, strategyForUnit);

    if (!target) {
      unit.chargeApproachActive = false;
      if (strategyForUnit.type === 'straight') {
        unit.state = 'MOVING';
        unit.targetId = null;
        this.moveForwardAclick(unit, allies);
      } else {
        unit.state = 'IDLE';
        unit.targetId = null;
      }
      return;
    }

    const focusConfig = strategyForUnit.focusFire || {};
    const focusActiveForUnit = Boolean(focusConfig.enabled) && unit.isRanged();

    let attackTarget = target;
    if (focusActiveForUnit) {
      const focused = selectPriorityUnitInRange(unit, enemies, focusConfig.targetUnitId || null, range);
      if (focused) {
        attackTarget = focused;
      }
    }

    unit.targetId = attackTarget.id;
    const dist = distance(unit, attackTarget);

    const canKite = strategyForUnit.type === 'kiting' && unit.isRanged();

    if (dist > range) {
      if (unit.canUseCharge && unit.canUseCharge() && unit.chargeReady) {
        unit.chargeApproachActive = true;
      }
      unit.state = 'MOVING';
      this.moveToPoint(unit, attackTarget, allies);
    } else {
      if (canKite && unit.attackCooldown > 0) {
        const retreat = computeRetreatPoint(unit, attackTarget, Math.max(0.7, range * 0.3));
        this.moveToPoint(unit, retreat, allies);
        unit.state = 'MOVING';
      } else {
        unit.state = 'ATTACKING';
      }
    }

    unit.attackCooldown = Math.max(0, unit.attackCooldown - config.tickDelta);

    if (distance(unit, attackTarget) <= range && unit.attackCooldown <= 0 && unit.state === 'ATTACKING') {
      unit.registerCombat(this.tick);
      attackTarget.registerCombat(this.tick);

      let chargeMultiplier = 1;
      if (unit.chargeApproachActive && unit.consumeCharge) {
        const consumedCharge = unit.consumeCharge(this.tick, ROYAL_KNIGHT_CHARGE_BONUS_TICKS);
        if (consumedCharge) {
          chargeMultiplier = unit.getChargeMultiplier ? unit.getChargeMultiplier() : 1;
        }
      }

      const blocked = attackTarget.consumeDeflectiveArmor(this.tick);

      if (!blocked) {
        const damage = calculateDamage(unit, attackTarget, {
          enemyUnits: enemies,
          chargeMultiplier,
        });
        attackTarget.applyDamage(damage);

        if (unit.hasClass && unit.hasClass('landsknecht') && unit.primaryWeapon && unit.primaryWeapon.type === 'melee') {
          for (const enemy of enemies) {
            if (enemy.dead || enemy.id === attackTarget.id) {
              continue;
            }

            const splashDistance = distance(attackTarget, enemy);
            if (splashDistance <= LANDSKNECHT_SPLASH_RADIUS) {
              enemy.applyDamage(damage);
              enemy.registerCombat(this.tick);
            }
          }
        }

        if (teamStrategy.type === 'kiting' && !this.kitingActivatedByTeam[unit.team]) {
          this.kitingActivatedByTeam[unit.team] = true;
        }
      }

      const weapon = unit.primaryWeapon;
      const attackRate = weapon && typeof weapon.speed === 'number' ? weapon.speed : 1;
      unit.attackCooldown = Math.max(0.2, attackRate);

      if (canKite && !attackTarget.dead) {
        const retreat = computeRetreatPoint(unit, attackTarget, Math.max(0.8, range * 0.8));
        this.moveToPoint(unit, retreat, allies);
      }
    }

    this.postMove(unit, allies);
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
      this.updateUnit(unit, aliveA, aliveB, this.strategyA);
    }

    for (const unit of aliveB) {
      this.updateUnit(unit, aliveB, aliveA, this.strategyB);
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
