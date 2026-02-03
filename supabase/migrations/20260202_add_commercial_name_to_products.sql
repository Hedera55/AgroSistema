-- Migration: Add commercial_name to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS commercial_name TEXT;
