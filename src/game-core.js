const TICK_MS = 1000 / 60;
const SURVIVAL_STEP_MS = 2000;

const ROOM = [
  '############',
  '#P..B....H.#',
  '#..##..#...#',
  '#..E...#B..#',
  '#....##....#',
  '#..H....E..#',
  '#..##..#...#',
  '#....B...H.#',
  '#....#....C#',
  '############',
];

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function parseRoom(rows) {
  const walls = new Set();
  const hearts = new Set();
  const blocks = [];
  const enemies = [];
  let playerSpawn = { x: 1, y: 1 };
  let chest = { x: 10, y: 8 };

  rows.forEach((row, y) => {
    row.split('').forEach((cell, x) => {
      if (cell === '#') walls.add(keyFor(x, y));
      if (cell === 'H') hearts.add(keyFor(x, y));
      if (cell === 'B') blocks.push({ x, y });
      if (cell === 'E') enemies.push({ x, y, dir: 1 });
      if (cell === 'P') playerSpawn = { x, y };
      if (cell === 'C') chest = { x, y };
    });
  });

  return {
    width: rows[0].length,
    height: rows.length,
    walls,
    hearts,
    blocks,
    enemies,
    playerSpawn,
    chest,
    totalHearts: hearts.size,
  };
}

function initialState(levelData, seed = 20260306) {
  return {
    seed,
    score: 0,
    lives: 3,
    level: 1,
    paused: false,
    gameOver: false,
    win: false,
    elapsedMs: 0,
    accumulatorMs: 0,
    survivalMs: 0,
    hitFlashMs: 0,
    player: clone(levelData.playerSpawn),
    enemies: clone(levelData.enemies),
    blocks: clone(levelData.blocks),
    hearts: new Set(levelData.hearts),
    collectedHearts: 0,
    chestUnlocked: false,
    message: 'Collect all hearts to unlock the chest.',
  };
}

