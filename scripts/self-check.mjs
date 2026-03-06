import assert from 'node:assert/strict';
import { createGame } from '../src/game-core.js';

const game = createGame({ seed: 20260306 });
const start = game.getState();
assert.equal(start.score, 0, 'initial score should be zero');
assert.equal(start.lives, 3, 'initial lives should be three');
assert.equal(start.heartsTotal >= 3, true, 'expected hearts in room');

for (let i = 0; i < 30; i += 1) {
  game.advance(100);
}

const advanced = game.getState();
assert.equal(advanced.elapsedMs > 0, true, 'elapsed time should advance');
assert.equal(advanced.score >= 10, true, 'survival score should increase deterministically');

game.togglePause();
const paused = game.getState();
game.advance(1000);
assert.equal(game.getState().elapsedMs, paused.elapsedMs, 'paused state should freeze simulation');

console.log('self-check passed');
