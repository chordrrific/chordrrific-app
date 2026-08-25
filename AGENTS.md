# AGENTS.md – Guía para agentes y desarrolladores

## Visión
Chordrrific es la base open‑source que probaremos antes de lanzar MySweetChord (SaaS multi‑tenant). Su arquitectura está separada en capas para que el dominio musical pueda reutilizarse sin depender de UI ni de infraestructura.

## Stack tecnológico
- **Frontend**: SvelteKit + TypeScript (strict) + TailwindCSS
- **Backend**: API SvelteKit + Prisma (SQLite por defecto, migrable a Postgres)
- **Auth**: Lucia Auth (argon2)
- **Parsing**: ChordSheetJS (solo en cliente)

## Arquitectura por capas
```
UI (Svelte) → App/State (stores) → Domain (src/lib/core) → Infra (src/lib/db, src/lib/auth)
```

## Convenciones de código
- TS strict, no `any`
- ESLint + Prettier (Husky + lint‑staged)
- Commits con Conventional Commits → SemVer
- **Los commits siempre se hacen en ramas `feature/*`.** El flujo típico es:
  1. Crear una rama de feature (`git checkout -b feature/<nombre>`).
  2. Realizar cambios y comitearlos.
  3. Abrir un Pull Request contra la rama `develop`.
  4. Después de revisión, mergear a `develop`.
- Feature branches `feature/<nombre>` → PR → `develop` → `main` (release).

## Estructura de directorios
```
src/
├─ lib/
│  ├─ core/        # dominio puro
│  ├─ db/          # Prisma client + repositorios
│  └─ auth/        # Lucia y helpers
├─ routes/
│  ├─ +page.svelte # página mínima
│  └─ api/
│     ├─ auth/
│     ├─ users/
│     └─ songs/
└─ routes/ui/       # UI futura (listado, editor, visor)
prisma/
  schema.prisma
  seed.ts
Dockerfile
README.md
AGENTS.md
```

## Reglas Svelte
- Mantener lógica fuera de componentes.
- Usar `bind:`/`on:`/stores para reactividad.
- Componentes pequeños y composables.

## Base de datos
- SQLite por defecto (`DATABASE_URL=file:./data/chordrrific.db`).
- Cambiar a PostgreSQL editando `.env`.

## Tests
- Unitarios en `src/lib/core/*` (Vitest).
- API integration en `tests/integration/*`.

## Git
- `main` solo recibe merges vía PR desde `develop`.
- Hooks: Husky + lint‑staged + commitlint.
- Tags automáticos con release‑please (opcional).

## Principios que NO deben romperse
1. **Idempotencia del seed** – nunca crear otro admin si ya existe uno.
2. **Separación de dominio** – `src/lib/core/*` sin Prisma, Lucia ni Svelte.
3. **No lógica de negocio en componentes** – usar servicios o core.
4. **DB desacoplada** – cambiar a Postgres solo editando `DATABASE_URL`.
