# AVA-Lou Security & Correctness Audit — V13

Audit date: 2026-05-05  
Scope: src/, supabase/migrations/, public/sw.js  
Methodology: read every API route handler, every migration, voice flow, PDF/CSV pipelines, service worker.

---

## P0 — Security

### P0-1. Public `/voir/...` and `?public=1` PDF leak any document by UUID
**Files**:
- `src/app/voir/facture/[id]/page.tsx:18-24`
- `src/app/voir/devis/[id]/page.tsx:19-25`
- `src/app/api/factures/[id]/pdf/route.tsx:29-44`
- `src/app/api/devis/[id]/pdf/route.tsx:19-33`
- `src/lib/supabase/middleware.ts:4` (`/voir` whitelisted)

**Issue**: Both the public HTML viewer pages and the PDF endpoints in `?public=1` mode use `createAdminClient()` which **bypasses RLS** and fetches the document with no auth. The comment says "UUIDs are unguessable", but UUID v4 is not an authorization mechanism: anyone who ever received a public link (forwarded email, browser history, server logs, analytics referrer, accidentally shared) can read that document **and any other document if they ever obtain its UUID**. The PDF endpoint is hit unauthenticated by anyone who knows or guesses an id; there is no per-document signed token, no expiry, no allowed-recipient check. Worse, `notes` and full address/SIRET/email of both vendor and client are returned.

**Fix**: Add a signed-link table (`document_share_tokens` with `id, doc_id, kind, token, expires_at, used_count`) and require `?token=…` rather than just the doc id. Validate token on the server, store hash, expire after N days. Until then, at minimum scope `?public=1` to documents whose `status` is `envoyée/envoyé/accepté` (not drafts) and add referrer/UA logging.

---

### P0-2. Public `/voir` route leaks vendor profile (SIRET, address, banking-style legal mentions)
**File**: `src/app/voir/facture/[id]/page.tsx:28-32`, `src/app/voir/devis/[id]/page.tsx:29-33`

**Issue**: After loading the invoice/quote, the page also reads the vendor's full `profiles` row via admin client (`select('*')`) and renders it through `<LegalMentions />`. That's the artisan's home address, IBAN-related data, RCS, mediator, capital social, etc. — broadcast to anyone with the link. `select('*')` is a footgun if any sensitive column is added later (e.g. phone, banking).

**Fix**: Whitelist only the fields needed for legal display (`company_name, full_name, siret, address, postal_code, city, naf_code, legal_form, capital_social, rcs, vat_intra, tva_franchise, late_penalty_rate, late_penalty_indemnity, b2c_mediator, payment_terms_days`) and never `select('*')` from a public path.

---

### P0-3. `/api/cron/*` accepts any request that sets `x-vercel-cron: 1`
**Files**:
- `src/app/api/cron/weekly/route.ts:17-23`
- `src/app/api/cron/insights/route.ts:16-22`
- `src/app/api/cron/recurring/route.ts:17-21`

**Issue**: All three cron endpoints accept `req.headers.get('x-vercel-cron') === '1'` as proof of cron. That header is not stripped by Vercel for external clients — anyone on the internet can `curl -H 'x-vercel-cron: 1' https://app/api/cron/recurring` and trigger an admin-bypass run that touches every user. `recurring` will create real invoices in everyone's accounts; `weekly` writes notifications to all users; `insights` burns Anthropic budget and writes per-user.

**Fix**: Require `CRON_SECRET` always (drop the `isCron` short-circuit), or verify `x-vercel-signature` if available. Even if Vercel does strip the header (it does not in current platform docs), defense in depth requires a shared secret on cron endpoints because they run as service-role admin.

---

### P0-4. `mark_paid` confirm path trusts client-supplied `candidate_invoice_id`
**File**: `src/app/api/actions/[id]/confirm/route.ts:282-310`

