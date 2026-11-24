# Chordrrific

Open-source songbook manager for ChordPro. Each account has a private library of songs, ordered collections and tags. The interface is available in Spanish and English.

## Requirements

- Node.js 24 and npm
- SQLite (managed through Prisma; no separate server required)

## Run locally

```sh
npm ci
cp .env.example .env
# Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before the first seed.
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open the URL printed by Vite. The seed creates an administrator only when no administrator exists; rerunning it does not reset credentials. Passwords must contain at least 12 characters. The SQLite file defaults to `data/chordrrific.db` and is ignored by Git. `DATABASE_URL` must be a SQLite `file:` URL.

For a production build, run `npm run build` and then `node build`. Set `ORIGIN` to the public URL when serving plain HTTP or using a reverse proxy (for example, `ORIGIN=http://localhost:3000 node build` for a local preview). Apply migrations with `npm run db:deploy` before starting a new version. The seed is always a separate manual step.

## Using the app

An administrator creates accounts, can grant administrator access and can reset passwords. The last administrator cannot be deleted or demoted. Users can change their own passwords. Deleting an account deletes its songs, collections, tags and sessions.

Songs store a separate searchable title and the original ChordPro text. The editor accepts plain text; the viewer parses it with ChordSheetJS in the browser and renders it with Svelte. Add a `{key: C}` directive to enable Nashville notation. Transposition and notation changes affect only the view, not the saved text.

Use **Importar canción/es** to choose one or more ChordPro files (`.cho`, `.crd`, `.chopro`, `.chord`, `.chordpro`, `.pro` or `.txt`). Each file creates a separate song. Its `{title}` (or `{t}`) becomes the song title; when absent, the filename without its extension is used. The app shows imported and failed files individually. Importing reads the original files without changing them.

By default, a `{chorus}` reference appears as "Estribillo" ("Chorus" in English). The viewer can instead expand the referenced chorus; this preference is saved in the browser. An unlabelled reference uses the nearest preceding chorus. A named reference such as `{chorus: Chorus 2}` uses the chorus named by `{start_of_chorus: Chorus 2}`. Repeated lyrics are generated only for display and are never written back to the song.

The custom `x_` directives below mark a passage to repeat. Both attributes are optional:

```chordpro
{x_start_of_bis repeat="2" label="Tenores"}
[E]Sing this passage again.
{x_end_of_bis}
```

The viewer draws a rounded bracket to the right. Without `repeat`, it shows `(bis)`; with a positive integer, it shows `(x2)`, `(x3)` and so on. `label` appears beneath the repeat marker as escaped text. Bis blocks may be nested once (two levels total); the outer bracket encloses the inner block and appears farther right. A third level is reported as a preview error. Marker wording is defined by `BisDisplayConfig` in `src/lib/client/song-preview.ts`; the bracket and text styles use `--bis-*` CSS variables in `src/routes/layout.css` for future customization. Other `x_` directives are ignored.

A song may belong to several collections. Every collection has its own song order. Songs and their tags and collections are private to their owner.

## Quality checks

```sh
npm run check
npm run lint
npm run format:check
npm test
npm run build
```

`npm test` runs domain unit tests and SQLite integration tests in a temporary database. GitHub Actions runs the same checks on feature branches and pull requests.

To check a running app over HTTP, set `SMOKE_BASE_URL`, `SMOKE_EMAIL` and `SMOKE_PASSWORD`, then run `node scripts/smoke-api.mjs`. Use an administrator account; the script creates and removes temporary records.

## Container deployment

A `Dockerfile` is provided for deployment and can be built with Podman. Local development uses `npm run dev` directly. Persist `/app/data` as a volume; run `npm run db:deploy` and, on first setup only, `npm run db:seed` in the container before serving traffic. Supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` only to the seed process. Set `ORIGIN` to the public URL when starting the app container. The container listens on port 3000.

For a local Podman check, after setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your shell:

```sh
podman build -t chordrrific:local .
podman volume create chordrrific-data
podman run --rm -v chordrrific-data:/app/data:Z chordrrific:local npm run db:deploy
podman run --rm -v chordrrific-data:/app/data:Z -e ADMIN_EMAIL -e ADMIN_PASSWORD chordrrific:local npm run db:seed
podman run --rm -p 3000:3000 -v chordrrific-data:/app/data:Z -e ORIGIN=http://localhost:3000 chordrrific:local
```

Open `http://localhost:3000`. Use the same volume for each command so migrations, the administrator and application data share one SQLite database.

## Architecture

`src/lib/core` contains pure domain validation without Svelte, Prisma or authentication dependencies. `src/lib/server` contains SQLite access, sessions and application services. SvelteKit API routes expose these services. The UI uses the API, and ChordSheetJS is loaded only in the browser for parsing and music transformations. The viewer builds safe Svelte text nodes from the parsed song. MySweetChord is a future separate private repository; this repository has no tenant model.

## Contributing

Work on a `feature/*` branch, use Conventional Commits and open a pull request to `develop`. Releases reach `main` through pull requests. The project is licensed under ISC; see [LICENSE](LICENSE).
