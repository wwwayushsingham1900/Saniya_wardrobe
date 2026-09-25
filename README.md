# Sania’s Wardrobe

A React + TypeScript rebuild of the existing shared wardrobe. The app keeps existing `#room=…` links and Firebase item/category IDs compatible. Opening `/` restores the configured main shared wardrobe. Private space opens a separate account-only collection without changing the shared room URL.

## Run locally

Use Node 22.12+ (Node 22 is configured for Netlify).

```sh
npm ci
npm run dev
```

Set `VITE_DEFAULT_ROOM_ID` in ignored `.env.local` (and in Netlify build environment variables) to select the main shared wardrobe. Explicit `#room=…` links take priority; otherwise the configured room opens, falling back to the last successfully opened room on that browser. Without either, a labelled local demo opens. Use `/?demo=1` for an explicit demo. Never commit room IDs or invite tokens. The configured default is included in the browser bundle and opens for site visitors; legacy link-based access remains unchanged.

The browser Firebase configuration is in `public/config.js` (public identifiers, not server credentials). The original root `config.js` remains for reference. Enable `localhost` / `127.0.0.1` as appropriate in Firebase Authentication’s authorized domains for local sign-in. These are separate hostnames: authorizing `localhost` does not authorize `127.0.0.1`. The production hostname `saniyawardrobe.netlify.app` must also be listed. Google must additionally be enabled under Authentication → Sign-in method with a support email configured.

### Sharing between two accounts

Keep opening the same complete room link. Signing in does not delete its items, change its room ID, or automatically create another wardrobe. Existing legacy links allow both people to add, edit and remove shared items before or after signing in. For an account-controlled room, use the default Editor invitation: after joining once, either account can add, edit, delete or check off shared items without the other person's approval. Viewer invitations remain read-only. Private clothes and notes belong to the signed-in account and are separate from the shared wishlist; deploy the new rules before using them in production.

Copy `.env.example` to `.env` for optional server credentials. Vite serves the three Netlify function routes locally. Server secrets are never prefixed with `VITE_` or exposed to the browser bundle.

## Implemented

- Mobile-first overview, persistent bottom navigation, thumb-reachable quick add, 44px touch targets, bottom-sheet forms, and compact optional details.
- Responsive checklist, category filtering, search, favourites, wishlist, and light/dark appearance.
- Existing Firebase room subscriptions and transaction-based collaboration. Required/optional items remain separate.
- Google and email/password sign-in, registration, anonymous-account linking, password reset.
- Existing account-owned rooms support owner/editor/viewer access, expiring invitations and member removal. The main UI no longer creates or switches shared rooms during sign-in.
- Immediate product-link saving; asynchronous retailer metadata and image-search fallback; retry and manual editing/photo selection.
- Product options can reference an existing checklist need, without increasing the essentials count.
- Category suggestions: server-side Gemini when configured, explicit keyword fallback otherwise. Suggestions are confirmed before saving; no silent category creation.
- Actual INR purchase amounts and a wardrobe budget, independently of checklist ticks.
- Recent activity (last 60 changes), JSON backup, and account-private notes.
- Account-private clothes with add/edit/delete, search, product links, image URLs, wishlist and purchase details. Stored separately under `users/{uid}/privateItems`; opening Private space never switches the shared room.

Private notes are **access-controlled, not end-to-end encrypted**. Do not use this feature as a password or payment-card vault. The activity feed is collaborative history, not a tamper-proof audit log.

## Verification

```sh
npm run build
npm test
npm run test:e2e
npm run test:rules
npm run test:connected
```

The browser suite covers desktop Chromium, Android Chrome-sized screens, and iPhone WebKit, including 320px/360px layouts and light/dark accessibility checks. Install browsers once with `npx playwright install chromium webkit`.

The Firebase tests require Java. They use the `demo-wardrobe` emulator project and disposable test accounts, never the production database. The connected test exercises signup without room replacement, a secure room, a viewer invitation, cross-browser live sync, private-note isolation, private-item CRUD and returning to the same shared room. Run emulator commands one at a time because they share ports 9000/9099.

## Production setup and deployment

1. Back up the current production database in Firebase Console before publishing rules. Keep the current Netlify deployment available for rollback.
2. In the existing Firebase project, retain Anonymous sign-in for legacy links and enable Email/Password and Google. Add the existing Netlify domain to authorized domains.
3. Publish `database.rules.json` to the **existing** database. Example after `firebase login`:
   ```sh
   npx firebase deploy --only database --project sania-wardrobe
   ```
   These rules preserve existing legacy room access. They do not assign ownership to anyone holding a link. New legacy room creation is disabled; new rooms require an account.
4. Set `VITE_DEFAULT_ROOM_ID` in the Netlify build environment to the existing room ID. Set server environment variables on the **existing** Netlify site:
   - `FIREBASE_ADMIN_KEY`: Firebase service account JSON, server/functions scope only.
   - `FIREBASE_DATABASE_URL`: the existing RTDB URL.
   - `SERPAPI_KEY`: retain the existing key for image-search fallback.
   - Optional `GEMINI_API_KEY` and `GEMINI_MODEL`: choose a currently available text model. Without both, categorization returns labelled keyword suggestions.
5. Build/deploy using `netlify.toml`: build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`. Deploy to the existing site to preserve its domain. Deploying only `dist` via a static drag-and-drop will omit the functions.
6. Verify the existing private link from two browsers. Verify Google/email login, a new viewer invite, a blocked retailer preview, and private-note isolation in production.

When admin configuration is missing, online functions return a clear setup error; saved links remain available for manual editing. Google provider configuration and production credentials must be checked on the actual services before claiming the release is live.

## Existing-room ownership migration

Legacy rooms have no reliable recorded owner. Their links retain the previous behaviour: anyone with the link and an anonymous Firebase session can edit. To upgrade one room, first establish the intended owner and collaborator account UIDs explicitly.

```sh
# Reads the selected room and shows a summary; no writes by default.
node --env-file=.env scripts/assign-room-owner.cjs --room ROOM_ID --owner OWNER_UID --editor EDITOR_UID
# Only after reviewing the UIDs:
node --env-file=.env scripts/assign-room-owner.cjs --room ROOM_ID --owner OWNER_UID --editor EDITOR_UID --apply
```

The script writes a private local backup under ignored `backups/`, then atomically adds only access metadata. Existing checklist data is not replaced. It refuses a second migration when ownership exists. After migration, the same URL works for named members; other link holders must receive a new invitation. No migration has been executed automatically.

Original frontend files are archived under `legacy/`. `database.rules.legacy.json` is an exact source snapshot, **not a validated rollback ruleset** (the old source used an unsupported `numChildren()` rules expression). Rollback should use the exported deployed rules and the prior Netlify deploy, not blindly publish that file. Do not roll back new secure rooms to the old app/rules, which do not enforce membership.

## Deliberately deferred

A cryptographic vault, password/card storage, biometric unlock, photo uploads, outfit calendar, weather, automated price tracking, push notifications, and durable offline edit queues. Shared-room changes currently require connectivity. Preview jobs run while the tab remains open; interrupted previews can be retried. Whole-room transactions are retained for compatibility and should be normalized into item-level writes before substantially increasing room size.
