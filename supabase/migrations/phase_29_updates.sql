-- 1. Add brand name to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- 2. Create warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Update client_stock to support warehouses
-- Note: We allow NULL for now to avoid breaking existing generic client stock, 
-- but new entries should target a warehouse.
ALTER TABLE public.client_stock ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- 4. Update orders for Contratista tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applicator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applied_by TEXT; -- Name of the person who marked it

-- 5. Add Contratista to role constraint if it exists (Supabase uses text, but good to be aware)
-- No explicit constraint check needed for simple text roles, but we'll reflect it in profiles if needed.

-- 6. Indices for performance
CREATE INDEX IF NOT EXISTS idx_warehouses_client ON public.warehouses(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_applicator ON public.orders(applicator_id);
