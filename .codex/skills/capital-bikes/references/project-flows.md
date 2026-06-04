# Capital Bikes Project Flows

## Structure

- App root: `C:\Users\Julieth\Desktop\APPS\CAPITAL WO-MAN BIKES\repo`
- Main React file: `src/App.tsx`
- Firebase helper: `src/firebase.ts`
- Production hosting: `https://capital-bikes.web.app`
- Skill folder: parent project `.codex/skills/capital-bikes`

## Loyverse

Use these existing helpers/patterns in `src/App.tsx`:

- `lookupLoyverseSKU`
- `lookupLoyverseCustomerByDocument`
- `sendBillingToLoyverse`
- billing row fields `loyverseItemId` and `loyverseVariantId`

Browser requests must go through `/api/loyverse/...`. Direct fetches to `https://api.loyverse.com/...` from the app cause CORS failures.

When adding products/repuestos/services to invoices:

- Search by SKU/code.
- Fill description and base price from Loyverse.
- Preserve Loyverse item and variant IDs.
- Allow quantity and discount percent edits.
- Do not allow manual base price edits unless the user explicitly changes that rule.

## Services And Checklist

The service process has intake/review, desarme, technical work, and cierre groups. Checklist state must persist in `processChecklist` and `processChecklistUpdatedAt`.

Before moving to desarme:

- Review checklist items must be complete.
- Initial quote/repuestos to change must exist.

Before marking `Lista para recoger`:

- Final billing must exist.
- Process checklist must be complete except `entrega`.

Before marking delivered:

- Safety cierre checks must be complete.
- Customer signature/name and acceptance text are required.

## Billing

Use `billingWithServiceLine`, `calcBilling`, `itemsFromRows`, and `saveBilling` patterns. Keep totals consistent:

- Products/repuestos total from `parts`.
- Service/mano de obra total from `labor`.
- Ticket total is products plus service.
- Discount applies by percent against original/base unit price.

When editing a ready-for-pickup service, keep the same Loyverse behavior as active services.

## Permissions

Admin can see broad data and delete services with password. Employee/user views should respect existing permission logic, but features requested by the user often need to work in both admin and employee service views.

PIN/password changes must avoid duplicate team PINs.

## UI

Mobile matters. Avoid narrow grids that overflow. For buttons, set explicit `background`, `color`, `borderColor`, and `appearance` if cross-device contrast is a concern.

If text disappears while typing on mobile, check input `color`, `background`, and inherited styles.

## Deployment

From `repo`:

```powershell
npm run build
firebase deploy --only hosting
```

Then verify:

```powershell
(Invoke-WebRequest -Uri 'https://capital-bikes.web.app/?v=change-name' -Headers @{'Cache-Control'='no-cache'} -UseBasicParsing -TimeoutSec 20).Content
```

Report the new bundle filename from the HTML.
