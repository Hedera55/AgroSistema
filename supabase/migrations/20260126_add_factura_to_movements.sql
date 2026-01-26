-- Migration: Add factura_image_url to movements table
-- Date: 2026-01-26
-- Description: Adds support for storing invoice/receipt images with stock movements

ALTER TABLE movements 
ADD COLUMN IF NOT EXISTS factura_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN movements.factura_image_url IS 'URL to uploaded factura (invoice/receipt) image in Supabase Storage';
