# SoulNotes — Enhancement & Cleanup Backlog

Created 2026-11-12 from a full working session (unit tests, build, live API
smoke). Everything here was verified by touching the code — items marked
"found during testing" are real observations from running the app headless.

## Cleanup

- [x] `config.local.yml` is documented in the README but the loader never read it — **fixed 2026-11-12**: `loadConfig()` now merges `config.local.yml` over the primary `config.yml`.
- [x] Missing-model config pins hang as an ollama PULL — document: verify model pins against `GET /api/tags` (documented in AGENTS.md; consider a startup model-existence check, below).
- [ ] Startup model validation: on boot (or on first call), check configured model names against `GET /api/tags` and surface a clear "model X not configured" error instead of hanging.
- [ ] `config.yml` is not gitignored while it can hold API tokens — add `config.yml` to `.gitignore`, keep `config.example.yml` as the template.
- [ ] STT backend dead in deployment: `speaches_base_url` targets Sarva `:10300`, and Speaches STT has been returning 500s since early October (TTS works). Either fix Speaches STT (ctranslate2/CUDA issue) or swap the transcription backend to a local whisper service.
- [ ] Archive stale plans: `plans/` holds ten design docs (phase1–3, capture-mode fixes, mic-silence analysis…). Move superseded ones into `plans/archive/<year>/` with a one-line status header (done/superseded + date).
- [ ] Route-level tests: `summarize`, `conversation`, `translate`, `meeting-report` have no direct vitest coverage of their request/response contracts — add small route tests against a fake LLM client (pattern exists in `__tests__`).

## Enhancements (high value first)

- [ ] **STT backend for the WS pipeline**: the low-latency WebSocket transcription (Sep 2026) fronts Speaches, whose STT is dead in deployment — make the STT engine swappable (whisper.cpp/local GPU beside Speaches) and add a health check that reports the actual STT state in the UI instead of failing live-capture silently. Also unlocks file-based audio e2e.
- [ ] **File-drop transcription**: accept an audio/video file (or URL) instead of live mic only — reuses the same STT + summarize pipeline, makes the app usable from a phone recording.
- [ ] **Model picker on settings page** populated from `GET /api/tags` (live list, matches what actually exists; see the ollama section in AGENTS.md).
- [ ] **Tauri release pipeline**: CI job that builds the Windows exe (needs a Rust runner); publish artifacts per tag — the README advertises a desktop app but there is no build path recorded.
- [ ] **Session persistence**: conversation sessions survive refresh (currently in-memory store/reload behavior — confirm what survives).
- [ ] **Model-pin pre-flight** (found 2026-11-12): a configured-but-missing ollama model makes ollama attempt a PULL on first call, which reads as an infinite hang in the UI — validate configured models against `GET /api/tags` at boot and show a clear settings error.
- [ ] **Pronunciation page polish**: wire scoring feedback into the gamification DB (xp/streak) consistently with FlashcardReview.
- [ ] **README quick-start audit**: run the README steps on a clean machine path and fix whatever drifted (Docker mount names, port numbers, config keys).

## Notes for humans reviewing this repo

- Tests: `npx vitest run` (414 tests). Build: `npm run build`. LLM features need
  `config.yml` pointed at a live ollama — see AGENTS.md for the Sarva specifics.
- The mic-based flows are the only ones a headless reviewer can't execute —
  everything API-side is curl-able.
