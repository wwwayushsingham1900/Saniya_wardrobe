// Sania's Wardrobe: public product metadata preview.
// Some retailers (notably Myntra) may block server requests. We do not
// manufacture product photos or prices or attempt to bypass access controls.
// No packages or Netlify environment variables are required.

const STORES = [
  'myntra.com', 'ajio.com', 'hm.com', 'zara.com', 'uniqlo.com',
  'amazon.in', 'amazon.com', 'flipkart.com', 'meesho.com',
  'adidas.co.in', 'nike.com', 'snitch.co.in', 'westside.com',
  'tatacliq.com', 'nykaafashion.com', 'marksandspencer.in',
  'bewakoof.com', 'thebearhouse.com', 'urbanic.com', 'souledstore.com'
];
const allowedHost = host => STORES.some(domain =>
  host === domain || host.endsWith('.' + domain)
);
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=600'
};
const send = (statusCode, data) => ({
  statusCode, headers, body: JSON.stringify(data)
});

function decode(value) {
  return String(value ?? '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (m, n) => {
      const v = n[0].toLowerCase() === 'x'
        ? parseInt(n.slice(1), 16) : parseInt(n, 10);
      return Number.isFinite(v) && v > 0 && v <= 0x10ffff
        ? String.fromCodePoint(v) : m;
    })
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);/gi, m => ({
      '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<',
      '&gt;': '>', '&nbsp;': ' '
    })[m.toLowerCase()] || m)
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4]);
  }
  return out;
}
function readMeta(html) {
  const out = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag), key = (a.property || a.name || '').toLowerCase();
    if (!key || !a.content) continue;
    if (!out[key]) out[key] = [];
    out[key].push(a.content);
  }
  return out;
}
const first = (meta, ...keys) => keys.flatMap(key => meta[key] || [])[0] || '';
function productsFromJsonLd(html) {
  const products = [];
  const seen = new Set();
  function walk(x) {
    if (!x || typeof x !== 'object' || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) return x.forEach(walk);
    const types = [x['@type']].flat().map(t => String(t).toLowerCase());
    if (types.some(t => /(?:^|\/)product$/.test(t))) products.push(x);
    for (const key of ['@graph', 'mainEntity', 'itemListElement']) walk(x[key]);
  }
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(script[1].trim())); } catch { /* malformed retail markup */ }
  }
  return products;
}
function safeImage(raw, base) {
  try {
    if (raw && typeof raw === 'object') raw = raw.url || raw.contentUrl || raw.src;
    if (!raw || typeof raw !== 'string') return '';
    const url = new URL(decode(raw), base);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString() : '';
  } catch { return ''; }
}
function cleanImages(raw, base) {
  const list = raw.flat(Infinity)
    .flatMap(v => typeof v === 'string' && v.includes('\n') ? v.split('\n') : [v]);
  return [...new Set(list.map(v => safeImage(v, base)).filter(Boolean))].slice(0, 5);
}
function fallbackTitle(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  let slug = parts.at(-1) === 'buy' ? parts.at(-3) : parts.at(-1);
  if (url.hostname.endsWith('myntra.com') && parts.length >= 3) slug = parts[2];
  try { slug = decodeURIComponent(slug || 'Saved product'); } catch { /* keep slug */ }
  return decode(slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).slice(0, 120);
}
function maintenancePage(html, title) {
  const symptom = /^(?:site maintenance|access denied|temporarily unavailable|just a moment|service unavailable|oops!?|are you a robot|request blocked|attention required)/i;
  return symptom.test(title.trim()) ||
    /(?:our site is currently under maintenance|enable javascript and cookies to continue|access to this page has been denied)/i.test(html.slice(0, 35000));
}
function formatPrice(raw, currency) {
  if (raw === null || raw === undefined || raw === '') return '';
  const amount = String(raw).trim().replace(/^[₹\s]+/, '');
  if (!/^\d[\d,.]*(?:\.\d+)?$/.test(amount)) return '';
  const symbol = String(currency || 'INR').toUpperCase() === 'INR'
    ? '₹' : String(currency).toUpperCase() + ' ';
  return (symbol + amount).slice(0, 45);
}
async function readPage(url) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8500),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; WardrobeProductPreview/1.0)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-IN,en;q=0.9'
      }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw Error('Redirect without destination');
      current = new URL(location, current);
      if (current.protocol !== 'https:' || !allowedHost(current.hostname.toLowerCase()) ||
        current.username || current.password) throw Error('Unsafe redirect');
      continue;
    }
    if (!response.ok) throw Error('Store returned HTTP ' + response.status);
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
      throw Error('Store did not return HTML');
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error('Empty response');
    const chunks = [];
    let size = 0;
    while (size < 1_000_000) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value)); size += value.byteLength;
    }
    await reader.cancel().catch(() => {});
    return { html: Buffer.concat(chunks).toString('utf8'), page: current };
  }
  throw Error('Too many redirects');
}

