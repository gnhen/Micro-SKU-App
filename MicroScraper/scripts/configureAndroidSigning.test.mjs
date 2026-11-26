import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./configureAndroidSigning.mjs', import.meta.url));
const requiredSecrets = [
  'ANDROID_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

const runSigningScript = (cwd, env) =>
  spawnSync(process.execPath, [scriptPath], { cwd, env, encoding: 'utf8' });

test('leaves generated signing unchanged when release secrets are absent', async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'micro-sku-signing-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const env = { ...process.env };
  for (const secret of requiredSecrets) delete env[secret];

  const result = runSigningScript(cwd, env);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Leaving the default debug signing in place/);
});

test('configures release signing once and is idempotent', async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'micro-sku-signing-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const gradlePath = path.join(cwd, 'android', 'app', 'build.gradle');
  const keystorePath = path.join(cwd, 'release.keystore');
  await mkdir(path.dirname(gradlePath), { recursive: true });
  await writeFile(keystorePath, 'test-keystore');
  await writeFile(gradlePath, `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}
`);

  const env = {
    ...process.env,
    ANDROID_KEYSTORE_PATH: keystorePath,
    ANDROID_KEYSTORE_PASSWORD: 'store-password',
    ANDROID_KEY_ALIAS: 'release',
    ANDROID_KEY_PASSWORD: 'key-password',
  };
  const firstRun = runSigningScript(cwd, env);
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const configuredGradle = await readFile(gradlePath, 'utf8');
  assert.equal((configuredGradle.match(/MICRO_SKU_RELEASE_SIGNING/g) || []).length, 1);
  assert.match(configuredGradle, /signingConfig signingConfigs\.release/);

  const secondRun = runSigningScript(cwd, env);
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.equal(await readFile(gradlePath, 'utf8'), configuredGradle);
});
