export function installDebugRuntime({ getCurrentGame, getMusicDebugState, getNetworkDebugState }) {
  if (typeof window === "undefined") return;
  window.__WOTC_DEBUG__ = {
    getState() {
      const game = typeof getCurrentGame === "function" ? getCurrentGame() : null;
      if (!game) return null;
      const tileSize = game.config?.map?.tile || 32;
      const playerX = Number.isFinite(game.player?.x) ? game.player.x : 0;
      const playerY = Number.isFinite(game.player?.y) ? game.player.y : 0;
      const tileX = Math.floor(playerX / tileSize);
      const tileY = Math.floor(playerY / tileSize);
      const tile =
        Array.isArray(game.map) && tileY >= 0 && tileX >= 0 && tileY < game.map.length && tileX < game.map[0].length
          ? (typeof game.map[tileY] === "string" ? game.map[tileY][tileX] : game.map[tileY][tileX])
          : null;
      const radius = Math.max(4, (game.player?.size || 20) * 0.5);
      const walkable =
        typeof game.isPositionWalkable === "function"
          ? game.isPositionWalkable(playerX, playerY, radius, true)
          : null;
      const camera = typeof game.getCamera === "function" ? game.getCamera() : { x: 0, y: 0 };
      const hostiles = Array.isArray(game.enemies)
        ? game.enemies
            .filter((enemy) => enemy && (!game.isEnemyFriendlyToPlayer || !game.isEnemyFriendlyToPlayer(enemy)) && (enemy.hp || 0) > 0)
            .map((enemy) => ({
              id: enemy.id || null,
              type: enemy.type || "",
              x: enemy.x,
              y: enemy.y,
              hp: enemy.hp,
              maxHp: enemy.maxHp,
              size: enemy.size || 0,
              distToPlayer: Math.hypot((enemy.x || 0) - playerX, (enemy.y || 0) - playerY),
              screenX: (enemy.x || 0) - camera.x,
              screenY: (enemy.y || 0) - camera.y
            }))
            .sort((a, b) => a.distToPlayer - b.distToPlayer)
            .slice(0, 12)
        : [];
      return {
        networkReady: !!game.networkReady,
        networkHasMap: !!game.networkHasMap,
        networkHasChunks: !!game.networkHasChunks,
        networkRole: game.networkRole || "",
        floor: game.floor,
        player: {
          x: playerX,
          y: playerY,
          size: game.player?.size || 0,
          health: game.player?.health || 0,
          classType: game.player?.classType || game.classType || "",
          dirX: game.player?.dirX || 0,
          dirY: game.player?.dirY || 0,
          fireCooldown: game.player?.fireCooldown || 0,
          fireArrowCooldown: game.player?.fireArrowCooldown || 0
        },
        aim: {
          x: Number.isFinite(game.input?.mouse?.worldX) ? game.input.mouse.worldX : null,
          y: Number.isFinite(game.input?.mouse?.worldY) ? game.input.mouse.worldY : null,
          hasAim: !!game.input?.mouse?.hasAim
        },
        camera,
        tile: {
          x: tileX,
          y: tileY,
          value: tile
        },
        walkable,
        hostiles,
        combat: {
          meleeSwingCount: Array.isArray(game.meleeSwings) ? game.meleeSwings.length : 0,
          bulletCount: Array.isArray(game.bullets) ? game.bullets.length : 0,
          fireArrowCount: Array.isArray(game.fireArrows) ? game.fireArrows.length : 0,
          floatingTextCount: Array.isArray(game.floatingTexts) ? game.floatingTexts.length : 0,
          recentFloatingTexts: Array.isArray(game.floatingTexts)
            ? game.floatingTexts.slice(-6).map((entry) => ({
                text: entry.text,
                color: entry.color,
                x: entry.x,
                y: entry.y,
                life: entry.life
              }))
            : [],
          ownedProjectiles: [
            ...((Array.isArray(game.bullets) ? game.bullets : [])
              .filter((projectile) => {
                const netState = typeof getNetworkDebugState === "function" ? getNetworkDebugState() : null;
                return !netState?.playerId || projectile.ownerId === netState.playerId;
              })
              .slice(-8)
              .map((projectile) => ({
                source: "authoritative",
                kind: "bullet",
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx || 0,
                vy: projectile.vy || 0,
                angle: projectile.angle,
                spawnSeq: projectile.spawnSeq || 0,
                projectileType: projectile.projectileType || "bullet"
              }))),
            ...((game.networkPredictedProjectiles instanceof Map
              ? Array.from(game.networkPredictedProjectiles.values()).flat()
              : [])
              .filter((projectile) => projectile && projectile.type === "bullet")
              .slice(-8)
              .map((projectile) => ({
                source: "predicted",
                kind: projectile.type,
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx || 0,
                vy: projectile.vy || 0,
                angle: projectile.angle,
                spawnSeq: projectile.seq || 0,
                projectileType: projectile.type || "bullet",
                createdAt: projectile.createdAt || 0
              })))
          ],
          recentPlayerShots: Array.isArray(game.recentPlayerShots)
            ? game.recentPlayerShots.slice(-8).map((shot) => ({
                atMs: shot.atMs,
                source: shot.source || "",
                moving: !!shot.moving,
                playerX: shot.playerX,
                playerY: shot.playerY,
                aimX: shot.aimX,
                aimY: shot.aimY,
                intendedAngle: shot.intendedAngle,
                volleyAngles: Array.isArray(shot.volleyAngles) ? shot.volleyAngles.slice() : [],
                multishotCount: shot.multishotCount || 0,
                projectileSpeed: shot.projectileSpeed || 0,
                fireCooldown: shot.fireCooldown || 0,
                seq: shot.seq || 0
              }))
            : []
        },
        net: typeof getNetworkDebugState === "function" ? getNetworkDebugState() : null,
        networkPerf: game.networkPerf && typeof game.networkPerf === "object"
          ? {
              appliedSnapshotCount: game.networkPerf.appliedSnapshotCount || 0,
              lastCorrectionPx: game.networkPerf.lastCorrectionPx || 0,
              maxCorrectionPx: game.networkPerf.maxCorrectionPx || 0,
              hardSnapCount: game.networkPerf.hardSnapCount || 0,
              softCorrectionCount: game.networkPerf.softCorrectionCount || 0,
              settleCorrectionCount: game.networkPerf.settleCorrectionCount || 0,
              blockedSnapCount: game.networkPerf.blockedSnapCount || 0
            }
          : null,
        ui: {
          shopOpen: !!game.shopOpen,
          skillTreeOpen: !!game.skillTreeOpen,
          statsPanelOpen: !!game.statsPanelOpen,
          gold: Number.isFinite(game.gold) ? game.gold : 0,
          skillPoints: Number.isFinite(game.skillPoints) ? game.skillPoints : 0,
          shopButton: game.uiRects?.shopButton || null,
          skillTreeButton: game.uiRects?.skillTreeButton || null,
          shopClose: game.uiRects?.shopClose || null,
          skillTreeClose: game.uiRects?.skillTreeClose || null,
          shopItems: Array.isArray(game.uiRects?.shopItems)
            ? game.uiRects.shopItems.slice(0, 4).map((entry) => ({
                key: entry.key,
                rect: entry.rect
              }))
            : [],
          shopStock: Array.isArray(game.shopStock)
            ? game.shopStock.slice(0, 5).map((entry) => ({
                key: entry?.key || "",
                stock: Number.isFinite(entry?.stock) ? entry.stock : 0
              }))
            : [],
          consumables: {
            activeSlots: Array.isArray(game.consumables?.activeSlots)
              ? game.consumables.activeSlots.map((slot) => ({
                  key: slot?.key || "",
                  count: Number.isFinite(slot?.count) ? slot.count : 0,
                  cooldownRemaining: Number.isFinite(slot?.cooldownRemaining) ? slot.cooldownRemaining : 0
                }))
              : [],
            passiveSlots: Array.isArray(game.consumables?.passiveSlots)
              ? game.consumables.passiveSlots.map((slot) => ({
                  key: slot?.key || "",
                  count: Number.isFinite(slot?.count) ? slot.count : 0,
                  cooldownRemaining: Number.isFinite(slot?.cooldownRemaining) ? slot.cooldownRemaining : 0
                }))
              : [],
            sharedCooldown: Number.isFinite(game.consumables?.sharedCooldown) ? game.consumables.sharedCooldown : 0
          },
          skillNodes: {
            fireArrow: game.uiRects?.skillFireArrowNode || null,
            piercingStrike: game.uiRects?.skillPiercingNode || null,
            multiarrow: game.uiRects?.skillMultiarrowNode || null,
            warriorMomentum: game.uiRects?.skillWarriorMomentumNode || null,
            warriorRage: game.uiRects?.skillWarriorRageNode || null,
            warriorExecute: game.uiRects?.skillWarriorExecuteNode || null,
            undeadMastery: game.uiRects?.skillUndeadMasteryNode || null,
            deathBolt: game.uiRects?.skillDeathBoltNode || null,
            explodingDeath: game.uiRects?.skillExplodingDeathNode || null
          },
          recentUiClicks: Array.isArray(game.input?.mouse?.recentUiLeftClicks)
            ? game.input.mouse.recentUiLeftClicks.slice(-8)
            : [],
          networkUiDebug: game.networkUiDebug && typeof game.networkUiDebug === "object"
            ? {
                lastClick: game.networkUiDebug.lastClick || null,
                lastHit: game.networkUiDebug.lastHit || "",
                lastActionKind: game.networkUiDebug.lastActionKind || "",
                recentActions: Array.isArray(game.networkUiDebug.recentActions)
                  ? game.networkUiDebug.recentActions.slice(-8)
                  : []
              }
            : null
        },
        audio: typeof getMusicDebugState === "function" ? getMusicDebugState() : null,
        documentHasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
        documentVisibilityState: typeof document.visibilityState === "string" ? document.visibilityState : ""
      };
    }
  };
}
