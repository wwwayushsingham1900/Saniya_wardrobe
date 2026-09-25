
/*
 * Sania's Wardrobe — Product Preview
 *
 * 1. Fetch public product details from supported stores.
 * 2. Fall back to SerpApi Google Images when photos are unavailable.
 * 3. Return possible photo matches for user confirmation.
 *
 * Required Netlify environment variable: SERPAPI_KEY
 * No additional npm packages required.
 */

const STORES = [
  "myntra.com",
  "ajio.com",
  "hm.com",
  "zara.com",
  "uniqlo.com",
  "amazon.in",
  "amazon.com",
  "flipkart.com",
  "meesho.com",
  "adidas.co.in",
  "nike.com",
  "snitch.co.in",
  "westside.com",
  "tatacliq.com",
  "nykaafashion.com",
  "marksandspencer.in",
  "bewakoof.com",
  "thebearhouse.com",
  "urbanic.com",
  "souledstore.com"
];

const allowedHost = host =>
  STORES.some(
    domain => host === domain || host.endsWith("." + domain)
  );

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=600"
};

const send = (statusCode, data) => ({
  statusCode,
  headers,
  body: JSON.stringify(data)
});

function decode(value) {
  return String(value ?? "")
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, value) => {
      const number =
        value[0].toLowerCase() === "x"
          ? parseInt(value.slice(1), 16)
          : parseInt(value, 10);

      return number > 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : match;
    })
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);/gi, match => {
      const entities = {
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&lt;": "<",
        "&gt;": ">",
        "&nbsp;": " "
      };

      return entities[match.toLowerCase()] || match;
    })
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract HTML tag attributes.
function attrs(tag) {
  const result = {};

  const pattern =
    /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decode(
      match[2] ?? match[3] ?? match[4]
    );
  }

  return result;
}

// Extract Open Graph and other metadata.
function readMeta(html) {
  const result = {};

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = attrs(tag);

    const key = (
      attributes.property ||
      attributes.name ||
      ""
    ).toLowerCase();

    if (!key || !attributes.content) continue;

    if (!result[key]) result[key] = [];

    result[key].push(attributes.content);
  }

  return result;
}

const first = (meta, ...keys) =>
  keys.flatMap(key => meta[key] || [])[0] || "";

// Extract JSON-LD Product objects.
function productsFromJsonLd(html) {
  const products = [];

  function walk(node) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const types = [node["@type"]]
      .flat()
      .map(value => String(value).toLowerCase());

    if (
      types.some(type =>
        /(?:^|\/)product$/.test(type)
      )
    ) {
      products.push(node);
    }

    for (const key of [
      "@graph",
      "mainEntity",
      "itemListElement"
    ]) {
      walk(node[key]);
    }
  }

  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const script of html.matchAll(pattern)) {
    try {
      walk(JSON.parse(script[1].trim()));
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return products;
}

// Validate publicly accessible HTTPS image URLs.
function safeImage(raw, base) {
  try {
    if (raw && typeof raw === "object") {
      raw = raw.url || raw.contentUrl || raw.src;
    }

    if (!raw || typeof raw !== "string") return "";

    const url = new URL(decode(raw), base);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    )
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function cleanImages(raw, base) {
  const list = raw
    .flat(Infinity)
    .flatMap(value =>
      typeof value === "string" && value.includes("\n")
        ? value.split("\n")
        : [value]
    );

  return [
    ...new Set(
      list.map(value => safeImage(value, base)).filter(Boolean)
    )
  ].slice(0, 5);
}

// Recover a readable name from the original URL.
function fallbackTitle(url) {
  const parts = url.pathname.split("/").filter(Boolean);

  let slug =
    parts.at(-1) === "buy"
      ? parts.at(-3)
      : parts.at(-1);

  if (
    url.hostname.endsWith("myntra.com") &&
    parts.length >= 3
  ) {
    slug = parts[2];
  }

  try {
    slug = decodeURIComponent(slug || "Saved product");
  } catch {
    slug = slug || "Saved product";
  }

  return decode(
    slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase())
  ).slice(0, 120);
}

// Detect common retailer error pages.
function maintenancePage(html, title) {
  const pattern =
    /^(?:site maintenance|access denied|temporarily unavailable|just a moment|service unavailable|oops!?|are you a robot|request blocked|attention required)/i;

  return (
    pattern.test(title.trim()) ||
    /(?:our site is currently under maintenance|enable javascript and cookies to continue|access to this page has been denied)/i.test(
      html.slice(0, 35000)
    )
  );
}

function formatPrice(raw, currency = "INR") {
  if (raw === null || raw === undefined || raw === "") {
    return "";
  }

  const amount = String(raw)
    .trim()
    .replace(/^[₹\s]+/, "");

  if (!/^\d[\d,.]*(?:\.\d+)?$/.test(amount)) {
    return "";
  }

  const symbol =
    String(currency).toUpperCase() === "INR"
      ? "₹"
      : String(currency).toUpperCase() + " ";

  return (symbol + amount).slice(0, 45);
}

// Retrieve a retailer's public HTML.
async function readPage(originalUrl) {
  let current = originalUrl;

  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8500),

      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; WardrobeProductPreview/1.0)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-IN,en;q=0.9"
      }
    });

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("Redirect without destination");
      }

      current = new URL(location, current);

      if (
        current.protocol !== "https:" ||
        !allowedHost(current.hostname.toLowerCase()) ||
        current.username ||
        current.password
      ) {
        throw new Error("Unsafe redirect");
      }

      continue;
    }

    if (!response.ok) {
      throw new Error(
        "Store returned HTTP " + response.status
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      !/text\/html|application\/xhtml\+xml/i.test(
        contentType
      )
    ) {
      throw new Error("Store did not return HTML");
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Empty response");
    }

    const chunks = [];
    let size = 0;

    while (size < 1_000_000) {
      const { value, done } = await reader.read();

      if (done) break;

      chunks.push(Buffer.from(value));
      size += value.byteLength;
    }

    await reader.cancel().catch(() => {});

    return {
      html: Buffer.concat(chunks).toString("utf8"),
      page: current
    };
  }

  throw new Error("Too many redirects");
}

