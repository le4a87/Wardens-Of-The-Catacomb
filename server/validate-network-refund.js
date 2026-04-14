import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = resolve(projectRoot, "artifacts", "network");
const HTTP_PORT = 8199;
const WS_PORT = 8200;
const ROOM_ID = "validate-network-refund";
const GAME_URL = `http://127.0.0.1:${HTTP_PORT}`;

const children = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasCommand(cmd, args = ["--version"]) {
  const res = spawnSync(cmd, args, { stdio: "ignore" });
  return res.status === 0;
}

function choosePythonCommand() {
  if (hasCommand("python3")) return { cmd: "python3", args: ["-m", "http.server"] };
  if (hasCommand("python")) return { cmd: "python", args: ["-m", "http.server"] };
  if (hasCommand("py", ["-3", "--version"])) return { cmd: "py", args: ["-3", "-m", "http.server"] };
  throw new Error("Python not found. Install Python or add it to PATH.");
}

function startChild(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: "pipe",
    shell: false
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

function ensurePortAvailable(port, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err?.code === "EADDRINUSE") {
        rejectPromise(new Error(`${label} port ${port} is already in use.`));
        return;
      }
      rejectPromise(err);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close((closeErr) => {
        if (closeErr) rejectPromise(closeErr);
        else resolvePromise();
      });
    });
  });
}

async function waitForHttpReady(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Timed out waiting for HTTP server at ${url}`);
}

async function waitForTcpReady(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise((resolvePromise) => {
      const socket = net.connect({ port, host: "127.0.0.1" }, () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.on("error", () => resolvePromise(false));
    });
    if (ready) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for TCP port ${port}`);
}

function rectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2
  };
}

async function clickCanvasRect(page, rect) {
  const canvasBox = await page.locator("#game").boundingBox();
  assert(canvasBox, "game canvas bounding box unavailable");
  const canvasMetrics = await page.evaluate(() => {
    const canvas = document.getElementById("game");
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    return {
      width: canvas.width,
      height: canvas.height
    };
  });
  assert(canvasMetrics?.width > 0 && canvasMetrics?.height > 0, "game canvas metrics unavailable");
  const point = rectCenter(rect);
  const scaleX = canvasBox.width / canvasMetrics.width;
  const scaleY = canvasBox.height / canvasMetrics.height;
  await page.mouse.click(canvasBox.x + point.x * scaleX, canvasBox.y + point.y * scaleY);
}

async function getDebugState(page) {
  return page.evaluate(() => window.__WOTC_DEBUG__?.getState?.() || null);
}

function findSkillTreeNode(state, key) {
  const nodes = Array.isArray(state?.ui?.skillTreeNodes) ? state.ui.skillTreeNodes : [];
  return nodes.find((node) => node?.key === key)?.rect || null;
}

async function getActionLog(page) {
  return page.evaluate(() => Array.isArray(window.__WOTC_NET_SEND_LOG__) ? window.__WOTC_NET_SEND_LOG__.slice() : []);
}

async function runDebug(page, action, payload = {}) {
  return page.evaluate(
    ({ command, data }) => window.__WOTC_DEBUG__?.run?.(command, data) || null,
    { command: action, data: payload }
  );
}

async function openLobby(page, { wsUrl, roomId, playerName, classType }) {
  await page.goto(GAME_URL, { waitUntil: "networkidle" });
  await page.keyboard.press("Space");
  await page.locator("#mode-select").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#menu-network").click();
  await page.locator("#network-setup-screen").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#net-server-url").fill(wsUrl);
  await page.locator("#net-room-id").fill(roomId);
  await page.locator("#net-player-name-setup").fill(playerName);
  await page.locator("#network-setup-next").click();
  await page.locator("#network-lobby-screen").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`[data-lobby-class-option="${classType}"]`).click();
}

async function setReady(page) {
  await page.locator("#network-lobby-toggle-ready").click();
}

async function captureFailure(page, error, state = null, actionLog = []) {
  mkdirSync(artifactsDir, { recursive: true });
  const screenshotPath = resolve(artifactsDir, "validate-network-refund-failure.png");
  const statePath = resolve(artifactsDir, "validate-network-refund-failure.json");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        state,
        actionLog
      },
      null,
      2
    )
  );
  return { screenshotPath, statePath };
}

