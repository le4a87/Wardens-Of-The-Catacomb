import { vecLength } from "../utils.js";
import { spawnSkeleton } from "./enemySpawnFactories.js";
import {
  countSummonedSkeletons,
  findNecromancerTeleportPoint,
  findRatCoverTarget,
  findSkeletonSummonPoint,
  getEnemyAttackOwnerId,
  getPriorityTarget,
  hasLineOfSight,
  isFriendlyToPlayer,
  isProjectileThreatening,
  moveEnemyTowardPoint
} from "./enemyAiShared.js";

function findControlledSkeletonGuardTarget(game, enemy, owner) {
  if (!game || !enemy || !owner) return null;
  const tile = game.config?.map?.tile || 32;
  const follow = (game.config?.necromancer?.followDistanceTiles || 2.2) * tile;
  const guardRadius = Math.max(tile * 2.25, follow * 1.2);
  const interceptRadius = Math.max(tile * 1.5, follow * 0.95);
  let best = null;
  let bestOwnerDist = Number.POSITIVE_INFINITY;
  let bestEnemyDist = Number.POSITIVE_INFINITY;
  for (const other of game.enemies || []) {
    if (!other || other === enemy || (other.hp || 0) <= 0) continue;
    if (isFriendlyToPlayer(game, other)) continue;
    if (other.type === "mimic" && other.dormant) continue;
    if (other.type === "skeleton_warrior" && other.collapsed) continue;
    const ownerDist = vecLength((other.x || 0) - owner.x, (other.y || 0) - owner.y);
    const enemyDist = vecLength((other.x || 0) - enemy.x, (other.y || 0) - enemy.y);
    if (ownerDist > guardRadius && enemyDist > interceptRadius) continue;
    if (ownerDist < bestOwnerDist || (ownerDist <= bestOwnerDist + 0.001 && enemyDist < bestEnemyDist)) {
      best = other;
      bestOwnerDist = ownerDist;
      bestEnemyDist = enemyDist;
    }
  }
  return best;
}

function updateFriendlySkeletonBodyguard(game, enemy, dt, speedScale, attackRange = 0, ownerId = null) {
  const owner =
    typeof game.getControllingPlayerEntityForEnemy === "function"
      ? game.getControllingPlayerEntityForEnemy(enemy)
      : game.player;
  if (!owner) return false;
  const ownerSpeed = typeof game.getPlayerMoveSpeedFor === "function" ? game.getPlayerMoveSpeedFor(owner) : game.getPlayerMoveSpeed();
  enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, ownerSpeed * 1.05);
  const tile = game.config?.map?.tile || 32;
  const follow = (game.config?.necromancer?.followDistanceTiles || 2.2) * tile;
  const anchor =
    typeof game.getControlledUndeadFormationPoint === "function"
      ? game.getControlledUndeadFormationPoint(enemy)
      : { x: owner.x, y: owner.y };
  const distToOwner = vecLength(owner.x - enemy.x, owner.y - enemy.y);
  const distToAnchor = vecLength(anchor.x - enemy.x, anchor.y - enemy.y);
  const hardLeash = Math.max(tile * 2.8, follow * 1.7);
  const guardThreat = findControlledSkeletonGuardTarget(game, enemy, owner);
  const legionMasterActive = owner === game.player
    ? (game?.necromancerTalents?.legionMaster?.points || 0) > 0
    : (owner?.necromancerTalents?.legionMaster?.points || 0) > 0;
  const rangedAttackRange = tile * 5;

  if (distToOwner > hardLeash) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "return");
    moveEnemyTowardPoint(game, enemy, anchor, dt, Math.max(1.05, speedScale), Math.max(8, tile * 0.3));
    return true;
  }

  if (guardThreat) {
    const dx = guardThreat.x - enemy.x;
    const dy = guardThreat.y - enemy.y;
    const dist = vecLength(dx, dy) || 1;
    enemy.dirX = dx / dist;
    enemy.dirY = dy / dist;
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "guard");
    if (attackRange > 0 && dist <= attackRange && (enemy.attackCooldown || 0) <= 0) {
      enemy.attackCooldown = (game.config.enemy.skeletonWarriorAttackCooldown || 1.0) / Math.max(0.4, 1 + (enemy.controlledAttackSpeedBonusPct || 0));
      game.applyEnemyDamage(guardThreat, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical", ownerId);
      return true;
    }
    enemy.rangedAttackCooldown = Math.max(0, (enemy.rangedAttackCooldown || 0) - dt);
    if (
      legionMasterActive &&
      enemy.type === "skeleton_warrior" &&
      dist <= rangedAttackRange &&
      dist > attackRange * 1.1 &&
      hasLineOfSight(game, enemy.x, enemy.y, guardThreat.x, guardThreat.y) &&
      (enemy.rangedAttackCooldown || 0) <= 0
    ) {
      const angle = Math.atan2(dy, dx);
      const speed = game.config.enemy.ratArcherProjectileSpeed || 360;
      const damageMin = Math.max(1, Math.round((enemy.damageMin || game.config.enemy.skeletonWarriorDamageMin || 10) * 0.8));
      const damageMax = Math.max(damageMin, Math.round((enemy.damageMax || game.config.enemy.skeletonWarriorDamageMax || 16) * 0.8));
      game.bullets.push({
        x: enemy.x + Math.cos(angle) * 10,
        y: enemy.y + Math.sin(angle) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle,
        life: 1.15,
        size: 6,
        damageMin,
        damageMax,
        damageType: "arrow",
        ownerId,
        faction: "player"
      });
      enemy.rangedAttackCooldown = 1.25;
      return true;
    }
    moveEnemyTowardPoint(game, enemy, guardThreat, dt, Math.max(0.95, speedScale), Math.max(6, tile * 0.18));
    return true;
  }

  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "escort");
  if (distToAnchor > Math.max(tile * 0.35, follow * 0.22)) {
    moveEnemyTowardPoint(game, enemy, anchor, dt, Math.max(0.92, speedScale), Math.max(6, tile * 0.18));
  }
  return true;
}

