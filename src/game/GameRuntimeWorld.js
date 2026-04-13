import { GameRuntimeBase } from "./GameRuntimeBase.js";
import {
  parseMap,
  revealAroundPlayer,
  isWallAt,
  isWalkableTile,
  updateNavigationField,
  getPathDirectionToPlayer,
  getPathDirectionToTarget,
  moveEnemyTowardPlayer,
  moveEnemyTowardTargetPoint,
  moveWithCollision,
  moveWithCollisionSubsteps,
  separateEnemyFromPlayer
} from "./world/navigationCollision.js";
import {
  placeArmorStands,
  spawnGhost,
  spawnTreasureGoblin,
  spawnAnimatedArmor,
  spawnMummy,
  spawnPrisoner,
  spawnMimic,
  spawnRatArcher,
  spawnSkeletonWarrior,
  spawnNecromancer,
  spawnMinotaur,
  spawnSonyaBoss,
  spawnLeprechaunBoss,
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
  buyShopItem,
  getConsumableOwnedCount,
  getShopFailureReason,
  getShopItems,
  pushConsumableMessage,
  refillShopForFloor,
  tickConsumables,
  useConsumableSlot,
  applyConsumableOnHitEffects,
  getConsumableBonusDamage,
  applyPassiveConsumableEvent,
  toggleShop,
  toggleSkillTree,
  toggleStatsPanel,
  setStatsPanelView,
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

  getPathDirectionToTarget(entity, targetX, targetY, options) {
    return getPathDirectionToTarget(this, entity, targetX, targetY, options);
  }

  moveEnemyTowardPlayer(enemy, speedScale, dt) {
    moveEnemyTowardPlayer(this, enemy, speedScale, dt);
  }

  moveEnemyTowardTargetPoint(enemy, targetX, targetY, speedScale, dt, minDistance = 0, usePathfinding = false) {
    moveEnemyTowardTargetPoint(this, enemy, targetX, targetY, speedScale, dt, minDistance, usePathfinding);
  }

  moveWithCollision(entity, dx, dy) {
    moveWithCollision(this, entity, dx, dy);
  }

  moveWithCollisionSubsteps(entity, dx, dy, maxStep = 4) {
    moveWithCollisionSubsteps(this, entity, dx, dy, maxStep);
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

  spawnPrisoner(x, y) {
    return spawnPrisoner(this, x, y);
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

  spawnSonyaBoss(x, y) {
    return spawnSonyaBoss(this, x, y);
  }

  spawnLeprechaunBoss(x, y) {
    return spawnLeprechaunBoss(this, x, y);
  }

  spawnSkeleton(x, y, options) {
    return spawnSkeleton(this, x, y, options);
  }

  applyEnemyDamage(enemy, amount, damageType = "physical", ownerId = null) {
    applyEnemyDamage(this, enemy, amount, damageType, ownerId);
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

  buyShopItem(key) {
    return buyShopItem(this, key);
  }

  getShopItems() {
    return getShopItems(this);
  }

  getConsumableOwnedCount(key) {
    return getConsumableOwnedCount(this, key);
  }

  getShopFailureReason(key) {
    return getShopFailureReason(this, key);
  }

  pushConsumableMessage(text) {
    return pushConsumableMessage(this, text);
  }

  refillShopForFloor() {
    return refillShopForFloor(this);
  }

  tickConsumables(dt) {
    return tickConsumables(this, dt);
  }

  useConsumableSlot(slotIndex) {
    return useConsumableSlot(this, slotIndex);
  }

  applyConsumableOnHitEffects(enemy, ownerId = null) {
    return applyConsumableOnHitEffects(this, enemy, ownerId);
  }

  getConsumableBonusDamage() {
    return getConsumableBonusDamage(this);
  }

  applyPassiveConsumableEvent(eventKey, payload = {}) {
    return applyPassiveConsumableEvent(this, eventKey, payload);
  }

  toggleShop(open) {
    toggleShop(this, open);
  }

  toggleSkillTree(open) {
    toggleSkillTree(this, open);
  }

  toggleStatsPanel(open) {
    toggleStatsPanel(this, open);
  }

  setStatsPanelView(view) {
    return setStatsPanelView(this, view);
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
