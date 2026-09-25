SANIA'S SHARED WARDROBE CHECKLIST — REAL-TIME VERSION

What it does
* The same mobile-friendly checklist with Add heading, Add item, optional items,
  delete, progress, and Reset ticks.
* Share one private room link with Sania. Changes appear on both phones/laptops.
* Firebase handles synchronization; you need to connect your own free project.

ONE-TIME SETUP (approx. 10-20 min)
1. Go to https://console.firebase.google.com/ and create a Firebase project.
2. Project settings > Your apps > Add a Web app; copy the Firebase config
   object and paste its values into config.js in this folder.
3. Build > Authentication > Sign-in method > enable Anonymous.
4. Build > Realtime Database > Create database; find its exact databaseURL
   under Realtime Database > Data and enter it in config.js.
5. Realtime Database > Rules: replace the rules with database.rules.json,
   then Publish. Link holders can edit: keep the link private.
6. Upload index.html and config.js to a public HTTPS static host. Netlify Drop
   (https://app.netlify.com/drop) can publish the two files from a folder;
   alternatively GitHub Pages or Firebase Hosting work.
7. Open your hosted URL. A unique room is created automatically. Click
   'Copy invite link' and send that exact link to Sania. Both people must open
   the SAME link. Changes should appear in real time.

IMPORTANT
* Opening the HTML with file:// does NOT provide real-time sharing. Host it.
* Share room invite URL privately. Anyone with that link can edit the list.
* Anyone with the Firebase project/config can create anonymous auth sessions;
  the sample rules protect access via a long random room ID, not named accounts.
* Don't commit secrets or private credentials to config.js; Firebase Web config
  is designed to be public, but security rules and usage limits matter.
* Existing local-only checklist changes do not automatically move into the
  shared room; the shared room starts with the original default checklist.

NEW: AUTOMATIC PRODUCT LINKS
* Choose a heading and paste any public product URL into Add a product link.
  Paste automatically adds the link to your shared list (or tap Add product).
* The Netlify function extracts public product title, image and price when
  available from supported shopping sites (Myntra, AJIO, H&M, Zara, Amazon,
  Flipkart and others). Sites may block metadata, prices may be unavailable.
  In that case, the link is still added using a title from the URL; tap
  Edit details to correct the name or add a price.
* Both users see links, image previews when available, ticks and edits
  through the existing Firebase Realtime Database room.
* To use link previews, deploy the COMPLETE sania_shared folder to Netlify
  with netlify.toml and netlify/functions/product-preview.js intact.
  A static-only host like GitHub Pages will still add links but cannot fetch
  product images/prices automatically.
* Redeploy this NEW version to the SAME Netlify site URL to keep your old
  room link working. Keep the existing config.js values if already set up.
* No product purchase is made; it only saves a link and public metadata.
