import { getWarriorClassSkillColor, getWarriorClassSkillCooldown, getWarriorClassSkillName } from "../../game/warriorTalentTree.js";

export function getHudAbilityState(game) {
  if (game.isWarriorClass && game.isWarriorClass()) {
    const title = getWarriorClassSkillName(game);
    const color = getWarriorClassSkillColor(game);
    const cooldownMax = Math.max(0.01, getWarriorClassSkillCooldown(game));
    const cooldownRemaining = Math.max(0, game.warriorRageCooldownTimer || 0);
    return {
      title,
      color,
      accent: "#ffb0b0",
      cooldownRemaining,
      cooldownMax,
      progress: cooldownRemaining > 0 ? 1 - cooldownRemaining / cooldownMax : 1,
      hoverText: cooldownRemaining > 0 ? `${title} cooldown: ${cooldownRemaining.toFixed(1)}s` : `${title} ready`
    };
  }
  if (game.isNecromancerClass && game.isNecromancerClass()) {
    const unlocked = (game.skills?.deathBolt?.points || 0) > 0;
    const cooldownMax = Math.max(0.01, game.config.deathBolt?.cooldown || 10);
    const cooldownRemaining = Math.max(0, game.player.deathBoltCooldown || 0);
    return {
      title: "Death Bolt",
      color: "#f3f4f7",
      accent: "#ffffff",
      cooldownRemaining,
      cooldownMax,
      progress: unlocked ? (cooldownRemaining > 0 ? 1 - cooldownRemaining / cooldownMax : 1) : 0,
      hoverText: !unlocked ? "Death Bolt locked" : cooldownRemaining > 0 ? `Death Bolt cooldown: ${cooldownRemaining.toFixed(1)}s` : "Death Bolt ready"
    };
  }
  const unlocked = game.isFireArrowUnlocked();
  const cooldownMax = Math.max(0.01, game.config.fireArrow.cooldown);
  const cooldownRemaining = Math.max(0, game.player.fireArrowCooldown || 0);
  return {
    title: "Fire Arrow",
    color: "#59b85a",
    accent: "#d7ffd0",
    cooldownRemaining,
    cooldownMax,
    progress: unlocked ? (cooldownRemaining > 0 ? 1 - cooldownRemaining / cooldownMax : 1) : 0,
    hoverText: !unlocked ? "Fire Arrow locked" : cooldownRemaining > 0 ? `Fire Arrow cooldown: ${cooldownRemaining.toFixed(1)}s` : "Fire Arrow ready"
  };
}