**Issue**: `candidate_invoice_id` comes from `entities` on the `ava_actions` row. The `ava_actions` row is owned by the user, and the update is scoped by `.eq('user_id', user.id)`, so RLS catches cross-tenant abuse. **However**, the `entities` column is created in `/api/intent/route.ts` from Claude's output and then enriched server-side. A user could PATCH their own `ava_actions` row to inject a `candidate_invoice_id` they own but that wasn't actually identified by AVA, then call confirm to mark it paid — bypassing any audit trail Claude established. Not a cross-tenant exposure but a control bypass.

**Fix**: Re-resolve `candidate_invoice_id` server-side at confirm time from `entities.client_name` rather than trusting the stored id, or hash-sign the entities on insert.

---

## P1 — Correctness

### P1-1. CSV export is vulnerable to formula injection
**File**: `src/app/api/export/route.ts:35-42`

**Issue**: `csvEscape` quotes fields containing `;`, `"`, `\n`, `\r` — but does not prefix-quote values that begin with `=`, `+`, `-`, `@`, or tab. A client name like `=cmd|'/c calc'!A1` or a notes field `=HYPERLINK("evil.com")` written into a quote will execute as a formula in Excel/Numbers/LibreOffice when the accountant opens the export. Real CVE-class issue (CVE-2014-3524 family); accountants are exactly the user persona here.

**Fix**: After the existing escape, if the resulting string starts with `=`, `+`, `-`, `@`, or `\t`/`\r`, prefix with a single quote `'` before quoting (the canonical OWASP CSV-injection mitigation).

---

### P1-2. CSV export does not validate `from`/`to` date format
**File**: `src/app/api/export/route.ts:27-31, 76-78`

**Issue**: `QuerySchema` declares `from: z.string().optional()` with no regex. A caller can pass `from=2026-13-99` or `from=' OR 1=1` — Zod accepts it, then it's passed to `.gte('issue_date', from)`. Supabase will reject the malformed date, but only after a round-trip; more importantly, the spec says YYYY-MM-DD must be enforced. Not a SQL-injection vector (PostgREST parameterizes), but the contract is broken and downstream filename `factures_${from}_${to}.csv` lets arbitrary user input into Content-Disposition (filename header injection if a `\r\n` ever lands there — currently blocked because Zod strips JSON but not regex-validated).

**Fix**: `from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()` and same for `to`. Sanitize the filename (only `[\w\-.]`) before including it in the response header.

---

### P1-3. TVA computed on running floats — line-level rounding missing (French invoicing rule)
**File**: `src/lib/format.ts:38-51`

**Issue**: `computeTotals` accumulates `lineHt = qty * unit_price` and `lineHt * vat_rate/100` into running floats, then rounds only the final HT/TVA/TTC. French invoicing best practice (and BOI-TVA-DECLA-30-20-20-10) requires per-line 2-decimal rounding so the printed line totals sum exactly to the printed grand total. With the current code, a 25 m² × 45 € TTC 8.5% line displays `1219,69 €` but if there were 7 lines the sum-of-printed-lines vs grand total can drift by a few cents. The PDF and HTML view show per-line `lineHt = l.qty * l.unit_price` un-rounded (`invoice-pdf.tsx:414`, also rendered HTML), so a customer doing the math by hand will see mismatches.

**Fix**: Round each line's HT and VAT to 2 decimals at line level, then sum the rounded values. Display the rounded value on each line in the PDF/HTML.

---

### P1-4. Year-based invoice numbering still has a race + can collide on creation
**Files**:
- `src/app/api/factures/route.ts:60-68`
- `src/app/api/devis/route.ts:60-67`
- `src/app/api/actions/[id]/confirm/route.ts:154-161`
- `src/app/api/cron/recurring/route.ts:55-62`
- `src/app/api/devis/[id]/convert/route.ts:34-42`

**Issue**: Numbering uses `count(*) + 1`. There is a UNIQUE index `invoices_user_number_unique` (migration 0003) which prevents duplicates, but two concurrent POSTs (e.g. mobile retry + recurring cron firing at the same time) will both compute the same `count`, race to insert, and one will get `23505` unique-violation → 400/500 to the user. The user sees an error even though the action is recoverable. Also note: `factures/route.ts` filters with `.like('number', 'FAC-${year}-%')` while `confirm/route.ts` filters by `.gte('created_at', yearStart)` — two different counting strategies for the same numbering domain. A document created Dec 31 23:59 and inserted Jan 1 00:00 (clock skew, mobile offline replay) gets a year-mismatched number.

