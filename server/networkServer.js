import { WebSocketServer } from "ws";
import { buildJoinKeyframeState } from "./net/deltaProtocol.js";
import { handleClientClose, handleClientMessage } from "./net/clientMessageHandler.js";
import { AuthoritativeRoom } from "./net/AuthoritativeRoom.js";
import { makeDefaultInput, normClassType, safeSend, sanitizeInput, uid } from "./net/serverHelpers.js";
import { startRoomSchedulers } from "./net/serverScheduler.js";
import { getStableId, serializeMetaState, serializeState } from "./net/stateSerialization.js";
import { average, makeSamplePusher, monotonicNowMs, percentile } from "./net/telemetry.js";
import { buildDeltaCollection } from "./net/deltaProtocol.js";
import { buildMapChunkRows } from "./net/mapChunkStreaming.js";
import { chooseGameplayTrack } from "./musicCatalog.js";

const PORT = Number.parseInt(process.env.PORT || "8090", 10);
const TICK_RATE = Number.parseInt(process.env.TICK_RATE || "72", 10);
const SNAPSHOT_RATE = Number.parseInt(process.env.SNAPSHOT_RATE || "28", 10);
const META_BROADCAST_MIN_MS = Number.parseInt(process.env.META_BROADCAST_MIN_MS || "160", 10);
const MAP_CHUNK_SIZE = Number.parseInt(process.env.MAP_CHUNK_SIZE || "24", 10);
const MAP_CHUNK_RADIUS = Number.parseInt(process.env.MAP_CHUNK_RADIUS || "2", 10);
const MAP_CHUNK_PUSH_MS = Number.parseInt(process.env.MAP_CHUNK_PUSH_MS || "120", 10);
const DELTA_KEYFRAME_EVERY = Number.parseInt(process.env.DELTA_KEYFRAME_EVERY || "30", 10);
const SNAPSHOT_ACK_GAP_FORCE_KEYFRAME = Number.parseInt(process.env.SNAPSHOT_ACK_GAP_FORCE_KEYFRAME || "8", 10);
const MAX_ROOMS = 64;
const MAX_PEERS_PER_ROOM = 8;
const MAX_WS_BUFFERED_BYTES = Number.parseInt(process.env.MAX_WS_BUFFERED_BYTES || "262144", 10);
const MAX_TELEMETRY_SAMPLES = Number.parseInt(process.env.MAX_TELEMETRY_SAMPLES || "4096", 10);
const TICK_DRIFT_EPSILON_MS = Number.parseFloat(process.env.TICK_DRIFT_EPSILON_MS || "0.5");
const MAX_TICKS_PER_LOOP = Number.parseInt(process.env.MAX_TICKS_PER_LOOP || "6", 10);
const MAX_SNAPSHOT_STEPS_PER_LOOP = Number.parseInt(process.env.MAX_SNAPSHOT_STEPS_PER_LOOP || "3", 10);

const rooms = new Map();
const pushTelemetrySample = makeSamplePusher(MAX_TELEMETRY_SAMPLES);

const roomOptions = {
  average,
  buildDeltaCollection,
  buildMapChunkRows,
  chooseGameplayTrack,
  deltaKeyframeEvery: DELTA_KEYFRAME_EVERY,
  getStableId,
  makeDefaultInput,
  mapChunkPushMs: MAP_CHUNK_PUSH_MS,
  mapChunkRadius: MAP_CHUNK_RADIUS,
  mapChunkSize: MAP_CHUNK_SIZE,
  maxWsBufferedBytes: MAX_WS_BUFFERED_BYTES,
  metaBroadcastMinMs: META_BROADCAST_MIN_MS,
  monotonicNowMs,
  percentile,
  pushTelemetrySample,
  serializeMetaState,
  serializeState,
  snapshotAckGapForceKeyframe: SNAPSHOT_ACK_GAP_FORCE_KEYFRAME,
  tickDriftEpsilonMs: TICK_DRIFT_EPSILON_MS
};

function getOrCreateRoom(roomId, classType) {
  let room = rooms.get(roomId);
  if (!room) {
    if (rooms.size >= MAX_ROOMS) return null;
    room = new AuthoritativeRoom(roomId, classType, roomOptions);
    rooms.set(roomId, room);
  }
  return room;
}

const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: false
});

wss.on("connection", (ws) => {
  if (ws._socket && typeof ws._socket.setNoDelay === "function") {
    ws._socket.setNoDelay(true);
  }
  const client = {
    id: uid("p"),
    ws,
    roomId: null,
    name: "Player",
    classType: "archer",
    protocolVersion: 1,
    input: makeDefaultInput(),
    lastInputSeq: 0
  };

  safeSend(ws, {
    type: "hello",
    playerId: client.id,
    protocol: 2,
    note: "Server authoritative alpha. One active controller per room; others are spectators."
  });

  ws.on("message", (raw) => {
    handleClientMessage(raw, {
      ws,
      client,
      rooms,
      getOrCreateRoom,
      normClassType,
      maxPeersPerRoom: MAX_PEERS_PER_ROOM,
      makeDefaultInput,
      sanitizeInput,
      serializeState,
      buildJoinKeyframeState,
      safeSend
    });
  });

  ws.on("close", () => {
    handleClientClose(client, rooms);
  });
});

startRoomSchedulers({
  rooms,
  tickRate: TICK_RATE,
  snapshotRate: SNAPSHOT_RATE,
  maxTicksPerLoop: MAX_TICKS_PER_LOOP,
  maxSnapshotStepsPerLoop: MAX_SNAPSHOT_STEPS_PER_LOOP,
  monotonicNowMs
});

console.log(`Authoritative network server listening on ws://localhost:${PORT}`);