export function updateRatArcher(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.ratArcherPreferredRangeTiles || 7) * tile;
  const retreatRange = (game.config.enemy.ratArcherRetreatRangeTiles || 5) * tile;
  const advanceRange = Math.max(preferredRange, (game.config.enemy.ratArcherAdvanceRangeTiles || 8.5) * tile);
  const holdBand = Math.max(tile * 0.5, (game.config.enemy.ratArcherHoldBandTiles || 1.1) * tile);
  const dodgeRadius = (game.config.enemy.ratArcherDodgeRadiusTiles || 2) * tile;
  const target = getPriorityTarget(game, enemy, preferredRange * 1.8);
  const toPlayerX = target.x - enemy.x;
  const toPlayerY = target.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const seesPlayer = hasLineOfSight(game, enemy.x, enemy.y, target.x, target.y);
  enemy.dirX = toPlayerX / playerDist;
  enemy.dirY = toPlayerY / playerDist;
  const prevWindupTimer = Number.isFinite(enemy.shotWindupTimer) ? enemy.shotWindupTimer : 0;
  enemy.shotWindupTimer = Math.max(0, prevWindupTimer - dt);
  enemy.shotIntervalTimer = Math.max(0, (enemy.shotIntervalTimer || 0) - dt);
  enemy.burstCooldownTimer = Math.max(0, (enemy.burstCooldownTimer || 0) - dt);
  enemy.repositionTimer = Math.max(0, (enemy.repositionTimer || 0) - dt);
  enemy.dodgeCooldownTimer = Math.max(0, (enemy.dodgeCooldownTimer || 0) - dt);
  enemy.dodgeTimer = Math.max(0, (enemy.dodgeTimer || 0) - dt);
  const inHoldBand = Math.abs(playerDist - preferredRange) <= holdBand;
  let nextStage = "hold";
  if (playerDist < retreatRange) nextStage = "retreat";
  else if (inHoldBand) nextStage = "hold";
  else if (enemy.repositionTimer > 0 || enemy.burstCooldownTimer > 0 || enemy.shotIntervalTimer > 0) nextStage = "reposition";
  else if (playerDist > advanceRange || !seesPlayer) nextStage = "advance";
  enemy.rangeStage = nextStage;
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, nextStage);
  if ((enemy.dodgeTimer || 0) > 0) {
    game.moveWithCollision(enemy, (enemy.dodgeVx || 0) * dt, (enemy.dodgeVy || 0) * dt);
    return;
  }
  for (const bullet of game.bullets) {
    if (bullet.projectileType === "trapArrow" || bullet.projectileType === "ratArrow") continue;
    if (!isProjectileThreatening(enemy, bullet, dodgeRadius)) continue;
    if ((enemy.dodgeCooldownTimer || 0) > 0) break;
    const sidestepChoices = [
      { x: -(bullet.vy || 0), y: bullet.vx || 0 },
      { x: bullet.vy || 0, y: -(bullet.vx || 0) }
    ];
    const dodgeDistance = (game.config.enemy.ratArcherDodgeDistanceTiles || 1.1) * tile;
    const dodgeDuration = Math.max(0.04, game.config.enemy.ratArcherDodgeDuration || 0.12);
    for (const choice of sidestepChoices) {
      const sidestepLen = vecLength(choice.x, choice.y) || 1;
      enemy.dodgeVx = (choice.x / sidestepLen) * (dodgeDistance / dodgeDuration);
      enemy.dodgeVy = (choice.y / sidestepLen) * (dodgeDistance / dodgeDuration);
      enemy.dodgeTimer = dodgeDuration;
      break;
    }
    enemy.dodgeCooldownTimer = game.config.enemy.ratArcherDodgeCooldown || 2.5;
    enemy.coverTargetX = enemy.x;
    enemy.coverTargetY = enemy.y;
    return;
  }
  if (prevWindupTimer > 0) {
    if (enemy.shotWindupTimer <= 0.0001) {
      const count = Math.max(1, Math.floor(game.config.enemy.ratArcherSpreadCount || 3));
      const spreadDeg = game.config.enemy.ratArcherSpreadDeg || 20;
      const spreadRad = (spreadDeg * Math.PI) / 180;
      const baseAngle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
      const speed = game.config.enemy.ratArcherProjectileSpeed || 360;
      const damageMin = game.config.enemy.ratArcherDamageMin;
      const damageMax = game.config.enemy.ratArcherDamageMax;
      for (let i = 0; i < count; i++) {
        const t = count <= 1 ? 0 : i / (count - 1);
        const offset = count <= 1 ? 0 : (t - 0.5) * spreadRad;
        const angle = baseAngle + offset;
        game.bullets.push({
          x: enemy.x + Math.cos(angle) * 9,
          y: enemy.y + Math.sin(angle) * 9,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          angle,
          life: game.config.enemy.ratArcherProjectileLife || 1.3,
          size: 6,
          projectileType: "ratArrow",
          damageMin,
          damageMax
        });
      }
      enemy.shotWindupTimer = 0;
      enemy.shotsRemaining = Math.max(0, (enemy.shotsRemaining || 0) - 1);
      if (enemy.shotsRemaining <= 0) {
        enemy.shotsRemaining = game.config.enemy.ratArcherBurstShots || 3;
        enemy.burstCooldownTimer = game.config.enemy.ratArcherBurstCooldown || 5;
      } else {
        enemy.shotIntervalTimer = game.config.enemy.ratArcherShotInterval || 1.5;
      }
      const cover = findRatCoverTarget(game, enemy, retreatRange);
      if (cover) {
        enemy.coverTargetX = cover.x;
        enemy.coverTargetY = cover.y;
        enemy.repositionTimer = game.config.enemy.ratArcherRepositionCommitTime || 1.35;
      }
      return;
    }
    return;
  }
  if (playerDist < retreatRange) {
    moveEnemyTowardPoint(game, enemy, { x: enemy.x - (toPlayerX / playerDist) * 96, y: enemy.y - (toPlayerY / playerDist) * 96 }, dt, speedScale);
    return;
  }
  if (enemy.repositionTimer > 0 || enemy.burstCooldownTimer > 0 || enemy.shotIntervalTimer > 0) {
    const cx = Number.isFinite(enemy.coverTargetX) ? enemy.coverTargetX : enemy.x;
    const cy = Number.isFinite(enemy.coverTargetY) ? enemy.coverTargetY : enemy.y;
    const dx = cx - enemy.x;
    const dy = cy - enemy.y;
    const len = vecLength(dx, dy);
    if (len > 6) {
      moveEnemyTowardPoint(game, enemy, { x: cx, y: cy }, dt, speedScale);
      return;
    }
  }
  if (!inHoldBand && (playerDist > advanceRange || !seesPlayer)) {
    if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
    else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
    return;
  }
  if (inHoldBand) {
    enemy.coverTargetX = enemy.x;
    enemy.coverTargetY = enemy.y;
  }
  if (enemy.burstCooldownTimer <= 0 && enemy.shotIntervalTimer <= 0 && seesPlayer) {
    enemy.shotWindupTimer = game.config.enemy.ratArcherWindup || 0.4;
  }
}

