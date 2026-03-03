// api/product-seo.js
export default async function handler(req, res) {
  const { id } = req.query;
  const projectId = "chilmarieshop1"; 

  if (!id) return res.redirect(302, "/");

  const userAgent = req.headers["user-agent"] || "";
  const isBot = /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slackbot|WhatsApp|TelegramBot|Discordbot|GPTBot|ClaudeBot/i.test(userAgent);

  if (!isBot) {
    return res.redirect(302, `/?_product=${id}`);
  }

  try {
    // সরাসরি Firestore Database থেকে তথ্য আনা
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${id}`;
    const response = await fetch(firestoreUrl);

    if (!response.ok) return res.redirect(302, "/");

    const data = await response.json();
    const f = data.fields;

    const name = f.name?.stringValue || "Chilmari E Shop";
    const desc = f.description?.stringValue || "";
    const price = f.basePrice?.doubleValue || f.basePrice?.integerValue || f.price?.stringValue || "0";
    const image = f.imageUrl?.stringValue || "https://www.chilmarieshop.top/favicon.png";

    const html = `<!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>${name} - Chilmari E Shop</title>
      <meta name="description" content="${desc.substring(0, 160)}">
      <meta property="og:title" content="${name}">
      <meta property="og:description" content="মূল্য: ৳${price}। ${desc.substring(0, 100)}">
      <meta property="og:image" content="${image}">
      <meta property="og:type" content="product">
      <meta name="twitter:card" content="summary_large_image">
    </head>
    <body>
      <h1>${name}</h1>
      <img src="${image}" alt="${name}">
      <p>${desc}</p>
      <p>Price: ৳${price}</p>
    </body>
    </html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    return res.redirect(302, "/");
  }
}