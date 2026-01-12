// ===== DOM =====
const cells = document.querySelectorAll(".cell");
const winLine = document.querySelector("#winLine");

const statusEl = document.querySelector("#status");
const turnNameEl = document.querySelector("#turnName");
const subTitleEl = document.querySelector("#subTitle");

const scoreXEl = document.querySelector("#scoreX");
const scoreOEl = document.querySelector("#scoreO");
const scoreDEl = document.querySelector("#scoreD");

const matchTargetEl = document.querySelector("#matchTarget");
const matchXEl = document.querySelector("#matchX");
const matchOEl = document.querySelector("#matchO");

const modeEl = document.querySelector("#mode");
const difficultyEl = document.querySelector("#difficulty");
const bestOfEl = document.querySelector("#bestOf");

const soundToggle = document.querySelector("#soundToggle");
const themeToggle = document.querySelector("#themeToggle");

const undoBtn = document.querySelector("#undoBtn");
const resetBoardBtn = document.querySelector("#resetBoardBtn");
const clearAllBtn = document.querySelector("#clearAllBtn");
const openStartBtn = document.querySelector("#openStart");

const startScreen = document.querySelector("#startScreen");
const startBtn = document.querySelector("#startBtn");
const playerXNameInput = document.querySelector("#playerXName");
const playerONameInput = document.querySelector("#playerOName");
const startModeEl = document.querySelector("#startMode");
const startDifficultyEl = document.querySelector("#startDifficulty");
const startBestOfEl = document.querySelector("#startBestOf");

const overlay = document.querySelector("#overlay");
const msgTitle = document.querySelector("#msgTitle");
const msg = document.querySelector("#msg");
const nextRoundBtn = document.querySelector("#nextRoundBtn");
const restartMatchBtn = document.querySelector("#restartMatchBtn");

const confettiCanvas = document.querySelector("#confettiCanvas");

// ===== STATE =====
const STORAGE_KEY = "ultimate_ttt_v1";

let board = Array(9).fill("");
let currentPlayer = "X";
let gameOver = false;

// Move history: store indices in order
let history = [];

// Match scoring (Best-of)
let matchX = 0;
let matchO = 0;
let draws = 0;

// Total scoreboard (same as match scoreboard, but we keep for UI)
let scoreX = 0;
let scoreO = 0;
let scoreD = 0;

// Settings
let mode = "pvp"; // pvp | cpu
let difficulty = "medium"; // easy | medium | hard
let bestOf = 3; // 1 | 3 | 5
let matchTarget = 2; // ceil(bestOf/2)
let soundOn = true;
let themeLight = false;

// Names
let playerXName = "Player X";
let playerOName = "Player O";

// Alternate starter per round (PvP)
let roundStarter = "X";

// ===== UTILS =====
const winPatterns = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function ceilDiv(a, b) {
  return Math.floor((a + b - 1) / b);
}

function deepCopy(arr) {
  return arr.slice();
}

// ===== SOUND =====
function beep(type = "move") {
  if (!soundOn) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  o.type = "sine";
  // Different tones
  const freq =
    type === "win" ? 660 :
    type === "draw" ? 220 :
    currentPlayer === "X" ? 520 : 420;

  o.frequency.value = freq;
  g.gain.value = 0.06;

  o.connect(g);
  g.connect(ctx.destination);

  o.start();
  setTimeout(() => {
    o.stop();
    ctx.close();
  }, type === "win" ? 170 : 90);
}

