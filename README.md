# VeriHub — LLM Public-Information Audit

> **Regression testing for public information in the AI era.**

VeriHub audits what public LLMs (ChatGPT, Gemini, Claude) say about an organization, checking their answers against the organization's **official sources** — across languages, providers, and repeated runs. The live demo audits a public model on **STIB-MIVB** (the Brussels public-transport operator) in **French and Dutch**.

## Why this matters

LLM answers scale. A single wrong fare, outdated fine amount, or missing deadline can propagate across thousands of interactions and cause real harm: incorrect payments, missed deadlines, extra helpdesk load, and loss of trust. Organizations have no systematic way to know *what the AI says about them* — VeriHub turns "the AI said something wrong" into a measurable, sourced audit.

Crucially, the failures are not just wrong facts. The same model can answer the **same question differently in French and Dutch**, and differently **from one run to the next** — inconsistencies a single-shot, single-language check never sees. VeriHub measures all three.

## What the demo does

1. **Facts & Sources Hub** — verified facts drawn from official STIB-MIVB pages (FR/NL), each with its source URL and verification date.
2. **Question set** — paired FR/NL questions, one per fact (fares, fines, MOBIB card, lost & found, school passes).
3. **Audit run** — a real public model (`gpt-4o-mini`) answers every question, with no access to the sources — exactly as a citizen would ask it. Each question is asked **N times** (default 3) to expose run-to-run instability.
4. **LLM judge** — a stronger model (`gpt-4o`) compares each answer to the official verified value and returns a per-answer verdict — *correct / incorrect / not-stated* plus a groundedness axis — with a human-readable reason (e.g. *"Answer says 7.60 EUR but the official value is 8.50 EUR"*).
5. **Cross-language drift** — an LLM judge compares the FR and NL answers to the same fact and flags where the model tells citizens different things depending on the language they ask in.
6. **Instability** — across the repeated runs, answers whose verdicts disagree (or whose stated values differ) are flagged: the model gave the same citizen different answers to the same question.
7. **Dashboard** — findings by type, severity, and language.

The judge replaces brittle regex scoring: instead of matching strings, it reasons about whether the model's answer actually contradicts the official fact.

## Four audit dimensions

| Dimension | Question it answers | How |
|---|---|---|
| **Correctness** | Does the answer contradict the official value? | LLM judge vs verified fact (hybrid: exact-match precheck → judge) |
| **Groundedness** | Does the answer give a concrete, sourced value at all? | LLM judge |
| **Cross-language drift** | Does the model say different things in FR vs NL? | LLM judge over the FR/NL answer pair |
| **Instability** | Does the model answer the same question differently across repeats? | Verdict disagreement across N runs; LLM tie-break when verdicts agree but stated values differ |

## Latest audit results (STIB-MIVB, FR/NL, N=3)

A single audit of `gpt-4o-mini` over 32 paired FR/NL questions, each asked 3 times:

| Finding type | Count |
|---|---|
| **Incorrect** (contradicts the official value) | 12 |
| **Ungrounded** (no concrete value / no source) | 16 |
| **Drift** (FR and NL answers disagree) | 7 |
| **Instability** (answer changes across repeats) | 9 |

Representative findings:

- **Instability — MOBIB card validity:** asked three times in Dutch, the model answered *"tien jaar" (10 years), "5 jaar", "5 jaar"* — the official value is 5 years, so one in three citizens would get the wrong answer.
- **Drift — MOBIB card validity:** the *same* fact also drifts across languages — FR says *5 ans*, NL says *10 jaar*. The model is inconsistent both between languages and between runs.
- **Drift — daily fare cap:** FR claims a maximum daily charge of *7.50 EUR*; NL says there is *no maximum per day* — a contradiction only visible when both languages are compared.
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
