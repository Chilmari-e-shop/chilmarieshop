// api/sitemap-dynamic.js
// Dynamic Sitemap — Firebase Storage থেকে product list নিয়ে XML বানায়
// Firestore Read = 0 ✅

export default async function handler(req, res) {
  try {
    // Firebase Storage থেকে sitemap-data.json নাও
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/chilmarieshop1.firebasestorage.app/o/seo-pages%2Fsitemap-data.json?alt=media&t=${Date.now()}`;

    let products = [];
    try {
      const response = await fetch(storageUrl);
      if (response.ok) {
        const data = await response.json();
        products = data.products || [];
      }
    } catch (e) {
      console.error("Sitemap data fetch failed:", e);
    }

    const today = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Static Pages -->
  <url>
    <loc>https://www.chilmarieshop.top/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.chilmarieshop.top/#about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.chilmarieshop.top/#contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

    // সব product URL যোগ করো
    for (const product of products) {
      xml += `
  <url>
    <loc>https://www.chilmarieshop.top/product-view/${product.id}</loc>
    <lastmod>${product.lastmod || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    xml += `\n</urlset>`;

    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // ১ ঘণ্টা cache
    return res.send(xml);

  } catch (err) {
    console.error("Sitemap error:", err);
    return res.status(500).send("Sitemap generation failed");
  }
}
