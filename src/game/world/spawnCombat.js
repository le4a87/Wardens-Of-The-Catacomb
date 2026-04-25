import { vecLength } from "../../utils.js";
import {
  spawnGhost as spawnGhostEntity,
  spawnTreasureGoblin as spawnTreasureGoblinEntity,
  spawnAnimatedArmor as spawnAnimatedArmorEntity,
  spawnMummy as spawnMummyEntity,
  spawnPrisoner as spawnPrisonerEntity,
  spawnMimic as spawnMimicEntity,
  spawnRatArcher as spawnRatArcherEntity,
  spawnSkeletonWarrior as spawnSkeletonWarriorEntity,
  spawnNecromancer as spawnNecromancerEntity,
  spawnMinotaur as spawnMinotaurEntity,
  spawnGolemBoss as spawnGolemBossEntity,
  spawnShardling as spawnShardlingEntity,
  spawnSonyaBoss as spawnSonyaBossEntity,
  spawnLeprechaunBoss as spawnLeprechaunBossEntity,
  spawnSkeleton as spawnSkeletonEntity
} from "../enemySystems.js";
import { isWalkableTile } from "./navigationCollision.js";

export function placeArmorStands(game) {
  const candidates = [];
  const mapH = game.map.length;
  const mapW = game.map[0].length;
  const placementTiles = typeof game.getArmorStandPlacementTiles === "function" ? game.getArmorStandPlacementTiles() : null;
  const standVariant = typeof game.getArmorStandVariant === "function" ? game.getArmorStandVariant() : null;
  const standSize = Number.isFinite(game.getCurrentBiomeRules?.()?.armorStandSize) ? game.getCurrentBiomeRules().armorStandSize : 24;
  for (let y = 2; y < mapH - 2; y++) {
    for (let x = 2; x < mapW - 2; x++) {
      if (game.map[y][x] === "#") continue;
      if (game.map[y][x] === "D" || game.map[y][x] === "K" || game.map[y][x] === "P") continue;
      if (Array.isArray(placementTiles) && placementTiles.length > 0) {
        if (!placementTiles.includes(game.map[y][x])) continue;
      } else {
        const nearWall =
          game.map[y - 1][x] === "#" ||
          game.map[y + 1][x] === "#" ||
          game.map[y][x - 1] === "#" ||
          game.map[y][x + 1] === "#";
        if (!nearWall) continue;
      }
      const wx = x * game.config.map.tile + game.config.map.tile / 2;
      const wy = y * game.config.map.tile + game.config.map.tile / 2;
      if (vecLength(wx - game.player.x, wy - game.player.y) < game.config.map.tile * 6) continue;
      candidates.push({ x: wx, y: wy });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const target = Math.max(10, Math.min(60, Math.floor((mapW * mapH) / game.config.enemy.armorStandCountFactor)));
  for (let i = 0; i < Math.min(target, candidates.length); i++) {
    const c = candidates[i];
    game.armorStands.push({
      x: c.x,
      y: c.y,
      size: standSize,
      animated: Math.random() < game.config.enemy.armorStandAnimatedChance,
      activated: false,
      variant: standVariant
    });
  }
}

export function spawnGhost(game, x, y) {
  return spawnGhostEntity(game, x, y);
}

export function spawnTreasureGoblin(game, x, y) {
  return spawnTreasureGoblinEntity(game, x, y);
}

export function spawnAnimatedArmor(game, x, y) {
  return spawnAnimatedArmorEntity(game, x, y);
}

export function spawnMummy(game, x, y) {
  return spawnMummyEntity(game, x, y);
}

export function spawnPrisoner(game, x, y) {
  return spawnPrisonerEntity(game, x, y);
}

export function spawnMimic(game, x, y) {
  return spawnMimicEntity(game, x, y);
}

export function spawnRatArcher(game, x, y) {
  return spawnRatArcherEntity(game, x, y);
}

export function spawnSkeletonWarrior(game, x, y) {
  return spawnSkeletonWarriorEntity(game, x, y);
}

export function spawnNecromancer(game, x, y) {
  return spawnNecromancerEntity(game, x, y);
}

export function spawnMinotaur(game, x, y) {
  return spawnMinotaurEntity(game, x, y);
}

export function spawnGolemBoss(game, x, y, options) {
  return spawnGolemBossEntity(game, x, y, options);
}

export function spawnShardling(game, x, y) {
  return spawnShardlingEntity(game, x, y);
}

export function spawnSonyaBoss(game, x, y) {
  return spawnSonyaBossEntity(game, x, y);
}

export function spawnLeprechaunBoss(game, x, y) {
  return spawnLeprechaunBossEntity(game, x, y);
}

export function spawnSkeleton(game, x, y, options) {
  return spawnSkeletonEntity(game, x, y, options);
}

export function applyEnemyDamage(game, enemy, amount, damageType = "physical", ownerId = null) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (enemy?.invincible) return;
  if (enemy?.type === "skeleton_warrior" && enemy.collapsed) {
    if (damageType === "fire" || damageType === "melee") {
      enemy.reviveAtEnd = false;
      enemy.collapseTimer = 0;
      enemy.reanimateTimer = 0;
      enemy.reanimating = false;
      enemy.hp = 0;
    }
    return;
  }
  let adjusted = amount;
  if (
    enemy &&
    typeof game.isUndeadEnemy === "function" &&
    game.isUndeadEnemy(enemy) &&
    (enemy.crusaderDefenseShredTimer || 0) > 0
  ) {
    const shredPct = Number.isFinite(enemy.crusaderDefenseShredPct) ? enemy.crusaderDefenseShredPct : 0;
    if (shredPct > 0) adjusted *= 1 + shredPct;
  }
  if (enemy?.type === "mimic") {
    if (damageType === "arrow") adjusted *= game.config.enemy.mimicArrowResistance;
    else if (damageType === "fire") adjusted *= game.config.enemy.mimicFireVulnerability;
    enemy.dormant = false;
    enemy.revealed = true;
  }
  if ((enemy?.curseTimer || 0) > 0) {
    adjusted *= 1.25;
    if (damageType === "poison") adjusted *= 1.25;
  }
  const defense = game.getEnemyDefenseScale() * (Number.isFinite(enemy?.controlledDefenseMultiplier) ? Math.max(0.1, enemy.controlledDefenseMultiplier) : 1);
  if (!Number.isFinite(defense) || defense <= 0) return;
  const effective = adjusted / defense;
  if (!Number.isFinite(effective) || effective <= 0) return;
  const enemyHpBefore = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
  const dealt = Math.min(effective, enemyHpBefore);
  enemy.lastDamageType = damageType;
  if (ownerId) enemy.lastDamageOwnerId = ownerId;
  enemy.hp -= effective;
  if (enemy?.type === "golem" && effective > 0) {
    const shardlingCap = Math.max(0, game.config.enemy.golemShardlingSpawnCap || 10);
    const activeShardlings = (game.enemies || []).filter((other) => other && other.type === "shardling" && (other.hp || 0) > 0).length;
    if ((enemy.fractureSpawnCooldown || 0) <= 0 && activeShardlings < shardlingCap && typeof game.spawnShardling === "function") {
      const spawnCount = Math.min(
        Math.max(1, game.config.enemy.golemShardlingSpawnCount || 1),
        shardlingCap - activeShardlings
      );
      for (let i = 0; i < spawnCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = (game.config.map.tile || 32) * (0.65 + Math.random() * 0.4);
        const safePoint = typeof game.findNearestSafePoint === "function"
          ? game.findNearestSafePoint(enemy.x + Math.cos(angle) * distance, enemy.y + Math.sin(angle) * distance, 5)
          : { x: enemy.x + Math.cos(angle) * distance, y: enemy.y + Math.sin(angle) * distance };
        if (!safePoint) continue;
        game.enemies.push(game.spawnShardling(safePoint.x, safePoint.y));
      }
      enemy.fractureSpawnCooldown = game.config.enemy.golemShardlingSpawnCooldown || 0.2;
      if (typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(enemy.x, enemy.y - enemy.size * 0.9, "Fracture", "#7ce7ff", 0.55, 12);
      }
    }

    const splitThreshold = (enemy.maxHp || 1) * 0.25;
    if (enemy.canSplit && !enemy.splitTriggered && enemyHpBefore > splitThreshold && enemy.hp <= splitThreshold) {
      enemy.splitTriggered = true;
      const splitHp = Math.max(2, Math.ceil(splitThreshold));
      const offset = (game.config.map.tile || 32) * 0.9;
      const leftPoint = typeof game.findNearestSafePoint === "function"
        ? game.findNearestSafePoint(enemy.x - offset, enemy.y, 5)
        : { x: enemy.x - offset, y: enemy.y };
      const rightPoint = typeof game.findNearestSafePoint === "function"
        ? game.findNearestSafePoint(enemy.x + offset, enemy.y, 5)
        : { x: enemy.x + offset, y: enemy.y };
      if (typeof game.spawnGolemBoss === "function") {
        const spawnA = leftPoint || { x: enemy.x - offset, y: enemy.y };
        const spawnB = rightPoint || { x: enemy.x + offset, y: enemy.y };
        game.enemies.push(game.spawnGolemBoss(spawnA.x, spawnA.y, { hp: splitHp, isSplitClone: true, isFloorBoss: true, splitTriggered: true }));
        game.enemies.push(game.spawnGolemBoss(spawnB.x, spawnB.y, { hp: splitHp, isSplitClone: true, isFloorBoss: true, splitTriggered: true }));
      }
      enemy.skipRewardsOnDeath = true;
      enemy.isFloorBoss = false;
      enemy.hp = 0;
      if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("split");
      if (typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(enemy.x, enemy.y - enemy.size, "Fractured", "#ffbf82", 1, 16);
      }
    }
  }
  if (!(game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy))) {
    const owner = typeof game.getPlayerEntityById === "function" ? game.getPlayerEntityById(ownerId) : game.player;
    if (typeof game.recordDamageDealtByPlayerEntity === "function") game.recordDamageDealtByPlayerEntity(owner, dealt);
  }
  const lifeLeech = game.isEnemyFriendlyToPlayer && game.isEnemyFriendlyToPlayer(enemy) ? 0 : game.getLifeLeechPercent();
  if (lifeLeech > 0 && dealt > 0) {
    game.applyPlayerHealing(dealt * lifeLeech);
  }
  enemy.hpBarTimer = game.config.enemy.hpBarDuration;
  if (effective >= 1 || (enemy.damageTextTimer || 0) <= 0) {
    game.spawnFloatingText(
      enemy.x,
      enemy.y - enemy.size * 0.65,
      `-${Math.max(1, Math.round(effective))}`,
      typeof game.getDamageTextColor === "function" ? game.getDamageTextColor(damageType) : "#e85c5c"
    );
    enemy.damageTextTimer = 0.14;
  }
  if (enemy?.type === "skeleton_warrior" && enemy.hp <= 0) {
    if (game.isControlledUndead && game.isControlledUndead(enemy)) {
      enemy.hp = 0;
      enemy.collapsed = false;
      enemy.collapseTimer = 0;
      enemy.reviveAtEnd = false;
      enemy.reanimateTimer = 0;
      enemy.reanimating = false;
      return;
    }
    if (damageType === "fire") {
      enemy.reviveAtEnd = false;
      enemy.collapseTimer = 0;
      enemy.reanimateTimer = 0;
      enemy.reanimating = false;
      enemy.hp = 0;
      return;
    }
    enemy.collapsed = true;
    enemy.collapseTimer = game.config.enemy.skeletonWarriorBonePileLife || 5;
    enemy.reviveAtEnd = Math.random() < (game.config.enemy.skeletonWarriorReviveChance || 0.1);
    enemy.reanimateTimer = 0;
    enemy.reanimating = false;
    enemy.hp = 1;
  }
}

