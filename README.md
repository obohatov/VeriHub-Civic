# VeriHub — LLM Public-Information Audit

> **Regression testing for public information in the AI era.**

VeriHub audits what public LLMs (ChatGPT, Gemini, Claude) say about an organization, checking their answers against the organization's **official sources** — across languages. The live demo audits a public model on **STIB-MIVB** (the Brussels public-transport operator) in **French and Dutch**.

## Why this matters

LLM answers scale. A single wrong fare, outdated fine amount, or missing deadline can propagate across thousands of interactions and cause real harm: incorrect payments, missed deadlines, extra helpdesk load, and loss of trust. Organizations have no systematic way to know *what the AI says about them* — VeriHub turns "the AI said something wrong" into a measurable, sourced audit.

## What the demo does

1. **Facts & Sources Hub** — verified facts drawn from official STIB-MIVB pages (FR/NL), each with its source URL and verification date.
2. **Question set** — paired FR/NL questions, one per fact (fares, fines, MOBIB card, lost & found, school passes).
3. **Audit run** — a real public model (`gpt-4o-mini`) answers every question, with no access to the sources — exactly as a citizen would ask it.
4. **LLM judge** — a stronger model (`gpt-4o`) compares each answer to the official verified value and returns a verdict — *correct / incorrect / ungrounded* — with a human-readable reason (e.g. *"Answer says 7.60 EUR but the official value is 8.50 EUR"*).
5. **Dashboard** — findings by type, severity, and language.

The judge replaces brittle regex scoring: instead of matching strings, it reasons about whether the model's answer actually contradicts the official fact.

## Latest audit results (STIB-MIVB, FR/NL)

A single audit of `gpt-4o-mini` over 32 paired FR/NL questions:

| Finding type | Count |
|---|---|
| **Incorrect** (contradicts the official value) | 15 |
| **Ungrounded** (no concrete value / no source) | 13 |
| **Total** | 28 |

Representative findings:
- Ticket validity: the model answered *60 minutes*; the official value is *18 months* (confused validity with the transfer window).
- Fine amount: the model answered *70 EUR*; the official first-offence fine is *107 EUR*.
- The model repeatedly hedged with *"as of my last update in October 2023"* — a direct illustration of stale AI knowledge about a real operator.

## Architecture

```
Question (FR/NL)  ──►  Audited model (gpt-4o-mini, no context)  ──►  Answer
                                                                       │
Official fact (STIB source)  ──►  LLM judge (gpt-4o)  ◄─────────────────┘
                                        │
                                     Finding (type · severity · reason)
```

- **Provider layer** sends the bare question to the audited model (mirrors real citizen usage).
- **Judge layer** scores the answer against the verified fact; a cheap exact-match precheck short-circuits obvious correct answers before calling the judge (hybrid evaluation).
- **Findings** feed the dashboard in a stable schema.

## Tech stack

- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui, TanStack Query
- **Backend:** Express + TypeScript, Drizzle ORM
- **Database:** PostgreSQL (Railway, EU / Amsterdam region)
- **AI:** OpenAI — `gpt-4o` judge, `gpt-4o-mini` audited model

## Live demo

**[deployment URL — to be added]**

## Quick start

```bash
npm install

# Postgres + real audit (requires OPENAI_API_KEY and DATABASE_URL)
DB_MODE=postgres DATABASE_URL="postgres://..." OPENAI_API_KEY="sk-..." npm run dev
```

Open http://localhost:5000 and start an audit run from the **Audit Runs** page (select the `openai` provider).

## Tests

```bash
npx vitest run                         # all
npx vitest run server/tests/unit       # unit
npx vitest run server/tests/integration # integration
```

## Roadmap — target product

This demo is a working **vertical slice**. The full product (separate repository, Python/FastAPI) extends it with:

- **RAG-powered Hub** — automated ingestion & retrieval of official sources. Working prototype: [stib-rag-assistant](https://github.com/obohatov/stib-rag-assistant)
- **Run matrix** — multiple providers × languages × repetitions
- **FR/NL drift & instability** detection across repeated runs
- **Human review queue** and before/after remediation reports

## Data & sources

Facts are sourced from official STIB-MIVB pages (FR/NL versions), snapshotted with source URLs and verification dates. STIB is used as a realistic public-organization example; VeriHub is not affiliated with STIB-MIVB.
