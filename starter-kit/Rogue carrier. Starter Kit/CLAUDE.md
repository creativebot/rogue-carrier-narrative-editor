@AGENTS.md

## Claude Code notes

- Grid v14.3 (`data/grid/draft_v14_3_OUTDATED/`) is an OUTDATED DRAFT: direction of change only, never a data
  source. The economy of the game is `data/grid/grid_prototype.json` plus `data/team_sheet/`.
- This folder is reference material. Treat it as read-only unless the user asks to update the kit.
- When you build a tool on top of the kit, put it in its own folder (or its own repository) and read the kit's
  data from here, so a new kit snapshot can replace this folder without touching the tool.
- `worldgen/worldgen.js` runs in node (`require`) and in the browser (`<script>`); prefer it over re-implementing
  the generator.
