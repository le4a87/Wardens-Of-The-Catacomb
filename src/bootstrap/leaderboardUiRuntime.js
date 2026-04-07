import {
  compareLeaderboardEntries,
  formatLeaderboardDuration,
  getLeaderboardClassText,
  getLeaderboardHandleText,
  LEADERBOARD_BOARD_GROUP,
  normalizeLeaderboardRow
} from "../leaderboard/leaderboardClient.js";

export function sortLeaderboardRows(rows = []) {
  return rows.map(normalizeLeaderboardRow).sort(compareLeaderboardEntries);
}

function createCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

export function renderLeaderboardRows(tbody, rows, emptyMessage) {
  if (!tbody) return;
  tbody.textContent = "";
  if (!Array.isArray(rows) || rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "leaderboard-empty";
    cell.textContent = emptyMessage;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  rows.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.appendChild(createCell(String(index + 1), "leaderboard-rank"));
    row.appendChild(createCell(getLeaderboardHandleText(entry)));
    row.appendChild(createCell(getLeaderboardClassText(entry)));
    row.appendChild(createCell(String(entry.score)));
    row.appendChild(createCell(formatLeaderboardDuration(entry.timeSeconds)));
    row.appendChild(createCell(`F${entry.floorReached}`));
    tbody.appendChild(row);
  });
}

export function syncLeaderboardBoards(soloButton, groupButton, activeBoard) {
  if (soloButton) soloButton.classList.toggle("is-active", activeBoard !== LEADERBOARD_BOARD_GROUP);
  if (groupButton) groupButton.classList.toggle("is-active", activeBoard === LEADERBOARD_BOARD_GROUP);
}

export function syncLeaderboardTabs(globalButton, sessionButton, activeTab) {
  if (globalButton) globalButton.classList.toggle("is-active", activeTab === "global");
  if (sessionButton) sessionButton.classList.toggle("is-active", activeTab === "session");
}

export function syncLeaderboardModal({
  modal,
  title,
  subtitle,
  status,
  closeButton,
  statsButton,
  deathActions,
  continueButton,
  activeBoard,
  soloButton,
  groupButton,
  activeTab,
  globalButton,
  sessionButton,
  globalRows,
  sessionRows,
  globalTableBody,
  sessionTableBody,
  errorText = "",
  loading = false,
  mode = "menu",
  remainingSeconds = 0
}) {
  if (!modal) return;
  modal.hidden = false;
  modal.classList.add("is-open");
  if (title) title.textContent = mode === "death" ? "Run Complete" : "Leaderboard";
  if (subtitle) {
    const boardLabel = activeBoard === LEADERBOARD_BOARD_GROUP ? "group" : "solo";
    subtitle.textContent = mode === "death"
      ? `Returning to menu in ${Math.max(0, Math.ceil(remainingSeconds))}s unless you open stats or continue now.`
      : `Global shows the persistent top 25 ${boardLabel} runs. This Session resets on refresh.`;
  }
  if (status) {
    if (loading) status.textContent = "Loading global leaderboard...";
    else if (errorText) status.textContent = errorText;
    else status.textContent = "";
  }
  if (closeButton) closeButton.hidden = mode === "death";
  if (deathActions) deathActions.hidden = mode !== "death";
  if (statsButton) statsButton.hidden = mode !== "death";
  if (continueButton) continueButton.hidden = mode !== "death";
  syncLeaderboardBoards(soloButton, groupButton, activeBoard);
  syncLeaderboardTabs(globalButton, sessionButton, activeTab);
  if (globalTableBody?.parentElement) globalTableBody.parentElement.hidden = activeTab !== "global";
  if (sessionTableBody?.parentElement) sessionTableBody.parentElement.hidden = activeTab !== "session";
  const emptyGlobal = activeBoard === LEADERBOARD_BOARD_GROUP ? "No global group runs yet." : "No global solo runs yet.";
  const emptySession = activeBoard === LEADERBOARD_BOARD_GROUP ? "No group runs this session yet." : "No solo runs this session yet.";
  renderLeaderboardRows(globalTableBody, globalRows, loading ? "Loading..." : (errorText || emptyGlobal));
  renderLeaderboardRows(sessionTableBody, sessionRows, emptySession);
}

export function hideLeaderboardModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove("is-open");
}