// ===== LOCAL STORAGE =====
function saveState() {
  const data = {
    mode,
    difficulty,
    bestOf,
    matchX,
    matchO,
    draws,
    scoreX,
    scoreO,
    scoreD,
    playerXName,
    playerOName,
    soundOn,
    themeLight,
    roundStarter,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    mode = data.mode ?? mode;
    difficulty = data.difficulty ?? difficulty;
    bestOf = Number(data.bestOf ?? bestOf);

    matchX = Number(data.matchX ?? 0);
    matchO = Number(data.matchO ?? 0);
    draws = Number(data.draws ?? 0);

    scoreX = Number(data.scoreX ?? matchX);
    scoreO = Number(data.scoreO ?? matchO);
    scoreD = Number(data.scoreD ?? draws);

    playerXName = data.playerXName ?? playerXName;
    playerOName = data.playerOName ?? playerOName;

    soundOn = Boolean(data.soundOn ?? true);
    themeLight = Boolean(data.themeLight ?? false);

    roundStarter = data.roundStarter ?? "X";
  } catch {
    // ignore corrupt storage
  }
}

// ===== UI HELPERS =====
function setBodyTheme() {
  document.body.classList.toggle("light", themeLight);
  themeToggle.checked = themeLight;
}

function updateSubtitle() {
  subTitleEl.textContent = `Best of ${bestOf} • ${mode.toUpperCase()} • ${difficulty}`;
}

function updateStatus() {
  statusEl.textContent = currentPlayer;
  const name = currentPlayer === "X" ? playerXName : playerOName;
  turnNameEl.textContent = name;
}

function updateScoresUI() {
  scoreXEl.textContent = scoreX;
  scoreOEl.textContent = scoreO;
  scoreDEl.textContent = scoreD;

  matchXEl.textContent = matchX;
  matchOEl.textContent = matchO;
  matchTargetEl.textContent = matchTarget;
}

function renderBoard() {
  cells.forEach((cell, i) => {
    cell.textContent = board[i];
    cell.disabled = gameOver || board[i] !== "";
  });
}

function clearWinHighlight() {
  cells.forEach((c) => c.classList.remove("win"));
}

function hideWinLine() {
  if (!winLine) return;
  winLine.classList.remove("show");
  winLine.style.transform = "translate(-50%, -50%) rotate(0deg)";
  winLine.style.left = "50%";
  winLine.style.top = "50%";
}

function showWinLine(pattern) {
  if (!winLine) return;

  // Rows
  if (pattern[0] === 0 && pattern[1] === 1 && pattern[2] === 2) {
    winLine.style.top = "18%";
    winLine.style.left = "50%";
    winLine.style.transform = "translate(-50%, -50%) rotate(0deg)";
  } else if (pattern[0] === 3 && pattern[1] === 4 && pattern[2] === 5) {
    winLine.style.top = "50%";
    winLine.style.left = "50%";
    winLine.style.transform = "translate(-50%, -50%) rotate(0deg)";
  } else if (pattern[0] === 6 && pattern[1] === 7 && pattern[2] === 8) {
    winLine.style.top = "82%";
    winLine.style.left = "50%";
    winLine.style.transform = "translate(-50%, -50%) rotate(0deg)";
  }
  // Cols
  else if (pattern[0] === 0 && pattern[1] === 3 && pattern[2] === 6) {
    winLine.style.top = "50%";
    winLine.style.left = "18%";
    winLine.style.transform = "translate(-50%, -50%) rotate(90deg)";
  } else if (pattern[0] === 1 && pattern[1] === 4 && pattern[2] === 7) {
    winLine.style.top = "50%";
    winLine.style.left = "50%";
    winLine.style.transform = "translate(-50%, -50%) rotate(90deg)";
  } else if (pattern[0] === 2 && pattern[1] === 5 && pattern[2] === 8) {
    winLine.style.top = "50%";
    winLine.style.left = "82%";
    winLine.style.transform = "translate(-50%, -50%) rotate(90deg)";
  }
  // Diagonals
  else if (pattern[0] === 0 && pattern[1] === 4 && pattern[2] === 8) {
    winLine.style.top = "50%";
    winLine.style.left = "50%";
    winLine.style.transform = "translate(-50%, -50%) rotate(45deg)";
  } else if (pattern[0] === 2 && pattern[1] === 4 && pattern[2] === 6) {
    winLine.style.top = "50%";
    winLine.style.left = "50%";
    winLine.style.transform = "translate(-50%, -50%) rotate(-45deg)";
  }

  requestAnimationFrame(() => winLine.classList.add("show"));
}

