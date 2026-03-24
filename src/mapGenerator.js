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

function pickFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function placeProgressionTiles(grid, width, height, floorTiles, dryTiles = null) {
  const usable = Array.isArray(dryTiles) && dryTiles.length > 0 ? dryTiles : floorTiles;
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  let playerTile = usable[0] || floorTiles[0];
  let closest = Number.POSITIVE_INFINITY;
  for (const tile of usable) {
    const d = vecLength(tile.x - center.x, tile.y - center.y);
    if (d < closest) {
      closest = d;
      playerTile = tile;
    }
  }

  let doorTile = usable[0] || floorTiles[0];
  let farthest = -1;
  for (const tile of usable) {
    const d = vecLength(tile.x - playerTile.x, tile.y - playerTile.y);
    if (d > farthest) {
      farthest = d;
      doorTile = tile;
    }
  }

  const diag = vecLength(width, height);
  const edgePadding = Math.max(6, Math.floor(Math.min(width, height) * 0.08));
  let keyCandidates = usable.filter((tile) => {
    const borderDist = Math.min(tile.x, tile.y, width - 1 - tile.x, height - 1 - tile.y);
    if (borderDist < edgePadding) return false;
    const dPlayer = vecLength(tile.x - playerTile.x, tile.y - playerTile.y);
    const dDoor = vecLength(tile.x - doorTile.x, tile.y - doorTile.y);
    return dPlayer > diag * 0.16 && dDoor > diag * 0.10;
  });
  if (keyCandidates.length === 0) {
    keyCandidates = usable.filter((tile) => vecLength(tile.x - playerTile.x, tile.y - playerTile.y) > diag * 0.12);
  }
  if (keyCandidates.length === 0) keyCandidates = usable;
  const keyTile = pickFrom(keyCandidates.length ? keyCandidates : floorTiles);

  grid[playerTile.y][playerTile.x] = "P";
  grid[doorTile.y][doorTile.x] = "D";
  grid[keyTile.y][keyTile.x] = "K";
}

export function createSewerMap(width, height) {
  const grid = Array.from({ length: height }, () => Array(width).fill("#"));
  const hallCenters = [
    Math.max(8, Math.floor(height * 0.22)),
    Math.floor(height * 0.5),
    Math.min(height - 9, Math.floor(height * 0.78))
  ];
  const hallHalfWidth = 2;
  const marginX = 3;

  function setTile(x, y, char) {
    if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) return;
    grid[y][x] = char;
  }

  function carveRect(x, y, w, h, char = ".") {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) setTile(xx, yy, char);
    }
  }

  function carveCorridor(x1, y1, x2, y2, widthTiles = 1, char = ".") {
    const half = Math.floor(widthTiles / 2);
    let cx = x1;
    let cy = y1;
    const draw = () => {
      for (let yy = cy - half; yy <= cy + half; yy++) {
        for (let xx = cx - half; xx <= cx + half; xx++) setTile(xx, yy, char);
      }
    };
    draw();
    while (cx !== x2) {
      cx += x2 > cx ? 1 : -1;
      draw();
    }
    while (cy !== y2) {
      cy += y2 > cy ? 1 : -1;
      draw();
    }
  }

  for (const centerY of hallCenters) {
    for (let y = centerY - hallHalfWidth; y <= centerY + hallHalfWidth; y++) {
      for (let x = marginX; x < width - marginX; x++) setTile(x, y, "~");
    }
  }

  const xStep = Math.max(16, Math.floor(width / 6));
  for (let index = 0; index < hallCenters.length; index++) {
    const hallY = hallCenters[index];
    const aboveStart = index === 0 ? 3 : hallCenters[index - 1] + hallHalfWidth + 3;
    const aboveEnd = hallY - hallHalfWidth - 3;
    const belowStart = hallY + hallHalfWidth + 3;
    const belowEnd = index === hallCenters.length - 1 ? height - 4 : hallCenters[index + 1] - hallHalfWidth - 3;
    const bands = [];
    if (aboveEnd - aboveStart >= 6) bands.push({ start: aboveStart, end: aboveEnd });
    if (belowEnd - belowStart >= 6) bands.push({ start: belowStart, end: belowEnd });
    if (bands.length === 0) continue;

    for (let anchorX = 8 + (index % 2) * 5; anchorX < width - 14; anchorX += xStep) {
      const band = pickFrom(bands);
      const roomW = 6 + Math.floor(Math.random() * 7);
      const roomH = 5 + Math.floor(Math.random() * 5);
      const x = Math.max(3, Math.min(width - roomW - 3, anchorX + Math.floor(Math.random() * 7) - 3));
      const yRange = Math.max(1, band.end - band.start - roomH + 2);
      const y = Math.max(band.start, Math.min(band.end - roomH + 1, band.start + Math.floor(Math.random() * yRange)));
      carveRect(x, y, roomW, roomH, ".");
      const cy = y + Math.floor(roomH / 2);
      const corridorY = cy < hallY ? hallY - hallHalfWidth - 1 : hallY + hallHalfWidth + 1;
      const entryLeft = x + Math.max(1, Math.floor(roomW * 0.28));
      const entryRight = x + Math.min(roomW - 2, Math.floor(roomW * 0.72));
      carveCorridor(entryLeft, cy, entryLeft, corridorY, 2, ".");
      carveCorridor(entryRight, cy, entryRight, corridorY, 2, ".");

      if (roomW >= 7 && roomH >= 5 && Math.random() < 0.7) {
        const poolW = Math.max(2, Math.min(roomW - 2, 2 + Math.floor(Math.random() * 3)));
        const poolH = Math.max(2, Math.min(roomH - 2, 2 + Math.floor(Math.random() * 2)));
        const poolX = x + 1 + Math.floor(Math.random() * Math.max(1, roomW - poolW - 1));
        const poolY = y + 1 + Math.floor(Math.random() * Math.max(1, roomH - poolH - 1));
        carveRect(poolX, poolY, poolW, poolH, "o");
      }
    }
  }

  for (let i = 0; i < hallCenters.length - 1; i++) {
    const upper = hallCenters[i];
    const lower = hallCenters[i + 1];
    const connectorCount = 2 + Math.floor(Math.random() * 2);
    for (let c = 0; c < connectorCount; c++) {
      const x = 8 + Math.floor(Math.random() * Math.max(1, width - 16));
      carveCorridor(x, upper + hallHalfWidth + 1, x, lower - hallHalfWidth - 1, 2, ".");
    }
  }

  const allFloorTiles = [];
  const dryTiles = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tile = grid[y][x];
      if (tile === "#") continue;
      allFloorTiles.push({ x, y });
      if (tile !== "~" && tile !== "o") dryTiles.push({ x, y });
    }
  }

  for (const tile of dryTiles) {
    if (grid[tile.y][tile.x] !== ".") continue;
    const roll = Math.random();
    if (roll < 0.055) grid[tile.y][tile.x] = "g";
    else if (roll < 0.095) grid[tile.y][tile.x] = "r";
  }

  placeProgressionTiles(grid, width, height, allFloorTiles, dryTiles);
  return grid.map((row) => row.join(""));
}
