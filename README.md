# VeriHub — LLM Public-Information Audit

> **Regression testing for public information in the AI era.**

VeriHub audits what public LLMs (ChatGPT, Gemini, Claude) say about an organization, checking their answers against the organization's **official sources** — across languages, providers, and repeated runs. The live demo audits a public model on **STIB-MIVB** (the Brussels public-transport operator) in **French, Dutch, and English**.

## Why this matters

LLM answers scale. A single wrong fare, outdated fine amount, or missing deadline can propagate across thousands of interactions and cause real harm: incorrect payments, missed deadlines, extra helpdesk load, and loss of trust. Organizations have no systematic way to know *what the AI says about them* — VeriHub turns "the AI said something wrong" into a measurable, sourced audit.

Crucially, the failures are not just wrong facts. The same model can answer the **same question differently across French, Dutch, and English**, and differently **from one run to the next** — inconsistencies a single-shot, single-language check never sees. VeriHub measures all of them.

## What the demo does

1. **Facts & Sources Hub** — verified facts drawn from official STIB-MIVB pages, each with its source URL and verification date. Ground truth is the value the organization declares; in this pilot the French version is used as the reference (French is STIB's primary publication language), with Dutch and English audited against it.
2. **Question set** — the same question in FR/NL/EN, one per fact (fares, fines, MOBIB card, lost & found, school passes).
3. **Audit run** — a real public model (`gpt-4o-mini`) answers every question, with no access to the sources — exactly as a citizen would ask it. Each question is asked **N times** (default 3) to expose run-to-run instability.
4. **LLM judge** — a stronger model (`gpt-4o`) compares each answer to the official verified value and returns a per-answer verdict — *correct / incorrect / not-stated* plus a groundedness axis — with a human-readable reason (e.g. *"Answer says 7.60 EUR but the official value is 8.50 EUR"*).
5. **Cross-language drift** — an LLM judge compares the FR / NL / EN answers to the same fact *against the official reference value*, flagging which languages match the truth and which diverge — where the model tells citizens different things depending on the language they ask in.
6. **Instability** — across the repeated runs, answers whose verdicts disagree (or whose stated values differ) are flagged: the model gave the same citizen different answers to the same question.
7. **Dashboard** — findings by type, severity, and language.

The judge replaces brittle regex scoring: instead of matching strings, it reasons about whether the model's answer actually contradicts the official fact.

## Four audit dimensions

| Dimension | Question it answers | How |
|---|---|---|
| **Correctness** | Does the answer contradict the official value? | LLM judge vs verified fact (hybrid: exact-match precheck → judge) |
| **Groundedness** | Does the answer give a concrete, sourced value at all? | LLM judge |
| **Cross-language drift** | Does the model say different things in FR / NL / EN? | LLM judge over all language answers, scored against the official reference value |
| **Instability** | Does the model answer the same question differently across repeats? | Verdict disagreement across N runs; LLM tie-break when verdicts agree but stated values differ |

## Latest audit results (STIB-MIVB, FR/NL/EN, N=3)

A single audit of `gpt-4o-mini` over 48 questions (16 facts × 3 languages), each asked 3 times — 144 model calls:

| Finding type | Count |
|---|---|
| **Incorrect** (contradicts the official value) | 24 |
| **Ungrounded** (no concrete value / no source) | 19 |
| **Drift** (languages disagree vs the reference) | 13 |
| **Instability** (answer changes across repeats) | 16 |

Representative findings:

- **Drift — daily fare cap:** the official value is *8.50 EUR*, but the model quoted a **different wrong price in each language** — FR *7.50 EUR*, NL *5 EUR per ride*, EN *7 EUR*. Three languages, three wrong answers, none matching the source.
- **Drift — MOBIB card validity:** reference *5 years* — FR answered *5 ans* (correct), EN answered *10 years* (wrong), NL hedged. The judge pinpoints which language matches the truth and which diverges, not just that they differ.
- **Instability — MOBIB card validity:** asked three times, the model's verdicts disagreed across repeats — the same citizen would get a different answer depending on when they asked.
- **Incorrect — fine amount:** the model answered *70 EUR*; the official first-offence fine is *107 EUR*.

## Judge calibration

The judge is the core of the product, so its trustworthiness is measured, not assumed. Every answer — including the ones the judge passes as *correct* — gets a stored verdict, so a human can review both what the judge flagged and what it let through.

On a blind human labeling of all 32 answers of one run (the reviewer did not see the judge's verdict):

- **Cohen's kappa = 0.95** (almost-perfect agreement), raw agreement 96.9%.
- **Recall on *correct* = 100%, zero false negatives** — every answer the judge passed, the human also judged correct. This is the metric that matters for a "we catch what you don't notice" product, and precision alone cannot show it.

Both the scorer and the labeled datasets are in the repo (`script/`), so the numbers are reproducible.

## Architecture

```
Question (FR/NL)  ──►  Audited model (gpt-4o-mini, no context)  ──►  Answer  ×N runs
                                                                       │
Official fact (STIB source)  ──►  LLM judge (gpt-4o)  ◄─────────────────┘
                                        │
                          per-answer verdict + Finding (type · severity · reason)
                                        │
              ┌─────────────────────────┼─────────────────────────┐
        Correctness /              Cross-language              Instability
        Groundedness              drift (FR vs NL)          (across N repeats)
```

- **Provider layer** sends the bare question to the audited model (mirrors real citizen usage), repeated N times per question.
- **Judge layer** scores each answer against the verified fact; a cheap exact-match precheck short-circuits obvious correct answers before calling the judge (hybrid evaluation).
- **Drift layer** compares the FR/NL answer pair for the same fact.
- **Instability layer** compares verdicts across the N repeats; when verdicts agree but values might differ, an LLM tie-break decides.
- **Findings** feed the dashboard in a stable schema; severity is risk-weighted by topic (deadlines and fees weigh more than opening hours).

## Tech stack

- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui, TanStack Query
- **Backend:** Express + TypeScript, Drizzle ORM
- **Database:** PostgreSQL (Railway, EU / Amsterdam region)
- **AI:** OpenAI — `gpt-4o` judge, `gpt-4o-mini` audited model

## Live demo

**https://verihub-civic-production.up.railway.app**

## Quick start

```bash
npm install
# Postgres + real audit (requires OPENAI_API_KEY and DATABASE_URL)
DB_MODE=postgres DATABASE_URL="postgres://..." OPENAI_API_KEY="sk-..." npm run dev
```

Open http://localhost:5000 and start an audit run from the **Audit Runs** page (select the `openai` provider). To control repetitions, POST to `/api/audit-runs` with `{"questionSetId":"stib_transport_v1","provider":"openai","repetitions":3}`.

## Tests

```bash
npx vitest run                          # all
npx vitest run server/tests/unit        # unit
npx vitest run server/tests/integration # integration
```
