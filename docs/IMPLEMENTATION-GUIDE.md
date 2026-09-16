# FAT Program — implementation guide

This app is a production rebuild of the Claude Design prototype in
`design/project/FAT PROGRAM.dc.html`. The prototype is the **visual source of truth**;
the database and APIs are real.

## Stack

- Next.js 16 (App Router, `src/` dir) — note: `middleware.ts` is now `proxy.ts`, and
  route handler params are async (`await ctx.params`, typed with `RouteContext<'/path'>`).
- React 19, TypeScript, plain CSS (no Tailwind).
- Prisma 7 + PostgreSQL. Prisma 7 needs a **driver adapter** — always import the shared
  client from `@/lib/db`, never construct `PrismaClient` yourself.
- Auth: bcrypt + `jose` JWT in an httpOnly cookie. Sessions are rows in `Session`.

## Golden rules

1. **Match the prototype pixel for pixel.** Open the screen's line range in
   `design/project/FAT PROGRAM.dc.html` and port the markup faithfully: same copy, same
   order of elements, same inline styles, same SVG icon paths, same column widths.
2. **Reuse the global CSS classes** in `src/app/globals.css` (ported verbatim from the
   prototype): `.card`, `.card-h`, `.card-b`, `.head`, `.head-act`, `.metrics`, `.metric`,
   `.chip` + `.chip-open|lock|warn|bad|info|ok`, `.btn`, `.btn-primary`, `.btn-sm`, `.bal`,
   `.tabs`, `.tab`, `.note`, `.note-warn`, `.dz`, `.legend`, `.timeline`, `.num`, `.r`,
   `.tot`, `.muted`, `.sm`, `.row` + `.row-2|3|4`, `.grid2`, `.grid-32`, `.stack`, `.bar`.
   Only use inline styles where the prototype used inline styles.
3. **Never invent data.** Every figure comes from Postgres, scoped to the active company
   and business unit. Where the prototype shows a placeholder `—`, render `—` when the
   value is zero/absent (`dash()` in `src/lib/format.ts`).
4. **Empty states stay.** Tables that start empty in the prototype keep their
   "Belum ada data …" row.
5. **Indonesian copy**, wrapped in `t()` so the EN dictionary applies.

## File layout per screen

```
src/app/(app)/<route>/page.tsx          server component: loads data with Prisma
src/app/(app)/<route>/<Name>Screen.tsx  "use client": filters, dialogs, validation
src/app/api/<resource>/route.ts         GET/POST handlers
```

The `(app)` route group wraps everything in the shell (rail, header, module bar) and the
toast provider — do not re-render chrome inside a screen.

**Reference implementation to copy:** `src/app/(app)/vendor/` plus `src/app/api/vendor/route.ts`
(prototype screen 13, lines 3054–3123). It shows the page/screen split, stat tiles, filter
bar, table, empty state, create dialog with field validation, and the audit log write.

## Server components

```ts
import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";

const context = await requireActiveContext();
// context.companyId, context.unitId, context.company, context.unit, context.user
const rows = await db.someModel.findMany({ where: { companyId: context.companyId } });
```

Scope by `unitId` too whenever the prototype labels the data "buku" (per-unit books).

Prisma `Decimal` values are not serialisable into client components — convert with
`toNumber()` from `@/lib/format` before passing them down.

## API routes

```ts
import { handle, handleRead, recordAudit, rule, nextDocumentNumber } from "@/lib/api";

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => { ... });
}
```

`handle` does auth + active-context + zod validation and maps errors to
`{ error, field }` JSON: 400 validation, 401 unauthorised, 409 no context, 422 business
rule (throw with `rule("pesan")`), 500 otherwise. Write an `AuditLog` row for every
create/update/delete via `recordAudit`. Generate document numbers with
`nextDocumentNumber(companyId, docType, prefix)`.

## Client components

- `useT()` from `@/i18n/LocaleProvider` for copy.
- `useToast()` from `@/components/ui/Toast` for the prototype's toast messages.
- `Dialog` from `@/components/ui/Dialog` for the `.mdl` modals.
- `PageHead`, `Metrics`, `StatTile`, `StatTileRow` from `@/components/ui/`.
- Icons: `@/components/shell/icons`. Add screen-specific SVGs inline, copying the
  prototype's exact path data.
- After a successful mutation: close dialog, `toast(...)`, `router.refresh()`.
- Mark required fields with `<label className="f" data-req="1">` (renders the red asterisk)
  and add `className="field-error"` to inputs that failed validation.

## Formatting

Use `src/lib/format.ts`: `formatAmount`, `formatAmount2`, `formatRupiah`, `formatQuantity`,
`dash`, `formatDate`, `formatDateLong`, `formatDateTime`, `toInputDate`, `periodLabel`,
`parseAmountInput`, `chipClassFor`, `humanizeEnum`, `MONTHS_ID`.

Money columns are right-aligned (`className="r num"`), codes and dates use `.num`.

## Business rules carried over from the prototype

- Petty cash claims are rejected above Rp 5.000.000 per claim (`SystemSetting.pettyCashLimit`).
- Straight-line depreciation: `(acquisitionCost - residualValue) / usefulLifeMonths` per month.
- Sales invoice: `ppn = dpp * ppnRate / 100`, `total = dpp + ppn` (default rate 11%).
- Journals must balance: total debit equals total credit before posting.
- Postings are refused into a period whose status is `DITUTUP` or `DIKUNCI`.
- Purchase orders above their approval threshold go through `ApprovalRequest`.

## Shared files — do not edit

`src/app/globals.css`, `src/components/shell/*`, `src/components/ui/*`, `src/lib/*`,
`src/i18n/*`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/app/(app)/layout.tsx`,
`src/lib/navigation.ts`.

If a screen needs a model or shared component change, **report it** instead of editing;
the coordinating session applies it centrally.

## Verifying your work

Run `npx tsc --noEmit` (do **not** run `next build` or `next dev` — a dev server is already
running on port 3000 and concurrent builds clobber `.next`).
