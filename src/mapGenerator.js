import { vecLength } from "./utils.js";

export function createCastleMap(width, height) {
  const grid = Array.from({ length: height }, () => Array(width).fill("#"));
  const rooms = [];
  const cellWidth = 18;
  const cellHeight = 14;
  const cols = Math.max(2, Math.floor((width - 4) / cellWidth));
  const rows = Math.max(2, Math.floor((height - 4) / cellHeight));

  function carveRect(x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (yy > 1 && yy < height - 2 && xx > 1 && xx < width - 2) {
          grid[yy][xx] = ".";
        }
      }
    }
  }

  function carveHallTile(cx, cy, hallWidth) {
    const half = Math.floor(hallWidth / 2);
    for (let yy = cy - half; yy <= cy + half; yy++) {
      for (let xx = cx - half; xx <= cx + half; xx++) {
        if (yy > 1 && yy < height - 2 && xx > 1 && xx < width - 2) {
          grid[yy][xx] = ".";
        }
      }
    }
  }

  function carveCorridor(x1, y1, x2, y2, hallWidth) {
    let cx = x1;
    let cy = y1;
    const turnAtXFirst = Math.random() < 0.5;
    carveHallTile(cx, cy, hallWidth);
    if (turnAtXFirst) {
      while (cx !== x2) {
        cx += x2 > cx ? 1 : -1;
        carveHallTile(cx, cy, hallWidth);
      }
      while (cy !== y2) {
        cy += y2 > cy ? 1 : -1;
        carveHallTile(cx, cy, hallWidth);
      }
    } else {
      while (cy !== y2) {
        cy += y2 > cy ? 1 : -1;
        carveHallTile(cx, cy, hallWidth);
      }
      while (cx !== x2) {
        cx += x2 > cx ? 1 : -1;
        carveHallTile(cx, cy, hallWidth);
      }
    }
  }

  const roomGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const baseX = 2 + gx * cellWidth;
      const baseY = 2 + gy * cellHeight;
      const areaW = Math.min(cellWidth, width - baseX - 2);
      const areaH = Math.min(cellHeight, height - baseY - 2);
      if (areaW < 8 || areaH < 8) continue;

      const roomW = 6 + Math.floor(Math.random() * Math.max(1, areaW - 7));
      const roomH = 6 + Math.floor(Math.random() * Math.max(1, areaH - 7));
      const offsetX = 1 + Math.floor(Math.random() * Math.max(1, areaW - roomW - 1));
      const offsetY = 1 + Math.floor(Math.random() * Math.max(1, areaH - roomH - 1));

      const room = {
        x: baseX + offsetX,
        y: baseY + offsetY,
        w: roomW,
        h: roomH,
        cx: baseX + offsetX + Math.floor(roomW / 2),
        cy: baseY + offsetY + Math.floor(roomH / 2),
        gx,
        gy
      };
      carveRect(room.x, room.y, room.w, room.h);
      rooms.push(room);
      roomGrid[gy][gx] = room;
    }
  }

  if (rooms.length === 0) {
    const fallback = { x: 6, y: 6, w: 12, h: 10, cx: 12, cy: 11, gx: 0, gy: 0 };
    carveRect(fallback.x, fallback.y, fallback.w, fallback.h);
    rooms.push(fallback);
  }

  for (const room of rooms) {
    const right = roomGrid[room.gy]?.[room.gx + 1];
    const down = roomGrid[room.gy + 1]?.[room.gx];
    if (right && Math.random() < 0.95) carveCorridor(room.cx, room.cy, right.cx, right.cy, 2);
    if (down && Math.random() < 0.95) carveCorridor(room.cx, room.cy, down.cx, down.cy, 2);
  }

  for (let i = 0; i < rooms.length * 0.35; i++) {
    const a = rooms[Math.floor(Math.random() * rooms.length)];
    const b = rooms[Math.floor(Math.random() * rooms.length)];
    if (a && b && a !== b) carveCorridor(a.cx, a.cy, b.cx, b.cy, 1);
  }

  const floors = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] === ".") floors.push({ x, y });
    }
  }

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  let playerTile = floors[0];
  let closest = Number.POSITIVE_INFINITY;
  const roomSpawnCandidates = rooms
    .map((room) => ({ x: room.cx, y: room.cy }))
    .filter((tile) => tile.y >= 0 && tile.x >= 0 && tile.y < height && tile.x < width && grid[tile.y][tile.x] === ".");
  const playerCandidates = roomSpawnCandidates.length > 0 ? roomSpawnCandidates : floors;
  for (const tile of playerCandidates) {
    const d = vecLength(tile.x - center.x, tile.y - center.y);
    if (d < closest) {
      closest = d;
      playerTile = tile;
    }
  }

  let doorTile = floors[0];
  let farthest = -1;
  for (const tile of floors) {
    const d = vecLength(tile.x - playerTile.x, tile.y - playerTile.y);
    if (d > farthest) {
      farthest = d;
      doorTile = tile;
    }
  }

  const diag = vecLength(width, height);
  const edgePadding = Math.max(6, Math.floor(Math.min(width, height) * 0.08));
  let keyCandidates = floors.filter((tile) => {
    const borderDist = Math.min(tile.x, tile.y, width - 1 - tile.x, height - 1 - tile.y);
    if (borderDist < edgePadding) return false;
    const dPlayer = vecLength(tile.x - playerTile.x, tile.y - playerTile.y);
    const dDoor = vecLength(tile.x - doorTile.x, tile.y - doorTile.y);
    return dPlayer > diag * 0.16 && dDoor > diag * 0.10;
  });
  if (keyCandidates.length === 0) {
    keyCandidates = floors.filter((tile) => {
      const dPlayer = vecLength(tile.x - playerTile.x, tile.y - playerTile.y);
      return dPlayer > diag * 0.12;
    });
  }
  if (keyCandidates.length === 0) keyCandidates = floors;
  const keyTile = keyCandidates[Math.floor(Math.random() * keyCandidates.length)];

  grid[playerTile.y][playerTile.x] = "P";
  grid[doorTile.y][doorTile.x] = "D";
  grid[keyTile.y][keyTile.x] = "K";

  return grid.map((row) => row.join(""));
}
