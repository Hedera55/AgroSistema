-- Migration: Create inventory_movements table and add harvest/sales support
-- Date: 2026-01-27
-- Description: Creates the movements table in Supabase and adds sale_price for tracking sales revenue

-- 1. Create inventory_movements table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'SALE', 'HARVEST')),
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'UNIT',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TEXT,
    sale_price NUMERIC DEFAULT 0,
    reference_id TEXT,
    notes TEXT,
    factura_image_url TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_client ON public.inventory_movements(client_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON public.inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON public.inventory_movements(date);

-- 3. Enable RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy (allow all for authenticated users - same pattern as other tables)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.inventory_movements;
CREATE POLICY "Allow all for authenticated users" ON public.inventory_movements
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 5. Ensure observed_yield and status exist in lots (redundant safety check)
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS observed_yield NUMERIC DEFAULT 0;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'EMPTY';
