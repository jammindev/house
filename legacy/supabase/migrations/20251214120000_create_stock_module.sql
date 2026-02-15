-- Migration: Create Stock Module
-- Tables: stock_categories, stock_items
-- Features: User-defined categories with color/emoji, inventory management

-- ============================================================
-- 1. STOCK CATEGORIES TABLE
-- ============================================================
-- Users can create custom categories with a name, color (hex), and emoji
-- All fields are required

CREATE TABLE IF NOT EXISTS public.stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',  -- hex color code (e.g., #ff5733)
  emoji text NOT NULL DEFAULT '📦',       -- single emoji character
  description text DEFAULT '',
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT stock_categories_name_not_empty CHECK (trim(name) <> ''),
  CONSTRAINT stock_categories_color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT stock_categories_emoji_not_empty CHECK (trim(emoji) <> '')
);

COMMENT ON TABLE public.stock_categories IS 'User-defined categories for organizing stock items (e.g., Food, Materials, Tools)';
COMMENT ON COLUMN public.stock_categories.color IS 'Hex color code for category display (e.g., #ff5733)';
COMMENT ON COLUMN public.stock_categories.emoji IS 'Emoji icon for category (e.g., 🍎, 🔧, 📦)';

-- ============================================================
-- 2. STOCK ITEMS TABLE
-- ============================================================
-- Core inventory items with quantity, unit, location, expiration, etc.

CREATE TYPE public.stock_item_status AS ENUM (
  'in_stock',
  'low_stock',
  'out_of_stock',
  'ordered',
  'expired',
  'reserved'
);

CREATE TABLE IF NOT EXISTS public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.stock_categories(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  
  -- Basic info
  name text NOT NULL,
  description text DEFAULT '',
  sku text DEFAULT '',                   -- optional internal reference code
  barcode text DEFAULT '',               -- optional barcode/EAN
  
  -- Quantity management
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',     -- e.g., kg, liters, pieces, boxes
  min_quantity numeric(12,3) DEFAULT 0,  -- threshold for low stock alerts
  max_quantity numeric(12,3),            -- optional max capacity
  
  -- Pricing & value
  unit_price numeric(12,2),              -- price per unit
  total_value numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN quantity IS NOT NULL AND unit_price IS NOT NULL 
         THEN ROUND(quantity * unit_price, 2) 
         ELSE NULL 
    END
  ) STORED,
  
  -- Dates
  purchase_date date,
  expiration_date date,                  -- for perishables
  last_restocked_at timestamptz,
  
  -- Status & metadata
  status public.stock_item_status NOT NULL DEFAULT 'in_stock',
  supplier text DEFAULT '',              -- vendor/supplier name
  notes text DEFAULT '',
  tags text[] DEFAULT '{}',
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT stock_items_name_not_empty CHECK (trim(name) <> ''),
  CONSTRAINT stock_items_quantity_positive CHECK (quantity >= 0),
  CONSTRAINT stock_items_min_quantity_positive CHECK (min_quantity IS NULL OR min_quantity >= 0),
  CONSTRAINT stock_items_max_quantity_positive CHECK (max_quantity IS NULL OR max_quantity >= 0),
  CONSTRAINT stock_items_unit_not_empty CHECK (trim(unit) <> '')
);

