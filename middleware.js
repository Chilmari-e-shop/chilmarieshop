// Edge-style bot assist (optional extra layer)
// Main bot HTML comes from /api/product-seo via vercel.json rewrite

export default async function middleware(request) {
  try {
    const userAgent = (request.headers.get("user-agent") || "").toLowerCase();

    const bots = [
      "googlebot",
      "google-inspectiontool",
      "bingbot",
      "yandex",
      "duckduck",
      "baidu",
      "slurp",
      "facebookexternalhit",
      "facebot",
      "twitterbot",
      "linkedinbot",
      "whatsapp",
      "telegrambot",
      "discordbot",
      "applebot",
      "semrush",
      "ahrefs",
      "petalbot",
      "bytespider",
      "gptbot",
      "chatgpt",
      "claudebot",
      "anthropic",
      "perplexity",
      "ccbot",
      "meta-externalagent",
    ];

    const isBot = bots.some((b) => userAgent.includes(b));
    if (!isBot) {
      return new Response(null, {
        headers: { "x-middleware-next": "1" },
      });
    }

    const url = new URL(request.url);

    // Product pages already handled by /api/product-seo rewrite — let it continue
    if (url.pathname.startsWith("/product-view/")) {
      return new Response(null, {
        headers: { "x-middleware-next": "1" },
      });
    }

    // Optional: Prerender for other pages (home, etc.) if token still valid
    const PRERENDER_TOKEN = "2PLnWAUKiuBSomR1R4O2";
    if (PRERENDER_TOKEN) {
      try {
        const prerenderUrl = `https://service.prerender.io/${url.href}`;
        const prerenderRes = await fetch(prerenderUrl, {
          headers: { "X-Prerender-Token": PRERENDER_TOKEN },
        });
        if (prerenderRes.ok) {
          const body = await prerenderRes.text();
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, s-maxage=600",
            },
          });
        }
      } catch (e) {
        // fall through
      }
    }

    return new Response(null, {
      headers: { "x-middleware-next": "1" },
    });
  } catch (e) {
    return new Response(null, {
      headers: { "x-middleware-next": "1" },
    });
  }
}
