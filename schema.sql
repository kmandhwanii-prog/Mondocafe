-- ========================================================
-- MONDO CAFE - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qgyoekfgdglitxslllry/sql
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.mondo_menu (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT,
    image_url TEXT,
    badge_tag TEXT DEFAULT NULL,
    calories TEXT DEFAULT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.mondo_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'delivery', -- 'delivery', 'pickup', 'dine_in'
    delivery_address TEXT,
    table_number TEXT,
    special_notes TEXT,
    items JSONB NOT NULL,
    subtotal NUMERIC NOT NULL,
    delivery_fee NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery', -- 'cash_on_delivery', 'nayapay_sadapay', 'jazzcash_easypaisa', 'card'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'brewing', 'ready', 'completed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.mondo_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mondo_orders ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR MENU (Allow anyone to read; anon can insert/update/delete for demo admin panel)
DROP POLICY IF EXISTS "Public can view menu items" ON public.mondo_menu;
CREATE POLICY "Public can view menu items" ON public.mondo_menu
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anon can manage menu items" ON public.mondo_menu;
CREATE POLICY "Anon can manage menu items" ON public.mondo_menu
    FOR ALL USING (true) WITH CHECK (true);

-- 5. RLS POLICIES FOR ORDERS (Allow anon to insert new orders and view/update orders for cafe staff)
DROP POLICY IF EXISTS "Anon can insert orders" ON public.mondo_orders;
CREATE POLICY "Anon can insert orders" ON public.mondo_orders
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can read orders" ON public.mondo_orders;
CREATE POLICY "Anon can read orders" ON public.mondo_orders
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anon can update orders" ON public.mondo_orders;
CREATE POLICY "Anon can update orders" ON public.mondo_orders
    FOR UPDATE USING (true) WITH CHECK (true);
