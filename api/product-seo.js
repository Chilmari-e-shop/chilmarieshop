export default async function handler(req, res) {
  const { id } = req.query;
  const userAgent = req.headers["user-agent"] || "";
  const isBot = /googlebot|bingbot|facebookexternalhit|WhatsApp|TelegramBot|Discordbot/i.test(userAgent);

  if (!isBot) return res.redirect(302, `/?_product=${id}`);

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/chilmarieshop1/databases/(default)/documents/products/${id}`;
    const response = await fetch(firestoreUrl);
    const data = await response.json();
    const f = data.fields;

    const name = f.name?.stringValue || "Chilmari E Shop";
    const desc = f.description?.stringValue || "";
    const image = f.imageUrl?.stringValue || "https://www.chilmarieshop.top/favicon.png";

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name}</title><meta name="description" content="${desc.substring(0, 160)}"><meta property="og:title" content="${name}"><meta property="og:image" content="${image}"></head><body><h1>${name}</h1></body></html>`;

    // --- খরচ বাঁচানোর ম্যাজিক লাইন ---
    // বটের জন্য এই পেজটি ১ ঘণ্টা ক্যাশ থাকবে
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.send(html);
  } catch (err) {
    return res.redirect(302, "/");
  }
}