export function updateSkeletonWarrior(game, enemy, dt, speedScale) {
  const ownerId = getEnemyAttackOwnerId(game, enemy);
  if (isFriendlyToPlayer(game, enemy) && typeof game.getPlayerMoveSpeed === "function") {
    enemy.speed = Math.max(Number.isFinite(enemy.speed) ? enemy.speed : 0, game.getPlayerMoveSpeed() * 1.1);
  }
  enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
  if (enemy.collapsed) {
    if (typeof game.setEnemyTacticPhase === "function") {
      game.setEnemyTacticPhase(enemy, enemy.reanimating ? "reanimating" : "collapsed");
    }
    enemy.collapseTimer = Math.max(0, (enemy.collapseTimer || 0) - dt);
    if (enemy.reviveAtEnd && !enemy.reanimating && enemy.collapseTimer <= 0) {
      enemy.reanimating = true;
      enemy.reanimateTimer = Math.max(0.15, game.config.enemy.skeletonWarriorReanimateWindup || 1.2);
    }
    if (enemy.reanimating) {
      enemy.reanimateTimer = Math.max(0, (enemy.reanimateTimer || 0) - dt);
      if (enemy.reanimateTimer <= 0) {
        enemy.collapsed = false;
        enemy.reanimating = false;
        enemy.reviveAtEnd = false;
        enemy.hp = Math.max(1, Math.round(enemy.maxHp * Math.max(0.1, game.config.enemy.skeletonWarriorReviveHpPct || 0.35)));
        enemy.attackCooldown = game.config.enemy.skeletonWarriorAttackCooldown || 1.0;
      }
    } else if (enemy.collapseTimer <= 0 && !enemy.reviveAtEnd) {
      enemy.hp = 0;
    }
    return;
  }
  if (isFriendlyToPlayer(game, enemy)) {
    updateFriendlySkeletonBodyguard(game, enemy, dt, speedScale, game.config.enemy.skeletonWarriorAttackRange || 42, ownerId);
    return;
  }
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "advancing");
  const range = game.config.enemy.skeletonWarriorAttackRange || 42;
  const target = getPriorityTarget(game, enemy, range * 4);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  enemy.dirX = dx / dist;
  enemy.dirY = dy / dist;
  if (dist <= range && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = (game.config.enemy.skeletonWarriorAttackCooldown || 1.0) / Math.max(0.4, 1 + (enemy.controlledAttackSpeedBonusPct || 0));
    if (game.isPlayerEntity && game.isPlayerEntity(target) && (target.hitCooldown || 0) <= 0) {
      target.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
    } else if (!game.isPlayerEntity || !game.isPlayerEntity(target)) {
      game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical", ownerId);
    }
    return;
  }
  if (typeof game.moveEnemyTowardTarget === "function") game.moveEnemyTowardTarget(enemy, target, speedScale, dt, 6);
  else game.moveEnemyTowardPlayer(enemy, speedScale, dt);
}