function showOverlay(title, text, isMatchEnd = false) {
  msgTitle.textContent = title;
  msg.textContent = text;

  // If match ended, Next Round should say "New Match"
  nextRoundBtn.textContent = isMatchEnd ? "New Match" : "Next Round";
  overlay.classList.remove("hide");
}

function hideOverlay() {
  overlay.classList.add("hide");
}

// ===== GAME LOGIC =====
function checkWinnerOn(b) {
  for (const pattern of winPatterns) {
    const [a, c, d] = pattern;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], pattern };
    }
  }
  return { winner: null, pattern: null };
}

function isDrawOn(b) {
  return b.every((v) => v !== "");
}

function setMatchTarget() {
  matchTarget = ceilDiv(bestOf, 2);
}

function resetRound(keepStarter = true) {
  board = Array(9).fill("");
  history = [];
  gameOver = false;

  clearWinHighlight();
  hideWinLine();
  hideOverlay();

  // Decide starter
  if (!keepStarter) {
    if (mode === "pvp") {
      roundStarter = roundStarter === "X" ? "O" : "X";
    } else {
      roundStarter = "X"; // CPU: player X starts always
    }
  }

  currentPlayer = roundStarter;
  renderBoard();
  updateStatus();
  saveState();

  // If CPU mode and O starts (shouldn’t), guard
  if (mode === "cpu" && currentPlayer === "O") {
    cpuMove();
  }
}

function resetMatch() {
  matchX = 0;
  matchO = 0;
  draws = 0;

  scoreX = 0;
  scoreO = 0;
  scoreD = 0;

  roundStarter = "X";
  updateScoresUI();
  resetRound(true);
  saveState();
}

function applyMove(index, symbol) {
  board[index] = symbol;
  history.push(index);
}

function makeMove(index) {
  if (gameOver) return;
  if (board[index] !== "") return;

  applyMove(index, currentPlayer);
  beep("move");

  // render move
  renderBoard();

  // check outcome
  const { winner, pattern } = checkWinnerOn(board);
  if (winner) {
    endRoundWithWinner(winner, pattern);
    return;
  }
  if (isDrawOn(board)) {
    endRoundWithDraw();
    return;
  }

  // switch player
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  updateStatus();
  saveState();

  // CPU turn
  if (mode === "cpu" && currentPlayer === "O") {
    setTimeout(cpuMove, 220);
  }
}

function endRoundWithWinner(winner, pattern) {
  gameOver = true;

  // Highlight
  pattern.forEach((i) => cells[i].classList.add("win"));
  showWinLine(pattern);

  // Update match and scores
  const winnerName = winner === "X" ? playerXName : playerOName;

  if (winner === "X") {
    matchX++;
    scoreX++;
  } else {
    matchO++;
    scoreO++;
  }

  updateScoresUI();
  beep("win");
  startConfetti();

  // Match end?
  const matchEnded = matchX >= matchTarget || matchO >= matchTarget;
  if (matchEnded) {
    showOverlay("MATCH WINNER!", `${winnerName} (${winner}) wins the match!`, true);
  } else {
    showOverlay("ROUND WIN!", `${winnerName} (${winner}) wins this round!`, false);
  }

  saveState();
}

function endRoundWithDraw() {
  gameOver = true;
  draws++;
  scoreD++;
  updateScoresUI();
  beep("draw");

  // Match end by max rounds? (optional) — we keep match until someone reaches target
  showOverlay("DRAW", "Round was a draw!", false);
  saveState();
}

// ===== UNDO =====
function undo() {
  if (history.length === 0) return;
  if (gameOver) return; // keep simple

  // PvP: remove one move
  // CPU: remove two moves (cpu + player) if possible
  const steps = mode === "cpu" ? 2 : 1;

  for (let s = 0; s < steps; s++) {
    const last = history.pop();
    if (last === undefined) break;
    board[last] = "";
  }

  // Restore currentPlayer based on history parity
  // X starts each roundStarter
  const movesMade = history.length;
  currentPlayer = movesMade % 2 === 0 ? roundStarter : (roundStarter === "X" ? "O" : "X");

  renderBoard();
  updateStatus();
  saveState();
}

