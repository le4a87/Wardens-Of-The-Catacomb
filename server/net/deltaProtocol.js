function shallowCloneEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  return { ...entry };
}

function pickChangedFields(prev, next) {
  const patch = {};
  let changed = false;
  for (const key of Object.keys(next)) {
    if (key === "id") continue;
    if (prev[key] !== next[key]) {
      patch[key] = next[key];
      changed = true;
    }
  }
  if (!changed) return null;
  return patch;
}

export function buildDeltaCollection(previousMap, currentList, keyframe = false) {
  const nextMap = new Map();
  const list = Array.isArray(currentList) ? currentList : [];
  const spawn = [];
  const update = [];
  const despawn = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") continue;
    const clone = shallowCloneEntry(item);
    nextMap.set(clone.id, clone);
  }

  if (keyframe) {
    const delta = {};
    if (nextMap.size > 0) {
      delta.spawn = Array.from(nextMap.values()).map((item) => shallowCloneEntry(item));
    }
    previousMap.clear();
    for (const [id, item] of nextMap.entries()) previousMap.set(id, shallowCloneEntry(item));
    return delta;
  }

  for (const [id, next] of nextMap.entries()) {
    const prev = previousMap.get(id);
    if (!prev) {
      spawn.push(shallowCloneEntry(next));
      continue;
    }
    const patch = pickChangedFields(prev, next);
    if (patch) update.push({ id, ...patch });
  }

  for (const id of previousMap.keys()) {
    if (!nextMap.has(id)) despawn.push(id);
  }

  previousMap.clear();
  for (const [id, item] of nextMap.entries()) previousMap.set(id, shallowCloneEntry(item));
  if (spawn.length === 0 && update.length === 0 && despawn.length === 0) return null;
  const delta = {};
  if (spawn.length > 0) delta.spawn = spawn;
  if (update.length > 0) delta.update = update;
  if (despawn.length > 0) delta.despawn = despawn;
  return delta;
}

export function buildJoinKeyframeState(fullState) {
  const toKeyframeCollection = (list) => ({
    ...(Array.isArray(list) && list.length > 0 ? { spawn: list.map((entry) => ({ ...entry })) } : {})
  });
  return {
    mapSignature: fullState.mapSignature,
    time: fullState.time,
    floor: fullState.floor,
    floorBoss: fullState.floorBoss ? { ...fullState.floorBoss } : null,
    player: fullState.player,
    door: fullState.door,
    pickup: fullState.pickup,
    portal: fullState.portal,
    delta: {
      keyframe: true,
      enemies: toKeyframeCollection(fullState.enemies),
      drops: toKeyframeCollection(fullState.drops),
      breakables: toKeyframeCollection(fullState.breakables),
      bullets: toKeyframeCollection(fullState.bullets),
      fireArrows: toKeyframeCollection(fullState.fireArrows),
      fireZones: toKeyframeCollection(fullState.fireZones),
      meleeSwings: toKeyframeCollection(fullState.meleeSwings),
      floatingTexts: toKeyframeCollection(fullState.floatingTexts)
    }
  };
}
