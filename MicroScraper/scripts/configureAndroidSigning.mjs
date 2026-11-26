// Run after `expo prebuild --platform android` in CI.
//
// Expo's generated build.gradle signs release builds with a debug keystore that
// is identical for every Expo project, so anyone could produce an APK that
// installs over this app as an "update". This script points the release build at
// a real keystore instead, read from environment variables:
//
//   ANDROID_KEYSTORE_PATH      path to the .jks/.keystore file
//   ANDROID_KEYSTORE_PASSWORD  keystore password
//   ANDROID_KEY_ALIAS          key alias
//   ANDROID_KEY_PASSWORD       key password
//
// If any are missing it changes nothing and exits 0, so unsigned/debug-signed
// builds keep working. It is idempotent.
import fs from 'node:fs';
import path from 'node:path';

const gradlePath = path.resolve('android/app/build.gradle');
const required = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.warn(`[signing] Missing ${missing.join(', ')}. Leaving the default debug signing in place.`);
  process.exit(0);
}

if (!fs.existsSync(gradlePath)) {
  console.error(`[signing] ${gradlePath} not found. Run expo prebuild first.`);
  process.exit(1);
}
if (!fs.existsSync(process.env.ANDROID_KEYSTORE_PATH)) {
  console.error(`[signing] Keystore not found at ${process.env.ANDROID_KEYSTORE_PATH}.`);
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
if (gradle.includes('MICRO_SKU_RELEASE_SIGNING')) {
  console.log('[signing] Already configured.');
  process.exit(0);
}

const releaseConfig = `        release { // MICRO_SKU_RELEASE_SIGNING
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
`;

// 1. Add a release signingConfig right after the existing signingConfigs { debug {...} } block.
const signingBlock = /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s{8}\}\n)/;
if (!signingBlock.test(gradle)) {
  console.error('[signing] Could not find the signingConfigs block in build.gradle.');
  process.exit(1);
}
gradle = gradle.replace(signingBlock, `$1${releaseConfig}`);

// 2. Point the release buildType at it.
const releaseBuildType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
if (!releaseBuildType.test(gradle)) {
  console.error('[signing] Could not find the release buildType signingConfig.');
  process.exit(1);
}
gradle = gradle.replace(releaseBuildType, '$1signingConfig signingConfigs.release');

fs.writeFileSync(gradlePath, gradle);
console.log('[signing] Release builds will use the configured keystore.');
