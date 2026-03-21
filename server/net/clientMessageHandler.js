export function handleActionMessage(room, action) {
  if (!action || typeof action !== "object" || typeof action.kind !== "string") return;
  const kind = action.kind;
  const sim = room.sim;
  if (kind === "escape") {
    if (sim.shopOpen) sim.toggleShop(false);
    else if (sim.skillTreeOpen) sim.toggleSkillTree(false);
    else if (sim.statsPanelOpen) sim.toggleStatsPanel(false);
    else if (!sim.gameOver) sim.paused = !sim.paused;
    return;
  }
  if (kind === "toggleShop") {
    sim.toggleShop();
    return;
  }
  if (kind === "closeShop") {
    sim.toggleShop(false);
    return;
  }
  if (kind === "toggleSkillTree") {
    sim.toggleSkillTree();
    return;
  }
  if (kind === "closeSkillTree") {
    sim.toggleSkillTree(false);
    return;
  }
  if (kind === "toggleStats") {
    sim.toggleStatsPanel();
    return;
  }
  if (kind === "closeStats") {
    sim.toggleStatsPanel(false);
    return;
  }
  if (kind === "setStatsView" && (action.view === "run" || action.view === "character")) {
    sim.statsPanelView = action.view;
    return;
  }
  if (kind === "buyUpgrade" && typeof action.key === "string") {
    sim.buyUpgrade(action.key);
    return;
  }
  if (kind === "spendSkill" && typeof action.key === "string") {
    sim.spendSkillPoint(action.key);
  }
}

export function handleClientMessage(raw, context) {
  const {
    ws,
    client,
    rooms,
    getOrCreateRoom,
    normClassType,
    maxPeersPerRoom,
    makeDefaultInput,
    sanitizeInput,
    serializeState,
    buildJoinKeyframeState,
    safeSend,
    leaderboardStore
  } = context;

  let msg = null;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    safeSend(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
    safeSend(ws, { type: "error", message: "Malformed message" });
    return;
  }

  if (msg.type === "leaderboard.get") {
    safeSend(ws, {
      type: "leaderboard.rows",
      requestId: typeof msg.requestId === "string" ? msg.requestId : "",
      rows: leaderboardStore ? leaderboardStore.getRows() : []
    });
    return;
  }

  if (msg.type === "leaderboard.submit") {
    const run = msg.run && typeof msg.run === "object" ? msg.run : null;
    if (!run) {
      safeSend(ws, {
        type: "error",
        requestId: typeof msg.requestId === "string" ? msg.requestId : "",
        message: "Missing leaderboard run payload"
      });
      return;
    }
    const rows = leaderboardStore ? leaderboardStore.submitRun(run) : [];
    safeSend(ws, {
      type: "leaderboard.rows",
      requestId: typeof msg.requestId === "string" ? msg.requestId : "",
      accepted: true,
      rows
    });
    return;
  }

  if (msg.type === "join") {
    const roomId = typeof msg.roomId === "string" && msg.roomId.trim() ? msg.roomId.trim().slice(0, 32) : "lobby";
    const classType = normClassType(msg.classType);
    const room = getOrCreateRoom(roomId, classType);
    if (!room) {
      safeSend(ws, { type: "error", message: "Room limit reached" });
      return;
    }
    if (room.clients.size >= maxPeersPerRoom) {
      safeSend(ws, { type: "error", message: "Room full" });
      return;
    }

    if (client.roomId && rooms.has(client.roomId)) {
      const oldRoom = rooms.get(client.roomId);
      oldRoom.removeClient(client.id);
      oldRoom.broadcastRoster();
      if (oldRoom.isEmpty()) rooms.delete(oldRoom.id);
    }

    client.roomId = room.id;
    client.name = typeof msg.name === "string" && msg.name.trim() ? msg.name.trim().slice(0, 20) : `Player-${client.id.slice(-4)}`;
    client.classType = classType;
    client.protocolVersion =
      Number.isFinite(msg.protocolVersion) && msg.protocolVersion >= 1 ? Math.floor(msg.protocolVersion) : client.protocolVersion;
    client.input = makeDefaultInput();
    room.addClient(client);

    safeSend(ws, {
      type: "join.ok",
      roomId: room.id,
      playerId: client.id,
      controllerId: room.controllerId,
      classType: room.sim.classType
    });
    room.sendMapState(client);
    const joinFullState = serializeState(room);
    const joinState = client.protocolVersion >= 2 ? buildJoinKeyframeState(joinFullState) : joinFullState;
    safeSend(ws, {
      type: "state.snapshot",
      roomId: room.id,
      serverTime: Date.now(),
      snapshotSeq: room.snapshotSeq,
      controllerId: room.controllerId,
      lastInputSeq: room.clients.get(room.controllerId)?.lastInputSeq || 0,
      mapSignature: room.mapSignature(),
      state: joinState
    });
    room.sendMeta(client, Date.now(), true);
    room.broadcastRoster();
    return;
  }

  if (msg.type === "input") {
    if (!client.roomId || !rooms.has(client.roomId)) return;
    const room = rooms.get(client.roomId);
    if (room.controllerId !== client.id) {
      safeSend(ws, { type: "warn", message: "Spectators cannot control this room in phase-1." });
      return;
    }
    client.input = sanitizeInput(msg.input, client.input);
    client.lastInputSeq = client.input.seq || client.lastInputSeq;
    return;
  }

  if (msg.type === "state.snapshotAck") {
    if (!client.roomId || !rooms.has(client.roomId)) return;
    const seq = Number.isFinite(msg.snapshotSeq) ? Math.max(0, Math.floor(msg.snapshotSeq)) : 0;
    client.lastSnapshotAckSeq = Math.max(Number.isFinite(client.lastSnapshotAckSeq) ? client.lastSnapshotAckSeq : 0, seq);
    return;
  }

  if (msg.type === "action") {
    if (!client.roomId || !rooms.has(client.roomId)) return;
    const room = rooms.get(client.roomId);
    if (room.controllerId !== client.id) return;
    handleActionMessage(room, msg.action);
    return;
  }

  if (msg.type === "room.takeControl") {
    if (!client.roomId || !rooms.has(client.roomId)) return;
    const room = rooms.get(client.roomId);
    room.controllerId = client.id;
    room.broadcastRoster();
    return;
  }

  if (msg.type === "perf.getMetrics") {
    if (!client.roomId || !rooms.has(client.roomId)) return;
    const room = rooms.get(client.roomId);
    safeSend(ws, {
      type: "perf.metrics",
      roomId: room.id,
      serverTime: Date.now(),
      metrics: room.getTelemetrySnapshot()
    });
    return;
  }

  safeSend(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
}

export function handleClientClose(client, rooms) {
  if (!client.roomId || !rooms.has(client.roomId)) return;
  const room = rooms.get(client.roomId);
  room.removeClient(client.id);
  if (room.isEmpty()) {
    rooms.delete(room.id);
  } else {
    room.broadcastRoster();
  }
}
