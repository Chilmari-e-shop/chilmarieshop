export default function middleware(request) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  
  const bots = [
    'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider',
    'facebookexternalhit', 'twitterbot', 'whatsapp', 'telegrambot', 
    'discordbot', 'applebot'
  ];

  const isBot = bots.some(bot => userAgent.includes(bot));

  if (isBot) {
    const url = new URL(request.url);
    const PRERENDER_TOKEN = '2PLnWAUKiuBSomR1R4O2'; 
    const prerenderUrl = `https://service.prerender.io/${url.href}`;

    return fetch(prerenderUrl, {
      headers: { 'X-Prerender-Token': PRERENDER_TOKEN }
    });
  }

  // কোনো ইমপোর্ট ছাড়া সাধারণ রেসপন্স
  return new Response(null, {
    headers: { 'x-middleware-next': '1' }
  });
}
