import { vecLength } from "../utils.js";

export const runtimeBaseDifficultyMethods = {
  getEnemySpeedScale() {
    const c = this.config.enemy;
    const tier = this.getDifficultyTier();
    const base = Number.isFinite(c.levelSpeedBase) ? c.levelSpeedBase : 0.62;
    const per = Number.isFinite(c.levelSpeedPerLevel) ? c.levelSpeedPerLevel : 0.085;
    const cap = Number.isFinite(c.levelSpeedCap) ? c.levelSpeedCap : 2.2;
    return Math.max(0.15, Math.min(cap, base + tier * per));
  },

  getEnemyDamageScale() {
    const c = this.config.enemy;
    const tier = this.getDifficultyTier();
    const base = Number.isFinite(c.levelDamageBase) ? c.levelDamageBase : 1.0;
    const per = Number.isFinite(c.levelDamagePerLevel) ? c.levelDamagePerLevel : 0.11;
    const cap = Number.isFinite(c.levelDamageCap) ? c.levelDamageCap : 2.8;
    return Math.max(0.1, Math.min(cap, base + tier * per));
  },

  getEnemyHealthScale() {
    const c = this.config.enemy;
    const tier = this.getDifficultyTier();
    const base = Number.isFinite(c.levelHealthBase) ? c.levelHealthBase : 1.0;
    const per = Number.isFinite(c.levelHealthPerLevel) ? c.levelHealthPerLevel : 0.1;
    const cap = Number.isFinite(c.levelHealthCap) ? c.levelHealthCap : 3.2;
    return Math.max(0.2, Math.min(cap, base + tier * per));
  },

  getEnemyDefenseScale() {
    const c = this.config.enemy;
    const tier = this.getDifficultyTier();
    const base = Number.isFinite(c.levelDefenseBase) ? c.levelDefenseBase : 1.0;
    const per = Number.isFinite(c.levelDefensePerLevel) ? c.levelDefensePerLevel : 0.07;
    const cap = Number.isFinite(c.levelDefenseCap) ? c.levelDefenseCap : 2.2;
    return Math.max(0.1, Math.min(cap, base + tier * per));
  },

  getEnemySpawnRateScale() {
    const c = this.config.enemy;
    const tier = this.getDifficultyTier();
    const base = Number.isFinite(c.levelSpawnRateBase) ? c.levelSpawnRateBase : 1.0;
    const per = Number.isFinite(c.levelSpawnRatePerLevel) ? c.levelSpawnRatePerLevel : 0.08;
    const cap = Number.isFinite(c.levelSpawnRateCap) ? c.levelSpawnRateCap : 2.4;
    return Math.max(0.1, Math.min(cap, base + tier * per));
  },

  getDifficultyTier() {
    const lvlPart = Math.max(0, (Number.isFinite(this.level) ? this.level : 1) - 1);
    const floorPart = Math.max(0, (Number.isFinite(this.floor) ? this.floor : 1) - 1);
    // Weight difficulty growth more strongly on floor progression than player level.
    return lvlPart * 0.35 + floorPart * 1.35;
  },

  getEnemyPackSize() {
    const tier = this.getDifficultyTier();
    const pack = 1 + Math.floor(tier / 3.2);
    return Math.max(1, Math.min(6, pack));
  },

  getEnemyOutpacingStatus() {
    const moveScale = this.getPlayerMoveSpeed() / this.classSpec.baseMoveSpeed;
    const atkScale = this.getAttackSpeed() / (1 / this.classSpec.baseAttackCooldown);
    const playerGrowth = (moveScale + atkScale) * 0.5;
    const enemyPressure = this.getEnemySpeedScale();
    if (enemyPressure > playerGrowth * 1.08) {
      return { label: "OUTPACING", color: "#e06a6a" };
    }
    if (enemyPressure > playerGrowth * 0.96) {
      return { label: "EVEN", color: "#dfc670" };
    }
    return { label: "BEHIND", color: "#7ad68f" };
  },

  rollRange(min, max) {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : safeMin;
    const lo = Math.min(safeMin, safeMax);
    const hi = Math.max(safeMin, safeMax);
    return lo + Math.random() * (hi - lo);
  },

  getEnemyContactDamageRange(enemy) {
    const min = Number.isFinite(enemy?.damageMin)
      ? enemy.damageMin
      : Number.isFinite(enemy?.damage)
      ? enemy.damage
      : this.config.player.hitDamage;
    const max = Number.isFinite(enemy?.damageMax)
      ? enemy.damageMax
      : Number.isFinite(enemy?.damage)
      ? enemy.damage
      : min;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  },

  rollEnemyContactDamage(enemy) {
    const range = this.getEnemyContactDamageRange(enemy);
    return this.rollRange(range.min, range.max);
  },

  rollScaledEnemyHealth(baseMin, baseMax) {
    const scale = this.getEnemyHealthScale();
    const min = Math.max(1, Math.round(Math.min(baseMin, baseMax) * scale));
    const max = Math.max(min, Math.round(Math.max(baseMin, baseMax) * scale));
    return Math.round(this.rollRange(min, max));
  },

  getMimicChestChance() {
    const enemyCfg = this.config.enemy;
    const minFloor = Number.isFinite(enemyCfg.mimicMinFloor) ? enemyCfg.mimicMinFloor : 2;
    if ((Number.isFinite(this.floor) ? this.floor : 1) < minFloor) return 0;
    const levelThreshold = Number.isFinite(enemyCfg.mimicChanceLevelThreshold) ? enemyCfg.mimicChanceLevelThreshold : 5;
    if ((Number.isFinite(this.level) ? this.level : 1) >= levelThreshold) {
      return Number.isFinite(enemyCfg.mimicChestChanceLevel5) ? enemyCfg.mimicChestChanceLevel5 : enemyCfg.mimicChestChance;
    }
    return Number.isFinite(enemyCfg.mimicChestChance) ? enemyCfg.mimicChestChance : 0.02;
  },

  placeBreakables() {
    const cfg = this.config.breakables;
    if (!cfg) return;
    const tile = this.config.map.tile;
    const minDistTiles = Number.isFinite(cfg.minDistanceFromPlayerTiles) ? cfg.minDistanceFromPlayerTiles : 5;
    const minDist = minDistTiles * tile;
    const mimicChance = this.getMimicChestChance();
    for (let y = 2; y < this.map.length - 2; y++) {
      for (let x = 2; x < this.map[0].length - 2; x++) {
        if (this.breakables.length >= cfg.maxCount) return;
        if (this.map[y][x] !== ".") continue;
        const wx = x * tile + tile / 2;
        const wy = y * tile + tile / 2;
        if (vecLength(wx - this.player.x, wy - this.player.y) < minDist) continue;
        if (vecLength(wx - this.door.x, wy - this.door.y) < tile * 2.5) continue;
        if (!this.pickup.taken && vecLength(wx - this.pickup.x, wy - this.pickup.y) < tile * 2.5) continue;
        if (Math.random() >= cfg.spawnChance) continue;
        const type = Math.random() < 0.55 ? "crate" : "box";
        if (type === "box" && mimicChance > 0 && Math.random() < mimicChance) {
          this.enemies.push(this.spawnMimic(wx, wy));
          continue;
        }
        this.breakables.push({
          type,
          x: wx,
          y: wy,
          size: 20,
          hp: 1
        });
      }
    }
  },

  dropBreakableLoot(x, y) {
    const cfg = this.config.breakables;
    if (!cfg) return;
    if (Math.random() < cfg.dropGoldRate) {
      const base = cfg.goldMin + Math.floor(Math.random() * (cfg.goldMax - cfg.goldMin + 1));
      const amount = Math.max(1, Math.floor(base * this.getGoldDropAmountMultiplier()));
      this.drops.push({
        type: "gold",
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        size: 9,
        amount,
        life: this.config.drops.life
      });
    }
    if (Math.random() < cfg.dropHealthRate) {
      this.drops.push({
        type: "health",
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        size: 12,
        amount: this.config.drops.healthRestore,
        life: this.config.drops.life
      });
    }
  }
};
