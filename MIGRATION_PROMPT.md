# 🔄 Migration Task: React + Express → Next.js (No Logic/UI Changes)

## 🎯 Objective
Migrate an existing project from a split architecture (React frontend + Express backend) into a single unified **Next.js** project.

> ⚠️ STRICT CONSTRAINT: Do NOT modify any business logic, UI components, styles, or API behavior. This is a **structural migration only** — move files, adapt imports/exports, and wire up Next.js conventions.

---

## 📁 Source Structure

The current project has two directories:

```
/fe        ← React app (Create React App or Vite)
  /src
    /components
    /pages (or /views)
    /hooks
    /utils
    /assets
    /styles
    App.tsx (or App.jsx)
    index.tsx

/be        ← Express app
  /src
    /routes
    /controllers
    /middlewares
    /models
    /utils
    /config
    server.ts (or index.ts)
```

---

## 🏗️ Target Structure (Next.js App Router)

```
/nextjs-app
  /app
    /layout.tsx              ← from fe/src/App.tsx (root layout)
    /page.tsx                ← from fe/src/pages/Home (or index)
    /[other-routes]/
      page.tsx               ← map each FE route to a Next.js page
    /api
      /[route]/
        route.ts             ← map each Express route to Next.js API route handler

  /components                ← copy directly from fe/src/components
  /hooks                     ← copy directly from fe/src/hooks
  /utils                     ← merge fe/src/utils and be/src/utils (prefix be utils as /utils/server/)
  /lib                       ← backend logic: controllers, models, config (from be/src/)
    /controllers
    /models
    /config
  /middlewares               ← from be/src/middlewares (adapt to Next.js middleware.ts if applicable)
  /styles                    ← copy directly from fe/src/styles
  /public                    ← copy from fe/public or fe/src/assets
  /types                     ← shared TypeScript types (if any)

  middleware.ts              ← adapt Express global middlewares (auth, cors, etc.) to Next.js middleware
  next.config.ts
  tsconfig.json
  package.json
```

---

## 📐 Migration Rules (Follow Strictly)

### 1. Frontend Pages → Next.js App Router Pages
- Each React route (React Router `<Route path="...">`) becomes a folder under `/app/`
- The component rendered at that route becomes `page.tsx` inside that folder
- Do NOT rewrite component logic — only wrap in Next.js page convention
- `App.tsx` root layout (providers, global styles, nav) → `/app/layout.tsx`

### 2. Express Routes → Next.js API Routes
- Each `router.get('/path', handler)` → `/app/api/path/route.ts` with `export async function GET(req: Request) {}`
- Each `router.post('/path', handler)` → same file, `export async function POST(req: Request) {}`
- Controller logic stays **identical** — only the handler signature changes:
  - Express: `(req: express.Request, res: express.Response) => {}`
  - Next.js: `(req: Request) => Response` using `NextResponse.json()`
- Move controller functions to `/lib/controllers/` and import them in the API route files

### 3. Middleware
- Express global middleware (cors, auth, rate-limit) → evaluate for `middleware.ts` (Next.js Edge Middleware)
- Route-specific middleware → inline in each API route handler or use a wrapper utility

### 4. Environment Variables
- Merge `.env` from both `/fe` and `/be`
- FE public vars: prefix with `NEXT_PUBLIC_`
- BE private vars: keep as-is (no prefix)
- Document all env vars in `.env.example`

### 5. Dependencies
- Merge `package.json` from both `/fe` and `/be`
- Remove: `react-scripts`, `express`, `cors` (if replaced by Next.js config), `react-router-dom`
- Add: `next`, keep all other deps unchanged
- Preserve all versions exactly as they are

### 6. Assets & Static Files
- `/fe/public/` → `/public/`
- `/fe/src/assets/` → `/public/assets/` or keep in `/app/` if used as imports

### 7. TypeScript / JS Config
- Use the existing tsconfig settings from `/fe/tsconfig.json` as base
- Add Next.js required compiler options
- Do NOT change strict mode or path aliases — just extend

---

## 🚫 What NOT To Do
- Do NOT refactor, optimize, or clean up any component or function
- Do NOT change variable names, function signatures, or data structures
- Do NOT upgrade or downgrade any library versions
- Do NOT change CSS classes, Tailwind classes, or inline styles
- Do NOT add new features or fix existing bugs
- Do NOT remove any commented-out code

---

## ✅ Deliverables

1. Full Next.js project folder structure with all files migrated
2. `/app/api/**/route.ts` files for every Express endpoint
3. `/app/**/page.tsx` files for every React route
4. `/app/layout.tsx` with all root-level providers and global styles
5. `middleware.ts` (if global Express middleware existed)
6. Merged `package.json` with correct dependencies
7. `.env.example` with all variables documented
8. `MIGRATION_LOG.md` — a file listing:
   - Every file moved and its source → destination path
   - Any manual steps required (e.g., session store, WebSocket, file upload adapters)
   - Any Express features that have no direct Next.js equivalent (flag only, do not fix)

---

## 🔍 Before You Start

Scan and confirm:
- [ ] List all React Router routes found in `/fe`
- [ ] List all Express routes found in `/be`
- [ ] List all global middlewares in `/be`
- [ ] List all environment variables used in both `/fe` and `/be`
- [ ] Identify any Express-specific features that need manual review (WebSocket, file streams, sessions, etc.)

Present this scan result first and wait for confirmation before proceeding with migration.
