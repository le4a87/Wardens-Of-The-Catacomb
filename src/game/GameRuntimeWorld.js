import { GameRuntimeBase } from "./GameRuntimeBase.js";
import {
  parseMap,
  revealAroundPlayer,
  isWallAt,
  isWalkableTile,
  updateNavigationField,
  getPathDirectionToPlayer,
  moveEnemyTowardTargetPoint,
  moveEnemyTowardPlayer,
  moveWithCollision,
  separateEnemyFromPlayer
} from "./world/navigationCollision.js";
import {
  placeArmorStands,
  spawnGhost,
  spawnTreasureGoblin,
  spawnAnimatedArmor,
  spawnMummy,
  spawnMimic,
  spawnRatArcher,
  spawnSkeletonWarrior,
  spawnNecromancer,
  spawnMinotaur,
  spawnSkeleton,
  applyEnemyDamage,
  randomEnemySpawnPoint
} from "./world/spawnCombat.js";
import {
  getEnemySpawnInterval,
  getMoveSpeedMultiplier,
  getGoldFindMultiplier,
  getGoldDropRate,
  getHealthDropRate,
  getGoldDropAmountMultiplier,
  getAttackSpeedMultiplier,
  getDamageMultiplier,
  getDefenseFlatReduction,
  getUpgradeCost,
  canBuyUpgrade,
  buyUpgrade,
  toggleShop,
  toggleSkillTree,
  pointInRect,
  handleUiClicks
} from "./world/uiEconomy.js";

export class GameRuntimeWorld extends GameRuntimeBase {
  parseMap() {
    parseMap(this);
  }

  revealAroundPlayer() {
    revealAroundPlayer(this);
  }

  isWallAt(x, y, blockBreakables = true) {
    return isWallAt(this, x, y, blockBreakables);
  }

  isWalkableTile(tx, ty) {
    return isWalkableTile(this, tx, ty);
  }

  isPositionWalkable(x, y, radius = 0, blockBreakables = true) {
    return super.isPositionWalkable(x, y, radius, blockBreakables);
  }

  updateNavigationField(force = false) {
    updateNavigationField(this, force);
  }

  getPathDirectionToPlayer(entity) {
    return getPathDirectionToPlayer(this, entity);
  }

  moveEnemyTowardTargetPoint(enemy, target, speedScale, dt, minDistance = 0) {
    moveEnemyTowardTargetPoint(this, enemy, target, speedScale, dt, minDistance);
  }

  moveEnemyTowardPlayer(enemy, speedScale, dt) {
    moveEnemyTowardPlayer(this, enemy, speedScale, dt);
  }

  moveWithCollision(entity, dx, dy) {
    moveWithCollision(this, entity, dx, dy);
  }

  separateEnemyFromPlayer(enemy) {
    separateEnemyFromPlayer(this, enemy);
  }

  placeArmorStands() {
    placeArmorStands(this);
  }

  spawnGhost(x, y) {
    return spawnGhost(this, x, y);
  }

  spawnTreasureGoblin(x, y) {
    return spawnTreasureGoblin(this, x, y);
  }

  spawnAnimatedArmor(x, y) {
    return spawnAnimatedArmor(this, x, y);
  }

  spawnMummy(x, y) {
    return spawnMummy(this, x, y);
  }

  spawnMimic(x, y) {
    return spawnMimic(this, x, y);
  }

  spawnRatArcher(x, y) {
    return spawnRatArcher(this, x, y);
  }

  spawnSkeletonWarrior(x, y) {
    return spawnSkeletonWarrior(this, x, y);
  }

  spawnNecromancer(x, y) {
    return spawnNecromancer(this, x, y);
  }

  spawnMinotaur(x, y) {
    return spawnMinotaur(this, x, y);
  }

  spawnSkeleton(x, y, options) {
    return spawnSkeleton(this, x, y, options);
  }

  applyEnemyDamage(enemy, amount, damageType = "physical") {
    applyEnemyDamage(this, enemy, amount, damageType);
  }

  getEnemySpawnInterval() {
    return getEnemySpawnInterval(this);
  }

  getMoveSpeedMultiplier() {
    return getMoveSpeedMultiplier(this);
  }

  getGoldFindMultiplier() {
    return getGoldFindMultiplier(this);
  }

  getGoldDropRate() {
    return getGoldDropRate(this);
  }

  getHealthDropRate() {
    return getHealthDropRate(this);
  }

  getGoldDropAmountMultiplier() {
    return getGoldDropAmountMultiplier(this);
  }

  getAttackSpeedMultiplier() {
    return getAttackSpeedMultiplier(this);
  }

  getDamageMultiplier() {
    return getDamageMultiplier(this);
  }

  getDefenseFlatReduction() {
    return getDefenseFlatReduction(this);
  }

  getUpgradeCost(upgradeKey) {
    return getUpgradeCost(this, upgradeKey);
  }

  canBuyUpgrade(upgradeKey) {
    return canBuyUpgrade(this, upgradeKey);
  }

  buyUpgrade(upgradeKey) {
    return buyUpgrade(this, upgradeKey);
  }

  toggleShop(open) {
    toggleShop(this, open);
  }

  toggleSkillTree(open) {
    toggleSkillTree(this, open);
  }

  pointInRect(x, y, rect) {
    return pointInRect(this, x, y, rect);
  }

  handleUiClicks() {
    handleUiClicks(this);
  }

  randomEnemySpawnPoint() {
    return randomEnemySpawnPoint(this);
  }
}