// ===== CPU AI =====
function emptyCells(b) {
  const res = [];
  for (let i = 0; i < b.length; i++) if (b[i] === "") res.push(i);
  return res;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Medium AI: if can win, win; else block; else center; else corner; else random
function mediumMove() {
  const empties = emptyCells(board);

  // Win
  for (const i of empties) {
    const test = deepCopy(board);
    test[i] = "O";
    if (checkWinnerOn(test).winner === "O") return i;
  }

  // Block
  for (const i of empties) {
    const test = deepCopy(board);
    test[i] = "X";
    if (checkWinnerOn(test).winner === "X") return i;
  }

  // Center
  if (board[4] === "") return 4;

  // Corners
  const corners = [0, 2, 6, 8].filter((i) => board[i] === "");
  if (corners.length) return randomChoice(corners);

  // Random
  return randomChoice(empties);
}

// Hard AI: minimax (unbeatable)
function minimax(b, isMaximizing) {
  const { winner } = checkWinnerOn(b);
  if (winner === "O") return { score: 10 };
  if (winner === "X") return { score: -10 };
  if (isDrawOn(b)) return { score: 0 };

  const empties = emptyCells(b);

  if (isMaximizing) {
    let best = { score: -Infinity, move: null };
    for (const i of empties) {
      const next = deepCopy(b);
      next[i] = "O";
      const res = minimax(next, false);
      if (res.score > best.score) best = { score: res.score, move: i };
    }
    return best;
  } else {
    let best = { score: Infinity, move: null };
    for (const i of empties) {
      const next = deepCopy(b);
      next[i] = "X";
      const res = minimax(next, true);
      if (res.score < best.score) best = { score: res.score, move: i };
    }
    return best;
  }
}

function hardMove() {
  const res = minimax(board, true);
  if (res.move === null) return randomChoice(emptyCells(board));
  return res.move;
}

function cpuMove() {
  if (gameOver) return;
  if (mode !== "cpu") return;
  if (currentPlayer !== "O") return;

  const empties = emptyCells(board);
  if (empties.length === 0) return;

  let moveIndex;
  if (difficulty === "easy") moveIndex = randomChoice(empties);
  else if (difficulty === "medium") moveIndex = mediumMove();
  else moveIndex = hardMove();

  makeMove(moveIndex);
}

// ===== CONFETTI =====
let confettiRunning = false;
let confettiPieces = [];
let confettiCtx = null;

function resizeConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function startConfetti() {
  if (!confettiCanvas) return;

  resizeConfetti();
  confettiCanvas.style.display = "block";

  confettiCtx = confettiCanvas.getContext("2d");
  confettiPieces = [];

  const count = 160;
  for (let i = 0; i < count; i++) {
    confettiPieces.push({
      x: Math.random() * confettiCanvas.width,
      y: -Math.random() * confettiCanvas.height * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: -0.15 + Math.random() * 0.3,
      life: 80 + Math.random() * 60,
    });
  }

  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(tickConfetti);
  }

  // auto stop
  setTimeout(stopConfetti, 1200);
}

function stopConfetti() {
  confettiRunning = false;
  if (confettiCanvas) confettiCanvas.style.display = "none";
}

function tickConfetti() {
  if (!confettiRunning || !confettiCtx) return;

  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  for (const p of confettiPieces) {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);

    // No fixed colors: use random grayscale-ish based on x/y
    const shade = Math.floor(120 + (p.x + p.y) % 120);
    confettiCtx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;

    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  }

  confettiPieces = confettiPieces.filter((p) => p.life > 0 && p.y < confettiCanvas.height + 50);

  if (confettiPieces.length === 0) {
    stopConfetti();
    return;
  }

  requestAnimationFrame(tickConfetti);
}

