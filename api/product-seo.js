import { readFileSync } from "fs";
import { join } from "path";

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) {
    res.statusCode = 400;
    return res.end("Missing product id");
  }

  const userAgent = req.headers["user-agent"] || "";
  const isBot = /googlebot|google-inspectiontool|bingbot|yandexbot|yandex\.com\/bots|duckduckbot|baiduspider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|ccbot|ia_archiver|meta-externalagent|amazonbot|bingpreview/i.test(userAgent);

  const productUrl = `https://chilmarieshop.top/product-view/${id}`;
  res.setHeader("Vary", "User-Agent");

  if (!isBot) {
    try {
      const indexPath = join(process.cwd(), "index.html");
      const html = readFileSync(indexPath, "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      return res.status(200).send(html);
    } catch (e) {
      console.error("index read error", e);
      res.statusCode = 302;
      res.setHeader("Location", "/");
      return res.end();
    }
  }

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/chilmarie-shop/databases/(default)/documents/products/${encodeURIComponent(id)}`;
    const response = await fetch(firestoreUrl);
    const data = await response.json();

    if (!data.fields) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Not Found</title><meta name=\"robots\" content=\"noindex\"></head><body><h1>Product not found</h1></body></html>");
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
      name,
      description: desc.substring(0, 5000),
      image: [image],
      sku: id,
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "BDT",
        price: String(price),
        availability,
        seller: { "@type": "Organization", name: "Chilmari E Shop" },
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
  <p><strong>Price:</strong> &#2547;${price}${oldPrice > price ? ` <s>&#2547;${oldPrice}</s>` : ""}</p>
  <p><strong>Availability:</strong> ${stock > 0 ? "In Stock" : "Out of Stock"}</p>
  <div>${safe(desc).replace(/\n/g, "<br>")}</div>
  <p><a href="${productUrl}">View / Buy at Chilmari E Shop</a></p>
</article>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).send(html);
  } catch (err) {
    console.error("product-seo error:", err);
    res.statusCode = 302;
    res.setHeader("Location", "https://chilmarieshop.top/");
    return res.end();
  }
}
