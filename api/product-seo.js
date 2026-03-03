// api/product-seo.js
// Google/AI Bot এর জন্য Static HTML সার্ভ করে
// Real User হলে সরাসরি সাইটে পাঠিয়ে দেয়

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.redirect(302, "https://www.chilmarieshop.top/");
  }

  const userAgent = req.headers["user-agent"] || "";

  // Google/AI Bot কিনা চেক করো
  const isBot = /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slackbot|WhatsApp|TelegramBot|Discordbot|GPTBot|ClaudeBot|anthropic|PerplexityBot|ChatGPT/i.test(userAgent);

  // --- ৩ নম্বর ধাপ: সাধারণ মানুষের জন্য লজিক ---
  if (!isBot) {
    // মানুষ হলে তাকে সরাসরি ইনডেক্স পেজে পাঠিয়ে দাও যাতে SPA কাজ করে
    // এবং URL পরিবর্তন না হয়
    return res.redirect(302, `/?_product=${id}`);
  }

  try {
    // বটের জন্য Firebase Storage থেকে pre-generated HTML নাও
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