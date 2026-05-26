export default async function handler(req, res) {
  const projectId = "chilmarie-shop";
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
export default async function handler(req, res) {
  // আপনার প্রজেক্ট আইডি
  const projectId = "chilmarie-shop"; 
  
  try {
    // ফায়ারস্টোর REST API থেকে ডাটা আনা (API Key প্রয়োজন নেই যদি রুলস পাবলিক থাকে)
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=1000`;
    
    const response = await fetch(firestoreUrl);
    const data = await response.json();
    const products = data.documents || [];

    const today = new Date().toISOString().split("T")[0];
    
    // সাইটম্যাপ XML তৈরি
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://www.chilmarieshop.top/</loc>
        <lastmod>${today}</lastmod>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>https://www.chilmarieshop.top/#about</loc>
        <lastmod>${today}</lastmod>
        <priority>0.8</priority>
      </url>
      <url>
        <loc>https://www.chilmarieshop.top/#contact</loc>
        <lastmod>${today}</lastmod>
        <priority>0.7</priority>
      </url>`;

    // অটোমেটিক সব প্রোডাক্টের আইডি যোগ করা
    products.forEach((doc) => {
      // doc.name থেকে আসল আইডিটি বের করা (projects/id/databases/.../ID)
      const productId = doc.name.split('/').pop();
      xml += `
      <url>
        <loc>https://www.chilmarieshop.top/product-view/${productId}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
      </url>`;
    });

    xml += `</urlset>`;

    // ব্রাউজারকে জানানো যে এটি একটি XML ফাইল
    res.setHeader('Content-Type', 'text/xml');
    // ২৪ ঘণ্টা পর্যন্ত Vercel-এর সার্ভারে এটি সেভ (Cache) থাকবে খরচ বাঁচাতে
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    
    return res.status(200).send(xml);
  } catch (e) {
    return res.status(500).send("Error generating sitemap");
  }
}
