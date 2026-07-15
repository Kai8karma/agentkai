# GTM OS Team Playbook — the loops

One tool, four roles, two loops. Every loop has a trigger, a process, a
verify step, and a stop condition — a loop without all four is a wish.

## The daily loop (every role, ~10 minutes)

**Trigger:** start of working day.

```bash
gtmos today --role <yours>
```

**Process:** work the checklist top to bottom. It is already
priority-ordered: overdue touches first, then by dollar amount at risk.

| role | your section is built from | typical actions |
|---|---|---|
| revops | audit score + stalled deals (funnel) | chase owners of stalled deals, fix worst audit dimension |
| sdr | due/overdue play touches | send the touch, then log it (below) |
| marketing | plays with unstarted targets | launch the next target's sequence, refresh ABM creative |
| founder | leak headline + activity pulse | unblock whoever owns the biggest stalled dollar |

**Verify:** every SDR touch you actually send gets logged, same minute:

```bash
gtmos play touch new-revops-hire --target "Acme" --step 2
```

Unlogged sends corrupt tomorrow's checklist. The state file is the truth.

**Stop:** checklist empty, or timebox (30 min) hit. Do not invent work —
if `today` shows nothing, the correct action is nothing.

## The weekly loop (revops owns it, founder reads it)

**Trigger:** Monday, before standup.

```bash
gtmos audit --portal --out ./audit-out        # refresh CRM integrity
gtmos funnel --portal --out ./funnel-out      # refresh leak model
gtmos eval                                     # harness still honest?
gtmos weekly                                   # assemble the review
```

**Process:** read `weekly-out/weekly-review.md`. The leak headline is the
agenda: one number, where it concentrates, who owns it.

**Verify:** `gtmos eval` exits 0. If it exits 1, the eval report tells you
which check broke — fix before trusting any number in the review.

**Stop:** review written, next actions assigned with owners. One week.

## The play loop (per signal, SDR-owned)

**Trigger:** a signal fires — merger news, new RevOps hire, hiring spree,
security review blocking a cloud vendor.

```bash
gtmos play list                                # pick the play
gtmos play run post-merger --targets targets.json --start-date 2026-07-14
gtmos play status post-merger                  # any morning: what's due
```

**Process:** touches surface in `gtmos today` on their scheduled day,
comment-before-DM order preserved. `--draft` upgrades copy in your voice
(capped at 10 targets per run — deliberate: review before scale).

**Verify:** `play status` shows done-steps advancing; reply → move the
conversation out of the play, log the final touch.

**Stop:** sequence exhausted or reply received. Never extend a sequence
past its last step "just once more" — that is how lists burn.

## Prompt tuning (any role, as needed)

```bash
gtmos prompts list                             # what exists, what's overridden
gtmos prompts export                           # write gtmos-prompts.json
# edit the template you care about, delete the rest
gtmos prompts show draft-outreach              # confirm override is live
```

Overrides live in `gtmos-prompts.json` next to `gtmos-team.json` —
versioned with your workspace, reviewed like code.

## Hard rules (from DOCTRINE.md, enforced by `gtmos eval`)

1. Scores are deterministic — no LLM ever touches a number.
2. Every LLM call goes through the harness chokepoint and leaves a receipt.
3. Unlogged work didn't happen. Log touches, log outcomes.
