export function startRoomSchedulers(options) {
  const {
    rooms,
    tickRate,
    snapshotRate,
    maxTicksPerLoop,
    maxSnapshotStepsPerLoop,
    monotonicNowMs
  } = options;

  const tickMs = 1000 / tickRate;
  const snapshotMs = 1000 / snapshotRate;
  const schedulerStartMonoMs = monotonicNowMs();
  const schedulerStartWallMs = Date.now();
  let nextTickMonoMs = schedulerStartMonoMs + tickMs;
  let nextSnapshotMonoMs = schedulerStartMonoMs + snapshotMs;

  function monotonicToWallClockMs(monoMs) {
    return schedulerStartWallMs + (monoMs - schedulerStartMonoMs);
  }

  function runTickStep(scheduledMonoMs) {
    const actualMonoMs = monotonicNowMs();
    const driftMs = actualMonoMs - scheduledMonoMs;
    const wallNowMs = Date.now();
    for (const room of rooms.values()) {
      room.tick(wallNowMs, driftMs);
    }
  }

  function tickLoop() {
    let processed = 0;
    while (monotonicNowMs() >= nextTickMonoMs && processed < maxTicksPerLoop) {
      runTickStep(nextTickMonoMs);
      nextTickMonoMs += tickMs;
      processed += 1;
    }
    const afterStepMonoMs = monotonicNowMs();
    if (afterStepMonoMs >= nextTickMonoMs) {
      nextTickMonoMs = afterStepMonoMs + tickMs;
    }
    const delayMs = Math.max(1, Math.round(nextTickMonoMs - monotonicNowMs()));
    setTimeout(tickLoop, delayMs);
  }

  function snapshotLoop() {
    const loopNowMonoMs = monotonicNowMs();
    if (loopNowMonoMs >= nextSnapshotMonoMs) {
      let steps = 0;
      while (loopNowMonoMs >= nextSnapshotMonoMs && steps < maxSnapshotStepsPerLoop) {
        nextSnapshotMonoMs += snapshotMs;
        steps += 1;
      }
      if (loopNowMonoMs >= nextSnapshotMonoMs) {
        nextSnapshotMonoMs = loopNowMonoMs + snapshotMs;
      }
      const snapshotNowMs = monotonicToWallClockMs(loopNowMonoMs);
      for (const room of rooms.values()) {
        room.maybeBroadcastSnapshot(snapshotNowMs);
      }
    }
    const delayMs = Math.max(1, Math.round(nextSnapshotMonoMs - monotonicNowMs()));
    setTimeout(snapshotLoop, delayMs);
  }

  const initialTickDelayMs = Math.max(1, Math.round(nextTickMonoMs - monotonicNowMs()));
  setTimeout(tickLoop, initialTickDelayMs);
  const initialSnapshotDelayMs = Math.max(1, Math.round(nextSnapshotMonoMs - monotonicNowMs()));
  setTimeout(snapshotLoop, initialSnapshotDelayMs);
}
