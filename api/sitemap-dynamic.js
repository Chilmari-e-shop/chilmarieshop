export default async function handler(req, res) {
  const projectId = "chilmarieshop1";
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=1000`;
    const response = await fetch(url);
    const data = await response.json();
    const products = data.documents || [];

    const today = new Date().toISOString().split("T")[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    xml += `<url><loc>https://www.chilmarieshop.top/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>`;

    products.forEach(doc => {
      const id = doc.name.split('/').pop();
      xml += `<url><loc>https://www.chilmarieshop.top/product-view/${id}</loc><priority>0.9</priority></url>`;
    });

    xml += `</urlset>`;
    
    // --- খরচ বাঁচানোর ম্যাজিক লাইন ---
    // এটি ভেরসেলকে বলবে এই সitemap টি ২৪ ঘণ্টা সেভ করে রাখতে (Cache)
    res.setHeader("Content-Type", "text/xml");
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate"); 
    return res.send(xml);
  } catch (e) {
    return res.status(500).send("Error");
  }
}