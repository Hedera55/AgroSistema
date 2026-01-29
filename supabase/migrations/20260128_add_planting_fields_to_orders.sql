-- Migration: Add planting fields to orders
-- Date: 2026-01-28
-- Description: Adds density and spacing fields to support planting orders

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS planting_density NUMERIC,
ADD COLUMN IF NOT EXISTS planting_density_unit TEXT CHECK (planting_density_unit IN ('PLANTS_HA', 'KG_HA')),
ADD COLUMN IF NOT EXISTS planting_spacing NUMERIC;

-- Add comments for documentation
COMMENT ON COLUMN public.orders.planting_density IS 'Target planting density (dosage)';
COMMENT ON COLUMN public.orders.planting_density_unit IS 'Unit for planting density (plants per hectare or kg per hectare)';
COMMENT ON COLUMN public.orders.planting_spacing IS 'Spacing between rows in centimeters';