// ===== SETUP / START SCREEN =====
function applySettingsToUI() {
  modeEl.value = mode;
  difficultyEl.value = difficulty;
  bestOfEl.value = String(bestOf);

  soundToggle.checked = soundOn;
  setBodyTheme();

  // Start screen values
  startModeEl.value = mode;
  startDifficultyEl.value = difficulty;
  startBestOfEl.value = String(bestOf);

  playerXNameInput.value = playerXName === "Player X" ? "" : playerXName;
  playerONameInput.value = playerOName === "Player O" ? "" : playerOName;

  updateSubtitle();
}

function openStartScreen() {
  startScreen.classList.remove("hidden");
}

function closeStartScreen() {
  startScreen.classList.add("hidden");
}

function startGameFromStartScreen() {
  // read inputs
  const xVal = (playerXNameInput.value || "").trim();
  const oVal = (playerONameInput.value || "").trim();

  mode = startModeEl.value;
  difficulty = startDifficultyEl.value;
  bestOf = Number(startBestOfEl.value);

  // Names
  playerXName = xVal ? xVal : "Player X";
  if (mode === "cpu") {
    playerOName = "Computer";
  } else {
    playerOName = oVal ? oVal : "Player O";
  }

  setMatchTarget();

  // Reset match because setup changed (more fair)
  matchX = 0;
  matchO = 0;
  draws = 0;

  scoreX = 0;
  scoreO = 0;
  scoreD = 0;

  roundStarter = "X";

  applySettingsToUI();
  updateScoresUI();

  closeStartScreen();
  resetRound(true);
  saveState();
}

// ===== EVENTS =====
cells.forEach((cell) => {
  cell.addEventListener("click", () => {
    const idx = Number(cell.dataset.i);
    makeMove(idx);
  });
});

undoBtn.addEventListener("click", undo);

resetBoardBtn.addEventListener("click", () => {
  resetRound(true); // keep same starter
});

clearAllBtn.addEventListener("click", () => {
  resetMatch();
});

modeEl.addEventListener("change", () => {
  mode = modeEl.value;
  if (mode === "cpu") playerOName = "Computer";
  setMatchTarget();
  updateSubtitle();
  saveState();
  resetMatch();
});

difficultyEl.addEventListener("change", () => {
  difficulty = difficultyEl.value;
  updateSubtitle();
  saveState();
  resetMatch();
});

bestOfEl.addEventListener("change", () => {
  bestOf = Number(bestOfEl.value);
  setMatchTarget();
  updateSubtitle();
  saveState();
  resetMatch();
});

soundToggle.addEventListener("change", () => {
  soundOn = soundToggle.checked;
  saveState();
});

themeToggle.addEventListener("change", () => {
  themeLight = themeToggle.checked;
  setBodyTheme();
  saveState();
});

openStartBtn.addEventListener("click", () => {
  openStartScreen();
});

startBtn.addEventListener("click", startGameFromStartScreen);

nextRoundBtn.addEventListener("click", () => {
  // If match ended, start a new match but keep setup
  const matchEnded = matchX >= matchTarget || matchO >= matchTarget;
  if (matchEnded) {
    matchX = 0;
    matchO = 0;
    draws = 0;
    scoreX = 0;
    scoreO = 0;
    scoreD = 0;
    updateScoresUI();
    roundStarter = "X";
    resetRound(true);
    saveState();
    return;
  }

  resetRound(false); // alternate starter for PvP
});

restartMatchBtn.addEventListener("click", () => {
  resetMatch();
  hideOverlay();
});

window.addEventListener("resize", resizeConfetti);

// ===== INIT =====
loadState();
setMatchTarget();
applySettingsToUI();
updateScoresUI();
updateStatus();
renderBoard();
hideWinLine();
hideOverlay();

// Show start screen if names/setup missing first time
// If user already has saved data, auto-start.
if (!localStorage.getItem(STORAGE_KEY)) {
  openStartScreen();
} else {
  closeStartScreen();
  updateSubtitle();
  saveState();
}
