# Circuit Trace — Official Website

Marketing website for **Circuit Trace**, a minimalist flow puzzle game for Android.

🌐 Live at: [circuittrace.app](https://circuittrace.app)
🎮 Game: [Google Play](https://play.google.com/store/apps/details?id=com.game.circuittrace)
🏢 Studio: [Grounded Studio](https://grounded-studio.app)

## Structure

```
circuittrace/
├── index.html              Home / landing
├── features.html           All game features in detail
├── modes.html              7 game modes deep-dive
├── editor.html             Puzzle Editor + Share Codes focus page
├── support.html            FAQ and contact
├── press.html              Press kit (fact sheet, bio, downloads)
├── invite.html             Deep link friend-invite handler
├── privacy.html            Privacy policy
├── terms.html              Terms of service
├── 404.html                Custom error page
├── blog/
│   └── index.html          Blog hub (placeholder)
├── assets/
│   ├── css/style.css       Shared design system
│   ├── js/main.js          Shared scripts (hamburger, FAQ)
│   ├── icon-ct.png         App icon
│   ├── hero-mockup.png     Hero image (3-phone composition)
│   ├── og-image.png        Social share preview
│   ├── favicon.png         Browser favicon
│   ├── screenshots/        Phone screenshots
│   └── press/              Press kit downloadables
├── .well-known/
│   └── assetlinks.json     Android App Links verification
├── CNAME                   circuittrace.app
├── robots.txt
├── sitemap.xml
└── llms.txt                AI/LLM crawler descriptor
```

## Design

- **Light theme** (opposite of grounded-studio.app which is dark)
- **Playful game vibe** with multi-color accents from the game palette
- **Outfit** font (headings/body) + **JetBrains Mono** (code)
- **Soft shadows + rounded cards** (not glowy dark panels)

## Hosting

- Hosted on **GitHub Pages**
- Custom domain `circuittrace.app` via Cloudflare DNS
- HTTPS enforced
- Deployed on push to `main`

## Updating

- Edit any file → commit → GitHub Pages redeploys in ~1 min
- Sitemap and llms.txt should be updated when new pages are added

## Contact

contact@grounded-studio.app
