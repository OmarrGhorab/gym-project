# Frontend AGENTS Guide

This file is the frontend constitution for every AI agent working inside `D:\Gym-project\frontend`.

It defines the app shape, coding patterns, design rules, mutation flow, localization discipline, and the non-negotiable logic future agents must follow.

## Scope

- This file applies to everything inside `frontend/`.
- Do not use `client/`. The active frontend lives in `frontend/`.
- When a task touches both frontend and backend, still follow this file for all frontend decisions.

## Stack

- Next.js App Router
- TypeScript
- React 19
- `next-intl` for localization
- Tailwind CSS v4
- shadcn-style UI components in `src/components/ui`
- Server Actions for dashboard mutations where already used
- `serverApiFetch` for backend requests
- Biome for checks and formatting

## Commands

Run these from `frontend/`:

```bash
npm run dev
npm run build
npm run check
npm run lint
npm run format
```

Notes:

- There is no `typecheck` script here unless it is added later.
- Prefer `npm run check` for final frontend validation.

## Folder Map

Use the existing structure. Do not invent a competing organization unless absolutely necessary.

### Main areas

- `src/app/`
  - App Router entrypoints, layouts, pages, route handlers
- `src/app/(main)/dashboard/`
  - Main dashboard product areas like `members`, `plans`, `academy`, `finance`, `crm`, `attendance`, `payroll`, `default`
- `src/app/api/`
  - Next route handlers used as frontend-side proxies/downloaders/helpers
- `src/components/ui/`
  - shared UI primitives
- `src/lib/`
  - auth, API utilities, preferences, session, helpers
- `src/navigation/`
  - sidebar and navigation definitions
- `src/stores/`
  - client state, currently preferences-oriented
- `src/i18n/`
  - intl config and message loading
- `messages/en.json`
- `messages/ar.json`

## Architecture Rules

### 1. Preserve server-first patterns

- Prefer Server Components by default.
- Use Client Components only for interaction, local state, dialogs, forms, browser APIs, transitions, charts needing client runtime, or event handlers.
- Fetch backend data in server-side data helpers when possible.
- Keep page files thin and compose with feature `_components`.

### 2. Follow existing feature conventions

Inside dashboard features, current patterns commonly look like:

- `page.tsx`
- `_components/data.ts`
- `_components/actions.ts`
- UI files per feature

Keep using this shape.

### 3. Do not create parallel data layers

- Use `serverApiFetch` and existing API helpers.
- Reuse `unwrapList`, typed response helpers, and current fetch/result shapes.
- Do not introduce Axios, React Query, Redux Toolkit, or alternate fetching systems.

### 4. Keep mutations aligned with current flow

- For dashboard forms, prefer Server Actions when the feature already uses them.
- After successful mutations, revalidate the exact affected paths with `revalidatePath`.
- Do not use `router.refresh()` as a substitute for proper invalidation.

## UI Constitution

### 1. Respect the existing dashboard design language

- Preserve the current visual system unless the task explicitly asks for redesign.
- Reuse card, table, dialog, badge, select, button, and form components from `src/components/ui`.
- Match current spacing, typography, border, and muted foreground conventions.

### 2. Avoid generic “AI-looking” UI

- Do not add random gradients, flashy colors, or unrelated motion in established pages.
- Fit into the existing admin dashboard tone.
- If adding a new section, make it feel native to this product, not like a pasted template.

### 3. Tables and action-heavy screens

- Prefer explicit actions near the relevant record.
- When adding shortcuts or action items, link to the specific section/action, not just the general page, when feasible.
- For dashboard cards and operational screens, practical clarity matters more than novelty.

### 4. Accessibility

- Use semantic labels and existing form controls.
- Preserve keyboard access for dialogs, forms, buttons, selects, and links.
- Do not remove accessible names for icon buttons.

## Localization Constitution

Localization is mandatory for user-facing text.

### Required rules

- Every new visible string must be added to both:
  - `frontend/messages/en.json`
  - `frontend/messages/ar.json`
- Reuse existing translation namespaces whenever possible.
- Keep key naming consistent with nearby keys.
- Do not leave raw fallback English text in components.
- When editing a localized feature, check for missing message keys before finishing.

