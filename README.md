# 🍔 Burger Ready! — Idle Burger Shop

An original, cartoon-style **idle burger restaurant game** built with plain HTML5 + Canvas + JavaScript (no frameworks, no build step). Cook burgers, serve hungry customers, earn coins, and upgrade your shop.

> This is an original game inspired by the idle-cooking genre. All artwork is drawn in code — it does not copy the assets, art, or UI of any existing commercial title.

---

## ▶️ How to play

- Tap the big **COOK** button (or tap near the counter) to grill a burger onto the tray.
- Tap a waiting customer to serve their order.
- Earn coins, level up, and open **UPGRADES** to grow your shop.

**Upgrades**

| Upgrade | Effect |
|---|---|
| 💲 Tastier Recipe | More coins per burger |
| 🍔 Bigger Counter | Hold more ready burgers |
| ⚡ Faster Grill | Cook faster |
| 👨‍🍳 Hire Cook | Auto-makes burgers (idle income) |
| 🧑‍💼 Hire Cashier | Auto-serves customers (idle income) |
| 🪑 More Space | Room for more customers |

Progress auto-saves to your browser, and idle staff keep earning while you're away.

---

## 💻 Run locally

Because the game uses a service worker and `localStorage`, serve it over HTTP (don't just double-click the file):

```bash
# from the project folder
python3 -m http.server 8080
# then open http://localhost:8080
```

## 🌐 Project files

```
index.html      # markup, HUD, cook button, shop panel, modal
styles.css      # cartoon idle-game styling (glossy, mobile-friendly)
game.js         # full game engine (rendering, economy, upgrades, save)
manifest.json   # PWA manifest (installable app metadata)
sw.js           # service worker (offline cache)
icon-*.png      # original burger app icons
make_icons.py   # regenerates the PNG icons (requires Pillow)
```

---

## 📱 Putting it on the Google Play Store

A web game can't be uploaded to Play directly — Play needs an Android app bundle (`.aab`). Since this game is already a **PWA**, the easiest path is to wrap it in a **Trusted Web Activity (TWA)** with Google's **Bubblewrap** tool. The wrapper just opens your hosted game full-screen inside an Android app.

### Step 0 — Host the game first
Bubblewrap wraps a **live URL**, so publish the PWA somewhere public over HTTPS, e.g.:
- **GitHub Pages** (repo must be public): Settings → Pages → Branch `main` / root.
- **Netlify / Vercel / Firebase Hosting** (free tiers work great).

Confirm the live URL loads and that `manifest.json` is reachable.

### Option A — Bubblewrap (TWA, recommended, free)

Requires Node.js 18+ and a JDK (Bubblewrap can install the Android SDK for you).

```bash
# 1. Install the CLI
npm install -g @bubblewrap/cli

# 2. Initialize from your hosted manifest
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.json

# 3. Build the Android app bundle + APK
bubblewrap build
```

This produces:
- `app-release-bundle.aab` → upload this to the Play Console
- `app-release-signed.apk` → install on a device to test (`adb install`)

**Important — Digital Asset Links:** TWAs must prove they own the website so the URL bar is hidden. Bubblewrap prints an `assetlinks.json` file. Host it at:

```
https://YOUR-DOMAIN/.well-known/assetlinks.json
```

Use the SHA-256 fingerprint of the key Play uses to sign your app (find it in **Play Console → Setup → App signing**). Re-check with:

```bash
bubblewrap validate --domain YOUR-DOMAIN
```

#### Even easier: PWABuilder
[https://www.pwabuilder.com](https://www.pwabuilder.com) — paste your hosted URL, click **Package for Stores → Android**, and it generates the signed `.aab` plus the `assetlinks.json` for you (it uses Bubblewrap under the hood).

### Option B — Capacitor (bundles the files inside the app)

Use this if you'd rather ship the HTML/JS **inside** the APK (works offline with no hosting):

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Burger Ready" "com.yourname.burgerready" --web-dir .
npx cap add android
npx cap copy
npx cap open android   # opens Android Studio → Build → Generate Signed Bundle/APK
```

### Step — Publish on Play
1. Create a **Google Play Developer account** (one-time $25 USD fee).
2. In the **Play Console**, create an app → upload your `.aab`.
3. Fill in store listing: title, short/full description, **screenshots** (phone), and a **512×512 icon** (use `icon-512.png`) + a **1024×500 feature graphic**.
4. Complete the required questionnaires (content rating, data safety, target audience).
5. Roll out to **Internal testing** first, then **Production**.

> First-time review usually takes a few days. New developer accounts may need extra testing/verification before production access.

---

## 🛠️ Regenerate icons

```bash
pip install Pillow
python3 make_icons.py
```

## 📄 License / ownership
This game and its code-drawn art are original. You're free to customize, rebrand, and publish it as your own.
