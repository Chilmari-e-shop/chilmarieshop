import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
// Default secret matches owner.html — works even if Vercel env not set
const DEFAULT_SECRET = 'chilmari-neon-sync-2026';
const ADMIN_SECRET = process.env.ADMIN_SYNC_SECRET || DEFAULT_SECRET;
const FIRESTORE_PROJECT = 'chilmarie-shop';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function checkAuth(req) {
  const key = req.headers['x-admin-key'] || '';
  // Accept env secret OR the default hardcoded secret (mobile-friendly)
  return key === ADMIN_SECRET || key === DEFAULT_SECRET;
}

/** Fetch all products from Firestore REST (paginated) */
async function fetchAllFirestoreProducts() {
  const products = [];
  let pageToken = null;

  do {
    let url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/products?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Firestore fetch failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    const docs = data.documents || [];

    for (const doc of docs) {
      const id = doc.name.split('/').pop();
      const f = doc.fields || {};
      const str = (k) => f[k]?.stringValue ?? null;
      const num = (k) => {
        if (f[k]?.integerValue != null) return Number(f[k].integerValue);
        if (f[k]?.doubleValue != null) return Number(f[k].doubleValue);
        return 0;
      };

      products.push({
        id,
        name: str('name') || 'Untitled',
        category: str('category'),
        imageurl: str('imageUrl') || str('imageurl'),
        price: num('basePrice') || num('price') || 0,
      });
    }

    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return products;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  if (!checkAuth(req)) return unauthorized(res);

  try {
    // ---------- SYNC ALL (Firestore → Neon) ----------
    if (req.method === 'POST' && (req.query.action === 'sync' || req.body?.action === 'sync')) {
      const products = await fetchAllFirestoreProducts();

      let synced = 0;
      let failed = 0;
      const errors = [];

      // Upsert in batches of 50 for safety
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        try {
          await sql`
            INSERT INTO products (id, name, category, imageurl, price, updated_at)
            VALUES (
              ${p.id},
              ${p.name},
              ${p.category},
              ${p.imageurl},
              ${p.price},
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              category = EXCLUDED.category,
              imageurl = EXCLUDED.imageurl,
              price = EXCLUDED.price,
              updated_at = NOW()
          `;
          synced++;
        } catch (e) {
          failed++;
          if (errors.length < 5) errors.push({ id: p.id, error: e.message });
        }
      }

      return res.status(200).json({
        success: true,
        total: products.length,
        synced,
        failed,
        errors,
      });
    }

    // ---------- DELETE ALL products from Neon ----------
    if (req.method === 'DELETE' || (req.method === 'POST' && (req.query.action === 'clear' || req.body?.action === 'clear'))) {
      const result = await sql`DELETE FROM products RETURNING id`;
      const count = Array.isArray(result) ? result.length : 0;
      return res.status(200).json({
        success: true,
        deleted: count,
        message: `Deleted ${count} products from Neon`,
      });
    }

    // ---------- COUNT ----------
    if (req.method === 'GET') {
      const rows = await sql`SELECT COUNT(*)::int AS count FROM products`;
      return res.status(200).json({ count: rows[0]?.count ?? 0 });
    }

    return res.status(405).json({ error: 'Method not allowed. Use POST?action=sync or DELETE' });
  } catch (err) {
    console.error('neon-admin error:', err);
    return res.status(500).json({ error: err.message || 'Admin operation failed' });
  }
}
