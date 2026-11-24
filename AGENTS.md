# AGENTS.md — Chordrrific

Chordrrific is the public, open-source ChordPro songbook app. MySweetChord is a future private project in a separate repository. Keep the music domain reusable and free of framework and storage dependencies.

## Stack and layout

- SvelteKit + TypeScript strict + Tailwind CSS; Node adapter.
- Prisma + SQLite only. `DATABASE_URL` is a SQLite `file:` URL; PostgreSQL is a future migration, not an environment-only switch.
- Passwords: argon2. Sessions: application code based on Lucia's current guides; do not add the deprecated Lucia package.
- ChordSheetJS runs in the browser only for parsing and music transformations. Render parsed content through escaped Svelte text nodes; do not use its HTML formatters or raw HTML.
- Vitest for unit and SQLite integration tests.

```
src/lib/core/          pure domain logic
src/lib/server/        Prisma, sessions, application services
src/lib/client/        UI state, translations and API client
src/lib/components/    small UI components
src/routes/api/        thin SvelteKit API endpoints
prisma/                schema, migration history and manual seed
```

UI → client state → application services → core / infrastructure. Do not put business rules in Svelte components. Do not import Svelte, Prisma or authentication code into `src/lib/core`.

## Invariants

1. The manual seed creates an administrator only if no `isAdmin` user exists. It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment and has no default password.
2. Never delete or demote the last administrator.
3. Every song, collection and tag belongs to one user. Always verify ownership in server services, including relationship updates. Deleting a user cascades to all their data and sessions.
4. A song may be in several collections; ordering belongs to the collection membership, not the song.
5. Store original ChordPro in `Song.content` and the searchable title separately. Transposition and notation changes are view-only.
6. SQLite is the only supported database for this version. Do not claim provider portability from `DATABASE_URL` alone.
7. `{chorus}` references are presentation only. By default show a localized label; expanded mode copies the targeted chorus into the view without changing saved ChordPro. Unlabelled references use the nearest preceding chorus; named references match the chorus label.
8. `x_start_of_bis` and `x_end_of_bis` are custom presentation directives. They can appear inside verses or choruses; all other `x_` directives are ignored. Preserve their content when expanding a chorus. Escape the optional label in Svelte and keep marker text and styles configurable in code.

## Workflow

- Use strict TypeScript; no `any`.
- Run `npm run check`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` for relevant changes.
- Use Prettier and ESLint; Husky runs lint-staged and commitlint.
- Commit only on `feature/*` branches with Conventional Commits. Open PRs to `develop`; release to `main` through a PR. Do not commit directly to `develop` or `main`.
- The current feature branch was initially committed under an older identity. The user has authorized using the current identity for local commits and will revise author metadata before publication.
- Do not run the seed automatically from `postinstall` or app startup. Apply migrations first, then run `npm run db:seed` manually.

## Testing and local development

Run directly with Node locally (`npm run dev`). Podman is available for container smoke tests; the container is for deployment, not a local development requirement. Keep SQLite files in `data/` and out of Git.