COMMENT ON TABLE public.stock_items IS 'Inventory items tracked in household stock';
COMMENT ON COLUMN public.stock_items.min_quantity IS 'Threshold below which item is considered low stock';
COMMENT ON COLUMN public.stock_items.total_value IS 'Computed field: quantity × unit_price';

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_stock_categories_household ON public.stock_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_household ON public.stock_items(household_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON public.stock_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_zone ON public.stock_items(zone_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_status ON public.stock_items(status);
CREATE INDEX IF NOT EXISTS idx_stock_items_expiration ON public.stock_items(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_name_gin ON public.stock_items USING gin(to_tsvector('simple', name));

-- ============================================================
-- 4. TRIGGERS FOR AUDIT FIELDS
-- ============================================================

-- Trigger function to set created_by on insert
CREATE OR REPLACE FUNCTION public.set_stock_category_created_by()
RETURNS trigger AS $$
BEGIN
  NEW.created_by := auth.uid();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_stock_item_created_by()
RETURNS trigger AS $$
BEGIN
  NEW.created_by := auth.uid();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to update updated_at and updated_by on update
CREATE OR REPLACE FUNCTION public.update_stock_category_metadata()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_stock_item_metadata()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trg_stock_categories_set_created_by ON public.stock_categories;
CREATE TRIGGER trg_stock_categories_set_created_by
  BEFORE INSERT ON public.stock_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_category_created_by();

DROP TRIGGER IF EXISTS trg_stock_categories_update_metadata ON public.stock_categories;
CREATE TRIGGER trg_stock_categories_update_metadata
  BEFORE UPDATE ON public.stock_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_category_metadata();

DROP TRIGGER IF EXISTS trg_stock_items_set_created_by ON public.stock_items;
CREATE TRIGGER trg_stock_items_set_created_by
  BEFORE INSERT ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_item_created_by();

DROP TRIGGER IF EXISTS trg_stock_items_update_metadata ON public.stock_items;
CREATE TRIGGER trg_stock_items_update_metadata
  BEFORE UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_item_metadata();

-- ============================================================
-- 5. CONSTRAINT: category must belong to same household as item
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_stock_item_category_household()
RETURNS trigger AS $$
DECLARE
  category_household_id uuid;
BEGIN
  SELECT household_id INTO category_household_id
  FROM public.stock_categories
  WHERE id = NEW.category_id;
  
  IF category_household_id IS NULL THEN
    RAISE EXCEPTION 'Stock category not found';
  END IF;
  
  IF category_household_id <> NEW.household_id THEN
    RAISE EXCEPTION 'Stock item and category must belong to the same household';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_items_check_category_household ON public.stock_items;
CREATE TRIGGER trg_stock_items_check_category_household
  BEFORE INSERT OR UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_item_category_household();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- Stock Categories Policies
DROP POLICY IF EXISTS "Members can view household stock categories" ON public.stock_categories;
CREATE POLICY "Members can view household stock categories"
  ON public.stock_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_categories.household_id
        AND household_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create stock categories" ON public.stock_categories;
CREATE POLICY "Members can create stock categories"
  ON public.stock_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_categories.household_id
        AND household_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can update household stock categories" ON public.stock_categories;
CREATE POLICY "Members can update household stock categories"
  ON public.stock_categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_categories.household_id
        AND household_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can delete household stock categories" ON public.stock_categories;
CREATE POLICY "Members can delete household stock categories"
  ON public.stock_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_categories.household_id
        AND household_members.user_id = auth.uid()
    )
  );

-- Stock Items Policies
DROP POLICY IF EXISTS "Members can view household stock items" ON public.stock_items;
CREATE POLICY "Members can view household stock items"
  ON public.stock_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_items.household_id
        AND household_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create stock items" ON public.stock_items;
CREATE POLICY "Members can create stock items"
  ON public.stock_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_items.household_id
        AND household_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can update household stock items" ON public.stock_items;
CREATE POLICY "Members can update household stock items"
  ON public.stock_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_items.household_id
        AND household_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can delete household stock items" ON public.stock_items;
CREATE POLICY "Members can delete household stock items"
  ON public.stock_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_members.household_id = stock_items.household_id
        AND household_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. VIEW: Stock summary by category
-- ============================================================

CREATE OR REPLACE VIEW public.stock_category_summary AS
SELECT
  sc.id AS category_id,
  sc.household_id,
  sc.name AS category_name,
  sc.color,
  sc.emoji,
  COUNT(si.id) AS item_count,
  COALESCE(SUM(si.quantity), 0) AS total_quantity,
  COALESCE(SUM(si.total_value), 0) AS total_value,
  COUNT(CASE WHEN si.status = 'low_stock' THEN 1 END) AS low_stock_count,
  COUNT(CASE WHEN si.status = 'out_of_stock' THEN 1 END) AS out_of_stock_count,
  COUNT(CASE WHEN si.expiration_date IS NOT NULL AND si.expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) AS expiring_soon_count
FROM public.stock_categories sc
LEFT JOIN public.stock_items si ON si.category_id = sc.id
GROUP BY sc.id, sc.household_id, sc.name, sc.color, sc.emoji;

COMMENT ON VIEW public.stock_category_summary IS 'Aggregated statistics per stock category';

-- ============================================================
-- 8. FUNCTION: Auto-update stock status based on quantity
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_update_stock_status()
RETURNS trigger AS $$
BEGIN
  -- Auto-set status based on quantity and min_quantity threshold
  IF NEW.quantity <= 0 THEN
    NEW.status := 'out_of_stock';
  ELSIF NEW.min_quantity IS NOT NULL AND NEW.quantity <= NEW.min_quantity THEN
    NEW.status := 'low_stock';
  ELSIF NEW.expiration_date IS NOT NULL AND NEW.expiration_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.status IN ('out_of_stock', 'low_stock', 'expired') THEN
    -- Reset to in_stock if quantity is above threshold and not expired
    IF NEW.quantity > COALESCE(NEW.min_quantity, 0) 
       AND (NEW.expiration_date IS NULL OR NEW.expiration_date >= CURRENT_DATE) THEN
      NEW.status := 'in_stock';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_items_auto_status ON public.stock_items;
CREATE TRIGGER trg_stock_items_auto_status
  BEFORE INSERT OR UPDATE OF quantity, min_quantity, expiration_date ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_stock_status();
