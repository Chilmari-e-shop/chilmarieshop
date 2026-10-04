// Bot-friendly product HTML for Google / AI crawlers
// Humans still get the SPA (index.html)

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) {
    res.statusCode = 400;
    return res.end("Missing product id");
  }

  const userAgent = req.headers["user-agent"] || "";
  const isBot = /googlebot|google-inspectiontool|bingbot|yandex|duckduck|baidu|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt|claudebot|anthropic|perplexity|ccbot|ia_archiver|meta-externalagent/i.test(userAgent);

  const host = req.headers["x-forwarded-host"] || req.headers.host || "chilmarieshop.top";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const origin = `${protocol}://${host}`;
  const productUrl = `https://chilmarieshop.top/product-view/${id}`;

  // Normal users → SPA shell (keeps URL /product-view/ID)
  if (!isBot) {
    try {
      const indexRes = await fetch(`${origin}/index.html`, {
        headers: { "User-Agent": "Chilmari-SEO-Proxy" },
      });
      const html = await indexRes.text();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res.status(200).send(html);
    } catch (e) {
      res.statusCode = 302;
      res.setHeader("Location", productUrl);
      return res.end();
    }
  }

  // Bots → real product HTML from Firestore
  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/chilmarie-shop/databases/(default)/documents/products/${encodeURIComponent(id)}`;
    const response = await fetch(firestoreUrl);
    const data = await response.json();

    if (!data.fields) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(`<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>Product Not Found | Chilmari E Shop</title><meta name="robots" content="noindex"><link rel="canonical" href="https://chilmarieshop.top/"></head><body><h1>Product not found</h1><p><a href="https://chilmarieshop.top/">Go to Chilmari E Shop</a></p></body></html>`);
    }

    const f = data.fields;
    const str = (key) => f[key]?.stringValue || "";
    const num = (key) => {
      if (f[key]?.integerValue != null) return Number(f[key].integerValue);
      if (f[key]?.doubleValue != null) return Number(f[key].doubleValue);
      return 0;
    };

    const name = str("name") || "Chilmari E Shop";
    const desc = (str("description") || name).replace(/\s+/g, " ").trim();
    const image = str("imageUrl") || "https://chilmarieshop.top/favicon.png";
    const price = num("basePrice") || num("price") || 0;
    const oldPrice = num("oldPrice");
    const stock = num("stock");
    const availability = stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

    const safe = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const metaDesc = safe(desc.substring(0, 160));
    const schema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      name: name,
      description: desc.substring(0, 5000),
      image: [image],
      sku: id,
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "BDT",
        price: String(price),
        availability: availability,
        seller: {
          "@type": "Organization",
          name: "Chilmari E Shop",
        },
      },
    };

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe(name)} | Chilmari E Shop</title>
<meta name="description" content="${metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${productUrl}">
<meta property="og:type" content="product">
<meta property="og:title" content="${safe(name)} | Chilmari E Shop">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${safe(image)}">
<meta property="og:url" content="${productUrl}">
<meta property="product:price:amount" content="${price}">
<meta property="product:price:currency" content="BDT">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<article>
  <h1>${safe(name)}</h1>
  <p><img src="${safe(image)}" alt="${safe(name)}" width="400"></p>
  <p><strong>Price:</strong> ৳${price}${oldPrice > price ? ` <s>৳${oldPrice}</s>` : ""}</p>
  <p><strong>Availability:</strong> ${stock > 0 ? "In Stock" : "Out of Stock"}</p>
  <div>${safe(desc).replace(/\n/g, "<br>")}</div>
  <p><a href="${productUrl}">View / Buy at Chilmari E Shop</a></p>
</article>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(html);
  } catch (err) {
    console.error("product-seo error:", err);
    res.statusCode = 302;
    res.setHeader("Location", "https://chilmarieshop.top/");
    return res.end();
  }
}
