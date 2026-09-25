const { authorize, body, limit, fail } = require("./lib/server");
const { handler: preview } = require("./lib/scraper");
exports.handler = async (event) => {
  try {
    const user = await authorize(event);
    await limit(user.uid, "preview");
    const data = body(event);
    const result = await preview({
      queryStringParameters: {
        url: typeof data.url === "string" ? data.url : "",
      },
    });
    result.headers["cache-control"] = "private, max-age=600";
    return result;
  } catch (e) {
    return fail(e);
  }
};