export function updateSkeleton(game, enemy, dt, speedScale) {
  if (isFriendlyToPlayer(game, enemy)) {
    updateFriendlySkeletonBodyguard(game, enemy, dt, speedScale);
    return;
  }
  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "advancing");
  const target = getPriorityTarget(game, enemy);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  enemy.dirX = dx / dist;
  enemy.dirY = dy / dist;
  moveEnemyTowardPoint(game, enemy, target, dt, speedScale, 6);
}

export function updateNecromancer(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.necromancerPreferredRangeTiles || 5) * tile;
  const retreatRange = (game.config.enemy.necromancerRetreatRangeTiles || 3) * tile;
  const teleportRange = (game.config.enemy.necromancerBossTeleportRangeTiles || 8) * tile;
  const teleportCooldownMax = Math.max(1.2, game.config.enemy.necromancerBossTeleportCooldown || 4.5);
  const teleportHealthThreshold = Math.max(0, Math.min(1, game.config.enemy.necromancerBossTeleportHealthThreshold || 0.8));
  const castCooldownMax = Math.max(0.3, game.config.enemy.necromancerCastCooldown || 2.2);
  const bossSummonCooldownMultiplier = enemy.isFloorBoss && Number.isFinite(game.config.enemy.necromancerBossSummonCooldownMultiplier)
    ? Math.max(0.25, game.config.enemy.necromancerBossSummonCooldownMultiplier)
    : 1;
  const summonCooldownMax = Math.max(0.8, (game.config.enemy.necromancerSummonCooldown || 5.5) * bossSummonCooldownMultiplier);
  const summonCapBonus = enemy.isFloorBoss && Number.isFinite(game.config.enemy.necromancerBossSummonCapBonus)
    ? Math.max(0, Math.floor(game.config.enemy.necromancerBossSummonCapBonus))
    : 0;
  const summonCountBonus = enemy.isFloorBoss && Number.isFinite(game.config.enemy.necromancerBossSummonCountBonus)
    ? Math.max(0, Math.floor(game.config.enemy.necromancerBossSummonCountBonus))
    : 0;
  const summonCap = Math.max(1, Math.floor(game.config.enemy.necromancerSummonCap || 5) + summonCapBonus);
  const summonCount = Math.max(1, Math.floor(game.config.enemy.necromancerSummonCount || 2) + summonCountBonus);
  const targetPlayer = typeof game.getNearestPlayerEntity === "function" ? game.getNearestPlayerEntity(enemy.x, enemy.y) : game.player;
  const toPlayerX = targetPlayer.x - enemy.x;
  const toPlayerY = targetPlayer.y - enemy.y;
  const playerDist = vecLength(toPlayerX, toPlayerY) || 1;
  const dirX = toPlayerX / playerDist;
  const dirY = toPlayerY / playerDist;
  const perpX = -dirY;
  const perpY = dirX;
  enemy.strafeTimer = Math.max(0, (enemy.strafeTimer || 0) - dt);
  enemy.castCooldown = Math.max(0, (enemy.castCooldown || 0) - dt);
  enemy.summonCooldown = Math.max(0, (enemy.summonCooldown || 0) - dt);
  enemy.teleportCooldown = Math.max(0, (enemy.teleportCooldown || 0) - dt);
  enemy.teleportFlashTimer = Math.max(0, (enemy.teleportFlashTimer || 0) - dt);
  if (enemy.strafeTimer <= 0) {
    enemy.strafeTimer = 0.8 + Math.random() * 1.4;
    enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }
  if (
    enemy.isFloorBoss &&
    enemy.teleportCooldown <= 0 &&
    playerDist >= teleportRange &&
    (enemy.hp / Math.max(1, enemy.maxHp)) <= teleportHealthThreshold
  ) {
    const point = findNecromancerTeleportPoint(game, enemy);
    if (point) {
      enemy.x = point.x;
      enemy.y = point.y;
      enemy.teleportCooldown = teleportCooldownMax;
      enemy.teleportFlashTimer = 0.28;
      enemy.castCooldown = Math.min(enemy.castCooldown, 0.35);
      enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
      if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "teleport");
      if (typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 10, "Blink", "#cfc1ff", 0.85, 13);
      }
      return;
    }
  }
  if (playerDist < retreatRange) {
    moveEnemyTowardPoint(game, enemy, { x: enemy.x - dirX * 96, y: enemy.y - dirY * 96 }, dt, Number.isFinite(speedScale) ? speedScale : 1);
    return;
  }
  if (playerDist > preferredRange || !hasLineOfSight(game, enemy.x, enemy.y, targetPlayer.x, targetPlayer.y)) {
    moveEnemyTowardPoint(game, enemy, targetPlayer, dt, speedScale * 0.92);
    return;
  }
  if (enemy.summonCooldown <= 0 && countSummonedSkeletons(game) < summonCap) {
    const activeCount = countSummonedSkeletons(game);
    const budget = Math.max(0, summonCap - activeCount);
    const toSpawn = Math.min(summonCount, budget);
    const baseAngle = Math.atan2(dirY, dirX) + Math.PI * 0.5;
    const radius = enemy.size + tile * 0.65;
    let spawned = 0;
    for (let i = 0; i < toSpawn; i++) {
      const offset = (i - (toSpawn - 1) * 0.5) * 0.85;
      const point = findSkeletonSummonPoint(game, enemy, baseAngle + offset, radius);
      if (!point) continue;
      game.enemies.push(spawnSkeleton(game, point.x, point.y, { summonedByNecromancer: true, summonerBoss: true }));
      spawned += 1;
    }
    if (spawned > 0) {
      enemy.summonCooldown = summonCooldownMax;
      game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 10, "Raise Dead", "#cfc1ff", 1.1, 14);
    }
  }
  if (enemy.castCooldown <= 0) {
    const baseAngle = Math.atan2(dirY, dirX);
    const spread = ((game.config.enemy.necromancerProjectileSpreadDeg || 16) * Math.PI) / 180;
    const speed = game.config.enemy.necromancerProjectileSpeed || 230;
    const size = game.config.enemy.necromancerProjectileSize || 12;
    const damage = game.config.enemy.necromancerProjectileDamage || 16;
    const life = game.config.enemy.necromancerProjectileLife || 2.8;
    const originDistance = enemy.size * 0.75;
    for (const offset of [-spread, 0, spread]) {
      const angle = baseAngle + offset;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      game.bullets.push({
        x: enemy.x + Math.cos(angle) * originDistance,
        y: enemy.y + Math.sin(angle) * originDistance,
        vx,
        vy,
        angle,
        life,
        size,
        kind: "necroticBolt",
        faction: "enemy",
        damage,
        damageType: "necrotic"
      });
    }
    enemy.castCooldown = castCooldownMax;
    enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
  }
  const strafeScale = playerDist > preferredRange * 0.7 ? 0.9 : 0.55;
  moveEnemyTowardPoint(
    game,
    enemy,
    { x: enemy.x + perpX * enemy.strafeDir * 96, y: enemy.y + perpY * enemy.strafeDir * 96 },
    dt,
    (Number.isFinite(speedScale) ? speedScale : 1) * strafeScale
  );
}

