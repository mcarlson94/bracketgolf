/**
 * Production server for Bracket Golf.
 * Serves the Vite SPA build with per-route meta tag injection for SEO and social sharing.
 */
import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist/public');
const INDEX = resolve(DIST, 'index.html');
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || 'https://bracketgolf.com';

// --- Startup check -----------------------------------------------------------
if (!existsSync(INDEX)) {
  console.error(
    `[server] ERROR: index.html not found at ${INDEX}.\n` +
    `Run "pnpm --filter @workspace/bracket-golf run build" first.`
  );
  process.exit(1);
}

// --- Route meta --------------------------------------------------------------
const DEFAULT_META = {
  title: 'Bracket Golf | 2026 U.S. Amateur Bracket Challenge',
  description:
    'Pick your winners and compete in the 2026 U.S. Amateur Championship bracket challenge. Build your bracket, track live scores, and climb the leaderboard.',
  ogImage: `${BASE_URL}/og-default.png`,
};

const META = {
  '/': {
    title: 'Bracket Golf | 2026 U.S. Amateur Championship',
    description:
      'The official bracket challenge for the 2026 U.S. Amateur Championship at Merion Golf Club. Pick your winners round by round and compete for bragging rights.',
    canonical: `${BASE_URL}/`,
    ogTitle: 'Bracket Golf — 2026 U.S. Amateur Bracket Challenge',
    ogDescription:
      'Think you know who will win the Havemeyer Trophy? Fill out your bracket and compete with friends.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
  '/login': {
    title: 'Sign In | Bracket Golf',
    description: 'Sign in to create your 2026 U.S. Amateur bracket and start competing.',
    canonical: `${BASE_URL}/login`,
    ogTitle: 'Sign In | Bracket Golf',
    ogDescription: 'Sign in to create your bracket for the 2026 U.S. Amateur Championship.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
  '/dashboard': {
    title: 'My Brackets | Bracket Golf',
    description:
      'View and manage all your 2026 U.S. Amateur brackets. Create new brackets, track picks, and submit before the deadline.',
    canonical: `${BASE_URL}/dashboard`,
    ogTitle: 'My Brackets | Bracket Golf',
    ogDescription: 'Manage your 2026 U.S. Amateur brackets and track your progress.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
  '/leaderboard': {
    title: 'Leaderboard | Bracket Golf',
    description:
      'See who is leading the 2026 U.S. Amateur bracket challenge. Live scores updated as matches are played at Merion Golf Club.',
    canonical: `${BASE_URL}/leaderboard`,
    ogTitle: 'Leaderboard | Bracket Golf',
    ogDescription:
      'Live leaderboard for the 2026 U.S. Amateur bracket challenge. Updated in real time.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
  '/tournament': {
    title: 'Tournament Results | Bracket Golf',
    description:
      'Full match play results for the 2026 U.S. Amateur Championship at Merion Golf Club — round by round scores, winners, and bracket progression.',
    canonical: `${BASE_URL}/tournament`,
    ogTitle: '2026 U.S. Amateur Results | Bracket Golf',
    ogDescription:
      'Round-by-round match play results for the 2026 U.S. Amateur Championship.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
  '/groups': {
    title: 'Groups | Bracket Golf',
    description:
      'Create or join a private group for the 2026 U.S. Amateur bracket challenge. Compete against friends and track your group leaderboard.',
    canonical: `${BASE_URL}/groups`,
    ogTitle: 'Groups | Bracket Golf',
    ogDescription: 'Compete against friends in a private bracket group.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
  '/admin': {
    title: 'Admin | Bracket Golf',
    description: 'Tournament administration panel for Bracket Golf.',
    canonical: `${BASE_URL}/admin`,
    ogTitle: 'Admin | Bracket Golf',
    ogDescription: 'Tournament administration.',
    ogImage: `${BASE_URL}/og-default.png`,
  },
};

// Dynamic routes that match a prefix pattern
const DYNAMIC_META = [
  {
    pattern: /^\/brackets\//,
    meta: {
      title: 'My Bracket | Bracket Golf',
      description:
        'View and edit your 2026 U.S. Amateur bracket picks. Track your score as matches play out at Merion Golf Club.',
      ogTitle: 'My Bracket | Bracket Golf',
      ogDescription: 'Check out this 2026 U.S. Amateur bracket on Bracket Golf.',
      ogImage: `${BASE_URL}/og-default.png`,
    },
  },
  {
    pattern: /^\/groups\//,
    meta: {
      title: 'Group | Bracket Golf',
      description:
        'Compete in a private bracket group for the 2026 U.S. Amateur Championship.',
      ogTitle: 'Bracket Golf Group',
      ogDescription: 'Check out this Bracket Golf group for the 2026 U.S. Amateur.',
      ogImage: `${BASE_URL}/og-default.png`,
    },
  },
];

function resolveMeta(path) {
  if (META[path]) return { ...DEFAULT_META, canonical: `${BASE_URL}${path}`, ...META[path] };
  for (const { pattern, meta } of DYNAMIC_META) {
    if (pattern.test(path)) {
      return { ...DEFAULT_META, canonical: `${BASE_URL}${path}`, ...meta };
    }
  }
  return { ...DEFAULT_META, canonical: `${BASE_URL}${path}` };
}

function injectMeta(html, meta) {
  const { title, description, canonical, ogTitle, ogDescription, ogImage } = meta;

  const tags = [
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:title" content="${esc(ogTitle || title)}">`,
    `<meta property="og:description" content="${esc(ogDescription || description)}">`,
    `<meta property="og:image" content="${esc(ogImage)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(ogTitle || title)}">`,
    `<meta name="twitter:description" content="${esc(ogDescription || description)}">`,
    `<meta name="twitter:image" content="${esc(ogImage)}">`,
  ].join('\n    ');

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

function esc(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Sitemap -----------------------------------------------------------------
function buildSitemap() {
  const staticRoutes = Object.keys(META).filter((r) => r !== '/admin' && r !== '/login');
  const urls = staticRoutes
    .map(
      (r) =>
        `  <url>\n    <loc>${BASE_URL}${r}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${r === '/' ? '1.0' : '0.8'}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

// --- App ---------------------------------------------------------------------
const app = express();

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nSitemap: ${BASE_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(buildSitemap());
});

// Static assets (hashed filenames — long cache)
app.use(express.static(DIST, { maxAge: '1y', index: false }));

// SPA catch-all with meta injection
app.get('*', (req, res) => {
  const meta = resolveMeta(req.path);
  const html = readFileSync(INDEX, 'utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.type('text/html').send(injectMeta(html, meta));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Bracket Golf running on http://0.0.0.0:${PORT}`);
});
