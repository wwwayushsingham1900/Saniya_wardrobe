import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/lib/scraper.js");
afterEach(() => vi.unstubAllGlobals());
describe("retailer preview boundary", () => {
  it.each([
    "https://localhost/",
    "http://www.hm.com/1",
    "https://hm.com.evil.test/1",
    "https://www.hm.com:8443/1",
    "https://name:password@www.hm.com/1",
    "file:///etc/passwd",
  ])("rejects unsafe source %s", async (url) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await handler({ queryStringParameters: { url } })).statusCode).toBe(
      422,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("extracts retailer metadata without invoking image search", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<script type="application/ld+json">{"@type":"Product","name":"Olive shirt","image":["https://www.hm.com/shirt.jpg"],"offers":{"price":"1499","priceCurrency":"INR"}}</script>',
          { headers: { "Content-Type": "text/html" } },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const result = JSON.parse(
      (
        await handler({
          queryStringParameters: { url: "https://www.hm.com/product/1" },
        })
      ).body,
    );
    expect(result.title).toBe("Olive shirt");
    expect(result.price).toBe("₹1499");
    expect(result.imageSource).toBe("retailer");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("never follows a redirect outside supported stores", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://127.0.0.1/internal" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = JSON.parse(
      (
        await handler({
          queryStringParameters: { url: "https://www.hm.com/olive-shirt" },
        })
      ).body,
    );
    expect(result.retailerError).toBe("Unsafe redirect");
    expect(
      fetch.mock.calls.some((c) => String(c[0]).includes("127.0.0.1")),
    ).toBe(false);
  });
});
it("resolves Amazon short links only through allowed retailer redirects", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "https://www.amazon.in/dp/EXAMPLE" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        '<meta property="og:title" content="Everyday cotton shirt"><meta property="og:image" content="https://images.example.com/shirt.jpg">',
        { headers: { "Content-Type": "text/html" } },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const result = JSON.parse(
    (
      await handler({
        queryStringParameters: { url: "https://amzn.in/d/example" },
      })
    ).body,
  );
  expect(result.title).toBe("Everyday cotton shirt");
  expect(result.vendor).toBe("amazon.in");
  expect(fetch).toHaveBeenCalledTimes(2);
});