**Fix**: Replace `count` with a Postgres sequence (`create sequence invoice_number_2026`) per-user-per-year, or use `for update` row lock on a `numbering_counters(user_id, year, kind)` table inside a SQL function. Also consolidate to a single counting strategy.

---

### P1-5. `findOrCreateClient` "reverse fuzzy" loads all clients and runs in JS
**File**: `src/app/api/actions/[id]/confirm/route.ts:65-75`

**Issue**: For an artisan with 500+ clients (real for established users), the third matching strategy fetches *every* client row over the wire and matches in Node. Aside from latency, an attacker exploiting a name collision — e.g., creating a client named "M." — would match any dictation containing "m.". Vocal mark-paid would then attach to a wildcard client.

**Fix**: Bound the result with `.limit(50)` and require `c.name.length >= 3` before substring-matching; if more than one match, surface "ambiguous, confirm" instead of picking arbitrarily.

---

### P1-6. Service worker caches authenticated HTML pages → previous user's data visible after logout
**File**: `public/sw.js:81-95` (PAGES_CACHE for navigation)

**Issue**: Navigation requests are cached by URL with `caches.open(PAGES_CACHE).put(request, copy)`. After logout (or account switch on a shared device), if the new state is offline the SW returns the cached `/factures`, `/clients`, `/dashboard` HTML which embeds the previous user's invoice numbers, client names, and totals (Server Component output is in the HTML body). The auth cookie is gone but the cache is keyed by URL only.

**Fix**: On logout, post a message `CLEAR_PAGES_CACHE` to the SW and have it `caches.delete(PAGES_CACHE)`. Also add `Cache-Control: private, no-store` on authenticated pages and skip caching responses whose URL is in the auth-required matcher.

---

### P1-7. Insights cron sends client names + revenue per client to Anthropic
**File**: `src/lib/insights.ts:215-225, 272-296`

**Issue**: `summarizeSnapshot` builds plain-text lines like `M. Payet : 4500 € sur 12 factures (10 payées, 2 en retard, retard moyen 38j)` and ships them to `claude-sonnet-4-5`. Per CLAUDE.md ("Onde sober public-service") and DROM-artisan trust expectations, real client names + financial behavior leaving the platform without consent is a problem. Anthropic's data-retention policy applies but the user has no on/off control.

**Fix**: Pseudonymize names before sending (`Client A`, `Client B`, …) and keep the mapping server-side; map back on parse. Add a profile flag `share_client_names_with_ai` (default false) and surface in /parametres.

---

### P1-8. Whisper audio sent to OpenAI without consent record / redaction
**Files**: `src/app/api/transcribe/route.ts:42`, `src/lib/whisper.ts:30-36`

**Issue**: The artisan's voice is sent to OpenAI Whisper. RGPD-relevant; no consent log written, no privacy notice surfaced before recording in the UI. Also `formData.get('audio')` is accepted as any Blob with no MIME-type allowlist (the `audio.type` is fed directly to Whisper as the File constructor's type).

**Fix**: Add a one-time consent prompt persisted to `profiles.voice_consent_at`, refuse mic until set; reject any `audio.type` not in `['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg']` before forwarding.

---

## P2 — Defense in depth

### P2-1. `/api/factures` GET, `/api/devis` GET, `/api/expenses` GET, `/api/recurring` GET, `/api/clients` GET, `/api/appointments` GET have no `.eq('user_id', user.id)` filter
**Files**: `src/app/api/factures/route.ts:30`, `src/app/api/devis/route.ts:29`, `src/app/api/expenses/route.ts:25`, `src/app/api/recurring/route.ts:35`, `src/app/api/clients/route.ts:32`, `src/app/api/appointments/route.ts:21`

**Issue**: All rely on RLS alone. The CLAUDE-MD style says "defense in depth". If RLS is ever disabled or a future migration drops a policy, every list endpoint cross-leaks. Cheap to add the filter explicitly.