exports.handler = async event => {
  let productUrl;
  try {
    const raw = event.queryStringParameters?.url;
    if (!raw || raw.length > 2500) return send(400, {error: 'Missing or invalid product URL'});
    productUrl = new URL(raw);
    if (productUrl.protocol !== 'https:' || productUrl.username || productUrl.password ||
        !allowedHost(productUrl.hostname.toLowerCase())) {
      return send(422, {error: 'Unsupported store'});
    }
    const { html, page } = await readPage(productUrl);
    const meta = readMeta(html);
    const product = productsFromJsonLd(html)[0] || {};
    const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) || {};
    const pageTitle = decode(first(meta, 'og:title', 'twitter:title') ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    if (maintenancePage(html, pageTitle)) {
      return send(503, {
        error: 'Store returned a maintenance or access-restricted page',
        code: 'STORE_UNAVAILABLE',
        fallbackTitle: fallbackTitle(productUrl)
      });
    }
    const title = decode(product.name || pageTitle || fallbackTitle(productUrl)).slice(0, 120);
    const imageSources = [
      ...(Array.isArray(product.image) ? product.image : [product.image]),
      ...(meta['og:image:secure_url'] || []),
      ...(meta['og:image'] || []),
      ...(meta['twitter:image'] || [])
    ];
    const images = cleanImages(imageSources, page);
    const currency = offers.priceCurrency || first(meta, 'product:price:currency', 'og:price:currency') || 'INR';
    const price = formatPrice(
      offers.price ?? offers.lowPrice ?? first(meta, 'product:price:amount', 'og:price:amount'),
      currency
    );
    const description = decode(product.description || first(meta, 'description', 'og:description')).slice(0, 300);
    // Don't misrepresent a non-product page as successful product metadata.
    if (!product.name && !images.length && !price && !first(meta, 'og:type')) {
      return send(503, {
        error: 'Product metadata is not available from this store',
        code: 'METADATA_UNAVAILABLE',
        fallbackTitle: fallbackTitle(productUrl)
      });
    }
    return send(200, {
      title, description, price, images, image: images[0] || '',
      vendor: page.hostname.replace(/^www\./, ''),
      previewAvailable: !!(images.length || price || product.name)
    });
  } catch (error) {
    console.warn('Product preview unavailable:', error.message);
    return send(503, {
      error: 'Store unavailable for previews; the product URL can still be saved',
      code: 'STORE_UNAVAILABLE',
      fallbackTitle: productUrl ? fallbackTitle(productUrl) : 'Saved product'
    });
  }
};

