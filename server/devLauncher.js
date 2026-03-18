import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(projectRoot);

const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT || "8080", 10);
const WS_PORT = Number.parseInt(process.env.WS_PORT || "8090", 10);
const GAME_URL = `http://localhost:${HTTP_PORT}/?dev=1`;

const children = [];
let shuttingDown = false;

function hasCommand(cmd, args = ["--version"]) {
  const res = spawnSync(cmd, args, { stdio: "ignore" });
  return res.status === 0;
}

function choosePythonCommand() {
  if (hasCommand("python3")) return "python3";
  if (hasCommand("python")) return "python";
  if (hasCommand("py", ["-3", "--version"])) return "py";
  throw new Error("Python not found. Install Python or add it to PATH.");
}

function startProcess(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    env: { ...process.env, ...extraEnv },
    cwd: projectRoot,
    stdio: "inherit",
    shell: false
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[${name}] exited unexpectedly (${reason}). Stopping all services.`);
    shutdown(1);
  });
  return child;
}

function describePortConflict(port, label) {
  const envName = label === "HTTP" ? "HTTP_PORT" : "WS_PORT";
  const fallbackPort = label === "HTTP" ? port + 1 : port + 10;
  const startCommand = label === "HTTP"
    ? `${envName}=${fallbackPort} npm run dev`
    : `HTTP_PORT=${HTTP_PORT} ${envName}=${fallbackPort} npm run dev`;
  return [
    `Port ${port} is already in use for the ${label} server.`,
    "Recommended action:",
    `- Stop the process using port ${port}. On Linux/WSL: \`lsof -i :${port}\` then \`kill <pid>\`.`,
    `- Or start the dev stack on a different port: \`${startCommand}\`.`
  ].join("\n");
}

function ensurePortAvailable(port, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        rejectPromise(new Error(describePortConflict(port, label)));
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

function openBrowser(url) {
  const isWsl = !!process.env.WSL_DISTRO_NAME;
  const platform = process.platform;
  if (isWsl) {
    spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process '${url}'`], { stdio: "ignore", detached: true });
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
    return;
  }
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true });
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGKILL");
    }
    process.exit(exitCode);
  }, 600);
}

async function main() {
  const pythonCmd = choosePythonCommand();
  const pyArgs = pythonCmd === "py" ? ["-3", "-m", "http.server", String(HTTP_PORT)] : ["-m", "http.server", String(HTTP_PORT)];

  await ensurePortAvailable(HTTP_PORT, "HTTP");
  await ensurePortAvailable(WS_PORT, "WebSocket");

  console.log(`Starting HTTP server on http://localhost:${HTTP_PORT}`);
  startProcess("http", pythonCmd, pyArgs);
  console.log(`Starting network server on ws://localhost:${WS_PORT}`);
  startProcess("network", process.execPath, ["server/networkServer.js"], { PORT: String(WS_PORT) });

  setTimeout(() => {
    console.log(`Opening browser: ${GAME_URL}`);
    openBrowser(GAME_URL);
    console.log("Dev environment ready. Press Ctrl+C to stop all services.");
  }, 1000);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (err) => {
  console.error("Launcher crashed:", err);
  shutdown(1);
});

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  shutdown(1);
});
