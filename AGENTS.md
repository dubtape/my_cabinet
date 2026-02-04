# Repository Guidelines

This repository hosts a zero-dependency Node.js and vanilla frontend MVP for a cabinet-style meeting workflow. Keep changes small and consistent with the existing lightweight structure.

## Project Structure & Module Organization
- `server/` contains the HTTP server, API routing, orchestrator logic, and the in-memory store that can be persisted to disk.
- `public/` holds the static SPA assets (`index.html`, `app.js`, `styles.css`).
- `data/` stores runtime persistence in `data/db.json` when the server calls `flush()`.
- `tests/` includes Node.js test files such as `orchestrator.test.js`.

## Build, Test, and Development Commands
- `npm start` runs the server via `node server/index.js` (default port 3000).
- `npm run dev` is the same entry point for local iteration.
- `npm test` runs the built-in Node.js test runner (`node --test`).

## Coding Style & Naming Conventions
- ES modules are enabled (`type: module`); use `import`/`export` and standard Node built-ins.
- Follow existing formatting: 2-space indentation, semicolons, and double quotes for strings.
- Use `camelCase` for variables/functions and `SCREAMING_SNAKE_CASE` for module-level constants.
- No formatter or linter is configured; keep diffs minimal and consistent with nearby code.

## Testing Guidelines
- Tests use the built-in `node:test` and live under `tests/*.test.js`.
- Prefer isolated tests by resetting in-memory state with `resetDb()` before each scenario.
- Name tests with a short ID and expected behavior (see `T1`, `T5` in `tests/orchestrator.test.js`).

## Commit & Pull Request Guidelines
- History shows short, imperative summaries (for example, “Implement cabinet meeting MVP”).
- PRs should include a clear description, how to verify, and any relevant API or UI changes.
- Include screenshots or GIFs for front-end updates and note any changes affecting `data/db.json`.

## Configuration & Data
- Configure the port with `PORT` (PowerShell example: `$env:PORT=4000; npm start`).
- To reset persisted state, delete `data/db.json` while the server is stopped.