// When a retailer's public metadata is unavailable, search independently for
// possible photos. Uses the documented SerpApi Google Images API, not blocked
// retailer endpoints. Keep SERPAPI_KEY in Netlify environment variables.
const directPreview = exports.handler;
function searchTerms(url) {
  const p = url.pathname.split('/').filter(Boolean);
  const raw = (url.hostname.endsWith('myntra.com') && p.length >= 3)
    ? p[2] : (p.at(-1) === 'buy' ? p.at(-3) : p.at(-1));
  const name = decode(decodeURIComponent(raw || ''))
    .replace(/[-_]+/g, ' ').replace(/\b(?:buy|online|shopping)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 100);
  const id = url.hostname.endsWith('myntra.com')
    ? (p.find(s => /^\d{5,12}$/.test(s)) || '') : '';
  return { name, id };
}
const meaningful = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(s => s.length > 2 && !['unisex','women','mens','men','shoes','shirt','sneakers','casual','design'].includes(s));
function rankImage(result, terms, originalUrl) {
  if (result.unsafe) return -1;
  const text = (result.title || '') + ' ' + (result.link || '');
  const haystack = text.toLowerCase();
  const must = meaningful(terms.name);
  if (must.length < 2) return -1;
  // Require the brand and model/key descriptors to appear; reject generic shoes.
  if (!haystack.includes(must[0])) return -1;
  let score = must.reduce((n, t) => n + (haystack.includes(t) ? 2 : 0), 0);
  if (score < Math.min(6, must.length * 2)) return -1;
  if (terms.id && haystack.includes(terms.id)) score += 12;
  if ((result.link || '').includes(originalUrl.hostname)) score += 8;
  if (/newbalance\.(com|in)|adidas\.(com|co\.in)|nike\.com/i.test(result.link || '')) score += 3;
  return score;
}
async function searchPublicImages(url) {
  if (!process.env.SERPAPI_KEY) {
    return {images:[], candidates:[], reason:'Image search is not configured. Add SERPAPI_KEY in Netlify environment variables.'};
  }
  const terms = searchTerms(url);
  if (!terms.name) return {images:[],candidates:[],reason:'No product name found in the URL.'};
  const params = new URLSearchParams({
    engine:'google_images', q:terms.name + (terms.id ? ' ' + terms.id : ''),
    gl:'in', hl:'en', safe:'active', api_key:process.env.SERPAPI_KEY
  });
  const response = await fetch('https://serpapi.com/search.json?' + params, {
    signal:AbortSignal.timeout(8500)
  });
  if (!response.ok) throw Error('Image search HTTP ' + response.status);
  const body = await response.json();
  if (body.error) throw Error(body.error);
  const sorted = (body.images_results || [])
    .map(r => ({r, score:rankImage(r,terms,url)}))
    .filter(x => x.score >= 0)
    .sort((a,b) => b.score-a.score).slice(0,8);
  const candidates = sorted.map(({r,score}) => ({
    image:safeImage(r.original || r.thumbnail),
    thumbnail:safeImage(r.thumbnail || r.original),
    source:safeImage(r.link), title:decode(r.title || '').slice(0,120), score
  })).filter(x => x.image || x.thumbnail);
  // Only autofill an image if its result explicitly refers to the retailer's
  // product ID; otherwise return a selectable gallery to avoid wrong colours.
  const exact = candidates.filter(x => terms.id && (x.title + ' ' + x.source).includes(terms.id));
  return {
    images:(exact.length ? exact : candidates.slice(0,1)).slice(0,5).map(x=>x.thumbnail || x.image), candidates,
    reason:candidates.length ? 'Image search found possible matches; please verify the colour and model.' : 'No sufficiently matching photographs found.'
  };
}
exports.handler = async event => {
  const normal = await directPreview(event);
  let prior = {};
  try {prior=JSON.parse(normal.body || '{}');} catch {}
  if (normal.statusCode === 400 || normal.statusCode === 422) return normal;
  if (normal.statusCode === 200 && prior.images?.length) return normal;
  const raw = event.queryStringParameters?.url;
  let url;
  try {url=new URL(raw); if(url.protocol !== 'https:' || !allowedHost(url.hostname.toLowerCase()))return normal;} catch{return normal;}
  try {
    const results=await searchPublicImages(url);
    const title=normal.statusCode === 200 ? prior.title : prior.fallbackTitle || fallbackTitle(url);
    return send(200, {
      title, vendor:url.hostname.replace(/^www\./,''),
      price:prior.price || '', description:prior.description || '',
      images:results.images, image:results.images[0] || '',
      candidates:results.candidates, imageSource:results.images.length ? (results.candidates.some(c => /\b\d{8}\b/.test(c.title)) ? 'image-search-exact-id' : 'image-search-suggestion') : '',
      searchStatus:results.reason,
      previewAvailable:!!(results.images.length || results.candidates.length)
    });
  } catch(e) {
    console.warn('Image search unavailable:',e.message);
    return send(200, {
      title:prior.fallbackTitle || fallbackTitle(url),vendor:url.hostname.replace(/^www\./,''),
      price:'', description:'', images:[], candidates:[],
      searchStatus:'Image search unavailable: ' + String(e.message).slice(0,120),
      previewAvailable:false
    });
  }
};
  'cache-control': 'public, max-age=600'
};

const send = (statusCode, data) => ({
  statusCode,
  headers,
  body: JSON.stringify(data)
});

// Decode HTML entities and remove HTML tags.
function decode(value) {
  return String(value ?? '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (m, n) => {
      const v = n[0].toLowerCase() === 'x'
        ? parseInt(n.slice(1), 16)
        : parseInt(n, 10);

      return Number.isFinite(v) && v > 0 && v <= 0x10ffff
        ? String.fromCodePoint(v)
        : m;
    })
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);/gi, m => ({
      '&amp;': '&',
      '&quot;': '"',
      '&apos;': "'",
      '&lt;': '<',
      '&gt;': '>',
      '&nbsp;': ' '
    })[m.toLowerCase()] || m)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Read attributes from an HTML tag.
