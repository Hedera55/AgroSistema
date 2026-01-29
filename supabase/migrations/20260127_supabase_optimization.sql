-- Migration: Supabase Database Performance & Security Optimization
-- Date: 2026-01-27
-- Description: Addresses auth_rls_initplan, multiple_permissive_policies, and duplicate_index warnings.

-- 1. Optimize and Consolidate RLS for inventory_movements
-- First, drop ALL existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Users can view movements of assigned clients" ON public.inventory_movements;
DROP POLICY IF EXISTS "optimized_inventory_movements_access" ON public.inventory_movements;

-- Create a single, optimized policy
-- Wrapping auth.role() in (SELECT ...) ensures it only runs once per query
CREATE POLICY "optimized_inventory_movements_access" ON public.inventory_movements
    FOR ALL
    USING ( (SELECT auth.role()) = 'authenticated' )
    WITH CHECK ( (SELECT auth.role()) = 'authenticated' );

-- 2. Cleanup duplicate indexes on inventory_movements
-- Keep the once created by migrations, drop the ones identified as duplicates by the linter
DROP INDEX IF EXISTS public.idx_inventory_movements_client_id;
DROP INDEX IF EXISTS public.idx_inventory_movements_product_id;
DROP INDEX IF EXISTS public.idx_inventory_movements_warehouse_id;

-- 3. Optimize RLS performance for other core tables
-- This prevents the "auth_rls_initplan" warning (row-by-row re-evaluation)

-- Clients
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "optimized_clients_access" ON public.clients;
CREATE POLICY "optimized_clients_access" ON public.clients
    FOR ALL USING ( (SELECT auth.role()) = 'authenticated' )
    WITH CHECK ( (SELECT auth.role()) = 'authenticated' );

-- Products
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.products;
DROP POLICY IF EXISTS "Users can view products of assigned clients" ON public.products;
DROP POLICY IF EXISTS "optimized_products_access" ON public.products;
CREATE POLICY "optimized_products_access" ON public.products
    FOR ALL USING ( (SELECT auth.role()) = 'authenticated' )
    WITH CHECK ( (SELECT auth.role()) = 'authenticated' );

-- Warehouses
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_master_admin_policy" ON public.warehouses;
DROP POLICY IF EXISTS "optimized_warehouses_access" ON public.warehouses;
CREATE POLICY "optimized_warehouses_access" ON public.warehouses
    FOR ALL USING ( (SELECT auth.role()) = 'authenticated' )
    WITH CHECK ( (SELECT auth.role()) = 'authenticated' );

-- Orders
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders of assigned clients" ON public.orders;
DROP POLICY IF EXISTS "optimized_orders_access" ON public.orders;
CREATE POLICY "optimized_orders_access" ON public.orders
    FOR ALL USING ( (SELECT auth.role()) = 'authenticated' )
    WITH CHECK ( (SELECT auth.role()) = 'authenticated' );

-- Farms and Lots (just to be thorough)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.farms;
CREATE POLICY "optimized_farms_access" ON public.farms FOR ALL USING ( (SELECT auth.role()) = 'authenticated' );

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.lots;
CREATE POLICY "optimized_lots_access" ON public.lots FOR ALL USING ( (SELECT auth.role()) = 'authenticated' );
