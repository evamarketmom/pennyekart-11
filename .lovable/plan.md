

## Problem

1. **Products from unapproved partners still showing**: The data fix migration ran, but the trigger may not have deployed correctly, or there's a timing issue. The customer UI queries only check `seller_products.is_approved` — they don't verify the partner's `profiles.is_approved` status.

2. **Re-approval should auto-approve all products**: Currently when a partner is re-approved, their products remain blocked. The user wants them auto-approved.

## Plan

### 1. Update the database trigger to handle both directions

Replace the existing `cascade_partner_unapproval` function to also handle re-approval:

```sql
CREATE OR REPLACE FUNCTION public.cascade_partner_approval_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_type = 'selling_partner' 
     AND OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
    UPDATE public.seller_products
    SET is_approved = NEW.is_approved
    WHERE seller_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

This single trigger handles both unapproval (blocks all products) and re-approval (approves all products).

### 2. Fix existing data again

Run a data-fix UPDATE to ensure all products of currently-unapproved partners are set to `is_approved = false`.

### 3. Update frontend `toggleApproval` to handle re-approval

Modify `SellingPartnersPage.tsx` so that when re-approving a partner, the code also sets all their products to `is_approved = true` (matching the trigger as a belt-and-suspenders approach). Update the toast message accordingly.

### 4. Add partner approval check to customer queries (defense in depth)

Add a join/filter in `useAreaProducts.tsx` and `useSectionProducts.tsx` to also check that the seller's profile `is_approved = true`. This prevents products from showing even if individual product flags are out of sync.

### Files changed
- **New migration**: Update trigger function + data fix
- **`src/pages/admin/SellingPartnersPage.tsx`**: Update `toggleApproval` to auto-approve products on re-approval
- **`src/hooks/useAreaProducts.tsx`**: Add partner approval filter
- **`src/hooks/useSectionProducts.tsx`**: Add partner approval filter