**Fix**: Append `.eq('user_id', user.id)` on every authenticated query.

---

### P2-2. `console.error('[confirm] insert error', insertErr)` and similar log full Supabase errors
**Files**: `src/app/api/actions/[id]/confirm/route.ts:185`, `src/app/api/intent/route.ts:132,146`, `src/lib/insights.ts:294,346`

**Issue**: Supabase error objects can include the failing query and column hints. Vercel logs are typically restricted, but they end up in Vercel observability and are searchable by anyone with project access. For a 1-person-team that's fine; if you ever add a contractor it leaks.

**Fix**: Log a redacted code (`{code: insertErr.code, hint: insertErr.hint}`) and an opaque request-id; keep details out of logs.

---

### P2-3. Public viewer pages set `dynamic = 'force-dynamic'` but no rate limit
**File**: `src/app/voir/facture/[id]/page.tsx:9`

**Issue**: Combined with P0-1, anyone can iterate UUIDs (low probability but non-zero) and Vercel will dutifully serve responses. No per-IP rate limit.

**Fix**: Add Edge middleware rate limit on `/voir/*` and `/api/*/pdf?public=1` (e.g., Vercel KV-based 30 req/min/IP).

---

### P2-4. `PrintButton` and route handlers accept any `id` string without UUID validation
**Files**: every `[id]` route, e.g. `src/app/api/factures/[id]/route.ts:23`

**Issue**: `id` from the URL path is passed straight to `.eq('id', id)`. Postgres returns `invalid input syntax for type uuid` for malformed strings → 400 bubbles up. Not exploitable but noisy in logs.

**Fix**: `z.string().uuid().parse(id)` at the top of each handler.

---

### P2-5. `vat_rate` stored on invoice header even with mixed-rate `line_items`
**File**: `src/app/api/actions/[id]/confirm/route.ts:162` (uses `lineItems[0].vat_rate`)

**Issue**: If voice extraction produces a multi-rate invoice (rare in DROM but possible), the header `vat_rate` is set from the first line only, then `/api/export/route.ts:131` exports it as a single rate. Mismatch between detail and aggregate. Cron-recurring (`recurring/route.ts:74`) also stores a single header rate.

**Fix**: When `line_items` rates are mixed, set header `vat_rate = null` and surface "multi-taux" in the CSV/PDF.

---

### P2-6. PDF generation registers Google Fonts at runtime
**File**: `src/lib/pdf/invoice-pdf.tsx:36-50`

**Issue**: Each cold start fetches `fonts.gstatic.com` server-side. If Google blocks Vercel's IP range (rare) or the URL changes, PDFs break silently and fall back to Times. Also a third-party network call on every cold-start invoice generation.

**Fix**: Bundle the TTF in `/public/fonts/` and register from a local URL.

---

### P2-7. `is_drom` not enforced — user can set `vat_default = 20` while in DROM
**File**: `src/app/api/actions/[id]/confirm/route.ts:125-127`

**Issue**: `defaultVat = profile?.vat_default ?? (profile?.is_drom ? 8.5 : 20)` — if the user explicitly stored `vat_default = 20` while `is_drom = true`, voice flow will insert at 20%. That's a tax-correctness bug (DROM-resident artisan filing at metropole rate). Conversely a metropole user with `is_drom = true` quirk gets 8.5%.

**Fix**: At settings save, if `is_drom = true` and `vat_default not in [0, 8.5, 2.1]`, warn or refuse. Or compute `defaultVat = profile?.is_drom ? 8.5 : (profile?.vat_default ?? 20)`.

---

## Summary

12 P0+P1 findings, 7 P2. Highest-impact items: P0-1/P0-2 (public document viewer is unauthenticated by UUID — fix before any marketing push), P0-3 (cron header spoofing — anyone can trigger admin-bypass jobs), P1-1 (CSV formula injection in accountant export), P1-6 (SW cache leaks across logout). RLS policies are present and correct on every user-scoped table; the gaps are at the application boundary where admin client is intentionally used.
