# WeChat Mini Program Agent Rules

These rules apply to `apps/miniprogram/**` and extend the repository-root `AGENTS.md`.

## Continuity and scope

1. At the start of every implementation conversation, read the root `docs/project-status.md`, inspect Git state/history/remotes, and read the exact active section of `docs/plans/2026-08-17-wechat-miniprogram-migration-plan.md` plus every linked architecture, design, testing, runbook, or ADR file implicated by the batch.
2. Complete only 1–3 tasks per conversation. Use one task for security, identity, privacy, concurrency, deployment, or complex calendar/gesture work.
3. Keep detailed Mini Program state in this directory. The root status file contains only the active batch, validation, checkpoint, blockers, and links.
4. Treat pre-existing changes outside the active batch as user-owned. Stage explicit paths only; never use `git add .`.

## Hard prohibitions

- An LLM must never start, wake, restart, control, or automate the local WeChat DevTools GUI or its CLI.
- Do not restore the historical Mini Program implementation as a whole. Historical code may only be consulted for isolated algorithms, fixtures, test ideas, and CI wrapper patterns after revalidation against the current Web/API.
- Do not add TDesign MiniProgram or another third-party UI component library.
- Do not add WebView fallback, uni-app, or an H5 runtime as the production Mini Program implementation.
- Do not place AppSecret, CI upload private keys, tokens, sessions, private project settings, screenshots, QR codes, or production data in Git.
- Do not make an unrecorded product, security, privacy, public API, or compatibility choice. Stop and ask the user when a new material choice is not resolved by the approved plan or an ADR.

## Allowed automation and release authority

- Local Node-based `miniprogram-ci`, `miniprogram-simulate`, static builds, tests, package audits, and visual comparison scripts are allowed without opening WeChat DevTools.
- Development/preview and experience uploads may be automated when credentials are available outside the repository.
- Submission for review and formal publication always require explicit user approval.
- ECS deployment remains the repository-root release track. A Mini Program upload is a separate track and never happens merely because Git/ECS advanced.

## Visual work

- Every visual batch must use the `frontend-design` skill and state its design intent before implementation.
- Web Storybook remains the golden design source. Map each Mini Program page/state to a story, fixture, viewport, and MiniTest screenshot in `docs/design/page-golden-manifest.md`.
- Obtain user confirmation for each page after the 390×844 golden and 320px boundary are ready, before native WXML/WXSS implementation.
- Validate stable regions with the project comparator: similarity ≥98%, significant differing pixels ≤2%, and key geometry deviation ≤2px. Mask only recorded dynamic native regions.

## Runtime and code boundaries

- Production pages use native WXML, WXSS, TypeScript, JSON, Skyline, and glass-easel. Minimum base library is 3.0.2; there is no WebView fallback.
- Source lives in `src/`; generated output lives in ignored `dist/`. Do not hand-edit `dist/`.
- Shared runtime code must be DOM-free, Node-free, database-free, and Zod-free in the Mini Program bundle.
- Preserve `'worklet'` as the first statement of each Worklet function and run the Worklet output audit after every relevant build change.
- Write requests are retried only when protected by a valid idempotency key. Offline mode is read-only and has no write queue.

## Checkpoints

- Run the root gates plus the Mini Program static, simulate, boundary, Worklet, determinism, secret, and package-size gates required by the active phase.
- Update the root status before a checkpoint, review both unstaged and staged diffs, stage explicit task paths, commit, push, and follow the repository ECS backup/deploy/verify rule.
- Never claim native visual or interaction acceptance from Storybook, `miniprogram-simulate`, or `miniprogram-ci`; only MiniTest and agreed physical devices provide native-runtime evidence.
