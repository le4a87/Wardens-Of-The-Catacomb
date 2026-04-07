export const runtimeBaseDevStartMethods = {
  estimateDebugStartingGoldForFloor(floor = this.floor) {
    const safeFloor = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    if (safeFloor <= 1) return 0;
    let totalGold = 0;
    for (let priorFloor = 1; priorFloor < safeFloor; priorFloor++) {
      const floorLevel = this.getMinimumLevelForFloorStart(priorFloor);
      const goldFindMultiplier =
        (1 + Math.max(0, floorLevel - 1) * 0.05) *
        (1 + Math.max(0, priorFloor - 1) * 0.08);
      const goldAmountMultiplier =
        (1 + Math.max(0, floorLevel - 1) * 0.09) *
        (1 + Math.max(0, priorFloor - 1) * 0.12);
      const goldDropRate = Math.min(
        0.7,
        0.10 + Math.max(0, floorLevel - 1) * 0.008 + Math.max(0, priorFloor - 1) * 0.012
      );
      const avgGoldDrop =
        ((this.config.drops.goldMin + this.config.drops.goldMax) * 0.5) *
        goldAmountMultiplier *
        goldFindMultiplier;
      const expectedKills = 18 + priorFloor * 7 + Math.round(Math.pow(Math.max(0, priorFloor - 1), 1.35) * 6);
      const bossRewardMean = priorFloor % 2 === 0
        ? ((this.config.enemy.minotaurRewardGoldMin || 110) + (this.config.enemy.minotaurRewardGoldMax || 150)) * 0.5
        : ((this.config.enemy.necromancerRewardGoldMin || 90) + (this.config.enemy.necromancerRewardGoldMax || 130)) * 0.5;
      totalGold += expectedKills * goldDropRate * avgGoldDrop;
      totalGold += bossRewardMean * goldFindMultiplier;
    }
    return Math.max(0, Math.round(totalGold));
  }
};
