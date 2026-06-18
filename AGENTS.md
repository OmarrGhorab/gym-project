# Repository Guidelines

## Project Structure & Module Organization

This repo contains a Laravel API backend and a Next.js dashboard frontend.

- `backend/`: Laravel 12 API, Sanctum auth, policies, requests, resources, actions, migrations, seeders, and Pest tests.
- `backend/routes/api/*.php`: versioned API route modules.
- `backend/app/Http/Controllers/Api/V1`: API controllers; keep them thin.
- `backend/app/Actions`: business logic for mutations.
- `client/`: Next.js 16 App Router frontend.
- `client/src/app/[locale]`: localized routes.
- `client/src/components`: reusable and feature-specific UI.
- `client/src/lib/api`: typed API fetch helpers.
- `client/src/lib/actions`: Server Actions for mutations.
- `client/messages`: `en.json` and `ar.json` translations.

## Build, Test, and Development Commands

Frontend commands run from `client/`:

- `npm run dev`: start Next.js dev server.
- `npm run typecheck`: run TypeScript checks.
- `npm run lint`: run ESLint.
- `npm run build`: production build.
- `npm test`: currently aliases `typecheck`.

Backend commands run from `backend/`:

- `composer install`: install PHP dependencies.
- `php artisan serve`: run the API locally.
- `php artisan migrate --seed`: apply schema and demo data.
- `composer test` or `php artisan test`: run Pest/PHPUnit tests.
- `vendor/bin/pint`: format PHP code.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and PHP 8.4 style for backend code. Prefer Server Components for data fetching and Client Components only for state, events, forms, dialogs, and browser APIs. Put backend validation in Form Requests and business logic in Actions.

Use kebab-case for frontend files, PascalCase for React components, and descriptive action names such as `CreateSaleAction` or `StoreProduct`. Keep translations in both `en.json` and `ar.json` when adding UI text.

## Testing Guidelines

Backend tests live in `backend/tests` and use Pest. Add feature tests for API behavior and validation, especially for new endpoints. Frontend currently relies on `typecheck`, `lint`, and `build`; run all before shipping UI changes.

## Commit & Pull Request Guidelines

Recent history uses conventional commits, mainly `feat: ...`. Follow that pattern: `feat: add payroll page`, `fix: prevent stale POS products`.

PRs should include a concise summary, changed routes/endpoints, validation notes, screenshots for UI changes, and commands run. Mention any known warnings, such as the existing TanStack Table React Compiler lint warning.

## Security & Configuration Tips

Never expose backend tokens in Client Components. Keep authenticated dashboard fetches uncached unless a safe per-user cache strategy is added. Store environment values in `.env` files and do not commit secrets.

## Agent-Specific Instructions

Do not revert unrelated user changes. Use existing patterns before adding new abstractions. For frontend work, update localization, run `typecheck`, `lint`, and `build`, and verify Server Action cache invalidation for affected pages.
