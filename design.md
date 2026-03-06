# Design - Adventures of Lolo: Moving Block Puzzles

## Core Loop
- Navigate a small deterministic room while avoiding enemy patrols.
- Push blocks to redirect movement paths and open routes to hearts.
- Collect all hearts, then reach the unlocked chest to clear the level.

## Twist
- Moving-block puzzle routing is central: each room requires at least one strategic block push.

## Determinism
- Fixed level data and fixed enemy patrol rules.
- Simulation advances in deterministic fixed ticks via `window.advanceTime(ms)`.

## Hooks
- `window.advanceTime(ms)` for scripted simulation.
- `window.render_game_to_text()` for JSON state snapshots.
