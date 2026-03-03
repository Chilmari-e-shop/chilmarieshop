// api/product-seo.js
// Google/AI Bot এর জন্য Static HTML সার্ভ করে
// Firebase Storage থেকে pre-generated HTML নিয়ে দেয়
// Firestore Read = 0 ✅

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.redirect(302, "https://www.chilmarieshop.top/");
  }

  const userAgent = req.headers["user-agent"] || "";

  // Google/AI Bot কিনা চেক করো
  const isBot = /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slackbot|WhatsApp|TelegramBot|Discordbot|GPTBot|ClaudeBot|anthropic|PerplexityBot|ChatGPT/i.test(userAgent);

  // Real User হলে — কিছু করো না, main site দেখাবে (vercel catch-all করবে)
  if (!isBot) {
    // index.html serve করো (Vercel catch-all এর মতো)
    res.setHeader("Location", "/");
    // Actually just let the page load normally
    return res.redirect(302, `/?_product=${id}`);
  }

  try {
    // Firebase Storage থেকে pre-generated HTML নাও
    // এটা Firestore Read নয় — Storage CDN Read (বিনামূল্যে প্রায়)
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/chilmarieshop1.firebasestorage.app/o/seo-pages%2F${encodeURIComponent(id)}.html?alt=media`;

    const response = await fetch(storageUrl);

    if (!response.ok) {
      // SEO page না পেলে homepage এ পাঠাও
      return res.redirect(302, "https://www.chilmarieshop.top/");
    }

    const html = await response.text();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // ১ ঘণ্টা cache
    return res.send(html);

  } catch (err) {
    console.error("Product SEO error:", err);
    return res.redirect(302, "https://www.chilmarieshop.top/");
  }
}
