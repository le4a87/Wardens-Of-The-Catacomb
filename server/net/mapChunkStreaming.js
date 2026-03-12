export function getTileChar(map, x, y) {
  if (!map || y < 0 || y >= map.length || x < 0) return "#";
  const row = map[y];
  if (typeof row === "string") return row[x] || "#";
  if (Array.isArray(row)) return row[x] || "#";
  return "#";
}

export function buildMapChunkRows(sim, cx, cy, chunkSize) {
  if (!sim || !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(chunkSize)) return null;
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const startX = cx * safeChunkSize;
  const startY = cy * safeChunkSize;
  if (startX >= sim.mapWidth || startY >= sim.mapHeight) return null;
  const chunkH = Math.max(0, Math.min(safeChunkSize, sim.mapHeight - startY));
  const rows = [];
  for (let row = 0; row < chunkH; row++) {
    const y = startY + row;
    let s = "";
    const chunkW = Math.max(0, Math.min(safeChunkSize, sim.mapWidth - startX));
    for (let col = 0; col < chunkW; col++) {
      s += getTileChar(sim.map, startX + col, y);
    }
    rows.push(s);
  }
  return { rows, startX, startY };
}