function spawnSonyaVolley(game, enemy, count, spreadRad, leaveFirePatch) {
  const ownerId = "sonya";
  const baseAngle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
  const speed = game.config.enemy.sonyaFireballSpeed || 212;
  const life = game.config.enemy.sonyaFireballLife || 2.8;
  const size = game.config.enemy.sonyaFireballSize || 13;
  const damage = game.config.enemy.sonyaFireballDamage || 18;
  const originDistance = enemy.size * 0.76;
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const offset = count <= 1 ? 0 : (t - 0.5) * spreadRad;
    const angle = baseAngle + offset;
    game.bullets.push({
      x: enemy.x + Math.cos(angle) * originDistance,
      y: enemy.y + Math.sin(angle) * originDistance,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      life,
      size,
      faction: "enemy",
      projectileType: "sonyaFireball",
      damage,
      damageType: "fire",
      leaveFirePatch: !!leaveFirePatch,
      ownerId
    });
  }
}

const SONYA_SPEECH_LINES = [
  "Haley, this one's for you!",
  "Make a wish.",
  "Feel the birthday heat."
];

export function updateSonyaBoss(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const preferredRange = (game.config.enemy.sonyaPreferredRangeTiles || 5.5) * tile;
  const retreatRange = (game.config.enemy.sonyaRetreatRangeTiles || 3.25) * tile;
  const castCooldownMax = Math.max(0.6, game.config.enemy.sonyaCastCooldown || 1.8);
  const castWindupMax = Math.max(0.18, game.config.enemy.sonyaCastWindup || 0.42);
  const blinkCooldownMax = Math.max(1.4, game.config.enemy.sonyaBlinkCooldown || 4.8);
  const blinkHealthThreshold = Math.max(0.2, Math.min(1, game.config.enemy.sonyaBlinkHealthThreshold || 0.6));
  const targetPlayer = typeof game.getNearestPlayerEntity === "function" ? game.getNearestPlayerEntity(enemy.x, enemy.y) : game.player;
  const dx = targetPlayer.x - enemy.x;
  const dy = targetPlayer.y - enemy.y;
  const playerDist = vecLength(dx, dy) || 1;
  const dirX = dx / playerDist;
  const dirY = dy / playerDist;
  const perpX = -dirY;
  const perpY = dirX;
  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const speed = (Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : game.config.enemy.sonyaSpeed || 112) * (Number.isFinite(speedScale) ? speedScale : 1);
  const seesPlayer = hasLineOfSight(game, enemy.x, enemy.y, targetPlayer.x, targetPlayer.y);

  enemy.dirX = dirX;
  enemy.dirY = dirY;
  enemy.strafeTimer = Math.max(0, (enemy.strafeTimer || 0) - dt);
  enemy.castCooldown = Math.max(0, (enemy.castCooldown || 0) - dt);
  const prevCastWindup = Number.isFinite(enemy.castWindup) ? enemy.castWindup : 0;
  enemy.castWindup = Math.max(0, prevCastWindup - dt);
  enemy.blinkCooldown = Math.max(0, (enemy.blinkCooldown || 0) - dt);
  enemy.blinkFlashTimer = Math.max(0, (enemy.blinkFlashTimer || 0) - dt);
  enemy.speechCooldown = Math.max(0, (enemy.speechCooldown || 0) - dt);
  if (enemy.strafeTimer <= 0) {
    enemy.strafeTimer = 0.9 + Math.random() * 1.2;
    enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }

  if (enemy.phase === "intro") {
    enemy.invincible = true;
    enemy.introTimer = Math.max(0, (enemy.introTimer || 0) - dt);
    if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase("intro");
    if (enemy.introTimer <= 0) {
      enemy.phase = "solo";
      enemy.invincible = false;
      if (typeof game.queueFloorBossSpeech === "function") {
        game.queueFloorBossSpeech("Let's light this birthday up.", enemy.x, enemy.y, 2.3);
      }
    }
    return;
  }

  enemy.invincible = false;
  const nextPhase = hpRatio <= 0.25 ? "candlestorm" : hpRatio <= 0.6 ? "chorus" : "solo";
  if (enemy.phase !== nextPhase) {
    enemy.phase = nextPhase;
    if (typeof game.setFloorBossEncounterPhase === "function") game.setFloorBossEncounterPhase(nextPhase);
    if (typeof game.queueFloorBossSpeech === "function") {
      const line =
        nextPhase === "candlestorm"
          ? "Candles up. No more safe spots."
          : nextPhase === "chorus"
          ? "Now sing with me."
          : "Happy birthday, Haley!";
      game.queueFloorBossSpeech(line, enemy.x, enemy.y, 2.2);
    }
  }

  if (enemy.speechCooldown <= 0 && typeof game.queueFloorBossSpeech === "function") {
    const min = Math.max(1.5, game.config.enemy.sonyaSpeechCooldownMin || 4.4);
    const max = Math.max(min, game.config.enemy.sonyaSpeechCooldownMax || 7.2);
    game.queueFloorBossSpeech(SONYA_SPEECH_LINES[Math.floor(Math.random() * SONYA_SPEECH_LINES.length)], enemy.x, enemy.y, 1.9);
    enemy.speechCooldown = min + Math.random() * Math.max(0, max - min);
  }

  if (
    enemy.blinkCooldown <= 0 &&
    hpRatio <= blinkHealthThreshold &&
    (playerDist < retreatRange * 0.85 || (!seesPlayer && playerDist > preferredRange * 1.2))
  ) {
    const point = findNecromancerTeleportPoint(game, enemy);
    if (point) {
      enemy.x = point.x;
      enemy.y = point.y;
      enemy.blinkCooldown = blinkCooldownMax;
      enemy.blinkFlashTimer = 0.3;
      enemy.castCooldown = Math.min(enemy.castCooldown || 0, 0.25);
      enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
      if (typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 8, "Blink Step", "#ffbf82", 0.8, 13);
      }
      return;
    }
  }

  if (prevCastWindup > 0) {
    if (enemy.castWindup <= 0.0001) {
      const isCandlestorm = enemy.phase === "candlestorm";
      const isChorus = enemy.phase === "chorus";
      if (enemy.castPattern === "fan") {
        spawnSonyaVolley(
          game,
          enemy,
          Math.max(3, Math.floor(game.config.enemy.sonyaVolleyCount || 3)),
          ((game.config.enemy.sonyaFireballSpreadDeg || 22) * Math.PI) / 180,
          isCandlestorm
        );
      } else {
        spawnSonyaVolley(game, enemy, 1, 0, isCandlestorm);
      }
      enemy.castCooldown = castCooldownMax * (isCandlestorm ? 0.86 : isChorus ? 0.92 : 1);
      enemy.castWindup = 0;
      enemy.hpBarTimer = Math.max(enemy.hpBarTimer || 0, game.config.enemy.hpBarDuration);
      if (enemy.phase === "candlestorm" && typeof game.spawnFloatingText === "function") {
        game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 10, "Candlestorm", "#ff9f54", 0.95, 13);
      }
    }
    return;
  }

  if (playerDist < retreatRange) {
    moveEnemyTowardPoint(game, enemy, { x: enemy.x - dirX * 96, y: enemy.y - dirY * 96 }, dt, Number.isFinite(speedScale) ? speedScale : 1);
    return;
  }
  if (playerDist > preferredRange * 1.18 || !seesPlayer) {
    moveEnemyTowardPoint(game, enemy, targetPlayer, dt, (Number.isFinite(speedScale) ? speedScale : 1) * 0.92);
    return;
  }

  if (enemy.castCooldown <= 0) {
    enemy.castPattern = enemy.phase === "solo" ? "single" : enemy.phase === "chorus" && Math.random() < 0.65 ? "fan" : "single";
    if (enemy.phase === "candlestorm" && Math.random() < 0.8) enemy.castPattern = "fan";
    enemy.castWindup = castWindupMax;
    if (typeof game.spawnFloatingText === "function") {
      game.spawnFloatingText(enemy.x, enemy.y - enemy.size - 8, enemy.castPattern === "fan" ? "Birthday Chorus" : "Fireball", "#ffd39a", 0.6, 12);
    }
    return;
  }

  moveEnemyTowardPoint(
    game,
    enemy,
    { x: enemy.x + perpX * (enemy.strafeDir || 1) * 96, y: enemy.y + perpY * (enemy.strafeDir || 1) * 96 },
    dt,
    (speed / Math.max(1, enemy.speed || speed)) * (enemy.phase === "candlestorm" ? 0.86 : 0.72)
  );
}

