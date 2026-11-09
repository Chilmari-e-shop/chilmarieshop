import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // CORS for browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 50);

  if (!q || q.length < 2) {
    return res.status(200).json({ data: [] });
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing');
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // ILIKE search + prefer names that start with the query
    const data = await sql`
      SELECT id, name, category, imageurl, price
      FROM products
      WHERE name ILIKE ${'%' + q + '%'}
         OR category ILIKE ${'%' + q + '%'}
      ORDER BY
        CASE WHEN name ILIKE ${q + '%'} THEN 0 ELSE 1 END,
        name ASC
      LIMIT ${limit}
    `;

    return res.status(200).json({ data });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
}