// Try fetching product details directly.
async function directPreview(productUrl) {
  const { html, page } = await readPage(productUrl);

  const meta = readMeta(html);
  const product = productsFromJsonLd(html)[0] || {};

  const offers = (
    Array.isArray(product.offers)
      ? product.offers[0]
      : product.offers
  ) || {};

  const pageTitle = decode(
    first(meta, "og:title", "twitter:title") ||
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    )?.[1] ||
    ""
  );

  if (maintenancePage(html, pageTitle)) {
    throw new Error(
      "Store returned a maintenance or access-restricted page"
    );
  }

  const title = decode(
    product.name ||
    pageTitle ||
    fallbackTitle(productUrl)
  ).slice(0, 120);

  const imageSources = [
    ...(Array.isArray(product.image)
      ? product.image
      : [product.image]),

    ...(meta["og:image:secure_url"] || []),
    ...(meta["og:image"] || []),
    ...(meta["twitter:image"] || [])
  ];

  const images = cleanImages(imageSources, page);

  const currency =
    offers.priceCurrency ||
    first(
      meta,
      "product:price:currency",
      "og:price:currency"
    ) ||
    "INR";

  const price = formatPrice(
    offers.price ??
    offers.lowPrice ??
    first(
      meta,
      "product:price:amount",
      "og:price:amount"
    ),
    currency
  );

  const description = decode(
    product.description ||
    first(meta, "description", "og:description")
  ).slice(0, 300);

  if (
    !product.name &&
    !images.length &&
    !price
  ) {
    throw new Error(
      "Product metadata unavailable"
    );
  }

  return {
    title,
    description,
    price,
    images,
    image: images[0] || "",
    vendor: page.hostname.replace(/^www\./, ""),
    previewAvailable: true,
    imageSource: images.length ? "retailer" : ""
  };
}

// Extract searchable product information.
function searchTerms(url) {
  const parts = url.pathname.split("/").filter(Boolean);

  const raw =
    url.hostname.endsWith("myntra.com") &&
    parts.length >= 3
      ? parts[2]
      : parts.at(-1) === "buy"
        ? parts.at(-3)
        : parts.at(-1);

  let decoded = raw || "";

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep original text.
  }

  const name = decode(decoded)
    .replace(/[-_]+/g, " ")
    .replace(/\b(?:buy|online|shopping)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  const id = url.hostname.endsWith("myntra.com")
    ? parts.find(part => /^\d{5,12}$/.test(part)) || ""
    : "";

  return { name, id };
}

function meaningful(value) {
  const ignored = new Set([
    "unisex",
    "women",
    "mens",
    "men",
    "shoes",
    "shirt",
    "sneakers",
    "casual",
    "design"
  ]);

  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(word =>
      word.length > 2 && !ignored.has(word)
    );
}

// Rank candidate image-search results.
function rankImage(result, terms, originalUrl) {
  if (result.unsafe) return -1;

  const text = (
    (result.title || "") +
    " " +
    (result.link || "")
  ).toLowerCase();

  const keywords = meaningful(terms.name);

  if (keywords.length < 2) return -1;

  if (!text.includes(keywords[0])) return -1;

  let score = keywords.reduce(
    (total, word) =>
      total + (text.includes(word) ? 2 : 0),
    0
  );

  if (
    score <
    Math.min(6, keywords.length * 2)
  ) {
    return -1;
  }

  if (
    terms.id &&
    text.includes(terms.id)
  ) {
    score += 12;
  }

  if (
    (result.link || "").includes(
      originalUrl.hostname
    )
  ) {
    score += 8;
  }

  if (
    /newbalance\.(com|in)|adidas\.(com|co\.in)|nike\.com/i
      .test(result.link || "")
  ) {
    score += 3;
  }

  return score;
}

