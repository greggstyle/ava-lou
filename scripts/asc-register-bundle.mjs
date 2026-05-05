#!/usr/bin/env node
/**
 * Register the fr.digidatale.ava bundle ID via App Store Connect API.
 *
 * Usage:
 *   ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=... node scripts/asc-register-bundle.mjs
 */

import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;
const BUNDLE_ID = process.env.APP_BUNDLE_ID || 'fr.digidatale.ava';
const APP_NAME = 'AVA';

if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('Missing env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH');
  process.exit(1);
}

const privateKey = readFileSync(KEY_PATH, 'utf8');
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: 'appstoreconnect-v1' },
  privateKey,
  { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } },
);

async function api(path, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text}`);
  return text ? JSON.parse(text) : {};
}

(async () => {
  // Check if already exists
  console.log(`Checking if ${BUNDLE_ID} is already registered…`);
  const existing = await api(`/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&filter[platform]=IOS`);
  if (existing.data && existing.data.length > 0) {
    console.log(`✓ Bundle ID ${BUNDLE_ID} already exists — id ${existing.data[0].id}`);
    process.exit(0);
  }

  console.log(`Registering ${BUNDLE_ID}…`);
  const created = await api('/v1/bundleIds', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: BUNDLE_ID,
          name: APP_NAME,
          platform: 'IOS',
        },
      },
    }),
  });

  console.log(`✓ Bundle ID created — id ${created.data.id}`);
  console.log('  identifier:', created.data.attributes.identifier);
  console.log('  name:', created.data.attributes.name);
  console.log('');
  console.log('Next: create the app in App Store Connect (web UI required):');
  console.log('  https://appstoreconnect.apple.com/apps');
  console.log(`  + → Nouvelle app → iOS → Nom: ${APP_NAME} → Bundle ID: ${BUNDLE_ID}`);
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
