import './style.css';
import { createGame } from './game-core.js';

const STEP_MS = 1000 / 60;
const app = document.querySelector('#app');
const game = createGame({ seed: 20260306 });
let lastTs = performance.now();
let fixedAccumulator = 0;

app.innerHTML = `
  <main class="shell">
    <header class="header">
      <h1>Adventures of Lolo</h1>
      <p>Moving Block Puzzles</p>
    </header>
    <section class="hud">
      <div><strong>Score</strong><span id="score">0</span></div>
      <div><strong>Lives</strong><span id="lives">3</span></div>
      <div><strong>Hearts</strong><span id="hearts">0/0</span></div>
      <div><strong>Status</strong><span id="status">Ready</span></div>
    </section>
    <section id="board" class="board" aria-label="adventures of lolo board"></section>
    <p class="controls">Move: Arrows/WASD | Pause: P | Reset: R</p>
  </main>
`;

const boardEl = document.querySelector('#board');
const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');
const heartsEl = document.querySelector('#hearts');
const statusEl = document.querySelector('#status');

function entityAt(list, x, y) {
  return list.some((item) => item.x === x && item.y === y);
}

function renderBoard(state) {
  const walls = new Set(state.walls);
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${state.board.width}, 1fr)`;

  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const key = `${x},${y}`;
      if (walls.has(key)) cell.classList.add('wall');
      if (state.chest.x === x && state.chest.y === y) {
        cell.classList.add('chest');
        if (state.chestUnlocked) cell.classList.add('unlocked');
      }
      if (entityAt(state.heartsRemaining, x, y)) cell.classList.add('heart');
      if (entityAt(state.blocks, x, y)) cell.classList.add('block');
      if (entityAt(state.enemies, x, y)) cell.classList.add('enemy');
      if (state.player.x === x && state.player.y === y) {
        cell.classList.add('player');
        if (state.hitFlashMs > 0) cell.classList.add('hit');
      }

      boardEl.appendChild(cell);
    }
  }
}

function render() {
  const state = game.getState();
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  heartsEl.textContent = `${state.heartsCollected}/${state.heartsTotal}`;

  let status = state.message;
  if (state.gameOver) {
    status = state.win ? 'Victory! Press R to replay.' : 'Defeat. Press R to replay.';
  } else if (state.paused) {
    status = 'Paused';
  }

  statusEl.textContent = status;
  renderBoard(state);
}

function step(ms = STEP_MS) {
  game.advance(ms);
  render();
}

function tick(ts) {
  const delta = Math.min(120, ts - lastTs);
  lastTs = ts;
  fixedAccumulator += delta;
  while (fixedAccumulator >= STEP_MS) {
    step(STEP_MS);
    fixedAccumulator -= STEP_MS;
  }
  requestAnimationFrame(tick);
}

function onMove(code) {
  if (code === 'ArrowLeft' || code === 'KeyA') return game.movePlayer('left');
  if (code === 'ArrowRight' || code === 'KeyD') return game.movePlayer('right');
  if (code === 'ArrowUp' || code === 'KeyW') return game.movePlayer('up');
  if (code === 'ArrowDown' || code === 'KeyS') return game.movePlayer('down');
  return false;
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyP') {
    game.togglePause();
    render();
    return;
  }
  if (event.code === 'KeyR') {
    game.reset();
    render();
    return;
  }
  if (onMove(event.code)) {
    render();
  }
});

window.advanceTime = (ms) => {
  const frames = Math.max(1, Math.round(ms / STEP_MS));
  for (let i = 0; i < frames; i += 1) {
    step(STEP_MS);
  }
};

window.render_game_to_text = () => {
  const state = game.getState();
  return JSON.stringify({
    game: 'adventures-of-lolo-moving-block-puzzles',
    paused: state.paused,
    game_over: state.gameOver,
    win: state.win,
    score: state.score,
    lives: state.lives,
    player: state.player,
    chest_unlocked: state.chestUnlocked,
    hearts_collected: state.heartsCollected,
    hearts_total: state.heartsTotal,
    hearts_remaining: state.heartsRemaining,
    enemies: state.enemies,
    blocks: state.blocks,
    elapsed_ms: state.elapsedMs,
    message: state.message,
  });
};

window.__lolo = {
  move(direction) {
    game.movePlayer(direction);
    render();
  },
  getState() {
    return game.getState();
  },
  debugSetPlayer(x, y) {
    game._debug.setPlayer(x, y);
    render();
  },
  debugCollectAllHearts() {
    game._debug.collectAllHearts();
    render();
  },
};

render();
requestAnimationFrame(tick);
