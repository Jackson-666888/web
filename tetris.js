(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  const COLORS = {
    I: "#3db8c5",
    O: "#e0a04a",
    T: "#7b6bb8",
    S: "#4caf7a",
    Z: "#d15b5b",
    J: "#4a7fd4",
    L: "#d97845",
  };

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  };

  const TYPES = Object.keys(SHAPES);
  const LINE_SCORES = [0, 100, 300, 500, 800];

  const boardCanvas = document.getElementById("tetris-board");
  const nextCanvas = document.getElementById("tetris-next");
  if (!boardCanvas || !nextCanvas) return;

  const boardCtx = boardCanvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  const scoreEl = document.getElementById("tetris-score");
  const linesEl = document.getElementById("tetris-lines");
  const levelEl = document.getElementById("tetris-level");
  const overlayEl = document.getElementById("tetris-overlay");
  const overlayTextEl = document.getElementById("tetris-overlay-text");
  const startBtn = document.getElementById("tetris-start");
  const pauseBtn = document.getElementById("tetris-pause");

  let grid = createGrid();
  let bag = [];
  let current = null;
  let nextType = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropMs = 800;
  let lastDrop = 0;
  let rafId = null;
  let playing = false;
  let paused = false;
  let gameOver = false;

  function createGrid() {
    return Array.from({ length: ROWS }, function () {
      return Array(COLS).fill(null);
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function takeFromBag() {
    if (bag.length === 0) {
      bag = shuffle(TYPES.slice());
    }
    return bag.pop();
  }

  function rotateMatrix(matrix) {
    const n = matrix.length;
    const result = Array.from({ length: n }, function () {
      return Array(n).fill(0);
    });
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        result[x][n - 1 - y] = matrix[y][x];
      }
    }
    return result;
  }

  function spawnPiece(type) {
    const matrix = SHAPES[type].map(function (row) {
      return row.slice();
    });
    return {
      type: type,
      matrix: matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0,
    };
  }

  function collides(piece, offsetX, offsetY, matrix) {
    const m = matrix || piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const nx = piece.x + x + offsetX;
        const ny = piece.y + y + offsetY;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function lockPiece() {
    current.matrix.forEach(function (row, y) {
      row.forEach(function (cell, x) {
        if (!cell) return;
        const gy = current.y + y;
        const gx = current.x + x;
        if (gy < 0) {
          endGame();
          return;
        }
        if (gy < ROWS) grid[gy][gx] = current.type;
      });
    });

    if (gameOver) return;

    clearLines();
    current = spawnPiece(nextType);
    nextType = takeFromBag();
    drawNext();

    if (collides(current, 0, 0)) {
      endGame();
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }

    if (cleared > 0) {
      lines += cleared;
      score += LINE_SCORES[cleared] * level;
      level = Math.floor(lines / 10) + 1;
      dropMs = Math.max(100, 800 - (level - 1) * 70);
      updateStats();
    }
  }

  function hardDrop() {
    if (!playing || paused || gameOver || !current) return;
    let dist = 0;
    while (!collides(current, 0, dist + 1)) dist++;
    current.y += dist;
    score += dist * 2;
    lockPiece();
    updateStats();
    draw();
  }

  function softDrop() {
    if (!playing || paused || gameOver || !current) return;
    if (!collides(current, 0, 1)) {
      current.y += 1;
      score += 1;
      updateStats();
    } else {
      lockPiece();
    }
    draw();
  }

  function move(dx) {
    if (!playing || paused || gameOver || !current) return;
    if (!collides(current, dx, 0)) {
      current.x += dx;
      draw();
    }
  }

  function rotate() {
    if (!playing || paused || gameOver || !current) return;
    if (current.type === "O") return;

    const rotated = rotateMatrix(current.matrix);
    const kicks = [0, -1, 1, -2, 2];
    for (let i = 0; i < kicks.length; i++) {
      if (!collides(current, kicks[i], 0, rotated)) {
        current.matrix = rotated;
        current.x += kicks[i];
        draw();
        return;
      }
    }
  }

  function ghostY() {
    let dist = 0;
    while (!collides(current, 0, dist + 1)) dist++;
    return current.y + dist;
  }

  function drawCell(ctx, x, y, color, alpha, size) {
    const s = size || BLOCK;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x * s + 1, y * s + 1, s - 2, Math.max(2, s * 0.22));
    ctx.globalAlpha = 1;
  }

  function drawBoardBackground() {
    boardCtx.fillStyle = "#1a2332";
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    boardCtx.strokeStyle = "rgba(255,255,255,0.04)";
    boardCtx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      boardCtx.beginPath();
      boardCtx.moveTo(x * BLOCK + 0.5, 0);
      boardCtx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
      boardCtx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, y * BLOCK + 0.5);
      boardCtx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
      boardCtx.stroke();
    }
  }

  function draw() {
    drawBoardBackground();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell) drawCell(boardCtx, x, y, COLORS[cell], 1);
      }
    }

    if (current && !gameOver) {
      const gy = ghostY();
      current.matrix.forEach(function (row, y) {
        row.forEach(function (cell, x) {
          if (!cell) return;
          drawCell(
            boardCtx,
            current.x + x,
            gy + y,
            COLORS[current.type],
            0.22
          );
        });
      });

      current.matrix.forEach(function (row, y) {
        row.forEach(function (cell, x) {
          if (!cell) return;
          drawCell(
            boardCtx,
            current.x + x,
            current.y + y,
            COLORS[current.type],
            1
          );
        });
      });
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = "#1a2332";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextType) return;

    const matrix = SHAPES[nextType];
    const size = 20;
    const w = matrix[0].length * size;
    const h = matrix.length * size;
    const ox = (nextCanvas.width - w) / 2 / size;
    const oy = (nextCanvas.height - h) / 2 / size;

    matrix.forEach(function (row, y) {
      row.forEach(function (cell, x) {
        if (!cell) return;
        const px = ox + x;
        const py = oy + y;
        nextCtx.globalAlpha = 1;
        nextCtx.fillStyle = COLORS[nextType];
        nextCtx.fillRect(px * size + 1, py * size + 1, size - 2, size - 2);
        nextCtx.fillStyle = "rgba(255,255,255,0.18)";
        nextCtx.fillRect(
          px * size + 1,
          py * size + 1,
          size - 2,
          Math.max(2, size * 0.22)
        );
      });
    });
  }

  function updateStats() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
  }

  function showOverlay(text) {
    overlayTextEl.textContent = text;
    overlayEl.hidden = false;
  }

  function hideOverlay() {
    overlayEl.hidden = true;
  }

  function endGame() {
    gameOver = true;
    playing = false;
    paused = false;
    cancelAnimationFrame(rafId);
    rafId = null;
    startBtn.textContent = "再来一局";
    pauseBtn.disabled = true;
    pauseBtn.textContent = "暂停";
    showOverlay("游戏结束");
    draw();
  }

  function reset() {
    grid = createGrid();
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    dropMs = 800;
    gameOver = false;
    paused = false;
    nextType = takeFromBag();
    current = spawnPiece(takeFromBag());
    updateStats();
    drawNext();
    draw();
  }

  function startGame() {
    reset();
    playing = true;
    lastDrop = performance.now();
    hideOverlay();
    startBtn.textContent = "重新开始";
    pauseBtn.disabled = false;
    pauseBtn.textContent = "暂停";
    loop(lastDrop);
  }

  function togglePause() {
    if (!playing || gameOver) return;
    paused = !paused;
    if (paused) {
      cancelAnimationFrame(rafId);
      rafId = null;
      pauseBtn.textContent = "继续";
      showOverlay("已暂停");
    } else {
      pauseBtn.textContent = "暂停";
      hideOverlay();
      lastDrop = performance.now();
      loop(lastDrop);
    }
  }

  function loop(now) {
    if (!playing || paused || gameOver) return;

    if (now - lastDrop >= dropMs) {
      if (!collides(current, 0, 1)) {
        current.y += 1;
      } else {
        lockPiece();
      }
      lastDrop = now;
      draw();
    }

    if (playing && !paused && !gameOver) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function handleAction(action) {
    switch (action) {
      case "left":
        move(-1);
        break;
      case "right":
        move(1);
        break;
      case "down":
        softDrop();
        break;
      case "rotate":
        rotate();
        break;
      case "drop":
        hardDrop();
        break;
    }
  }

  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);

  document.querySelectorAll("[data-tetris]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      handleAction(btn.dataset.tetris);
    });
  });

  document.addEventListener("keydown", function (event) {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (event.key === "p" || event.key === "P") {
      if (playing) {
        event.preventDefault();
        togglePause();
      }
      return;
    }

    if (!playing || paused || gameOver) return;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        move(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        move(1);
        break;
      case "ArrowDown":
        event.preventDefault();
        softDrop();
        break;
      case "ArrowUp":
        event.preventDefault();
        rotate();
        break;
      case " ":
        event.preventDefault();
        hardDrop();
        break;
    }
  });

  showOverlay("按开始");
  draw();
  drawNext();
})();
