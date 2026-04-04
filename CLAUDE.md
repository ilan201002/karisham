# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
```

No test runner is configured.

## Architecture

Single-page React app (Vite) backed by Supabase. The entire application is in **`src/App.jsx`** — there is no component split across files.

**UI language:** Hebrew, RTL (`dir="rtl"`, `lang="he"`). All user-facing strings are in Hebrew.

**Supabase tables:**
- `work_days` — one row per (user_id, date); columns: `is_active`, `tips`, `cash_from_clients`, `bonus`
- `upsells` — upsell/referral records per user; columns: `date`, `name`, `type` (`"onsite"` | `"referral"`), `status`, `address`, `phone`, `amount`, `commission`

**Key business constants (App.jsx top):**
- `BASE = 580` — base daily pay (₪)
- `CR = 0.25` — commission rate (25% of upsell amount)

**Upsell status flows:**
- Onsite (`type="onsite"`): `pending` → `done` → `paid` (cyclic tap)
- Referral (`type="referral"`): `pending` → `confirmed` (requires entering final amount) → `paid`

**Styling:** All styles are inline JS objects. A shared color palette (`C`), and reusable style constants (`INP`, `LBL`, `BTNP`, `BTNS`, `card()`) are defined at the top of App.jsx and used throughout.

**Tabs:** `field` (daily entry), `summary` (monthly/weekly overview), `upsells` (upsell management).
