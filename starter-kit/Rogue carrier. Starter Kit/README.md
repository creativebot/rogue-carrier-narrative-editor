# Game context kit

A ready context folder for working on our game with AI agents (Claude Code, Codex, Cursor and others).
It explains the game, the world generator and the economy, and carries the current data and icons, so an agent on
any PC understands the project from the first prompt.

Snapshot: 2026-10-01.

## What is inside

| folder | what |
|---|---|
| `AGENTS.md` | the entry point every agent reads first (Claude Code loads it through `CLAUDE.md`) |
| `docs/` | the game, the world, the economy, game systems, data reference, glossary, item catalogs |
| `data/grid/` | the crafting grid of the game (team prototype); `draft_v14_3_OUTDATED/` holds an old draft rework, see the warning below |
| `data/team_sheet/` | game tables from the team workbook *Economy v0.2* (quests, rewards, events, biomes, crew, traders, settings) |
| `data/world/` | the map generator's current settings |
| `worldgen/` | the map generator as a JS module (same index, same map), a CLI and a browser preview |
| `icons/` | item and building icons, 64/96 px and 256 px, with an index by id |

**Grid v14.3 is an outdated draft.** It no longer matches the game or the current design and is kept only to show
the general direction in which the economy is changing. Agents are told never to use it as a data source.

Not inside on purpose: balance models, price and value calculations, evaluation tools and the designer's working
notes. The kit describes what the game has, not how it is being balanced.

## How to use it

1. Copy the folder next to your project (or into it, for example as `game-context/`).
2. Point your agent at it:
   - **Claude Code:** open the folder, or add it to your session; `CLAUDE.md` loads `AGENTS.md` automatically.
     From another project, add a line `@../game-context/AGENTS.md` to that project's `CLAUDE.md`.
   - **Codex, Cursor and other agents:** they read `AGENTS.md`; if yours does not, start the session with
     "Read game-context/AGENTS.md and follow its reading order."
3. Ask your question or describe your tool. The agent should work from the prototype grid and the team sheet.

Try the generator:

```bash
node worldgen/cli.js map 17
```

```bash
node worldgen/cli.js stats 256
```

Open `worldgen/preview.html` in a browser to see any map.

## Keeping it current

The live sources are the team workbook and the engine. When they change a lot, ask for a new snapshot of this
kit rather than editing the copies by hand; tools built on the kit should read its files, not copy them.
