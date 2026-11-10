import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Default matches owner.html — works even without Vercel env
const DEFAULT_SECRET = 'chilmari-neon-sync-2026';
const ADMIN_SECRET = process.env.ADMIN_SYNC_SECRET || DEFAULT_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Protect writes — accept env secret OR default
  const clientKey = req.headers['x-admin-key'] || '';
  if (clientKey !== ADMIN_SECRET && clientKey !== DEFAULT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'POST') {
      // Upsert product
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, name, category, imageurl, price } = body || {};

      if (!id || !name) {
        return res.status(400).json({ error: 'id and name are required' });
      }

      await sql`
        INSERT INTO products (id, name, category, imageurl, price, updated_at)
        VALUES (
          ${id},
          ${name},
          ${category || null},
          ${imageurl || null},
          ${price != null ? Number(price) : 0},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          imageurl = EXCLUDED.imageurl,
          price = EXCLUDED.price,
          updated_at = NOW()
      `;

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      await sql`DELETE FROM products WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('product-sync error:', err);
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
}
