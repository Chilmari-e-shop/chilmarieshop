export default async function handler(req, res) {
  const projectId = "chilmarie-shop";
  const base = "https://chilmarieshop.top";

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=1000`;
    const response = await fetch(url);
    const data = await response.json();
    const products = data.documents || [];

    const today = new Date().toISOString().split("T")[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${base}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;

    for (const doc of products) {
      const id = doc.name.split("/").pop();
      if (!id) continue;
      xml += `  <url><loc>${base}/product-view/${id}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
    }

    xml += `</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate");
    return res.status(200).send(xml);
  } catch (e) {
    console.error("sitemap error:", e);
    res.statusCode = 500;
    return res.end("Sitemap error");
  }
}
