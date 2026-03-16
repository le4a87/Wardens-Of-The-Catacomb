import { GameRuntimeBase } from "./GameRuntimeBase.js";
import {
  parseMap,
  revealAroundPlayer,
  isWallAt,
  isWalkableTile,
  updateNavigationField,
  getPathDirectionToPlayer,
  moveEnemyTowardPlayer,
  moveWithCollision
} from "./world/navigationCollision.js";
import {
  placeArmorStands,
  spawnGhost,
  spawnTreasureGoblin,
  spawnAnimatedArmor,
  spawnMimic,
  spawnNecromancer,
  spawnSkeleton,
  applyEnemyDamage,
  randomEnemySpawnPoint
} from "./world/spawnCombat.js";
import {
  getEnemySpawnInterval,
  getMoveSpeedMultiplier,
  getEnemySpawnRateMultiplier,
  getGoldFindMultiplier,
  getGoldDropRate,
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

  updateNavigationField(force = false) {
    updateNavigationField(this, force);
  }

  getPathDirectionToPlayer(entity) {
    return getPathDirectionToPlayer(this, entity);
  }

  moveEnemyTowardPlayer(enemy, speedScale, dt) {
    moveEnemyTowardPlayer(this, enemy, speedScale, dt);
  }

  moveWithCollision(entity, dx, dy) {
    moveWithCollision(this, entity, dx, dy);
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

  spawnMimic(x, y) {
    return spawnMimic(this, x, y);
  }

  spawnNecromancer(x, y) {
    return spawnNecromancer(this, x, y);
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

  getEnemySpawnRateMultiplier() {
    return getEnemySpawnRateMultiplier(this);
  }

  getGoldFindMultiplier() {
    return getGoldFindMultiplier(this);
  }

  getGoldDropRate() {
    return getGoldDropRate(this);
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
