export function serializeTreasureChest(getStableId, room, chest) {
  return {
    id: getStableId(room, "treasureChest", "tc", chest),
    type: "treasure_chest",
    x: chest.x,
    y: chest.y,
    size: chest.size,
    opened: !!chest.opened,
    discovered: !!chest.discovered
  };
}
