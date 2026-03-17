-- Migration: Add harvest metadata to inventory_movements
-- Date: 2026-03-16
-- Description: Adds columns to support full persistence of harvest details (price, contractor, costs)

-- 1. Add harvest metadata columns
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS harvest_labor_price_per_ha NUMERIC DEFAULT 0;

ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS harvest_labor_cost NUMERIC DEFAULT 0;

ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS contractor_name TEXT;

ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS receiver_name TEXT;

-- 2. Add farm and lot context (for easier querying/sync)
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.lots(id) ON DELETE SET NULL;

-- 3. Add column comments for documentation
COMMENT ON COLUMN public.inventory_movements.harvest_labor_price_per_ha IS 'Price paid for harvest labor per hectare';
COMMENT ON COLUMN public.inventory_movements.harvest_labor_cost IS 'Total calculated cost for harvest labor';
COMMENT ON COLUMN public.inventory_movements.contractor_name IS 'Name of the contractor who performed the harvest';
COMMENT ON COLUMN public.inventory_movements.receiver_name IS 'Name of the person or entity receiving the grain/product';
