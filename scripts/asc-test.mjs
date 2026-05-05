#!/usr/bin/env node
/**
 * Quick App Store Connect API connectivity test.
 *
 * Usage:
 *   ASC_KEY_ID=MDAFVFXY36 \
 *   ASC_ISSUER_ID=xxxx-xxxx-xxxx \
 *   ASC_KEY_PATH=./.appstore/AuthKey_MDAFVFXY36.p8 \
 *   node scripts/asc-test.mjs
 *
 * Lists apps + bundle IDs visible to the key. If we see `fr.digidatale.ava`,
 * the bundle ID is registered and ready for builds.
 */

import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;

if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('Missing env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH');
  process.exit(1);
}

const privateKey = readFileSync(KEY_PATH, 'utf8');

const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 60 * 15, // 15 min — App Store Connect max is 20 min
    aud: 'appstoreconnect-v1',
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  },
);

console.log('Generated JWT (first 60 chars):', token.slice(0, 60) + '…');

async function api(path) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} — ${body.slice(0, 400)}`);
  }
  return res.json();
}

(async () => {
  console.log('\n→ Apps visible to this key:');
  try {
    const apps = await api('/v1/apps');
    if (apps.data.length === 0) {
      console.log('  (no apps yet — create one in App Store Connect with bundle id fr.digidatale.ava)');
    }
    for (const a of apps.data) {
      console.log(`  · ${a.attributes.name} (${a.attributes.bundleId}) — id ${a.id}`);
    }
  } catch (e) {
    console.error('  apps query failed:', e.message);
  }

  console.log('\n→ Bundle IDs registered to your developer team:');
  try {
    const bundles = await api('/v1/bundleIds?filter[platform]=IOS&limit=200');
    const matching = bundles.data.filter((b) => b.attributes.identifier === 'fr.digidatale.ava');
    for (const b of matching) {
      console.log(`  ✓ ${b.attributes.identifier} (${b.attributes.name}) — id ${b.id}`);
    }
    if (matching.length === 0) {
      console.log('  (fr.digidatale.ava not found — register at developer.apple.com/account/resources/identifiers)');
      console.log(`  Total bundle IDs visible: ${bundles.data.length}`);
    }
  } catch (e) {
    console.error('  bundles query failed:', e.message);
  }

  console.log('\n→ TestFlight info:');
  try {
    const apps = await api('/v1/apps?filter[bundleId]=fr.digidatale.ava');
    if (apps.data.length === 0) {
      console.log('  (no app for fr.digidatale.ava — create one in App Store Connect)');
    } else {
      const appId = apps.data[0].id;
      const builds = await api(`/v1/builds?filter[app]=${appId}&limit=5`);
      console.log(`  Found ${builds.data.length} TestFlight build(s) for AVA.`);
      for (const b of builds.data) {
        console.log(`  · build ${b.attributes.version} (${b.attributes.processingState}) uploaded ${b.attributes.uploadedDate}`);
      }
    }
  } catch (e) {
    console.error('  builds query failed:', e.message);
  }

  console.log('\n✓ ASC credentials valid.');
})();
