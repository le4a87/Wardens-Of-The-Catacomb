function applyDeltaToEntityMap(entityMap, delta, keyframe = false) {
  if (!(entityMap instanceof Map)) return;
  if (!delta || typeof delta !== "object") return;
  if (keyframe) entityMap.clear();
  const spawnList = Array.isArray(delta.spawn) ? delta.spawn : [];
  const updateList = Array.isArray(delta.update) ? delta.update : [];
  const despawnList = Array.isArray(delta.despawn) ? delta.despawn : [];

  for (const item of spawnList) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") continue;
    entityMap.set(item.id, { ...item });
  }
  for (const patch of updateList) {
    if (!patch || typeof patch !== "object" || typeof patch.id !== "string") continue;
    const prev = entityMap.get(patch.id) || { id: patch.id };
    entityMap.set(patch.id, { ...prev, ...patch });
  }
  for (const id of despawnList) {
    if (typeof id === "string") entityMap.delete(id);
  }
}

export function updateProjectileStateFromSnapshot(state, projectileState) {
  if (!state || typeof state !== "object" || !projectileState) return;
  if (state.delta && typeof state.delta === "object") {
    const keyframe = !!state.delta.keyframe;
    applyDeltaToEntityMap(projectileState.bullets, state.delta.bullets, keyframe);
    applyDeltaToEntityMap(projectileState.fireArrows, state.delta.fireArrows, keyframe);
    return;
  }
  projectileState.bullets.clear();
  projectileState.fireArrows.clear();
  const bullets = Array.isArray(state.bullets) ? state.bullets : [];
  const fireArrows = Array.isArray(state.fireArrows) ? state.fireArrows : [];
  for (const p of bullets) {
    if (p && typeof p === "object" && typeof p.id === "string") projectileState.bullets.set(p.id, { ...p });
  }
  for (const p of fireArrows) {
    if (p && typeof p === "object" && typeof p.id === "string") projectileState.fireArrows.set(p.id, { ...p });
  }
}
