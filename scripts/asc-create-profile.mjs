#!/usr/bin/env node
/**
 * Create an App Store distribution provisioning profile for AVA.
 *
 * Why we need this: -exportArchive with -allowProvisioningUpdates can fail with
 * "Cloud signing permission error" when the API key role can't create cloud-
 * signed profiles on the fly. Creating a real profile up-front via the API
 * sidesteps the cloud-signing path.
 *
 * Required env (load from .appstore/.env):
 *   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH
 *   APP_BUNDLE_ID  (e.g. fr.digidatale.ava)
 *   APP_BUNDLE_REF (the API bundle id object id, e.g. SQZRQL8JTG)
 *
 * Output: writes the .mobileprovision binary into ./.appstore/profile.mobileprovision
 * and copies it into ~/Library/MobileDevice/Provisioning Profiles/ so xcodebuild
 * can pick it up.
 */

import jwt from 'jsonwebtoken';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;
const BUNDLE = process.env.APP_BUNDLE_ID;

if (!KEY_ID || !ISSUER_ID || !KEY_PATH || !BUNDLE) {
  console.error('Missing env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, APP_BUNDLE_ID');
  process.exit(1);
}

const privateKey = readFileSync(KEY_PATH, 'utf8');

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: 'appstoreconnect-v1' },
    privateKey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } },
  );
}

const token = makeToken();
const BASE = 'https://api.appstoreconnect.apple.com';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${method} ${path} → ${res.status}`);
    console.error(text);
    process.exit(1);
  }
  return text ? JSON.parse(text) : {};
}

console.log('Step 1/4: Find bundle id object…');
const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&limit=10`);
const bundleObj = (bundles.data || []).find((b) => b.attributes.identifier === BUNDLE);
if (!bundleObj) {
  console.error(`Bundle ${BUNDLE} not found via API`);
  process.exit(1);
}
console.log(`  bundleId.id = ${bundleObj.id}`);

console.log('Step 2/4: Find distribution certificate…');
const certs = await api('GET', `/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=20`);
let cert = (certs.data || []).find((c) => c.attributes.certificateType === 'DISTRIBUTION');
if (!cert) {
  // Some teams have IOS_DISTRIBUTION instead
  const certs2 = await api('GET', `/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION&limit=20`);
  cert = (certs2.data || []).find((c) => c.attributes.certificateType === 'IOS_DISTRIBUTION');
}
if (!cert) {
  console.error('No DISTRIBUTION certificate found. Did you upload the CSR and import the cert?');
  process.exit(1);
}
console.log(`  certificate.id = ${cert.id} (${cert.attributes.certificateType})`);

console.log('Step 3/4: Create provisioning profile…');
const profileName = `AVA App Store ${new Date().toISOString().slice(0, 10)}`;
const created = await api('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: {
      name: profileName,
      profileType: 'IOS_APP_STORE',
    },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundleObj.id } },
      certificates: { data: [{ type: 'certificates', id: cert.id }] },
    },
  },
});
const profile = created.data;
console.log(`  profile.id = ${profile.id} (name="${profile.attributes.name}")`);

console.log('Step 4/4: Decode + install profile…');
const b64 = profile.attributes.profileContent;
const buf = Buffer.from(b64, 'base64');

if (!existsSync('.appstore')) mkdirSync('.appstore');
const outPath = '.appstore/profile.mobileprovision';
writeFileSync(outPath, buf);
console.log(`  wrote ${outPath} (${buf.length} bytes)`);

const localProfilesDir = join(homedir(), 'Library/MobileDevice/Provisioning Profiles');
mkdirSync(localProfilesDir, { recursive: true });
const installedPath = join(localProfilesDir, `${profile.attributes.uuid}.mobileprovision`);
writeFileSync(installedPath, buf);
console.log(`  installed ${installedPath}`);

console.log('');
console.log(`Profile name : ${profile.attributes.name}`);
console.log(`Profile UUID : ${profile.attributes.uuid}`);
console.log(`Expires      : ${profile.attributes.expirationDate}`);
console.log('');
console.log('Now re-run scripts/ios-archive-and-upload.sh — the export step will pick up this profile.');
