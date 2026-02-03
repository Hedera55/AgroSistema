-- Migration: 20260202_dynamic_investors.sql

-- 1. Add partners column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS partners text[] DEFAULT '{}';

-- 2. Add investor_name column to inventory_movements
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS investor_name text;

-- 3. Add investor_name column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS investor_name text;

-- 4. Set search path (Best practice)
ALTER FUNCTION public.handle_new_user_registration SET search_path = public, auth;
