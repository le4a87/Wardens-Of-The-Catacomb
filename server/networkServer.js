import http from "node:http";
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
import { installRoomDevBossOverride } from "./net/installRoomDevBossOverride.js";
import { chooseGameplayTrack } from "./musicCatalog.js";
import { handleLeaderboardApiRequest } from "./leaderboardApi.js";
import { LeaderboardStore } from "./leaderboardStore.js";

const PORT = Number.parseInt(process.env.PORT || "8090", 10);
const HOST = typeof process.env.HOST === "string" && process.env.HOST.trim() ? process.env.HOST.trim() : "";
const TICK_RATE = Number.parseInt(process.env.TICK_RATE || "60", 10);
const SNAPSHOT_RATE = Number.parseInt(process.env.SNAPSHOT_RATE || "20", 10);
const META_BROADCAST_MIN_MS = Number.parseInt(process.env.META_BROADCAST_MIN_MS || "320", 10);
const MAP_CHUNK_SIZE = Number.parseInt(process.env.MAP_CHUNK_SIZE || "24", 10);
const MAP_CHUNK_RADIUS = Number.parseInt(process.env.MAP_CHUNK_RADIUS || "2", 10);
const MAP_CHUNK_PUSH_MS = Number.parseInt(process.env.MAP_CHUNK_PUSH_MS || "120", 10);
const DELTA_KEYFRAME_EVERY = Number.parseInt(process.env.DELTA_KEYFRAME_EVERY || "30", 10);
const SNAPSHOT_ACK_GAP_FORCE_KEYFRAME = Number.parseInt(process.env.SNAPSHOT_ACK_GAP_FORCE_KEYFRAME || "8", 10);
const MAX_ROOMS = 64;
const MAX_PEERS_PER_ROOM = 6;
const MAX_WS_BUFFERED_BYTES = Number.parseInt(process.env.MAX_WS_BUFFERED_BYTES || "262144", 10);
const MAX_TELEMETRY_SAMPLES = Number.parseInt(process.env.MAX_TELEMETRY_SAMPLES || "4096", 10);
const TICK_DRIFT_EPSILON_MS = Number.parseFloat(process.env.TICK_DRIFT_EPSILON_MS || "0.5");
const MAX_TICKS_PER_LOOP = Number.parseInt(process.env.MAX_TICKS_PER_LOOP || "6", 10);
const MAX_SNAPSHOT_STEPS_PER_LOOP = Number.parseInt(process.env.MAX_SNAPSHOT_STEPS_PER_LOOP || "3", 10);

const rooms = new Map();
const pushTelemetrySample = makeSamplePusher(MAX_TELEMETRY_SAMPLES);
const leaderboardStore = new LeaderboardStore();

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
    installRoomDevBossOverride(room);
    rooms.set(roomId, room);
  }
  return room;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/api/leaderboard") {
    await handleLeaderboardApiRequest(req, res, leaderboardStore);
    return;
  }
  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(`${JSON.stringify({ error: "Not found" })}\n`);
});

const wss = new WebSocketServer({
  server,
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
    note: "Server authoritative alpha. Multiplayer room scaffolding is in progress."
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
      safeSend,
      leaderboardStore
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

server.listen(PORT, HOST || undefined, () => {
  const address = server.address();
  const boundHost =
    address && typeof address === "object" && typeof address.address === "string"
      ? address.address === "::" || address.address === "0.0.0.0"
        ? "all interfaces"
        : address.address
      : HOST || "all interfaces";
  const endpointHost =
    address && typeof address === "object" && typeof address.address === "string" && address.address && address.address !== "::" && address.address !== "0.0.0.0"
      ? address.address
      : HOST || "localhost";
  console.log(`Authoritative server listening on ${boundHost}:${PORT}`);
  console.log(`WebSocket gameplay endpoint available on ws://${endpointHost}:${PORT}`);
  console.log(`Leaderboard REST endpoint available on http://${endpointHost}:${PORT}/api/leaderboard`);
});
