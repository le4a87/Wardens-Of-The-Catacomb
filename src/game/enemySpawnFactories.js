export function spawnGhost(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.ghostHpMin, game.config.enemy.ghostHpMax);
  const speedMin = Number.isFinite(game.config.enemy.ghostSpeedMin) ? game.config.enemy.ghostSpeedMin : 110;
  const speedMax = Number.isFinite(game.config.enemy.ghostSpeedMax) ? game.config.enemy.ghostSpeedMax : 150;
  const speed = speedMin + Math.random() * Math.max(0, speedMax - speedMin);
  return {
    type: "ghost",
    tacticKey: "ghost",
    x,
    y,
    size: 20,
    speed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: speed,
    hpBarTimer: 0,
    damageMin: game.config.enemy.ghostDamageMin,
    damageMax: game.config.enemy.ghostDamageMax,
    baseDamageMin: game.config.enemy.ghostDamageMin,
    baseDamageMax: game.config.enemy.ghostDamageMax,
    contactAttackCooldown: 0,
    siphonTickTimer: 0,
    siphoning: false,
    diveTimer: 1.2 + Math.random() * 1.6,
    diveDuration: 0,
    orbitDir: Math.random() < 0.5 ? -1 : 1,
    orbitSwapTimer: 0.8 + Math.random() * 1.4
  };
}

export function spawnTreasureGoblin(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.goblinHpMin, game.config.enemy.goblinHpMax);
  return {
    type: "goblin",
    tacticKey: "goblin",
    x,
    y,
    size: 16,
    speed: 95,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.goblinDamageMin,
    damageMax: game.config.enemy.goblinDamageMax,
    goldEaten: 0,
    aggression: 0.12,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 0.5 + Math.random() * 0.8,
    growthStage: "scared"
  };
}

export function spawnAnimatedArmor(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.armorHpMin, game.config.enemy.armorHpMax);
  return {
    type: "armor",
    tacticKey: "armor",
    x,
    y,
    size: 24,
    speed: game.config.enemy.armorSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.armorDamageMin,
    damageMax: game.config.enemy.armorDamageMax,
    variant: typeof game.getAnimatedArmorVariant === "function" ? game.getAnimatedArmorVariant() : null
  };
}

export function spawnMummy(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.mummyHpMin, game.config.enemy.mummyHpMax);
  return {
    type: "mummy",
    tacticKey: "mummy",
    x,
    y,
    size: 24,
    speed: game.config.enemy.mummySpeed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: game.config.enemy.mummySpeed,
    hpBarTimer: 0,
    damageMin: game.config.enemy.mummyDamageMin,
    damageMax: game.config.enemy.mummyDamageMax,
    baseDamageMin: game.config.enemy.mummyDamageMin,
    baseDamageMax: game.config.enemy.mummyDamageMax,
    contactAttackCooldown: 0,
    auraPulseTimer: 0
  };
}

export function spawnPrisoner(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.prisonerHpMin, game.config.enemy.prisonerHpMax);
  return {
    type: "prisoner",
    x,
    y,
    size: 26,
    speed: game.config.enemy.prisonerSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.prisonerDamageMin,
    damageMax: game.config.enemy.prisonerDamageMax,
    attackCooldown: 0,
    swingTimer: 0,
    sweepApplied: false,
    dirX: 1,
    dirY: 0
  };
}

export function spawnMimic(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.mimicHpMin, game.config.enemy.mimicHpMax);
  return {
    type: "mimic",
    tacticKey: "mimic",
    x,
    y,
    homeX: x,
    homeY: y,
    size: 20,
    speed: game.config.enemy.mimicSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.mimicDamageMin,
    damageMax: game.config.enemy.mimicDamageMax,
    dormant: true,
    revealed: false,
    tongueCooldown: 0,
    tongueTimer: 0,
    tongueDirX: 1,
    tongueDirY: 0,
    tongueLength: 0
  };
}

export function spawnRatArcher(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.ratArcherHpMin, game.config.enemy.ratArcherHpMax);
  return {
    type: "rat_archer",
    tacticKey: "rat_archer",
    x,
    y,
    size: 20,
    speed: game.config.enemy.ratArcherSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.ratArcherContactDamageMin,
    damageMax: game.config.enemy.ratArcherContactDamageMax,
    rangedDamageMin: game.config.enemy.ratArcherDamageMin,
    rangedDamageMax: game.config.enemy.ratArcherDamageMax,
    dirX: 1,
    dirY: 0,
    shotWindupTimer: 0,
    shotIntervalTimer: 0,
    burstCooldownTimer: 0,
    dodgeCooldownTimer: 0,
    dodgeTimer: 0,
    dodgeVx: 0,
    dodgeVy: 0,
    shotsRemaining: game.config.enemy.ratArcherBurstShots,
    coverTargetX: x,
    coverTargetY: y,
    repositionTimer: 0,
    rangeStage: "hold"
  };
}

export function spawnSkeletonWarrior(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.skeletonWarriorHpMin, game.config.enemy.skeletonWarriorHpMax);
  return {
    type: "skeleton_warrior",
    tacticKey: "skeleton_warrior",
    x,
    y,
    size: 20,
    speed: game.config.enemy.skeletonWarriorSpeed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: game.config.enemy.skeletonWarriorSpeed,
    hpBarTimer: 0,
    damageMin: game.config.enemy.skeletonWarriorDamageMin,
    damageMax: game.config.enemy.skeletonWarriorDamageMax,
    baseDamageMin: game.config.enemy.skeletonWarriorDamageMin,
    baseDamageMax: game.config.enemy.skeletonWarriorDamageMax,
    attackCooldown: 0,
    contactAttackCooldown: 0,
    collapsed: false,
    collapseTimer: 0,
    reviveAtEnd: false,
    reanimateTimer: 0,
    reanimating: false
  };
}

