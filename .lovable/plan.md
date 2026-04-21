

## Goal

When a selling partner adds a product under a **grocery** category, admin can assign it to **all** or **selected** micro godowns. Customers only see seller products if their ward maps to one of the assigned micro godowns.

## Current state

- `seller_products` has `area_godown_id` (single area-godown link) and is filtered globally — no micro-godown-level visibility control.
- `useAreaProducts.tsx` already resolves the customer's micro godown(s) via `godown_wards` and area godowns via `godown_local_bodies`, then queries `seller_products` by `area_godown_id`.
- `categories.category_type` distinguishes `grocery` from other types.
- Admin Products page (`src/pages/admin/ProductsPage.tsx`) has a Seller Products tab.

## Approach

A many-to-many `seller_product_micro_godowns` link table + admin assignment UI + customer-side visibility filter.

### 1. Database migration

**New table** `seller_product_micro_godowns`:
- `id uuid pk`
- `seller_product_id uuid not null` → seller_products.id (no FK, indexed)
- `godown_id uuid not null` → godowns.id (indexed)
- `created_at timestamptz default now()`
- Unique `(seller_product_id, godown_id)`

RLS:
- SELECT: anyone (public read — needed by customer query)
- INSERT/UPDATE/DELETE: `is_super_admin() OR has_permission('update_products')`

**Helper column** on `seller_products`: `assign_to_all_micro_godowns boolean default false` — when true, product is visible in every micro godown (no link rows needed). Defaults to false so a new grocery seller product is invisible until admin assigns it.

**Auto-flag trigger** `mark_grocery_seller_product`:
- BEFORE INSERT/UPDATE OF category on `seller_products`
- Sets a new `is_grocery boolean` column based on `categories.category_type = 'grocery'` lookup.
- Used by admin UI to surface only relevant rows in the new "Micro Godown Assignment" view.

### 2. Admin UI — `src/pages/admin/ProductsPage.tsx` (Seller Products tab)

- Add a **"Micro Godown"** column showing either "All" badge or a count chip ("3 godowns") for each row.
- Add a **"Assign Micro Godowns"** action button per row → opens a dialog:
  - Toggle: **"Assign to all micro godowns"** (writes `assign_to_all_micro_godowns`).
  - When off: searchable checkbox list of every active `godown_type='micro'` godown, pre-checked from `seller_product_micro_godowns`.
  - Save: upserts `assign_to_all_micro_godowns` and replaces link rows for that product.
- Add filter dropdown above the table: **All / Grocery only / Non-grocery / Unassigned grocery** (helps admin find products needing assignment).

### 3. Customer-side visibility — `src/hooks/useAreaProducts.tsx`

Update the `seller_products` query:
- Resolve the customer's micro godown IDs (already computed via `godown_wards` join).
- Fetch seller products that are EITHER:
  - `assign_to_all_micro_godowns = true`, OR
  - present in `seller_product_micro_godowns` for one of the customer's micro godown IDs.
- Keep existing `is_active`, `is_approved`, `coming_soon`, `stock > 0` filters.

Implementation: two parallel queries (all-flag set + linked rows for customer's micro godowns), merge by id, dedupe.

### 4. Selling partner side

No code change. Partner creates product as today; visibility defaults to "none" until admin assigns. (Optional follow-up: notify admin on new grocery seller product — out of scope here.)

## Files touched

- `supabase/migrations/<new>.sql` — new table, columns, trigger, RLS, backfill
- `src/pages/admin/ProductsPage.tsx` — column + dialog + filter
- `src/hooks/useAreaProducts.tsx` — visibility filter rewrite
- `src/integrations/supabase/types.ts` — auto-regenerated

## Verification

1. Selling partner creates a grocery product → row appears in admin Seller Products with empty Micro Godown column.
2. Admin opens assignment dialog → picks 2 micro godowns → save.
3. Customer mapped to one of those micro godowns sees the product on home/category pages.
4. Customer mapped to a different micro godown does not see it.
5. Admin toggles "Assign to all" → all customers in any micro godown see it.
6. Non-grocery seller products continue to behave as today (unaffected).

