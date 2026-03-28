import { FLOOR_BOSS_OVERRIDE_AUTO, normalizeFloorBossOverride } from "../../src/game/floorBossDebugOverride.js";
import {
  NETWORK_DEATH_RULES_FRIENDLY,
  NETWORK_DEATH_RULES_SURVIVAL,
  normalizeNetworkDeathRulesMode
} from "../../src/net/networkDeathRules.js";

const FRIENDLY_REVIVE_HEALTH_PCT = 0.3;

export function installRoomDevBossOverride(room) {
  if (!room || room.__devBossOverrideInstalled) return room;
  room.__devBossOverrideInstalled = true;
  room.requestedBossOverride = FLOOR_BOSS_OVERRIDE_AUTO;
  room.requestedDeathRulesMode = NETWORK_DEATH_RULES_SURVIVAL;

  const baseCreateFreshSim = typeof room.createFreshSim === "function" ? room.createFreshSim : null;
  const baseStartRun = typeof room.startRun === "function" ? room.startRun : null;
  const baseTick = typeof room.tick === "function" ? room.tick : null;

  function reviveFriendlyAlliesAfterFloorChange() {
    if (room.requestedDeathRulesMode !== NETWORK_DEATH_RULES_FRIENDLY) return;
    if (!room.pauseOwnerId || !room.sim || room.sim.gameOver) return;
    const anchor = room.syncPrimaryActivePlayerFromSim();
    if (!anchor || (anchor.health || 0) <= 0) return;
    const tile = room.sim.config?.map?.tile || 32;
    let revivedIndex = 0;
    for (const client of room.clients.values()) {
      if (!client || client.id === room.pauseOwnerId) continue;
      const state = room.activePlayers.get(client.id);
      if (!state || (state.alive !== false && (state.health || 0) > 0)) continue;
      const ring = 1 + Math.floor(revivedIndex / 4);
      const angle = (revivedIndex / Math.max(1, room.clients.size - 1)) * Math.PI * 2;
      const spawn = typeof room.sim.findNearestSafePoint === "function"
        ? room.sim.findNearestSafePoint(
          anchor.x + Math.cos(angle) * ring * tile * 1.1,
          anchor.y + Math.sin(angle) * ring * tile * 1.1,
          10
        )
        : { x: anchor.x, y: anchor.y };
      state.x = Number.isFinite(spawn?.x) ? spawn.x : anchor.x;
      state.y = Number.isFinite(spawn?.y) ? spawn.y : anchor.y;
      state.health = Math.max(1, Math.ceil((Number.isFinite(state.maxHealth) ? state.maxHealth : 1) * FRIENDLY_REVIVE_HEALTH_PCT));
      state.fireCooldown = 0;
      state.fireArrowCooldown = 0;
      state.deathBoltCooldown = 0;
      state.hitCooldown = 0;
      state.hpBarTimer = 0;
      state.moving = false;
      state.alive = true;
      revivedIndex += 1;
    }
  }

  room.createFreshSim = function createFreshSimWithBossOverride(...args) {
    const sim = baseCreateFreshSim ? baseCreateFreshSim.apply(this, args) : null;
    if (sim && typeof sim.applyDebugBossOverride === "function") {
      sim.applyDebugBossOverride(this.requestedBossOverride);
    }
    return sim;
  };

  room.startRun = function startRunWithBossOverride(nowMs = Date.now()) {
    if (this.sim && typeof this.sim.applyDebugBossOverride === "function") {
      this.sim.applyDebugBossOverride(this.requestedBossOverride);
    }
    return baseStartRun ? baseStartRun.call(this, nowMs) : false;
  };

  room.tick = function tickWithFriendlyRules(nowMs, scheduleDriftMs = 0) {
    const previousFloor = Number.isFinite(this.sim?.floor) ? this.sim.floor : null;
    const result = baseTick ? baseTick.call(this, nowMs, scheduleDriftMs) : undefined;
    const nextFloor = Number.isFinite(this.sim?.floor) ? this.sim.floor : null;
    if (previousFloor !== null && nextFloor !== null && nextFloor > previousFloor) {
      reviveFriendlyAlliesAfterFloorChange();
    }
    return result;
  };

  room.updateRequestedBossOverride = function updateRequestedBossOverride(clientId, override = FLOOR_BOSS_OVERRIDE_AUTO) {
    if (this.phase !== "lobby") return false;
    if (clientId !== this.roomOwnerId) return false;
    const nextOverride = normalizeFloorBossOverride(override);
    if (nextOverride === this.requestedBossOverride) return false;
    this.requestedBossOverride = nextOverride;
    this.cancelLobbyCountdown("Boss override changed. Countdown restarted.");
    this.refreshLobbyState(Date.now(), "Boss override changed. Countdown restarted.");
    return true;
  };

  room.updateRequestedDeathRulesMode = function updateRequestedDeathRulesMode(clientId, mode = NETWORK_DEATH_RULES_SURVIVAL) {
    if (this.phase !== "lobby") return false;
    if (clientId !== this.roomOwnerId) return false;
    const nextMode = normalizeNetworkDeathRulesMode(mode);
    if (nextMode === this.requestedDeathRulesMode) return false;
    this.requestedDeathRulesMode = nextMode;
    this.cancelLobbyCountdown("Game rules changed. Countdown restarted.");
    this.refreshLobbyState(Date.now(), "Game rules changed. Countdown restarted.");
    return true;
  };

  room.broadcastRoster = function broadcastRosterWithBossOverride() {
    this.broadcast("room.roster", {
      phase: this.phase,
      ownerId: this.roomOwnerId,
      pauseOwnerId: this.pauseOwnerId,
      controllerId: this.pauseOwnerId,
      requestedStartFloor: this.requestedStartFloor,
      requestedBossOverride: this.requestedBossOverride,
      requestedDeathRulesMode: this.requestedDeathRulesMode,
      lobbyCountdownEndsAt: this.lobbyCountdownEndsAt || 0,
      lobbyCountdownRemainingMs: this.getLobbyCountdownRemainingMs(),
      lobbyInlineMessage: this.lobbyInlineMessage,
      players: this.getRosterEntries()
    });
  };

  if (room.sim && typeof room.sim.applyDebugBossOverride === "function") {
    room.sim.applyDebugBossOverride(room.requestedBossOverride);
  }
  return room;
}
