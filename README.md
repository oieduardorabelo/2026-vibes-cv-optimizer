# CVCV

CV optimization workspace with branch-per-job workflows.

## What It Does

- Store one base CV plus supplementary notes/transcripts.
- Create multiple job branches per pipeline.
- Run AI matrix analysis per branch.
- Generate optimized CV + cover letter from analysis.

## Stack

- Frontend: React + Vite + Tailwind + React Query + React Router
- Backend: H3 + Drizzle ORM + SQLite
- AI: Vercel AI SDK + AWS Bedrock

## Repo Layout

- `client/` React app (default: `http://localhost:5173`)
- `server/` API + SQLite (default: `http://localhost:3001`)

## Prerequisites

- Node.js 20+
- `pnpm`
- AWS credentials with Bedrock access

`mise` users can install runtimes via your local `mise` flow.

## Quick Start

```bash
pnpm -C server install
pnpm -C client install

pnpm -C server run db:migrate

# terminal 1
pnpm -C server run dev

# terminal 2
pnpm -C client run dev
```

Open `http://localhost:5173`.

## Environment

Server reads standard process env vars (no dotenv loader wired by default):

- `AWS_REGION` (default: `ap-southeast-2`)
- `BEDROCK_MODEL_ID` (default set in code)
- Optional AWS credential env vars/profile config required by Bedrock SDK

Reference values: [`server/.env.example`](server/.env.example)

## Scripts

Server (`server/package.json`):

- `pnpm run dev` start API in watch mode
- `pnpm run db:generate` create Drizzle migration files
- `pnpm run db:migrate` apply migrations

Client (`client/package.json`):

- `pnpm run dev` start Vite dev server
- `pnpm run build` build app
- `pnpm run lint` run ESLint
- `pnpm run preview` preview production build

## Notes Before Production/Public Use

- No auth/multi-user isolation yet.
- Data is local SQLite under `server/data/` and now ignored by git.
- Validate AI outputs before use in applications.
