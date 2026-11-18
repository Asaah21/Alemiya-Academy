# Alemiya Academy School Management System

Version 1 of a simple school system for a small basic school (Creche to JHS 3): students, weekly student attendance, daily staff attendance, results and report cards, cash fees with receipts, parent portal, and term reports.

**The build plan is the source of truth:** https://claude.ai/artifact/CfQmuD4oXb1DU3QFN46rip
Read sections 1 to 7 and 10 before changing anything. Pick a task from the Task Tracker (section 8), mark it In progress, and add a Handoff Log row (section 9) when you finish.

## Stack

React, Vite, TypeScript, Tailwind CSS, React Router, Supabase (database, login, row-level security), Netlify (hosting and functions).

## Run it locally

```bash
npm install
cp .env.example .env.local     # then paste the Supabase public (anon) key into .env.local
npm run dev                    # open the address it prints
npm test                       # run the rule tests
npm run build                  # type-check and build into dist/
```

## Database setup (T02)

The database tables are defined in `supabase/migrations/` (seven numbered files). For a new, empty Supabase project:

1. Open Supabase, then **SQL Editor > New query**.
2. Open `supabase/run_all.sql` in this repository, copy everything, paste it into the editor, and click **Run**.
3. Check it worked: **Table Editor** should list 23 tables, each marked "RLS enabled". Or run `select count(*) from information_schema.tables where table_schema = 'public';` and expect 23.

Row-level security is switched on with no policies, so the browser can read and write nothing until the access rules are added in T03. That is intended.

Changing the database later: add a new numbered file in `supabase/migrations/`, run `npm run db:bundle`, and run only the new file in Supabase. Run `npm test`: `supabase/tests/schema.test.ts` applies every migration to a local test database and checks the rules (A4 days absent, score limits, payments never edited or deleted, no deletions, history of corrections).

## Environment variables

| Name | Where to find it | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API > Project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase > Project Settings > API > `anon` public key | No (protected by row-level security) |

Set both in Netlify under Site configuration > Environment variables. **Never** put the `service_role` key in this repository, in front-end code or in chat. It belongs only in Netlify environment variables used by functions in `netlify/functions/`.

## Folder layout

```
src/features/       one folder per module: setup, students, attendance, staff-attendance,
                    results, report-cards, fees, reports, parent
src/lib/            shared calculations and their tests (attendance, totals, grades, positions,
                    balances, turnover). Every business rule in the plan gets a test.
src/pages/          screens
supabase/migrations/  database changes, in order (one numbered file per change)
supabase/run_all.sql  generated: all migrations in one file for the first setup
supabase/tests/       database tests (schema, rules, later access rules)
scripts/              helper scripts (npm run db:bundle)
netlify/functions/    server code (invites, parent access codes, parent login)
```

## Working rules

- One branch per task, named with the task ID, for example `T02-database-tables`.
- Every task ends in a working app: `npm test` and `npm run build` must pass.
- No secrets in code. Records are never deleted; they are voided with a reason.
- Do not change a decision or business rule from the plan without owner approval.
