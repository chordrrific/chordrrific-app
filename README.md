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

The library shows song cards beside a collapsible metadata filter panel. Click a field or a value to cycle through include, exclude and no filter; use its circle to combine filters without a keyboard. Ctrl (or Command) also combines filters. Pin fields to keep them at the top. A positive collection filter preserves that collection's song order. Use the circle at the top right of each card to select several songs for bulk tag, collection or delete actions; Ctrl-click also works. Click a card to open the full-size viewer, navigate within the current filtered order, or switch to editing. The mobile filter panel opens with the menu button or a swipe from the left edge. The header offers light/dark mode and language choices.

The text filter sits above the metadata filters. It searches titles, directive values, collection names and lyrics with Fuse.js, ignores accents and letter case, and tolerates small spelling mistakes. Its clear icon clears only the text; **Limpiar** clears the text and all metadata filters. The library controls stay visible while song cards scroll. In the song dialog, use the arrow buttons, keyboard arrows (outside text inputs), or horizontal swipe/drag to move through the filtered songs. If the current song has an unsaved edit, navigation offers to save and move or stay in the editor. Cancel, Escape, closing the dialog, or switching to the viewer asks before discarding a changed draft; browser reload and tab close also trigger the browser's unsaved-changes warning. Import results and other library messages appear as dismissible notifications. Non-error toasts disappear after a few seconds; the bell keeps per-user notification history until entries are deleted. "Saved" toasts are transient and do not enter that history. Notifications can be marked read or deleted individually, and the bell panel can clear all notifications after confirmation. Header menus close after choosing an action, opening another menu, or clicking outside.

Song tags come from `{tag: ...}` directives in the saved ChordPro. The tag dialog edits those directives; the database tag relationships are synchronized for API compatibility. The card author uses `{artist}`, then `{composer}`, then `{lyricist}`. Album, year and the filter metadata also come from the ChordPro text. Collections remain database memberships.

Songs store a separate searchable title derived from the required `{title: ...}` directive in their ChordPro text. The short `{t: ...}` form is also accepted when saving, but the editor suggests the full name. The editor uses CodeMirror for syntax highlighting, directive and parameter completion, paired environment highlighting, and formatting; its content remains plain ChordPro. Choose an opening environment directive to insert both tags, then press Tab to move between them. Right-click selected text to wrap complete lines in an environment. The viewer parses with ChordSheetJS in the browser and renders with Svelte. Add a `{key: C}` directive to enable Nashville notation. Transposition and notation changes affect only the view, not the saved text.

The completion catalog covers the directives listed in the ChordPro specification, their recognized abbreviations and the custom bis directives. Completion support does not imply that the current viewer renders every directive (for example, embedded ABC, LilyPond or SVG sections).

Typing `[` in a lyrics line offers chords in English and solfege notation, such as `G / Sol`; choosing one inserts the English form by default. Suggestions cover natural and altered roots plus common chord qualities. `ChordCompletionConfig` in `src/lib/client/chord-completion.ts` controls the primary notation, secondary label and suggested qualities for a future settings UI.

Use **Importar** in the user menu to choose one or more ChordPro files (`.cho`, `.crd`, `.chopro`, `.chord`, `.chordpro`, `.pro` or `.txt`). Each file creates a separate song. Its `{title}` (or `{t}`) becomes the song title; when absent, the filename without its extension is inserted as a `{title: ...}` directive at the start of the saved copy. The app shows imported and failed files individually. Importing reads the original files without changing them.

By default, a `{chorus}` reference appears as "Estribillo" ("Chorus" in English). The label links to the original chorus, and its arrow expands or collapses that reference alone. The viewer can also expand all references by default; this preference is saved in the browser. An unlabelled reference uses the nearest preceding chorus. A named reference such as `{chorus: Chorus 2}` uses the chorus named by `{start_of_chorus: Chorus 2}`. Repeated lyrics are generated only for display and are never written back to the song. The renderer builds a typed preview tree and displays it through Svelte components and snippets; it does not generate or inject HTML.

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

`npm test` runs domain unit tests and SQLite integration tests in a temporary database. GitHub Actions runs these checks, plus a production dependency audit, on feature branches and pull requests.

After validation, pushes to `develop`, `main` and version tags build native AMD64 and ARM64 images and publish a combined image to Docker Hub at `chordrrific/chordrrific`. `develop` publishes `edge` and `develop`; `main` publishes `latest`. A tag such as `v0.1.0` publishes `v0.1.0` and `0.1.0` only when it matches `package.json` and points to a commit on `main`. Every published build also gets a `sha-...` tag. Pull requests and feature branches never publish images. The workflow uses the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.

To check a running app over HTTP, set `SMOKE_BASE_URL`, `SMOKE_EMAIL` and `SMOKE_PASSWORD`, then run `node scripts/smoke-api.mjs`. Use an administrator account; the script creates and removes temporary records.

## Container deployment

A `Dockerfile` is provided for deployment and can be built with Podman. Local development uses `npm run dev` directly. Persist `/app/data` as a volume; run `npm run db:deploy` and, on first setup only, `npm run db:seed` in the container before serving traffic. Supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` only to the seed process. Set `ORIGIN` to the public URL when starting the app container. The container listens on port 3000.

The example [`compose.yaml`](compose.yaml) uses the Docker Hub `edge` image by default, exposes port 3000 and keeps SQLite in a named volume. Set `CHORDRRIFIC_ORIGIN` to the public URL when deploying behind a proxy; `CHORDRRIFIC_PORT` changes the host port, and `CHORDRRIFIC_TAG` selects an image tag such as `latest` or a version. On first deployment:

```sh
docker compose pull
docker compose run --rm chordrrific npm run db:deploy
# Export ADMIN_EMAIL and ADMIN_PASSWORD in the shell before the one-off seed.
docker compose run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD chordrrific npm run db:seed
docker compose up -d
```

For later updates, pull the selected tag, apply migrations, then restart with `docker compose up -d`. The administrator seed is only needed when setting up the first account.

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