async function main() {
  await ensurePortAvailable(HTTP_PORT, "HTTP");
  await ensurePortAvailable(WS_PORT, "WS");

  const python = choosePythonCommand();
  startChild("http", python.cmd, [...python.args, String(HTTP_PORT)]);
  startChild("ws", process.execPath, ["server/networkServer.js"], { PORT: String(WS_PORT) });

  await waitForHttpReady(GAME_URL);
  await waitForTcpReady(WS_PORT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const log = [];
    window.__WOTC_NET_SEND_LOG__ = log;
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = class LoggedWebSocket extends OriginalWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
      }
      send(data) {
        try {
          const text = typeof data === "string" ? data : "";
          const parsed = text ? JSON.parse(text) : null;
          log.push({
            atMs: Math.round(performance.now()),
            type: parsed?.type || "",
            actionKind: parsed?.action?.kind || "",
            actionKey: parsed?.action?.key || "",
            goldDelta: parsed?.action?.goldDelta || 0,
            skillPointDelta: parsed?.action?.skillPointDelta || 0
          });
          if (log.length > 512) log.splice(0, log.length - 512);
        } catch {}
        return super.send(data);
      }
    };
  });
  const page = await context.newPage();
  let lastState = null;
  try {
    await openLobby(page, {
      wsUrl: `ws://127.0.0.1:${WS_PORT}`,
      roomId: ROOM_ID,
      playerName: "RefundValidator",
      classType: "archer"
    });
    await setReady(page);

    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.networkReady === true && state.networkRole === "Active" && !!state.ui?.skillTreeButton;
    }, null, { timeout: 15000 });

    await runDebug(page, "grantSkillPoints", { amount: 2 });
    await runDebug(page, "grantGold", { amount: 400 });
    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.skillPoints >= 2 && state.ui?.gold >= 400;
    }, null, { timeout: 5000 });

    lastState = await getDebugState(page);
    await clickCanvasRect(page, lastState.ui.skillTreeButton);
    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.skillTreeOpen === true && !!state.ui?.refundButton && Array.isArray(state.ui?.skillTreeNodes) && state.ui.skillTreeNodes.some((node) => node?.key === "fireArrowActive");
    }, null, { timeout: 5000 });

    let skillState = await getDebugState(page);
    const fireArrowNode = findSkillTreeNode(skillState, "fireArrowActive");
    assert(fireArrowNode, "fireArrowActive node not available in skill tree");
    await clickCanvasRect(page, fireArrowNode);
    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.talentLevels?.fireArrowActive === 1 && state.ui?.spentSkillPoints === 1;
    }, null, { timeout: 5000 });

    skillState = await getDebugState(page);
    const skillPointsBeforeRefund = skillState.ui.skillPoints;
    const goldBeforeRefund = skillState.ui.gold;
    const refundCost = skillState.ui.refundCost;
    assert(refundCost > 0, `expected positive refund cost, got ${refundCost}`);

    await clickCanvasRect(page, skillState.ui.refundButton);
    await page.waitForFunction(() => {
      const state = window.__WOTC_DEBUG__?.getState?.();
      return !!state && state.ui?.refundCount === 1 && state.ui?.spentSkillPoints === 0 && state.ui?.talentLevels?.fireArrowActive === 0;
    }, null, { timeout: 5000 });

    lastState = await getDebugState(page);
    const actionLog = await getActionLog(page);
    assert(lastState.ui.skillPoints === skillPointsBeforeRefund + 1, `refund sync did not restore skill points: ${JSON.stringify(lastState.ui)}`);
    assert(lastState.ui.gold === goldBeforeRefund - refundCost, `refund sync gold mismatch: before=${goldBeforeRefund}, cost=${refundCost}, after=${lastState.ui.gold}`);
    assert(actionLog.some((entry) => entry.type === "action" && entry.actionKind === "debugGrantProgress" && entry.skillPointDelta === 2), "missing debugGrantProgress skill point action");
    assert(actionLog.some((entry) => entry.type === "action" && entry.actionKind === "debugGrantProgress" && entry.goldDelta === 400), "missing debugGrantProgress gold action");
    assert(actionLog.some((entry) => entry.type === "action" && entry.actionKind === "spendSkill" && entry.actionKey === "fireArrowActive"), "missing spendSkill fireArrowActive action");
    assert(actionLog.some((entry) => entry.type === "action" && entry.actionKind === "refundSkills"), "missing refundSkills action");

    mkdirSync(artifactsDir, { recursive: true });
    const successPath = resolve(artifactsDir, "validate-network-refund-success.json");
    writeFileSync(
      successPath,
      JSON.stringify(
        {
          refundCost,
          finalUi: lastState.ui,
          actionLog: actionLog.slice(-20)
        },
        null,
        2
      )
    );
    console.log(JSON.stringify({
      refundCost,
      goldAfterRefund: lastState.ui.gold,
      skillPointsAfterRefund: lastState.ui.skillPoints,
      refundCount: lastState.ui.refundCount,
      successPath
    }, null, 2));
  } catch (error) {
    const state = await getDebugState(page).catch(() => lastState);
    const actionLog = await getActionLog(page).catch(() => []);
    const artifacts = await captureFailure(page, error, state, actionLog);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nArtifacts: ${artifacts.screenshotPath}, ${artifacts.statePath}`);
  } finally {
    await browser.close();
    stopChildren();
  }
}

main().catch((error) => {
  stopChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
