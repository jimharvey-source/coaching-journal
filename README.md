# Coaching Journal

Private, live guide books for coaching clients. One site, one book per client.

- Live address: https://coaching.themessagebusiness.com/<client> (e.g. /ines)
- Hosting: Vercel, from this GitHub repo. Static files only: no build step.
- Data: Supabase project DelegateIgnite (fdiitxhgfytvlbtokbok), schema `coaching`.
  - `coaching.clients`: one row per client: slug, name, title, the book's content (HTML), hashed access codes.
  - `coaching.entries`: what the client writes, one row per box.
  - The page talks to two database functions only: `coaching_open` and `coaching_save`. The tables are not reachable from the browser.
- Each client has two codes: theirs (can write in their boxes) and the coach's (reads everything; can write only boxes whose id starts with `coach-`).
- Offline: entries save on the device first and sync when back online. A service worker keeps the page itself available offline after the first visit.

## Updating a book
Chapters live in the database, not in this repo. Claude updates `coaching.clients.content_html` for the client. No redeploy needed.

## Adding a client
Insert a row in `coaching.clients` with a new slug, content and two new code hashes (sha256 of salt + CODE in capitals). Claude can do this.

## First-time setup (once)
1. GitHub: create a private repo `coaching-journal` under jimharvey-source and push this folder.
2. Vercel: Add New > Project > import `coaching-journal`. Framework: Other. No build command. Deploy.
3. Vercel > coaching-journal > Settings > Domains: add `coaching.themessagebusiness.com`. Copy the CNAME value Vercel shows.
4. Cloudflare > themessagebusiness.com > DNS: add CNAME `coaching` pointing to that value. Proxy status: grey cloud (DNS only).
