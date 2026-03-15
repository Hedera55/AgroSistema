-- Migration: Add missing columns for full synchronization support
-- Date: 2026-03-15

-- 1. Updates for products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS standard_presentations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS concentration TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Updates for stock table
ALTER TABLE stock ADD COLUMN IF NOT EXISTS presentation_label TEXT;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS presentation_content NUMERIC;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS presentation_amount NUMERIC;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS presentation TEXT;
-- updated_at already exists in stock based on supabase_schema.sql (line 89)

-- 3. Updates for inventory_movements table
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS investors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS presentation_label TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS presentation_content NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS presentation_amount NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS discharge_number TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS gross_weight NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tare_weight NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS humidity NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS hectoliter_weight NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS transport_company TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS truck_plate TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS trailer_plate TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS departure_date_time TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS distance_km NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS freight_tariff NUMERIC;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS destination_company TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS destination_address TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS origin_address TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS primary_sale_cuit TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN DEFAULT false;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS origin_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS dest_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS partner_id TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS transport_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS transport_cuit TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS driver_cuit TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS warehouse_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS transport_sheets JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 4. Updates for clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS investors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partners JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS enabled_units JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS enabled_sellers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_harvest_warehouse_id UUID;
-- updated_at already exists in clients

-- Update triggers for updated_at (if they exist or should exist)
-- We assume the existing updated_at columns are handled by general triggers in the DB.
