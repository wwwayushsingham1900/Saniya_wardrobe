const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
function admin() {
  if (
    !getApps().length &&
    process.env.FIREBASE_AUTH_EMULATOR_HOST &&
    process.env.FIREBASE_DATABASE_EMULATOR_HOST &&
    process.env.GCLOUD_PROJECT?.startsWith("demo-")
  ) {
    initializeApp({
      projectId: process.env.GCLOUD_PROJECT,
      databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${process.env.GCLOUD_PROJECT}-default-rtdb`,
    });
  }
  if (!getApps().length) {
    const raw = process.env.FIREBASE_ADMIN_KEY;
    if (!raw) {
      const e = Error(
        "Online tools need server configuration. Your saved links are safe.",
      );
      e.status = 503;
      throw e;
    }
    let credential;
    try {
      credential = cert(JSON.parse(raw));
    } catch {
      const e = Error("Server credentials are not configured correctly.");
      e.status = 503;
      throw e;
    }
    initializeApp({
      credential,
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        "https://sania-wardrobe-default-rtdb.firebaseio.com",
    });
  }
  return getDatabase();
}
const response = (statusCode, data) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
  body: JSON.stringify(data),
});
async function authorize(event, { anonymous = true } = {}) {
  if (event.httpMethod !== "POST") {
    const e = Error("Use POST for this endpoint.");
    e.status = 405;
    throw e;
  }
  const bearer =
    event.headers?.authorization || event.headers?.Authorization || "";
  if (!bearer.startsWith("Bearer ")) {
    const e = Error("Sign in to use this feature.");
    e.status = 401;
    throw e;
  }
  admin();
  let user;
  try {
    user = await getAuth().verifyIdToken(bearer.slice(7));
  } catch {
    const e = Error("Your session expired. Sign in again.");
    e.status = 401;
    throw e;
  }
  if (!anonymous && user.firebase?.sign_in_provider === "anonymous") {
    const e = Error("Sign in with an account to manage invitations.");
    e.status = 403;
    throw e;
  }
  return user;
}
function body(event) {
  if (!event.body || event.body.length > 20000) {
    const e = Error("Invalid request.");
    e.status = 400;
    throw e;
  }
  try {
    return JSON.parse(event.body);
  } catch {
    const e = Error("Invalid JSON.");
    e.status = 400;
    throw e;
  }
}
async function limit(uid, kind, max = 10) {
  const now = Date.now(),
    path = admin().ref(`rateLimits/${uid}/${kind}`);
  const result = await path.transaction((v) => {
    if (!v || now - v.since >= 60000) return { since: now, count: 1 };
    if (v.count >= max) return;
    return { ...v, count: v.count + 1 };
  });
  if (!result.committed) {
    const e = Error("A few too many requests. Try again in a minute.");
    e.status = 429;
    throw e;
  }
}
const fail = (e) =>
  response(e.status || 500, {
    error: e.status
      ? e.message
      : "This service is temporarily unavailable. Please try again.",
  });
module.exports = { admin, response, authorize, body, limit, fail };
