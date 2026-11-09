# Chilmari Shop — Supabase → Neon Migration

## কী পরিবর্তন হয়েছে

| আগে (Supabase)              | এখন (Neon)                          |
|-----------------------------|-------------------------------------|
| Browser → Supabase JS client | Browser → `/api/search` + `/api/product-sync` |
| DB credentials public       | Credentials only on Vercel server   |
| `search_products_v2` RPC    | Postgres ILIKE + ranking            |

**Firebase / Firestore অপরিবর্তিত** — শুধু product search mirror Neon-এ গেছে।

---

## Setup Steps (বাধ্যতামূলক)

### 1. Neon-এ Table বানান
Neon Console → SQL Editor → `NEON_SETUP.sql` এর পুরো কোড পেস্ট করে **Run** করুন।

### 2. Vercel Environment Variables
Vercel Dashboard → Project → Settings → Environment Variables:

| Name               | Value |
|--------------------|-------|
| `DATABASE_URL`     | `postgresql://neondb_owner:YOUR_REAL_PASSWORD@ep-royal-lab-bd3dduy6-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `ADMIN_SYNC_SECRET`| যেকোনো শক্তিশালী random string (উদাহরণ: `xK9mP2vQ7nL4`) |

> **গুরুত্বপূর্ণ:** Connection string-এর password (`npg_...`) আসলটা দিন। Client-side কোডে password **কখনো** রাখবেন না।

### 3. owner.html-এ Secret মিলান
`owner.html` এ এই লাইন আছে:
```js
window.ADMIN_SYNC_SECRET = window.ADMIN_SYNC_SECRET || 'chilmari-neon-sync-2026';
```
এখানকার value টা Vercel-এর `ADMIN_SYNC_SECRET` এর সাথে **একই** করুন।

### 4. Deploy
```bash
# package.json যোগ হয়েছে (@neondatabase/serverless)
# Vercel auto-install করবে
git add .
git commit -m "Migrate product search from Supabase to Neon"
git push
```

### 5. Products Neon-এ আনুন
- Admin panel থেকে যেকোনো product **Edit → Save** করলে সেটা automatically Neon-এ sync হবে।
- অথবা সব product একসাথে পাঠাতে চাইলে আমাকে বলুন — one-time migration script দিয়ে দেব।

---

## API Endpoints

- `GET  /api/search?q=keyword&limit=20`  → public search
- `POST /api/product-sync`              → upsert (header: `x-admin-key`)
- `DELETE /api/product-sync?id=xxx`     → delete (header: `x-admin-key`)

---

## Test
1. Site open → Search box এ কিছু লিখুন → suggestions / results আসছে কিনা দেখুন।
2. Admin → Product add/edit → Network tab এ `/api/product-sync` 200 আসছে কিনা দেখুন।
3. Neon Console → Tables → `products` → rows দেখা যাচ্ছে কিনা।
