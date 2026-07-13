# Manuskrip — Plan (v1, deployed core)

## One sentence
A local-first writing studio in the browser where a manuscript lives as a tree of small
documents and an offline PUEBI/EYD engine checks Bahasa Indonesia with citable rule ids.

## What ships in v1 (this deployment)
- Three columns: Binder (tree, add/rename/delete/reorder), Editor (plain-text page,
  debounced autosave to IndexedDB), Inspector (metadata, snapshots, cuts, Bahasa panel).
- Never lose a word: autosave on every pause, snapshots (manual + before restore),
  cuts drawer (selection → cuts, restorable), full JSON export/import.
- Bahasa panel (the differentiator): PUEBI/EYD rules engine running fully offline from
  `data/puebi_eyd_rules.json` — kata baku lexicon + regex rules, every finding cites its
  rule id, Terapkan/Abaikan, ignores persist per project, verse mode silences K/P rules.
- Kamus tab: loads a writer-supplied local `kbbi.json` (never bundled — copyright);
  honest empty state when absent. `tools/kbbi_pdf_to_json.py` included.
- Customization: 4 token-based themes, typography controls (family, size, line height,
  measure), all persisted. Zero hard-coded hex outside `tokens.css`.
- Status bar: words, session words, ceiling overage, reading time, save state.
- Command palette (Ctrl/Cmd+K): commands + document jump.

## Decisions
- **Editor is a styled textarea, not contenteditable.** The brief forbids hand-rolled
  contenteditable and vendoring ProseMirror without a network/build step is out of scope
  for v1. A textarea is XSS-proof, undo-safe, and diagnostics run on plain text. Rich
  marks are the first v2 item.
- **No build step, no framework, no runtime CDN.** ES modules + relative paths, so the
  same tree runs on GitHub Pages under `/budiasta/` and on any static host.
- **Deployment: GitHub Pages via Actions** (`.github/workflows/deploy.yml`), uploading
  the repo root. No wrangler: this is a static site in a GitHub repo; Pages is the
  native path and has no `hello world` scaffold to accidentally serve.

## Theme point of view (tokens in styles/tokens.css)
- **Lontar** (default light): warm manuscript paper `#f4efe3`, ink `#26241e`, indigo
  accent `#31456e` — palm-leaf manuscript, not cream+terracotta.
- **Senja** (dark): slate `#1c2026`, amber `#d9a441`.
- **Pantai** (light): cool mist `#eef1f2`, teal `#2b6f6a`.
- **Malam Hujan** (dark): blue-black `#12151c`, rain cyan `#7fb4c9`.

## Cut from v1 (and why)
- Corkboard/outliner/timeline/tension views — need the structural metadata UI first.
- Screenplay/verse formatting engines — mode flag exists; formatting is v2.
- LLM assistant (layer 3) — privacy plumbing must be built carefully, not quickly.
