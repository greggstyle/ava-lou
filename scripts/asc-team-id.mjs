#!/usr/bin/env node
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;

if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('Missing env');
  process.exit(1);
}

const privateKey = readFileSync(KEY_PATH, 'utf8');
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: 'appstoreconnect-v1' },
  privateKey,
  { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } },
);

const res = await fetch('https://api.appstoreconnect.apple.com/v1/profiles?limit=1', {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  // Try via certificates if profiles fails
  const c = await fetch('https://api.appstoreconnect.apple.com/v1/certificates?limit=5', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (c.ok) {
    const cj = await c.json();
    console.log('Certificates found:', cj.data.length);
  }
  console.error('profiles HTTP', res.status, await res.text());
  process.exit(1);
}
const json = await res.json();
console.log(JSON.stringify(json.data, null, 2));