// Search Google Images through SerpApi.
async function searchPublicImages(url) {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return {
      images: [],
      candidates: [],
      reason:
        "Image search is not configured. Add SERPAPI_KEY in Netlify environment variables."
    };
  }

  const terms = searchTerms(url);

  if (!terms.name) {
    return {
      images: [],
      candidates: [],
      reason: "Product name unavailable."
    };
  }

  const query =
    terms.name +
    (terms.id ? " " + terms.id : "");

  const params = new URLSearchParams({
    engine: "google_images",
    q: query,
    gl: "in",
    hl: "en",
    safe: "active",
    api_key: apiKey
  });

  const response = await fetch(
    "https://serpapi.com/search.json?" +
    params.toString(),
    {
      signal: AbortSignal.timeout(20000)
    }
  );

  if (!response.ok) {
    throw new Error(
      "Image search HTTP " + response.status
    );
  }

  const body = await response.json();

  if (body.error) {
    throw new Error(body.error);
  }

  const sorted = (body.images_results || [])
    .map(result => ({
      result,
      score: rankImage(
        result,
        terms,
        url
      )
    }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const candidates = sorted
    .map(({ result, score }) => ({
      image: safeImage(
        result.original || result.thumbnail
      ),

      thumbnail: safeImage(
        result.thumbnail || result.original
      ),

      source: safeImage(result.link),

      title: decode(
        result.title || ""
      ).slice(0, 120),

      score
    }))
    .filter(
      candidate =>
        candidate.image || candidate.thumbnail
    );

  // Prefer candidates containing the exact product ID.
  const exact = candidates.filter(
    candidate =>
      terms.id &&
      (
        candidate.title +
        " " +
        candidate.source
      ).includes(terms.id)
  );

  // Other matches remain suggestions and should be verified.
  const suggested = exact.length
    ? exact
    : candidates.slice(0, 1);

  return {
    images: suggested
      .slice(0, 5)
      .map(candidate =>
        candidate.thumbnail || candidate.image
      ),

    candidates,

    reason: candidates.length
      ? "Possible product photographs found. Verify the model and colour."
      : "No sufficiently matching photographs found.",

    exactMatch: exact.length > 0
  };
}

// Main Netlify function.
exports.handler = async event => {
  const raw = event.queryStringParameters?.url;

  if (!raw || raw.length > 2500) {
    return send(400, {
      error: "Missing or invalid product URL"
    });
  }

  let productUrl;

  try {
    productUrl = new URL(raw);
  } catch {
    return send(400, {
      error: "Invalid product URL"
    });
  }

  if (
    productUrl.protocol !== "https:" ||
    productUrl.username ||
    productUrl.password ||
    !allowedHost(
      productUrl.hostname.toLowerCase()
    )
  ) {
    return send(422, {
      error: "Unsupported store"
    });
  }

  let product = {
    title: fallbackTitle(productUrl),
    description: "",
    price: "",
    images: [],
    image: "",
    vendor: productUrl.hostname.replace(/^www\./, ""),
    previewAvailable: false
  };

  let retailerError = "";

  // First attempt: retrieve the original product page.
  try {
    product = await directPreview(productUrl);
  } catch (error) {
    retailerError = error.message;

    console.warn(
      "Retailer preview unavailable:",
      retailerError
    );
  }

  // If retailer photos exist, return them directly.
  if (product.images.length) {
    return send(200, {
      ...product,
      candidates: [],
      searchStatus: "Retailer photographs retrieved."
    });
  }

  // Second attempt: independent public image search.
  try {
    const results =
      await searchPublicImages(productUrl);

    return send(200, {
      ...product,

      images: results.images,

      image: results.images[0] || "",

      candidates: results.candidates,

      imageSource: results.images.length
        ? results.exactMatch
          ? "image-search-exact-id"
          : "image-search-suggestion"
        : "",

      searchStatus: results.reason,

      previewAvailable:
        product.previewAvailable ||
        results.images.length > 0,

      retailerError
    });

  } catch (error) {
    console.warn(
      "Image search unavailable:",
      error.message
    );

    return send(200, {
      ...product,

      candidates: [],

      searchStatus:
        "Image search unavailable: " +
        String(error.message).slice(0, 120),

      retailerError
    });
  }
};
