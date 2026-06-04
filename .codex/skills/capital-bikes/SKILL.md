---
name: capital-bikes
description: Project guide for the Capital Wo-Man Bikes app. Use when working in this repository on React/Vite/Firebase code, service workflow, workshop checklists, billing, Loyverse integration, admin/user permissions, calendar/tasks, mobile UI fixes, build/deploy, or production verification for capital-bikes.web.app.
---

# Capital Bikes

## Project Context

Work in `C:\Users\Julieth\Desktop\APPS\CAPITAL WO-MAN BIKES\repo` for app code. The parent folder may contain `.codex`, docs, and project metadata; the React/Firebase app lives in `repo`.

Primary file is usually `src/App.tsx`. Firebase helpers are in `src/firebase.ts`; hosting output is `dist`.

## Standard Workflow

1. Inspect before editing: use `rg` first, then `Get-Content` for focused ranges.
2. Preserve user changes: never reset, checkout, or revert unrelated dirty work.
3. Edit with `apply_patch` for manual file changes.
4. Build with `npm run build`.
5. Deploy production changes with `firebase deploy --only hosting`.
6. Verify production HTML with a cache-busted URL, for example:
   `https://capital-bikes.web.app/?v=short-change-name`
7. Confirm the loaded bundle in the HTML changed before telling the user it is live.

Use Spanish in user-facing responses.

## App Rules

Keep changes synchronized across admin and employee/user views. If a feature exists in services, check calendar, dashboard, ready-for-pickup cards, and employee service views when relevant.

Important business rules:

- Loyverse calls must use the local `/api/loyverse/...` proxy, not direct browser calls to `https://api.loyverse.com`, to avoid CORS.
- Products, repuestos, and services added to billing should come from Loyverse when the workflow requires synced items.
- Base prices from Loyverse should not be manually editable; use discount percent for negotiated prices.
- `Lista para recoger` must require final billing and completed process checklist, excluding only final customer delivery confirmation.
- Customer delivery must require final safety checks and customer signature/acceptance.
- Deleting services requires admin password.
- Users can edit invoice where the app currently permits it; do not re-lock invoice editing without explicit request.

For detailed workflow notes, read `references/project-flows.md` when touching workshop process, billing, Loyverse, checklist, or deployment behavior.

## Verification Notes

Build warnings about chunks over 500 kB are known and not automatically blocking.

After deploy, use a URL query like `?v=feature-name` so mobile browsers and the PWA cache fetch the new HTML. If the user still sees old UI, advise closing/reopening the browser or using the cache-busted link.