export function updateMinotaur(game, enemy, dt, speedScale) {
  const tile = game.config?.map?.tile || 32;
  const target = getPriorityTarget(game, enemy, tile * 12);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = vecLength(dx, dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;
  const chargeRange = (game.config.enemy.minotaurChargeRangeTiles || 6.5) * tile;
  const stompRange = (game.config.enemy.minotaurStompRangeTiles || 1.8) * tile;
  const chargePushDistance = (game.config.enemy.minotaurChargePushDistanceTiles || 1.2) * tile;
  const chargeDamageMultiplier = Math.max(1, game.config.enemy.minotaurChargeContactDamageMultiplier || 1.3);

  enemy.chargeCooldown = Math.max(0, (enemy.chargeCooldown || 0) - dt);
  enemy.chargeTimer = Math.max(0, (enemy.chargeTimer || 0) - dt);
  enemy.chargeWindupTimer = Math.max(0, (enemy.chargeWindupTimer || 0) - dt);
  enemy.stompCooldown = Math.max(0, (enemy.stompCooldown || 0) - dt);
  enemy.chargeImpactCooldown = Math.max(0, (enemy.chargeImpactCooldown || 0) - dt);

  if ((enemy.chargeTimer || 0) > 0) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "charging");
    const chargeScale = (game.config.enemy.minotaurChargeSpeedMultiplier || 2.2) * (Number.isFinite(speedScale) ? speedScale : 1);
    const chargeTravel = (game.config.enemy.minotaurChargeTravelTiles || 7) * tile;
    moveEnemyTowardPoint(
      game,
      enemy,
      { x: enemy.x + (enemy.chargeDirX || dirX) * chargeTravel, y: enemy.y + (enemy.chargeDirY || dirY) * chargeTravel },
      dt,
      chargeScale
    );
    if (game.isPlayerEntity && game.isPlayerEntity(target)) {
      const playerRadius = typeof game.getPlayerEnemyCollisionRadiusFor === "function"
        ? game.getPlayerEnemyCollisionRadiusFor(target)
        : (target.size || 20) * 0.5;
      const collisionRange = playerRadius + (enemy.size || 34) * 0.52;
      const playerDist = vecLength(target.x - enemy.x, target.y - enemy.y);
      if (playerDist <= collisionRange) {
        game.moveWithCollision(target, (enemy.chargeDirX || dirX) * chargePushDistance * dt, (enemy.chargeDirY || dirY) * chargePushDistance * dt);
        if (enemy.chargeImpactCooldown <= 0 && (target.hitCooldown || 0) <= 0) {
          target.hitCooldown = 0.75;
          enemy.chargeImpactCooldown = 0.18;
          const rawDamage = game.rollEnemyContactDamage(enemy) * chargeDamageMultiplier;
          const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
          game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
        }
      }
    }
    return;
  }

  if ((enemy.chargeWindupTimer || 0) > 0) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "windup");
    return;
  }

  if (dist <= stompRange && enemy.stompCooldown <= 0) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "stomp");
    enemy.stompCooldown = game.config.enemy.minotaurStompCooldown || 2.2;
    if (game.isPlayerEntity && game.isPlayerEntity(target) && (target.hitCooldown || 0) <= 0) {
      target.hitCooldown = 1.0;
      const rawDamage = game.rollEnemyContactDamage(enemy);
      const scaledEnemyDamage = rawDamage * game.getEnemyDamageScale();
      game.applyDamageToPlayerEntity(target, game.getDamageTakenForPlayerEntity(target, scaledEnemyDamage, "physical"), "physical");
    } else if (!game.isPlayerEntity || !game.isPlayerEntity(target)) {
      game.applyEnemyDamage(target, game.rollEnemyContactDamage(enemy) * game.getEnemyDamageScale(), "physical");
    }
    return;
  }

  if (dist >= stompRange * 1.4 && dist <= chargeRange && enemy.chargeCooldown <= 0) {
    if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "windup");
    enemy.chargeDirX = dirX;
    enemy.chargeDirY = dirY;
    enemy.chargeWindupTimer = game.config.enemy.minotaurWindup || 0.45;
    enemy.chargeCooldown = game.config.enemy.minotaurChargeCooldown || 3.8;
    enemy.chargeTimer = game.config.enemy.minotaurChargeDuration || 0.6;
    return;
  }

  if (typeof game.setEnemyTacticPhase === "function") game.setEnemyTacticPhase(enemy, "advancing");
  moveEnemyTowardPoint(game, enemy, target, dt, speedScale, Math.max(8, stompRange * 0.45));
}
