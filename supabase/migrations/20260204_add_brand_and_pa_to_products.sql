-- Migration: Add brand_name and active_ingredient to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active_ingredient TEXT;