export function createGame({ seed = 20260306 } = {}) {
  const levelData = parseRoom(ROOM);
  let state = initialState(levelData, seed);

  function blockIndexAt(x, y) {
    return state.blocks.findIndex((b) => b.x === x && b.y === y);
  }

  function tileBlocked(x, y) {
    if (x < 0 || y < 0 || x >= levelData.width || y >= levelData.height) return true;
    if (levelData.walls.has(keyFor(x, y))) return true;
    if (blockIndexAt(x, y) >= 0) return true;
    return false;
  }

  function applyEnemyStep(enemy) {
    const nextX = enemy.x + enemy.dir;
    const wallAhead = levelData.walls.has(keyFor(nextX, enemy.y));
    const blockAhead = blockIndexAt(nextX, enemy.y) >= 0;
    const chestAhead = nextX === levelData.chest.x && enemy.y === levelData.chest.y;

    if (wallAhead || blockAhead || chestAhead) {
      enemy.dir *= -1;
      return;
    }

    enemy.x = nextX;
  }

  function detectEnemyHit() {
    return state.enemies.some((enemy) => enemy.x === state.player.x && enemy.y === state.player.y);
  }

  function resetActorsAfterHit() {
    state.player = clone(levelData.playerSpawn);
    state.enemies = clone(levelData.enemies);
    state.hitFlashMs = 700;
    state.message = 'Caught by a snakey eye. Positions reset.';
  }

  function collectHeartIfAny() {
    const key = keyFor(state.player.x, state.player.y);
    if (state.hearts.has(key)) {
      state.hearts.delete(key);
      state.collectedHearts += 1;
      state.score += 100;
      if (state.hearts.size === 0) {
        state.chestUnlocked = true;
        state.message = 'Chest unlocked. Reach it!';
      } else {
        state.message = `Heart collected (${state.collectedHearts}/${levelData.totalHearts}).`;
      }
    }
  }

  function maybeFinishLevel() {
    const onChest = state.player.x === levelData.chest.x && state.player.y === levelData.chest.y;
    if (!onChest || !state.chestUnlocked) return;
    state.score += 250;
    state.win = true;
    state.gameOver = true;
    state.message = 'Room complete. Victory! Press R to replay.';
  }

  function movePlayer(dirName) {
    if (state.gameOver || state.paused) return false;
    const dir = DIRS[dirName];
    if (!dir) return false;

    const targetX = state.player.x + dir.x;
    const targetY = state.player.y + dir.y;

    if (targetX === levelData.chest.x && targetY === levelData.chest.y && !state.chestUnlocked) {
      state.message = 'The chest is sealed. Collect all hearts first.';
      return false;
    }

    const blockIdx = blockIndexAt(targetX, targetY);
    if (blockIdx >= 0) {
      const pushX = targetX + dir.x;
      const pushY = targetY + dir.y;
      if (tileBlocked(pushX, pushY)) {
        state.message = 'Block cannot move further.';
        return false;
      }
      state.blocks[blockIdx].x = pushX;
      state.blocks[blockIdx].y = pushY;
      state.player.x = targetX;
      state.player.y = targetY;
      state.message = 'Block pushed.';
      collectHeartIfAny();
      maybeFinishLevel();
      return true;
    }

    if (tileBlocked(targetX, targetY)) {
      state.message = 'Movement blocked.';
      return false;
    }

    state.player.x = targetX;
    state.player.y = targetY;
    state.message = 'Moved.';
    collectHeartIfAny();
    maybeFinishLevel();
    return true;
  }

  function advance(ms = TICK_MS) {
    if (state.gameOver || state.paused) return;

    state.elapsedMs += ms;
    state.accumulatorMs += ms;
    state.survivalMs += ms;

    if (state.hitFlashMs > 0) {
      state.hitFlashMs = Math.max(0, state.hitFlashMs - ms);
    }

    while (state.accumulatorMs >= 250) {
      state.enemies.forEach(applyEnemyStep);
      state.accumulatorMs -= 250;
    }

    if (state.survivalMs >= SURVIVAL_STEP_MS) {
      const bonuses = Math.floor(state.survivalMs / SURVIVAL_STEP_MS);
      state.score += bonuses * 10;
      state.survivalMs -= bonuses * SURVIVAL_STEP_MS;
    }

    if (detectEnemyHit()) {
      state.lives -= 1;
      if (state.lives <= 0) {
        state.lives = 0;
        state.gameOver = true;
        state.win = false;
        state.message = 'No lives left. Press R to restart.';
        return;
      }
      resetActorsAfterHit();
    }
  }

  function reset() {
    state = initialState(levelData, state.seed);
  }

  function togglePause() {
    if (state.gameOver) return;
    state.paused = !state.paused;
    state.message = state.paused ? 'Paused.' : 'Resumed.';
  }

  function getState() {
    return {
      seed: state.seed,
      board: { width: levelData.width, height: levelData.height },
      score: state.score,
      lives: state.lives,
      level: state.level,
      paused: state.paused,
      gameOver: state.gameOver,
      win: state.win,
      elapsedMs: state.elapsedMs,
      hitFlashMs: state.hitFlashMs,
      player: clone(state.player),
      enemies: clone(state.enemies),
      blocks: clone(state.blocks),
      heartsRemaining: [...state.hearts].map((value) => {
        const [x, y] = value.split(',').map(Number);
        return { x, y };
      }),
      heartsCollected: state.collectedHearts,
      heartsTotal: levelData.totalHearts,
      chest: clone(levelData.chest),
      chestUnlocked: state.chestUnlocked,
      message: state.message,
      walls: [...levelData.walls],
    };
  }

  return {
    movePlayer,
    advance,
    reset,
    togglePause,
    getState,
    _debug: {
      blockIndexAt,
      setPlayer(x, y) {
        state.player = { x, y };
      },
      setEnemy(index, x, y) {
        if (!state.enemies[index]) return;
        state.enemies[index].x = x;
        state.enemies[index].y = y;
      },
      collectAllHearts() {
        const remaining = state.hearts.size;
        state.hearts.clear();
        state.collectedHearts = levelData.totalHearts;
        state.score += remaining * 100;
        state.chestUnlocked = true;
        state.message = 'Chest unlocked. Reach it!';
      },
    },
  };
}
