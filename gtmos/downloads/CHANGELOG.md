# Changelog

All notable changes to GTM OS are documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); this project
intends to follow [Semantic Versioning](https://semver.org/) once past
0.x (see `docs/SUPPORT.md` for the pre-1.0 versioning caveat).

## [0.3.0] — 2026-07-13

The team-operations layer: a daily loop, prompt tuning without forking
code, and a surface for non-terminal roles.

### Added
- `gtmos today` — role-aware daily checklist assembled from stalled deals
  (funnel), audit grade, due/overdue play touches (with copy), unstarted
  targets, and yesterday's activity pulse. `--role` filters to one
  section; missing sources degrade to gaps, never a crash.
- `gtmos play touch` / `gtmos play status` — per-target touch logging and
  due/overdue progress tracking (`gtmos/plays/state.py`), so the state
  file `today` reads tomorrow reflects what actually got sent.
- `gtmos prompts` (`list` / `show` / `export`) — the harness prompt
  registry (`gtmos/prompts.py`) made inspectable and per-workspace
  overridable via `gtmos-prompts.json`, without forking code.
- `gtmos serve` — local, read-only web dashboard (`gtmos/serve/`) for
  non-terminal roles. Reads the same JSON/Markdown artifacts the CLI
  writes. Binds `127.0.0.1:8390` by default; refuses `--host 0.0.0.0`
  unless `--lan` is also passed.
- `docs/TEAM-PLAYBOOK.md` — the daily/weekly/play loop doctrine (trigger,
  process, verify, stop) for all four roles.
- Enterprise doc pack: `docs/PRD.md`, `docs/SUPPORT.md`, `PRIVACY.md`,
  `SECURITY.md`, `LICENSE.md`, `docs/DPA-POSTURE.md`, this changelog.
- `gtmos doctor` — security/environment preflight (python, claude CLI,
  masked token check, workspace, `~/.gtmos` permissions, writable cwd),
  `--json` for machines.
- `gtmos quickstart` — plug-into-CRM onboarding: doctor → init → audit →
  funnel → today in one command, offline (`--contacts`/`--deals`) or live;
  each step fail-safe, partial data still yields partial impact.
- Fail-proof layer: global crash handler (one clean line + full trace to
  `~/.gtmos/errors.log`, never a user-facing traceback), HubSpot fetch
  retry/backoff (429/5xx/network, Retry-After honored, token never echoed),
  atomic play-state writes (`os.replace`), corrupt state files degrade to
  a warning.
- Two new eval checks: `token-hygiene` (AST scan — no token value reaches
  `print`) and `state-atomicity` (regression lock on atomic writes).
- Pre-push gate: `.githooks/pre-push` runs the full test suite + eval
  harness (`git config core.hooksPath .githooks`).

### Notes
- Version string bumped to `0.3.0` in `gtmos/__init__.py` and
  `pyproject.toml`.

## [0.2] — 2026-07-13 — team-complete GTM OS

Took GTM OS from an audit tool to a full-team operating loop. 13
subcommands after this release.

### Added
- `gtmos funnel` — deal-stage revenue-leak analysis: stage table,
  survivorship conversion funnel, stalled-deal detection, and a $-leak
  model (`closed-lost value + 0.5 × stalled open value`, median-imputed
  for unvalued deals). `--portal` (live HubSpot) or `--input` (offline
  JSON); `--stall-days` configurable.
- `gtmos init` / `gtmos team` — workspace scaffolding
  (`gtmos-team.json`, `DOCTRINE.md`, `PLAN.md`, `PLAYS.md`) and config
  get/set (`gtmos team --get team.acv` / `--set team.acv=9000`).
- `gtmos play` (`list` / `show` / `run`) — signal-play library: four
  built-in plays (post-merger, new-revops-hire, hiring-spree,
  compliance-wall), each a 4–5 touch comment-before-DM sequence over
  ~14 days. Planning is deterministic; `--draft` upgrades copy per
  target through the harness, capped at 10 targets per run.
- `gtmos eval` — the eval harness: audit-regression-vs-golden,
  audit-determinism, receipts-log integrity, and a static
  harness-contract scan (fails the build if any `subprocess.*` call is
  found outside `gtmos/harness.py`). `--judge` adds an LLM-graded
  actionability check on the latest audit report.
- `gtmos weekly` — closed-loop weekly ops review: assembles whatever
  exists (audit score, funnel leak, harness receipts activity) into
  `weekly-review.md` with a leak headline and a gaps list; missing
  sources are reported, never fatal.

## [0.1.1] — 2026-07-09 — productize

### Added
- `demo/` — a 500-record deterministic synthetic HubSpot portal
  (`demo/demo-portal.json`) and generator script (`demo/generate_demo.py`)
  for a repeatable, fictional-data demo (grade C, 67.5 composite, 80
  duplicate clusters).
- `docs/OFFER.md` — the $3,000 / 5-business-day CRM Integrity Audit offer,
  guarantee ($30,000 recoverable pipeline or free), and free-teaser terms.
- `plugin/` — a Claude Code plugin/skill distribution tier
  (`crm-integrity-audit` skill, marketplace manifest).

### Also in this release
- `gtmos abm` — 1:1 ABM ad-set plan builder: deterministic account
  planning, LinkedIn-Campaign-Manager-ready page and creative rendering,
  conflict-of-interest lane externalization. `--push` requires a human
  to type approval and `LINKEDIN_ACCESS_TOKEN`; with no live API call
  wired yet, it prints artifacts for manual import into Campaign
  Manager (see `docs/linkedin-api-application.md`).

## [0.1.0] — 2026-07-09 — self-hosted GTM OS CLI

First release. Audit-first, self-hosted, zero-egress positioning
established from commit one.

### Added
- `gtmos audit` — deterministic CRM Integrity Score: five weighted
  dimensions (completeness 0.30, validity 0.25, freshness 0.25,
  ownership 0.10, consistency 0.10), an unreachability score cap, a
  two-tier duplicate-detection pass (exact-email, then fuzzy
  surname+company), and a $-leak model
  (`unreachable_share × total_records × ACV × 2%`). `--portal` (live
  HubSpot, paginated) or `--input` (offline JSON) mode.
- `gtmos prospect`, `gtmos stalk`, `gtmos draft`, `gtmos brief` — the
  first harness (LLM-backed) commands: ICP-matched lead lists, founder
  recon briefs, in-voice content drafting (LinkedIn/X/outreach,
  self-eval gated), and daily GTM briefs. Each accepts `--input` +
  `--dry-run` for a fully offline path.
- `gtmos outcomes` — thin wrapper over the `brain` CLI to log recall
  win/loss/neutral outcomes.
- `gtmos/harness.py` — the single chokepoint for every `claude` CLI
  subprocess call: `MAX_ITERATIONS = 3`, 180s per-call timeout, and a
  receipt (`ts`, `command`, `prompt_chars`, `duration_s`, `exit`)
  written to `~/.gtmos/receipts.jsonl` for every call.
- `docs/integrity-score-methodology.md` — the CRM Integrity Score
  published in full: dimension rubrics, duplicate-detection rules, the
  $-leak model and its stated assumptions.
- `docs/COMPETITIVE.md` — the wedge/parity/deferred capability matrix
  against Baseloop and Oxygen.
- 18 tests, offline-capable (`tests/test_cli.py`, `tests/test_engine.py`).
