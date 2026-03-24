export function createSkillState() {
  return {
    fireArrow: { key: "fireArrow", label: "Fire Arrow", points: 0, maxPoints: 8 },
    piercingStrike: { key: "piercingStrike", label: "Piercing Strike", points: 0, maxPoints: 8 },
    multiarrow: { key: "multiarrow", label: "Multiarrow", points: 0, maxPoints: 8 },
    warriorMomentum: { key: "warriorMomentum", label: "Frenzy", points: 0, maxPoints: 8 },
    warriorRage: { key: "warriorRage", label: "Rage", points: 0, maxPoints: 8 },
    warriorExecute: { key: "warriorExecute", label: "Execute", points: 0, maxPoints: 8 },
    undeadMastery: { key: "undeadMastery", label: "Control Mastery", points: 0, maxPoints: 4 },
    deathBolt: { key: "deathBolt", label: "Death Bolt", points: 0, maxPoints: 8 },
    explodingDeath: { key: "explodingDeath", label: "Augment Death", points: 0, maxPoints: 8 }
  };
}

export function createRunStats() {
  return {
    totalKills: 0,
    bossKills: 0,
    floorsCleared: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingReceived: 0,
    goldEarned: 0,
    goldSpent: 0,
    killsByEnemyType: {},
    killsByFloor: {},
    classSpecific: {
      ranger: {
        shotsFired: 0,
        fireArrowKills: 0
      },
      warrior: {
        executeKills: 0,
        frenzies: 0
      },
      necromancer: {
        undeadCharmed: 0,
        undeadHealing: 0
      }
    }
  };
}

export function createUpgradeState() {
  return {
    moveSpeed: { key: "moveSpeed", label: "Move Speed", baseCost: 80, costScale: 1.28, level: 0, maxLevel: 20 },
    attackSpeed: { key: "attackSpeed", label: "Attack Speed", baseCost: 120, costScale: 1.32, level: 0, maxLevel: 20 },
    damage: { key: "damage", label: "Damage", baseCost: 110, costScale: 1.3, level: 0, maxLevel: 20 },
    defense: { key: "defense", label: "Defense", baseCost: 95, costScale: 1.29, level: 0, maxLevel: 16 }
  };
}

export function createNecromancerBeamState() {
  return {
    active: false,
    targetId: null,
    targetX: 0,
    targetY: 0,
    progress: 0,
    healTickTimer: 0
  };
}

export function createPlayerState(classType, classSpec, fallbackMaxHealth) {
  const baseMaxHealth = Number.isFinite(classSpec.baseMaxHealth) ? classSpec.baseMaxHealth : fallbackMaxHealth;
  return {
    x: 0,
    y: 0,
    size: 22,
    speed: classSpec.baseMoveSpeed,
    health: baseMaxHealth,
    maxHealth: baseMaxHealth,
    fireCooldown: 0,
    fireArrowCooldown: 0,
    deathBoltCooldown: 0,
    dirX: 1,
    dirY: 0,
    facing: 0,
    moving: false,
    animTime: 0,
    hitCooldown: 0,
    hpBarTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    knockbackTimer: 0,
    classType
  };
}