function attrs(tag) {
  const out = {};

  for (const m of tag.matchAll(
    /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  )) {
    out[m[1].toLowerCase()] = decode(
      m[2] ?? m[3] ?? m[4]
    );
  }

  return out;
}

// Extract Open Graph and other metadata.
function readMeta(html) {
  const out = {};

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const key = (a.property || a.name || '').toLowerCase();

    if (!key || !a.content) continue;

    if (!out[key]) out[key] = [];

    out[key].push(a.content);
  }

  return out;
}

const first = (meta, ...keys) =>
  keys.flatMap(key => meta[key] || [])[0] || '';

// Extract structured product information.
function productsFromJsonLd(html) {
  const products = [];
  const seen = new Set();

  function walk(x) {
    if (!x || typeof x !== 'object' || seen.has(x)) {
      return;
    }

    seen.add(x);

    if (Array.isArray(x)) {
      x.forEach(walk);
      return;
    }

    const types = [x['@type']]
      .flat()
      .map(t => String(t).toLowerCase());

    if (types.some(t => /(?:^|\/)product$/.test(t))) {
      products.push(x);
    }

    for (const key of [
      '@graph',
      'mainEntity',
      'itemListElement'
    ]) {
      walk(x[key]);
    }
  }

  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const script of html.matchAll(pattern)) {
    try {
      walk(JSON.parse(script[1].trim()));
    } catch {
      // Ignore malformed structured data.
    }
  }

  return products;
}

// Validate product photo URLs.
function safeImage(raw, base) {
  try {
    if (raw && typeof raw === 'object') {
      raw = raw.url || raw.contentUrl || raw.src;
    }

    if (!raw || typeof raw !== 'string') {
      return '';
    }

    const url = new URL(decode(raw), base);

    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password
    )
      ? url.toString()
      : '';

  } catch {
    return '';
  }
}

// Extract up to five unique images.
function cleanImages(raw, base) {
  const list = raw
    .flat(Infinity)
    .flatMap(v =>
      typeof v === 'string' && v.includes('\n')
        ? v.split('\n')
        : [v]
    );

  return [
    ...new Set(
      list
        .map(v => safeImage(v, base))
        .filter(Boolean)
    )
  ].slice(0, 5);
}

// Generate a readable name from the product URL.
function fallbackTitle(url) {
  const parts = url.pathname
    .split('/')
    .filter(Boolean);

  let slug = parts.at(-1) === 'buy'
    ? parts.at(-3)
    : parts.at(-1);

  if (
    url.hostname.endsWith('myntra.com') &&
    parts.length >= 3
  ) {
    slug = parts[2];
  }

  try {
    slug = decodeURIComponent(
      slug || 'Saved product'
    );
  } catch {
    // Keep original slug.
  }

  return decode(
    slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  ).slice(0, 120);
}

// Detect maintenance pages and access restrictions.
function maintenancePage(html, title) {
  const symptom =
    /^(?:site maintenance|access denied|temporarily unavailable|just a moment|service unavailable|oops!?|are you a robot|request blocked|attention required)/i;

  return (
    symptom.test(title.trim()) ||
    /(?:our site is currently under maintenance|enable javascript and cookies to continue|access to this page has been denied)/i
      .test(html.slice(0, 35000))
  );
}

// Format prices without inventing missing values.
function formatPrice(raw, currency) {
  if (
    raw === null ||
    raw === undefined ||
    raw === ''
  ) {
    return '';
  }

  const amount = String(raw)
    .trim()
    .replace(/^[₹\s]+/, '');

  if (!/^\d[\d,.]*(?:\.\d+)?$/.test(amount)) {
    return '';
  }

  const symbol =
    String(currency || 'INR').toUpperCase() === 'INR'
      ? '₹'
      : String(currency).toUpperCase() + ' ';

  return (symbol + amount).slice(0, 45);
}

