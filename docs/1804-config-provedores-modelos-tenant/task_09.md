---
status: done
title: Docs .env.example + verificação final lint/build/tsc --noEmit
type: docs
complexity: low
dependencies:
  - task_02
  - task_05
  - task_06
  - task_07
  - task_08
---

# Task 09: Docs `.env.example` + verificação final

## Overview

Documenta as variáveis de ambiente de AI que faltavam no `.env.example`, atualiza a nota sobre o fallback final (agora concentrado em `lib/ai-config.ts`) e roda a trindade de verificação estática (`npm run lint`, `npm run build`, `npx tsc --noEmit`) como evidência fresca de que a feature compila e passa no lint, com a suíte manual por bucket marcada como concluída.

<critical>
- ALWAYS READ the PRD and TechSpec before starting.
- REFERENCE TECHSPEC 'Impact Analysis' (`.env.example` row) and `AGENTS.md` (commands).
- FOCUS ON "WHAT" — document the env vars; run the verification commands; no new code.
- MINIMIZE CODE — none.
- TESTS REQUIRED — the static commands ARE the test.
</critical>

<requirements>
- MUST add to `.env.example`: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` (currently referenced in code but undocumented), with the note that they serve as the final fallback when neither tenant nor system defaults configure that provider.
- MUST note in `.env.example` that `OPENCODE_API_KEY` remains the last-resort fallback in `lib/ai-config.ts` for both chat and PDF extraction.
- MUST NOT remove any existing entries from `.env.example`.
- MUST run `npm run lint`, `npm run build` (typecheck), and `npx tsc --noEmit` and capture the green outputs as evidence.
- MUST confirm `supabase_get_advisors` (security) shows no new high/critical findings introduced by the feature (document the result).
- MUST add a final manual-test checklist reference to `tasks.md` for the per-bucket matrix (already in tasks 02/05/06).
</requirements>

## Subtasks
- [ ] 09.1 Edit `.env.example` to add the three missing AI env vars + the fallback-semantics note.
- [ ] 09.2 Run `npm run lint` and capture green output.
- [ ] 09.3 Run `npm run build` and capture green typecheck output.
- [ ] 09.4 Run `npx tsc --noEmit` and capture green output.
- [ ] 09.5 Run `supabase_get_advisors` (security) and record the findings; remediate any high/critical introduced by the feature (e.g. add RLS to `system_ai_defaults` if missing — already enforced in task_01).
- [ ] 09.6 Append a short "Verification evidence" section to `tasks.md` summarizing the green runs.

## Implementation Details

No code changes; the static commands are the gate. Capture outputs to evidence (terminal transcript). Per `AGENTS.md`, `npm run build` runs typecheck (ESLint is skipped during build by `next.config.ts`), so `npm run lint` must be run separately. No `src/` directory in this project.

### Relevant Files
- `.env.example` — to extend.
- `AGENTS.md` — command reference (`npm run dev`/`build`/`lint`/`clean`).
- `tasks.md` — append verification evidence.

### Dependent Files
- All implementation tasks (02-08) must be merged before final verification.

### Related ADRs
- (none directly; this task is the cross-cutting verification step.)

## Deliverables
- `.env.example` updated with the three AI env vars + fallback note.
- Green transcripts of `npm run lint`, `npm run build`, `npx tsc --noEmit`.
- Security advisor result recorded (no new high/critical findings).
- Verification-evidence section appended to `tasks.md`.

## Tests
- Static (mandatory):
  - [ ] `npm run lint` exits 0.
  - [ ] `npm run build` exits 0.
  - [ ] `npx tsc --noEmit` exits 0.
- Security:
  - [ ] `supabase_get_advisors` (security) shows no high/critical findings introduced by this feature.
- Regression:
  - [ ] App boots in `npm run dev` without runtime errors on `/`, `/settings`, `/admin/users`, `/admin/ai-defaults`.
  - [ ] Per-bucket manual matrix from tasks 02/05/06 re-confirmed green in this final pass.

## Success Criteria
- All three static commands green.
- `.env.example` documents the previously-undocumented AI env vars.
- Security advisor clean for the new objects.
- Verification evidence appended to `tasks.md`; feature ready for manual commit (no auto-commit).