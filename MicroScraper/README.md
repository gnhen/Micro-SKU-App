# Micro SKU App

An unofficial toolbelt for Micro Center retail employees. Scan barcodes, look up SKUs, check per-store inventory, and build PC component lists — all from your phone.

---

## Installation

### iOS — TestFlight

[Join the TestFlight Beta](https://testflight.apple.com/join/PLACEHOLDER)

### Android — Sideloading

1. Visit the [Releases tab](https://github.com/grant/Micro-SKU-App/releases)
2. Download the latest Android `.apk`
3. Install on your device

### iOS — Sideloaded IPA

1. Visit the [Releases tab](https://github.com/grant/Micro-SKU-App/releases)
2. Download the latest iOS `.ipa`
3. Sideload using [Sideloadly](https://sideloadly.io/) or [SideStore](https://sidestore.io/)
4. Refresh the app every 7 days (or use the iOS Shortcut below)

### iOS Shortcut Version

For users who cannot or will not sideload, an iOS Shortcut opens product pages directly.

1. [Install the shortcut](#)
2. Add to Home Screen — tap **⋯** → tap the shortcut **Name** → **"Add to Home Screen"**

---

## Features

- **Barcode Scanner** — Scan product barcodes to instantly look up pricing and inventory
- **Text Search** — Search by product name, keyword, or SKU
- **Per-Store Inventory** — Check exact stock levels at your selected Micro Center
- **PC Builder** — Save components to a personal build list
- **Search History** — Quickly revisit past lookups
- **Customizable Tabs** — Rearrange or hide tabs to fit your workflow
- **Multiple Themes** — System, Light, Dark, and Windows XP
- **Custom App Icons** — Choose from 9 icon styles (requires a built app, not Expo Go)

---

## Development

### Prerequisites

- Node.js 18+
- Expo CLI
- Xcode (iOS) or Android Studio (Android)

### Setup

```bash
cd MicroScraper
npm install
npx expo start
```

### Build

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios

# Prebuild (generates native ios/ and android/ folders)
npx expo prebuild

# EAS build (cloud build for distribution)
eas build --platform android
eas build --platform ios
```

### Dynamic App Icons

The app supports 9 launcher icon variants (black, gray, green, purple, salmon, serious, teal, white, default). These are configured via the `@howincodes/expo-dynamic-app-icon` config plugin in `app.json`. 

After adding or modifying icon assets, run `npx expo prebuild` to regenerate native icon sets. Icons must be 1024×1024 PNGs.

> **Note:** Dynamic icon switching only works in a dev client or EAS/local build — it does not work in Expo Go.

### Cloudflare Challenge Flow

When Micro Center's Cloudflare bot detection triggers, the app uses a hidden WebView to solve the challenge automatically. If that fails, a visible WebView modal prompts the user to complete the challenge manually. The flow is implemented in:

- `hooks/useChallengeSolver.tsx` — shared background solver hook
- `app/challenge.tsx` — visible challenge modal
- `services/challengeSession.js` — challenge request persistence
- `services/challengeWebViewUtils.js` — injected JS for challenge detection

### Regenerating Data Files

The app ships with pre-generated lookup data for Store 071 (Sharonville) and UI Care codes:

```bash
# Regenerate store 071 lookup table
node scripts/buildStore071Lookup.js

# Regenerate UI Care data
node scripts/buildUiCareData.js

# Regenerate store 071 map index
node scripts/buildStore071MapIndex.js
```

The generated files (`constants/store071Lookup.ts`, `constants/store071MapIndex.ts`, `constants/uiCareData.ts`) are marked "do not edit" — regenerate them instead.

---

## Architecture Notes

- **Scraper**: Product data is scraped from `microcenter.com` via regex-based HTML parsing in `services/scraper.ts`. The scraper spoofs a Pixel 7 UA and handles Cloudflare challenges.
- **Exact Stock**: Uses the "cart trick" — adds the item to a session cart to leak `QuantityInStock`, then removes it.
- **Persistence**: All user data (lists, history, builds, settings) is stored in AsyncStorage. PC Builder components use SQLite.
- **Remote Kill Switch**: On launch, the app checks GitHub API for availability. If the repo is gone, a "Service Unavailable" screen is shown.

---

## Privacy Policy

[View Privacy Policy](../privacy_policy.md)

---

## License

Private / All rights reserved.