### Direction and formatting

- Keep Arabic support intact.
- Avoid layout choices that break RTL.
- Use locale-aware formatting patterns already present in the codebase.

## Forms and Validation

### Frontend

- Prefer `zod` for form input parsing in Server Actions where that pattern already exists.
- Reuse existing `FormField`, `FormSelect`, `FormDatePicker`, `FieldError`, `Input`, `Textarea`, and `Checkbox` patterns.
- Keep error messages actionable and short.

### Backend-aware behavior

- Frontend must respect backend constraints instead of masking them.
- If a backend value is nullable, support that explicitly in the form UX.
- If a backend operation revalidates or computes values automatically, avoid duplicating business rules unless needed for UX.

## Data and Domain Logic Rules

### 1. Do not silently change business meaning

Examples:

- Member plan dates should follow plan logic unless the feature explicitly supports manual override.
- Finance numbers must stay aligned with backend data sources.
- Commissions, payroll, and membership status logic should not be reinterpreted on the frontend.

### 2. Prefer explicit domain naming

Use terms already present in the product:

- member
- subscription
- plan
- employee
- coach
- payroll
- commission
- attendance

Do not rename concepts casually in UI or code.

### 3. Preserve current dashboard relationships

Current important relationships already used in the product include:

- members can have `coach_id`
- subscriptions rely on backend plans
- staff/academy screens manage employees and commissions
- finance/payroll depend on backend-generated totals

New frontend work should align with these relationships, not invent new ones locally.

## Navigation Rules

- Sidebar items live in `src/navigation/sidebar/sidebar-items.ts`.
- Authorization-aware route logic lives in current auth/authorization helpers.
- If hiding a page, also consider:
  - sidebar visibility
  - redirect behavior
  - direct-link access expectations

## When Editing Existing Features

Before changing a feature:

1. Read the page entry.
2. Read the feature `data.ts`.
3. Read the feature `actions.ts` if mutations exist.
4. Read the main UI components involved.
5. Check localization keys for that namespace.

Do not patch blindly.

## Reuse Rules

- Reuse existing components before creating new ones.
- Reuse current option shapes and typed rows where possible.
- Reuse current empty states, badges, status pills, dialogs, and action patterns.
- If two areas already solve the same problem, copy the established product pattern rather than inventing a third version.

## Styling Rules

- Use Tailwind utility classes consistent with nearby code.
- Prefer existing classes and spacing scales from adjacent components.
- Keep code readable; do not collapse giant class strings without reason.
- Avoid inline styles unless the codebase already needs them for that case.

## Anti-Patterns

Do not:

- use `client/` instead of `frontend/`
- add visible strings without updating both locale files
- introduce a second component library
- introduce Axios, React Query, Redux Toolkit, or unrelated state layers
- add `any` when a type can be written reasonably
- bypass existing server actions with ad hoc client fetches for the same mutation
- hardcode route text instead of using translations
- create duplicate business logic that drifts from the backend
- refactor unrelated files just because you touched the area

## Change Discipline

- Keep changes focused and scoped to the requested task.
- Preserve unrelated user changes.
- Do not rename folders or move frontend code unless explicitly requested.
- If a task references “memberships page”, “members page”, “staff page”, or similar, inspect the real current implementation first.

## Validation Before Finishing

For frontend work, the minimum expected check is:

```bash
npm run check
```

If the task is tightly scoped, targeted file checks are acceptable:

```bash
npm run check -- 'path/to/file.tsx'
```

Also verify:

- localization keys exist in both languages
- links/anchors point to the intended section
- dialogs/forms still submit correctly
- revalidation covers affected pages

## Agent Constitution

Every AI agent working in this folder must follow these principles:

1. Read first, then change.
2. Work only in `frontend/`, never `client/`.
3. Localize every user-facing string in both English and Arabic.
4. Reuse existing patterns before inventing new ones.
5. Keep UI consistent with the current dashboard product.
6. Respect backend business logic and data contracts.
7. Prefer small, typed, maintainable changes over broad rewrites.
8. Validate with `npm run check` before finishing whenever feasible.
9. Do not disturb unrelated files or user work.
10. Leave the codebase clearer, not noisier.

