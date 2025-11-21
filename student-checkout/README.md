# Student Checkout (student-checkout)

This is the frontend for the Classroom Student Checkout system. It is a Vite + React + TypeScript app that connects to Supabase for data storage.

## Quick local dev

Requirements:
- Node.js 18+ (or compatible)
- npm

Install dependencies:

```bash
cd student-checkout
npm install
```

Run dev server:

```bash
npm run dev
# open http://localhost:5173
```

Run production build and preview:

```bash
npm run build
npm run preview
# open the URL shown by the preview command
```

## Deployment (Netlify)

Recommended settings when connecting this repository to Netlify (or when creating a site from Git):

- Base directory: `student-checkout`
- Build command: `npm run build`
- Publish directory: `dist`

Environment variables (Netlify > Site settings > Build & deploy > Environment):

- `VITE_SUPABASE_URL` — Your Supabase project URL (e.g. `https://xyzcompany.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

After those are set, trigger a deploy. The site will be published at the Netlify-provided URL which you can share with students.

## Required Supabase schema (high-level)

The frontend expects these tables and common columns (update if your schema differs):

- `students`
  - `id` (uuid or string)
  - `name` (string)
  - `email` (string)
  - `student_id` (string) — optional identifier
  - `grade` (string or int)
  - `class_name` (string)

- `current_checkouts`
  - `id`
  - `student_id` (references `students.id`)
  - `destination_id` (references `destinations.id`)
  - `checkout_time` (timestamp)
  - `auto_return_at` (timestamp)
  - `notes` (text, optional)

- `destinations`
  - `id`
  - `name`
  - `is_active` (boolean)
  - `display_order` (int)

- `checkout_log`
  - `id`
  - `student_id`
  - `student_name`
  - `student_email`
  - `student_gender`
  - `class_name`
  - `destination_name`
  - `action` (IN/OUT/RESET)
  - `checkout_time`
  - `checkin_time` (nullable)
  - `duration_minutes`

Make sure row-level policies or permissions allow the anon/public key to read/write the tables used by the frontend (or use a safer server-side approach).

## Admin bulk upload

- Upload expects an Excel/CSV with columns like `name`, `student_id`, `grade`, `email` (email is required for each row).

## Notes & troubleshooting

- The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time. Netlify must have them configured before the build.
- If you see failures connecting to Supabase in the deployed site, verify the environment variables and Supabase RLS policies.

## Development notes

- If you want to change chunking or reduce bundle size, consider code-splitting large modules (e.g., `xlsx`) or adjust `vite.config.ts` rollup options.

---

If you want, I can also add example SQL to create the minimal set of tables above. Tell me if you want that included.

## Netlify CLI: set environment variables (example)

If you prefer to set the `VITE_` environment variables from the command line, use the Netlify CLI. Replace the example values with your real Supabase values. This uses the Netlify site name `305checkout` from your account.

```bash
# set using site name
netlify env:set VITE_SUPABASE_URL "https://your-project-ref.supabase.co" --site 305checkout
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key" --site 305checkout

# verify
netlify env:list --site 305checkout
```

Notes:
- Do not include angle brackets when running the commands.
- If you prefer to use the site id instead of the name, replace `--site 305checkout` with `--site <site-id>` (the GUID shown by `netlify sites:list`).
