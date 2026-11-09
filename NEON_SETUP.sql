-- ============================================================
-- Chilmari Shop → Neon Postgres Setup
-- Neon SQL Editor এ এই পুরো স্ক্রিপ্ট রান করুন
-- ============================================================

-- 1. Extension for better text search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Products table (search mirror of Firestore products)
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  imageurl    TEXT,
  price       NUMERIC DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast ILIKE / prefix search
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_name_trgm  ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products (category);

-- 4. Optional helper function (same idea as old search_products_v2)
CREATE OR REPLACE FUNCTION search_products(query_text TEXT, result_limit INT DEFAULT 40)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  category TEXT,
  imageurl TEXT,
  price NUMERIC
) AS $$
  SELECT p.id, p.name, p.category, p.imageurl, p.price
  FROM products p
  WHERE p.name ILIKE '%' || query_text || '%'
     OR p.category ILIKE '%' || query_text || '%'
  ORDER BY
    CASE WHEN p.name ILIKE query_text || '%' THEN 0 ELSE 1 END,
    p.name ASC
  LIMIT result_limit;
$$ LANGUAGE sql STABLE;

-- Done. After this:
-- 1. Vercel → Project Settings → Environment Variables:
--    DATABASE_URL = your neon connection string
--    ADMIN_SYNC_SECRET = a random secret (same value as in owner.html)
-- 2. Redeploy
-- 3. Existing products will sync to Neon when you edit/save them from Admin panel.
--    Or run a one-time migration script if you want all products at once.
