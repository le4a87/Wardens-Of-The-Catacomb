import { clamp } from "../utils.js";

export const runtimeBasePlacementMethods = {
  findNearestSafePoint(x, y, maxRadiusTiles = 8) {
    const tile = this.config.map.tile;
    const tx = Math.floor(x / tile);
    const ty = Math.floor(y / tile);
    const radius = Math.max(4, (this.player?.size || tile * 0.6) * 0.5);
    const isSafe = (cx, cy) => {
      const px = cx * tile + tile * 0.5;
      const py = cy * tile + tile * 0.5;
      if (typeof this.isPositionWalkable === "function") return this.isPositionWalkable(px, py, radius);
      if (typeof this.isWalkableTile === "function" && !this.isWalkableTile(cx, cy)) return false;
      if (typeof this.isWallAt === "function") {
        return !this.isWallAt(px - radius, py - radius, true) && !this.isWallAt(px + radius, py - radius, true) &&
          !this.isWallAt(px - radius, py + radius, true) && !this.isWallAt(px + radius, py + radius, true);
      }
      return true;
    };
    if (isSafe(tx, ty)) return { x: tx * tile + tile * 0.5, y: ty * tile + tile * 0.5 };
    for (let radiusTiles = 1; radiusTiles <= maxRadiusTiles; radiusTiles++) {
      for (let oy = -radiusTiles; oy <= radiusTiles; oy++) {
        for (let ox = -radiusTiles; ox <= radiusTiles; ox++) {
          if (Math.abs(ox) !== radiusTiles && Math.abs(oy) !== radiusTiles) continue;
          const cx = tx + ox;
          const cy = ty + oy;
          if (!isSafe(cx, cy)) continue;
          return { x: cx * tile + tile * 0.5, y: cy * tile + tile * 0.5 };
        }
      }
    }
    return { x: this.player.x, y: this.player.y };
  },

  getPlayerEnemyCollisionRadius() {
    const size = Number.isFinite(this.config.player.enemyCollisionSize) ? this.config.player.enemyCollisionSize : this.player.size;
    return Math.max(0, size) * 0.5;
  },

  isPositionWalkable(x, y, radius = 0, blockBreakables = true) {
    if (typeof this.isWallAt !== "function") return true;
    const r = Math.max(0, Number.isFinite(radius) ? radius : 0);
    return (
      !this.isWallAt(x - r, y - r, blockBreakables) &&
      !this.isWallAt(x + r, y - r, blockBreakables) &&
      !this.isWallAt(x - r, y + r, blockBreakables) &&
      !this.isWallAt(x + r, y + r, blockBreakables)
    );
  },

  ensurePlayerSafePosition(maxRadiusTiles = 10) {
    const radius = Math.max(4, (this.player?.size || this.config.map.tile * 0.6) * 0.5);
    if (this.isPositionWalkable(this.player.x, this.player.y, radius, true)) return false;
    const safe = this.findNearestSafePoint(this.player.x, this.player.y, maxRadiusTiles);
    if (!safe) return false;
    this.player.x = safe.x;
    this.player.y = safe.y;
    return true;
  },

  getTrapDetectionBonus() {
    return 0;
  },

  getActiveBounds(padTiles = 8) {
    const cam = this.getCamera();
    const tile = this.config.map.tile;
    const pad = Math.max(0, padTiles) * tile;
    const playW = this.getPlayAreaWidth();
    return {
      left: cam.x - pad,
      top: cam.y - pad,
      right: cam.x + playW + pad,
      bottom: cam.y + this.canvas.height + pad
    };
  },

  isInsideBounds(x, y, radius = 0, bounds = null) {
    if (!bounds || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const r = Number.isFinite(radius) ? Math.max(0, radius) : 0;
    return x + r >= bounds.left && x - r <= bounds.right && y + r >= bounds.top && y - r <= bounds.bottom;
  },

  getPickupRadius() {
    return this.config.player.pickupRadius;
  },

  isPlayerAtDoor() {
    if (!this.door.open) return false;
    const tileHalf = this.config.map.tile / 2;
    const left = this.door.x - tileHalf;
    const right = this.door.x + tileHalf;
    const top = this.door.y - tileHalf;
    const bottom = this.door.y + tileHalf;
    const px = this.player.x;
    const py = this.player.y;
    const pr = this.player.size * 0.5;
    const closestX = clamp(px, left, right);
    const closestY = clamp(py, top, bottom);
    const dx = px - closestX;
    const dy = py - closestY;
    return dx * dx + dy * dy <= (pr + 4) * (pr + 4);
  }
};
