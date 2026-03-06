import assert from 'node:assert/strict';
import { createGame } from '../src/game-core.js';

function findHorizontalPushableBlock(state) {
  const occupied = new Set([
    ...state.walls,
    ...state.blocks.map((block) => `${block.x},${block.y}`),
  ]);

  for (const block of state.blocks) {
    const left = `${block.x - 1},${block.y}`;
    const right = `${block.x + 1},${block.y}`;
    const right2 = `${block.x + 2},${block.y}`;
    if (!occupied.has(left) && !occupied.has(right2)) {
      return {
        playerStart: { x: block.x - 1, y: block.y },
        direction: 'right',
        blockStart: { x: block.x, y: block.y },
      };
    }
    const left2 = `${block.x - 2},${block.y}`;
    if (!occupied.has(right) && !occupied.has(left2)) {
      return {
        playerStart: { x: block.x + 1, y: block.y },
        direction: 'left',
        blockStart: { x: block.x, y: block.y },
      };
    }
  }

  throw new Error('No pushable block found in test map');
}

function testDeterministicState() {
  const gameA = createGame({ seed: 20260306 });
  const gameB = createGame({ seed: 20260306 });

  assert.deepEqual(gameA.getState().blocks, gameB.getState().blocks, 'blocks should be deterministic');
  assert.deepEqual(gameA.getState().enemies, gameB.getState().enemies, 'enemies should be deterministic');
  assert.deepEqual(gameA.getState().heartsRemaining, gameB.getState().heartsRemaining, 'hearts should be deterministic');
}

function testPushAndCollisionRules() {
  const game = createGame({ seed: 2 });
  const initial = game.getState();
  const puzzle = findHorizontalPushableBlock(initial);

  game._debug.setPlayer(puzzle.playerStart.x, puzzle.playerStart.y);
  const moved = game.movePlayer(puzzle.direction);
  assert.equal(moved, true, 'player should be able to push block');

  const after = game.getState();
  const movedBlock = after.blocks.find((block) => block.x !== puzzle.blockStart.x || block.y !== puzzle.blockStart.y);
  assert.ok(movedBlock, 'one block should have moved');
}

function testScoringPauseResetAndHooks() {
  const game = createGame({ seed: 2 });
  const before = game.getState();

  game.advance(2200);
  const afterBonus = game.getState();
  assert.ok(afterBonus.score >= before.score + 10, 'survival bonus should increase score');

  game.togglePause();
  const pausedState = game.getState();
  game.advance(1000);
  assert.equal(game.getState().elapsedMs, pausedState.elapsedMs, 'paused game should not advance elapsed time');

  game.togglePause();
  game.advance(300);
  assert.ok(game.getState().elapsedMs > pausedState.elapsedMs, 'unpaused game should advance elapsed time');

  game.reset();
  const reset = game.getState();
  assert.equal(reset.score, 0, 'reset should clear score');
  assert.equal(reset.lives, 3, 'reset should restore lives');
  assert.equal(reset.heartsCollected, 0, 'reset should clear collected hearts');
}

function run() {
  testDeterministicState();
  testPushAndCollisionRules();
  testScoringPauseResetAndHooks();
  console.log('game-core tests passed');
}

run();