export function spawnNecromancer(game, x, y) {
  const hpBase = game.rollScaledEnemyHealth(game.config.enemy.necromancerHpMin, game.config.enemy.necromancerHpMax);
  const hpMultiplier = Number.isFinite(game.config.enemy.necromancerBossHpMultiplier)
    ? Math.max(1, game.config.enemy.necromancerBossHpMultiplier)
    : 1;
  const speedMultiplier = Number.isFinite(game.config.enemy.necromancerBossSpeedMultiplier)
    ? Math.max(1, game.config.enemy.necromancerBossSpeedMultiplier)
    : 1;
  const hp = Math.max(1, Math.round(hpBase * hpMultiplier));
  const speed = game.config.enemy.necromancerSpeed * speedMultiplier;
  return {
    type: "necromancer",
    tacticKey: "necromancer",
    x,
    y,
    size: 28,
    speed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: speed,
    hpBarTimer: 9999,
    damageMin: game.config.enemy.necromancerDamageMin,
    damageMax: game.config.enemy.necromancerDamageMax,
    isFloorBoss: true,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 1.1 + Math.random() * 1.2,
    summonCooldown: 0,
    castCooldown: 0,
    teleportCooldown: 1.8,
    teleportFlashTimer: 0
  };
}

export function spawnSonyaBoss(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.sonyaHpMin, game.config.enemy.sonyaHpMax);
  return {
    type: "sonya",
    tacticKey: "sonya",
    x,
    y,
    size: 30,
    speed: game.config.enemy.sonyaSpeed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: game.config.enemy.sonyaSpeed,
    hpBarTimer: 9999,
    damageMin: game.config.enemy.sonyaDamageMin,
    damageMax: game.config.enemy.sonyaDamageMax,
    isFloorBoss: true,
    bossVariant: "sonya",
    bossName: "Sonya",
    phase: "intro",
    introTimer: 2.8,
    invincible: true,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 0.7 + Math.random() * 1.2,
    castCooldown: 1.15,
    castWindup: 0,
    castPattern: "single",
    blinkCooldown: 1.8,
    blinkFlashTimer: 0,
    speechCooldown: 0
  };
}

export function spawnMinotaur(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.minotaurHpMin, game.config.enemy.minotaurHpMax);
  return {
    type: "minotaur",
    tacticKey: "minotaur",
    x,
    y,
    size: 34,
    speed: game.config.enemy.minotaurSpeed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: game.config.enemy.minotaurSpeed,
    hpBarTimer: 9999,
    damageMin: game.config.enemy.minotaurDamageMin,
    damageMax: game.config.enemy.minotaurDamageMax,
    isFloorBoss: true,
    bossName: "Minotaur",
    chargeCooldown: 0.8,
    chargeTimer: 0,
    chargeDirX: 0,
    chargeDirY: 0,
    chargeWindupTimer: 0,
    stompCooldown: 0.8,
    chargeImpactCooldown: 0
  };
}

export function spawnLeprechaunBoss(game, x, y) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.leprechaunHpMin, game.config.enemy.leprechaunHpMax);
  const pot = game.findNearestSafePoint(
    x + game.config.map.tile * (6 + Math.floor(Math.random() * 4)),
    y + game.config.map.tile * (4 + Math.floor(Math.random() * 5)),
    14
  );
  return {
    type: "leprechaun",
    x,
    y,
    size: 26,
    speed: game.config.enemy.leprechaunFleeSpeed,
    hp,
    maxHp: hp,
    baseMaxHp: hp,
    baseSpeed: game.config.enemy.leprechaunFleeSpeed,
    hpBarTimer: 9999,
    damageMin: game.config.enemy.leprechaunDamageMin,
    damageMax: game.config.enemy.leprechaunDamageMax,
    isFloorBoss: true,
    bossVariant: "leprechaun",
    phase: "intro",
    invincible: true,
    goldDropped: 0,
    goldDropCooldown: 0,
    fleeElapsed: 0,
    potX: pot.x,
    potY: pot.y,
    potSpawned: false,
    charmCooldown: 0,
    punchCooldown: 0,
    punchKnockbackCooldown: 0,
    punchWindup: 0,
    punchApplied: false,
    dirX: 1,
    dirY: 0,
    speechCooldown: 0
  };
}

export function spawnSkeleton(game, x, y, options = {}) {
  const hp = game.rollScaledEnemyHealth(game.config.enemy.skeletonHpMin, game.config.enemy.skeletonHpMax);
  return {
    type: "skeleton",
    tacticKey: "skeleton",
    x,
    y,
    size: 18,
    speed: game.config.enemy.skeletonSpeed,
    hp,
    maxHp: hp,
    hpBarTimer: 0,
    damageMin: game.config.enemy.skeletonDamageMin,
    damageMax: game.config.enemy.skeletonDamageMax,
    summonedByNecromancer: !!options.summonedByNecromancer,
    summonerBoss: !!options.summonerBoss,
    summonLife: Number.isFinite(options.summonLife) ? options.summonLife : null
  };
}
