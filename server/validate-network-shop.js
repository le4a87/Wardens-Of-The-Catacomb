import { AuthoritativeRoom } from "./net/AuthoritativeRoom.js";
import { handleActionMessage } from "./net/clientMessageHandler.js";
import { buildDeltaCollection } from "./net/deltaProtocol.js";
import { buildMapChunkRows } from "./net/mapChunkStreaming.js";
import { getStableId, serializeMetaState, serializeState } from "./net/stateSerialization.js";
import { average, monotonicNowMs, percentile } from "./net/telemetry.js";
import { makeDefaultInput } from "./net/serverHelpers.js";
import { chooseGameplayTrack } from "./musicCatalog.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createFakeSocket() {
  return {
    OPEN: 1,
    readyState: 1,
    bufferedAmount: 0,
    send() {}
  };
}

function makeClient(id, name, classType) {
  return {
    id,
    name,
    classType,
    protocolVersion: 2,
    ws: createFakeSocket(),
    input: makeDefaultInput(),
    lastInputSeq: 0,
    classLocked: true
  };
}

function createRoomOptions() {
  return {
    average,
    buildDeltaCollection,
    buildMapChunkRows,
    chooseGameplayTrack,
    deltaKeyframeEvery: 30,
    getStableId,
    makeDefaultInput,
    mapChunkPushMs: 120,
    mapChunkRadius: 2,
    mapChunkSize: 24,
    maxWsBufferedBytes: 262144,
    metaBroadcastMinMs: 320,
    monotonicNowMs,
    percentile,
    pushTelemetrySample() {},
    serializeMetaState,
    serializeState,
    snapshotAckGapForceKeyframe: 8,
    tickDriftEpsilonMs: 0.5
  };
}

function getActiveSlot(state, key) {
  return Array.isArray(state?.consumables?.activeSlots)
    ? state.consumables.activeSlots.find((slot) => slot?.key === key) || null
    : null;
}

function getPassiveSlot(state, key) {
  return Array.isArray(state?.consumables?.passiveSlots)
    ? state.consumables.passiveSlots.find((slot) => slot?.key === key) || null
    : null;
}

function getStock(room, key) {
  return room.sim.shopStock.find((entry) => entry?.key === key) || null;
}

function main() {
  const room = new AuthoritativeRoom("validate-network-shop", "archer", createRoomOptions());
  const owner = makeClient("owner", "Owner", "warrior");
  const peer = makeClient("peer", "Peer", "archer");
  room.addClient(owner);
  room.addClient(peer);
  room.startRun(Date.now());

  let ownerState = room.activePlayers.get(owner.id);
  const peerState = room.activePlayers.get(peer.id);
  assert(ownerState && peerState, "active player state missing after room start");

  room.sim.shopStock = [
    { key: "shield", stock: 2 },
    { key: "regenerationPotion", stock: 1 },
    { key: "angelRing", stock: 2 },
    { key: "speedPotion", stock: 1 },
    { key: "fireOil", stock: 1 }
  ];
  room.sim.gold = 3000;
  ownerState.gold = 3000;
  peerState.gold = 3000;
  room.syncSimPrimaryPlayerState();

  handleActionMessage(room, owner.id, { kind: "buyUpgrade", key: "shield" });
  ownerState = room.syncPrimaryActivePlayerFromSim();
  assert(ownerState.gold === 2997, `owner gold did not drop after shield purchase: ${ownerState.gold}`);
  assert(getActiveSlot(ownerState, "shield")?.count === 1, "owner shield did not enter active inventory");
  assert(getStock(room, "shield")?.stock === 1, `shared shield stock did not decrement after owner purchase: ${getStock(room, "shield")?.stock}`);
  assert(!getActiveSlot(peerState, "shield"), "peer incorrectly received owner shield purchase");

  handleActionMessage(room, peer.id, { kind: "buyUpgrade", key: "shield" });
  assert(peerState.gold === 2997, `peer gold did not drop after shield purchase: ${peerState.gold}`);
  assert(getActiveSlot(peerState, "shield")?.count === 1, "peer shield did not enter active inventory");
  assert(getStock(room, "shield")?.stock === 0, `shared shield stock did not reach zero after peer purchase: ${getStock(room, "shield")?.stock}`);

  handleActionMessage(room, owner.id, { kind: "buyUpgrade", key: "shield" });
  ownerState = room.syncPrimaryActivePlayerFromSim();
  assert(getActiveSlot(ownerState, "shield")?.count === 1, "owner shield count changed after out-of-stock purchase attempt");

  handleActionMessage(room, owner.id, { kind: "buyUpgrade", key: "angelRing" });
  ownerState = room.syncPrimaryActivePlayerFromSim();
  assert(getPassiveSlot(ownerState, "angelRing")?.count === 1, "owner angel ring did not enter passive inventory");
  assert(getStock(room, "angelRing")?.stock === 1, "angel ring stock did not decrement after owner purchase");

  handleActionMessage(room, peer.id, { kind: "buyUpgrade", key: "angelRing" });
  assert(getPassiveSlot(peerState, "angelRing")?.count === 1, "peer angel ring did not enter passive inventory");
  assert(getStock(room, "angelRing")?.stock === 0, "angel ring stock did not reach zero after peer purchase");

  handleActionMessage(room, owner.id, { kind: "useConsumableSlot", slot: 0 });
  ownerState = room.syncPrimaryActivePlayerFromSim();
  assert(!getActiveSlot(ownerState, "shield"), "owner shield charge was not consumed on use");
  assert((ownerState.consumables?.sharedCooldown || 0) > 0, "owner shared consumable cooldown did not start");

  handleActionMessage(room, peer.id, { kind: "useConsumableSlot", slot: 0 });
  assert(!getActiveSlot(peerState, "shield"), "peer shield charge was not consumed on use");
  assert((peerState.consumables?.sharedCooldown || 0) > 0, "peer shared consumable cooldown did not start");

  console.log(JSON.stringify({
    ownerGold: ownerState.gold,
    peerGold: peerState.gold,
    remainingStock: room.sim.shopStock,
    ownerConsumables: ownerState.consumables,
    peerConsumables: peerState.consumables
  }, null, 2));
}

main();
