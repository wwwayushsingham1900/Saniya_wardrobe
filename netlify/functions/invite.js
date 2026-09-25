const crypto = require("node:crypto");
const {
  admin,
  authorize,
  body,
  limit,
  response,
  fail,
} = require("./lib/server");
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
exports.handler = async (event) => {
  try {
    const user = await authorize(event, { anonymous: false });
    await limit(user.uid, "invite", 10);
    const data = body(event);
    if (!/^[a-f0-9]{40}$/.test(data.roomId))
      return response(400, { error: "Invalid wardrobe." });
    const accessRef = admin().ref(`roomAccess/${data.roomId}`),
      access = (await accessRef.get()).val();
    if (!access)
      return response(409, {
        error:
          "This legacy room needs an administrator to assign ownership first.",
      });
    if (data.action === "accept") {
      if (typeof data.token !== "string" || !/^[a-f0-9]{64}$/.test(data.token))
        return response(400, { error: "Invalid invitation." });
      const inviteRef = admin().ref(
        `invites/${data.roomId}/${hash(data.token)}`,
      );
      const invite = (await inviteRef.get()).val();
      if (
        !invite ||
        invite.expiresAt < Date.now() ||
        !["editor", "viewer"].includes(invite.role)
      )
        return response(410, {
          error: "This invitation expired or was revoked. Ask for a new link.",
        });
      if (!access.members?.[user.uid])
        await accessRef.child(`members/${user.uid}`).set(invite.role);
      return response(200, { joined: true });
    }
    if (access.ownerId !== user.uid)
      return response(403, { error: "Only the owner can manage invitations." });
    if (data.action === "create") {
      if (!["editor", "viewer"].includes(data.role))
        return response(400, { error: "Choose editor or viewer access." });
      const token = crypto.randomBytes(32).toString("hex");
      await admin()
        .ref(`invites/${data.roomId}/${hash(token)}`)
        .set({
          role: data.role,
          expiresAt: Date.now() + 7 * 86400000,
          createdBy: user.uid,
        });
      return response(200, { token });
    }
    if (data.action === "revoke") {
      await admin().ref(`invites/${data.roomId}`).remove();
      return response(200, { revoked: true });
    }
    if (data.action === "remove-member") {
      if (
        typeof data.uid !== "string" ||
        data.uid === access.ownerId ||
        /[.#$\[\]\/]/.test(data.uid)
      )
        return response(400, { error: "Invalid member." });
      await accessRef.child(`members/${data.uid}`).remove();
      return response(200, { removed: true });
    }
    return response(400, { error: "Unknown invitation action." });
  } catch (e) {
    return fail(e);
  }
};
