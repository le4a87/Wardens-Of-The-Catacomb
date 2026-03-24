export class NetClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  emit(type, payload = {}) {
    const list = this.handlers.get(type) || [];
    for (const fn of list) fn(payload);
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener("open", () => this.emit("open", {}));
    this.ws.addEventListener("close", () => this.emit("close", {}));
    this.ws.addEventListener("error", (err) => this.emit("error", { err }));
    this.ws.addEventListener("message", (evt) => {
      let msg = null;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        this.emit("error", { err: new Error("Invalid JSON from server") });
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      this.emit(msg.type, msg);
      this.emit("message", msg);
    });
  }

  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  join(roomId, name, classType, protocolVersion = 2) {
    return this.send("join", { roomId, name, classType, protocolVersion });
  }

  sendInput(input) {
    return this.send("input", { input });
  }

  sendLobbyUpdate(payload = {}) {
    return this.send("room.lobbyUpdate", payload);
  }

  takeControl() {
    return this.send("room.takeControl", {});
  }

  sendAction(action) {
    return this.send("action", { action });
  }

  returnRoomToLobby() {
    return this.send("room.returnToLobby", {});
  }

  disconnect() {
    if (this.ws) this.ws.close();
    this.ws = null;
  }
}
