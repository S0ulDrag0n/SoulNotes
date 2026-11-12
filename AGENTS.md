# SoulNotes — Agent Context

Everything below is working knowledge for future agents (and for Andy).
Verify against the code before relying on a detail — this file was last
reconciled with the tree on 2026-11-12.

## What this app is

A speech/learning studio: live microphone transcription, real-time
translation, meeting summaries, an AI conversation partner, and a
spaced-repetition vocabulary flashcard system. Shipped as a Next.js web app
and wrapped as a Windows desktop app via Tauri (`src-tauri/`).

## Stack

- **Next.js** (web + API routes) with **Tailwind v4**
- **Tauri** (Rust) for the desktop shell — Rust toolchain is NOT available in
  the Hermes sandbox; web-side work only, `next build` + `vitest` are the
  local gates
- **Speaches** (faster-whisper) for STT — `speaches_base_url` in config; the
  deployment currently points at Sarva `:10300`, whose STT endpoints are
  broken as of Oct 2026 (TTS/Kokoro works). Live transcription accordingly
  does not work until Speaches STT is fixed or the backend is swapped.
- **Ollama** for LLM work (translate/summarize/conversation). On Sarva, the
  native ollama is `10.61.46.95:10102` (models: aya-expanse, llava,
  minicpm-v locally; deepseek-v4.1-flash:cloud, glm-5.3-flash:cloud,
  glm-5.3:cloud, kimi-k3.1-pro:cloud via ollama.com). The llama-swap proxy on
  `:10101` serves a different 19-model list (Qwen3.x, Gemma4, Kat-Coder…) —
  do not mix the two model names.
- Tests: **vitest** (web). No e2e framework yet.

## Config model (important)

- `config.example.yml` is the committed template; the loader reads
  `config.yml` (first of: repo root, `config/`, `/app/data/config.yml`) and,
  since 2026-11-12, merges `config.local.yml` over it for machine-local
  overrides (`config.local.yml` is gitignored; `config.yml` is NOT — never
  commit tokens in it).
- `config.yml` is machine-local and uncommitted — don't `git add` it.
- Env vars override config (`LLM_PROVIDER`, `OLLAMA_BASE_URL`, …) — see
  `buildLLMConfig()` in `src/lib/llm-client.ts`.
- If a configured ollama model does not exist on the server, ollama attempts
  to PULL it on first call — that looks like an infinite hang rather than an
  error. After changing pins, verify against `GET /api/tags` on the ollama
  host before assuming the app is broken.
- Auth semantics are house-convention: routes call `requireAuth`/`requireUser`
  which THROW `AuthError`; every `catch` must translate `error instanceof
  AuthError` into `error.statusCode` (see `src/app/api/board/route.ts` for
  the canonical shape).

## Verified working (2026-11-12)

- `npx vitest run`: 27 files, 414 tests green
- `npm run build`: clean (Next static export + Tauri static copy)
- Live API smoke through `next dev` with `config.yml` pointed at Sarva:
  `POST /api/translate` ja→en via `deepseek-v4.1-flash:cloud` returns natural
  English in <1s

## Test locally (what works headless)

```
npm ci && npx vitest run && npm run build
npx next dev -p 3457   # then curl the /api/* routes
```

The microphone path (getUserMedia) cannot be exercised from a headless
sandbox — audio needs a human at the wheel.
