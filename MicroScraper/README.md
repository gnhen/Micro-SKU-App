# Micro SKU App

Scan Micro Center product barcodes, look up SKUs, check store inventory, and build PC component lists — all from your phone.

---

## Installation

### iOS — TestFlight (Recommended)

Join the TestFlight beta to install the app directly to your iPhone:

[Join the TestFlight Beta](#)

### Android — Sideloading

1. Visit the [Releases tab](https://github.com/grant/Micro-SKU-App/releases)
2. Download the latest Android `.apk`
3. Install on your device

### iOS — Sideloaded IPA

1. Visit the [Releases tab](https://github.com/grant/Micro-SKU-App/releases)
2. Download the latest iOS `.ipa`
3. Sideload using [Sideloadly](https://sideloadly.io/) or [SideStore](https://sidestore.io/) (SideStore recommended)
4. Refresh the app every 7 days or sooner (or use the shortcut below)

### iOS Shortcut Version

For users who cannot or will not sideload, there is an iOS Shortcut that opens product pages directly.

1. [Visit the Shortcut URL](#)
2. Install the shortcut
3. Add to Home Screen:
   - Tap the **⋯** button in the top-right of the shortcut
   - Tap the shortcut **Name**
   - Tap **"Add to Home Screen"**

---

## Development

### Prerequisites

- Node.js 18+
- Expo CLI
- Xcode (iOS) or Android Studio (Android)

### Setup

```bash
npm install
npx expo start
```

### Build Android

```bash
npx expo run:android
```

### Build iOS

```bash
npx expo run:ios
```

---

## Features

- **Barcode Scanner** — Scan product barcodes to instantly look up pricing and inventory
- **Text Search** — Search by product name, keyword, or SKU
- **Per-Store Inventory** — Check exact stock levels at your selected Micro Center
- **PC Builder** — Save components to a personal build list
- **Search History** — Quickly revisit past lookups
- **Customizable Tabs** — Rearrange or hide tabs to fit your workflow
- **Multiple Themes** — System, Light, Dark, and Windows XP
- **Custom App Icons** — Choose from 9 icon styles

---

## Tech Stack

- [Expo](https://expo.dev) / React Native
- [expo-router](https://expo.github.io/router/) — File-based routing
- [SQLite](https://expo.github.io/sqlite/) — Local component storage
- [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) — Barcode scanning

---

## License

Private / All rights reserved.