// Retrieve a product page safely.
async function readPage(url) {
  let current = url;

  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(current, {
      redirect: 'manual',

      signal: AbortSignal.timeout(8500),

      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; WardrobeProductPreview/1.0)',

        accept:
          'text/html,application/xhtml+xml',

        'accept-language':
          'en-IN,en;q=0.9'
      }
    });

    // Follow redirects only to supported stores.
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location =
        response.headers.get('location');

      if (!location) {
        throw Error(
          'Redirect without destination'
        );
      }

      current = new URL(location, current);

      if (
        current.protocol !== 'https:' ||
        !allowedHost(
          current.hostname.toLowerCase()
        ) ||
        current.username ||
        current.password
      ) {
        throw Error('Unsafe redirect');
      }

      continue;
    }

    if (!response.ok) {
      throw Error(
        'Store returned HTTP ' + response.status
      );
    }

    const contentType =
      response.headers.get('content-type') || '';

    if (
      !/text\/html|application\/xhtml\+xml/i
        .test(contentType)
    ) {
      throw Error(
        'Store did not return HTML'
      );
    }

    const reader =
      response.body?.getReader();

    if (!reader) {
      throw Error('Empty response');
    }

    const chunks = [];
    let size = 0;

    while (size < 1_000_000) {
      const { value, done } =
        await reader.read();

      if (done) break;

      chunks.push(Buffer.from(value));

      size += value.byteLength;
    }

    await reader.cancel().catch(() => {});

    return {
      html: Buffer.concat(chunks).toString('utf8'),
      page: current
    };
  }

  throw Error('Too many redirects');
}

// Main Netlify serverless function.
exports.handler = async event => {
  let productUrl;

  try {
    const raw =
      event.queryStringParameters?.url;

    if (!raw || raw.length > 2500) {
      return send(400, {
        error: 'Missing or invalid product URL'
      });
    }

    productUrl = new URL(raw);

    if (
      productUrl.protocol !== 'https:' ||
      productUrl.username ||
      productUrl.password ||
      !allowedHost(
        productUrl.hostname.toLowerCase()
      )
    ) {
      return send(422, {
        error: 'Unsupported store'
      });
    }

    const { html, page } =
      await readPage(productUrl);

    const meta = readMeta(html);

    const product =
      productsFromJsonLd(html)[0] || {};

    const offers = (
      Array.isArray(product.offers)
        ? product.offers[0]
        : product.offers
    ) || {};

    const pageTitle = decode(
      first(
        meta,
        'og:title',
        'twitter:title'
      ) ||
      html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
      )?.[1] ||
      ''
    );

    // Reject store error pages.
    if (maintenancePage(html, pageTitle)) {
      return send(503, {
        error:
          'Store returned a maintenance or access-restricted page',

        code: 'STORE_UNAVAILABLE',

        fallbackTitle:
          fallbackTitle(productUrl)
      });
    }

    // Product name.
    const title = decode(
      product.name ||
      pageTitle ||
      fallbackTitle(productUrl)
    ).slice(0, 120);

    // Product photographs.
    const imageSources = [
      ...(Array.isArray(product.image)
        ? product.image
        : [product.image]),

      ...(meta['og:image:secure_url'] || []),

      ...(meta['og:image'] || []),

      ...(meta['twitter:image'] || [])
    ];

    const images =
      cleanImages(imageSources, page);

    // Product price.
    const currency =
      offers.priceCurrency ||
      first(
        meta,
        'product:price:currency',
        'og:price:currency'
      ) ||
      'INR';

    const price = formatPrice(
      offers.price ??
      offers.lowPrice ??
      first(
        meta,
        'product:price:amount',
        'og:price:amount'
      ),
      currency
    );

    // Product description.
    const description = decode(
      product.description ||
      first(
        meta,
        'description',
        'og:description'
      )
    ).slice(0, 300);

    // Reject pages without useful product metadata.
    if (
      !product.name &&
      !images.length &&
      !price &&
      !first(meta, 'og:type')
    ) {
      return send(503, {
        error:
          'Product metadata is not available from this store',

        code: 'METADATA_UNAVAILABLE',

        fallbackTitle:
          fallbackTitle(productUrl)
      });
    }

    // Successful product preview.
    return send(200, {
      title,

      description,

      price,

      images,

      image: images[0] || '',

      vendor:
        page.hostname.replace(/^www\./, ''),

      previewAvailable: !!(
        images.length ||
        price ||
        product.name
      )
    });

  } catch (error) {
    console.warn(
      'Product preview unavailable:',
      error.message
    );

    return send(503, {
      error:
        'Store unavailable for previews; the product URL can still be saved',

      code: 'STORE_UNAVAILABLE',

      fallbackTitle:
        productUrl
          ? fallbackTitle(productUrl)
          : 'Saved product'
    });
  }
};
