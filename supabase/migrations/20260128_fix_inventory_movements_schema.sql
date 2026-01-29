-- Migration: Fix inventory_movements schema mismatch
-- Date: 2026-01-28
-- Description: Ensures the required columns exist for syncing stock movements

-- 1. Ensure sale_price exists
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS sale_price NUMERIC DEFAULT 0;

-- 2. Ensure factura_image_url exists (safety check)
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS factura_image_url TEXT;

-- 3. Add column comments for documentation
COMMENT ON COLUMN public.inventory_movements.sale_price IS 'Price at which the item was sold (for SALE type movements)';
COMMENT ON COLUMN public.inventory_movements.factura_image_url IS 'URL to the uploaded invoice/receipt image in Supabase Storage';