export function randomEnemySpawnPoint(game) {
  const tile = game.config.map.tile;
  const playW = game.getPlayAreaWidth();
  const maxTx = game.map[0].length - 2;
  const maxTy = game.map.length - 2;
  const livingPlayers = typeof game.getLivingPlayerEntities === "function" ? game.getLivingPlayerEntities() : [game.player];
  const activePlayers = Array.isArray(livingPlayers) && livingPlayers.length > 0 ? livingPlayers.filter((player) => !!player) : [game.player];
  const playerViews = activePlayers.map((player) => {
    const px = Number.isFinite(player?.x) ? player.x : (game.player?.x || 0);
    const py = Number.isFinite(player?.y) ? player.y : (game.player?.y || 0);
    const camX = Math.max(0, Math.min(game.worldWidth - playW, px - playW / 2));
    const camY = Math.max(0, Math.min(game.worldHeight - game.canvas.height, py - game.canvas.height / 2));
    return {
      player,
      viewLeft: Math.floor(camX / tile),
      viewRight: Math.floor((camX + playW) / tile),
      viewTop: Math.floor(camY / tile),
      viewBottom: Math.floor((camY + game.canvas.height) / tile)
    };
  });

  const isOutsideView = (tx, ty, view) =>
    tx < view.viewLeft || tx > view.viewRight || ty < view.viewTop || ty > view.viewBottom;
  const tryPickNear = (baseTx, baseTy, view) => {
    for (let r = 0; r <= 2; r++) {
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          const tx = Math.max(1, Math.min(maxTx, baseTx + ox));
          const ty = Math.max(1, Math.min(maxTy, baseTy + oy));
          if (!isOutsideView(tx, ty, view)) continue;
          if (!isWalkableTile(game, tx, ty)) continue;
          const x = tx * tile + tile / 2;
          const y = ty * tile + tile / 2;
          return { x, y };
        }
      }
    }
    return null;
  };

  const spawnViewCount = Math.max(1, playerViews.length);
  const startIndex = Number.isFinite(game.enemySpawnFocusIndex) ? game.enemySpawnFocusIndex % spawnViewCount : 0;
  const nextView = () => {
    const view = playerViews[(game.enemySpawnFocusIndex || startIndex) % spawnViewCount] || playerViews[0];
    game.enemySpawnFocusIndex = ((Number.isFinite(game.enemySpawnFocusIndex) ? game.enemySpawnFocusIndex : startIndex) + 1) % spawnViewCount;
    return view;
  };

  for (let i = 0; i < 40; i++) {
    const view = nextView();
    const side = Math.floor(Math.random() * 4);
    let tx = 1;
    let ty = 1;
    if (side === 0) {
      tx = view.viewLeft - 1;
      ty = view.viewTop + Math.floor(Math.random() * Math.max(1, view.viewBottom - view.viewTop + 1));
    } else if (side === 1) {
      tx = view.viewRight + 1;
      ty = view.viewTop + Math.floor(Math.random() * Math.max(1, view.viewBottom - view.viewTop + 1));
    } else if (side === 2) {
      ty = view.viewTop - 1;
      tx = view.viewLeft + Math.floor(Math.random() * Math.max(1, view.viewRight - view.viewLeft + 1));
    } else {
      ty = view.viewBottom + 1;
      tx = view.viewLeft + Math.floor(Math.random() * Math.max(1, view.viewRight - view.viewLeft + 1));
    }
    const p = tryPickNear(tx, ty, view);
    if (p) return p;
  }

  // Fallback: random walkable tile outside visible bounds.
  for (let i = 0; i < 60; i++) {
    const view = nextView();
    const tx = 1 + Math.floor(Math.random() * (game.map[0].length - 2));
    const ty = 1 + Math.floor(Math.random() * (game.map.length - 2));
    if (!isWalkableTile(game, tx, ty)) continue;
    if (!isOutsideView(tx, ty, view)) continue;
    const x = tx * tile + tile / 2;
    const y = ty * tile + tile / 2;
    return { x, y };
  }
  return null;
}
