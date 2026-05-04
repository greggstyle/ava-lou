'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvaTopBar, AvaCard, AvaField, AvaButton, AvaDisclaimer, AvaLabel, C, SANS } from '@/components/ava';

const inputStyle: React.CSSProperties = {
  background: C.paper,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: '12px 14px',
  font: `500 15px/1.3 ${SANS}`,
  color: C.ink,
  width: '100%',
  outline: 'none',
};

export default function NouveauClientPage() {
  const router = useRouter();
  const [isBusiness, setIsBusiness] = React.useState(false);
  const [name, setName] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [siret, setSiret] = React.useState('');
  const [vatIntra, setVatIntra] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [city, setCity] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [siretLookup, setSiretLookup] = React.useState<{ status: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ status: 'idle' });

  async function lookupSiret() {
    if (!siret || siret.replace(/\D/g, '').length !== 14) {
      setSiretLookup({ status: 'err', msg: 'SIRET incomplet (14 chiffres requis).' });
      return;
    }
    setSiretLookup({ status: 'busy' });
    try {
      const res = await fetch(`/api/lookup/siret?siret=${encodeURIComponent(siret)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Lookup échoué');
      }
      const data = await res.json();
      setCompanyName(data.denomination ?? companyName);
      setAddress(data.address ?? address);
      setPostalCode(data.postal_code ?? postalCode);
      setCity(data.city ?? city);
      if (!name) setName(data.denomination ?? name);
      setSiretLookup({ status: 'ok', msg: `Trouvé : ${data.denomination}` });
    } catch (err) {
      setSiretLookup({ status: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          postal_code: postalCode || null,
          city: city || null,
          notes: notes || null,
          is_business: isBusiness,
          company_name: isBusiness ? companyName || null : null,
          siret: isBusiness ? siret || null : null,
          vat_intra: isBusiness ? vatIntra || null : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur lors de la création');
      }
      router.push('/clients');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar title="Nouveau client" onBack={() => router.back()} />

      <form onSubmit={onSubmit} style={{ padding: '8px 20px 120px', flex: 1, overflowY: 'auto' }}>
        <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isBusiness}
              onChange={(e) => setIsBusiness(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
              Client professionnel (entreprise)
            </span>
          </label>

          {isBusiness && (
            <>
              <AvaField label="SIRET" hint="14 chiffres — auto-remplit le reste">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                  />
                  <AvaButton kind="light" onClick={lookupSiret} disabled={siretLookup.status === 'busy'}>
                    {siretLookup.status === 'busy' ? 'Recherche…' : 'Rechercher'}
                  </AvaButton>
                </div>
                {siretLookup.status === 'ok' && (
                  <div style={{ marginTop: 6, font: `500 12px/1.4 ${SANS}`, color: C.green }}>{siretLookup.msg}</div>
                )}
                {siretLookup.status === 'err' && (
                  <div style={{ marginTop: 6, font: `500 12px/1.4 ${SANS}`, color: C.warn }}>{siretLookup.msg}</div>
                )}
              </AvaField>
              <AvaField label="Raison sociale">
                <input style={inputStyle} type="text" value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Plomberie Hoarau SARL" />
              </AvaField>
              <AvaField label="N° TVA intracommunautaire">
                <input style={inputStyle} type="text" value={vatIntra}
                  onChange={(e) => setVatIntra(e.target.value)}
                  placeholder="FR12345678901" />
              </AvaField>
            </>
          )}

          <AvaField label={isBusiness ? 'Contact (nom + prénom)' : 'Nom *'}>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
              autoFocus required placeholder={isBusiness ? 'Marie Hoarau' : 'Marie Dupont'} />
          </AvaField>
          <AvaField label="Email">
            <input style={inputStyle} type="email" autoComplete="email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="marie@exemple.com" />
          </AvaField>
          <AvaField label="Téléphone">
            <input style={inputStyle} type="tel" autoComplete="tel" inputMode="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="0692 00 00 00" />
          </AvaField>
          <AvaField label="Adresse">
            <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="12 rue des Filaos" />
          </AvaField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <AvaField label="Code postal">
              <input style={inputStyle} type="text" maxLength={5} inputMode="numeric"
                value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                placeholder="97400" />
            </AvaField>
            <AvaField label="Ville">
              <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Saint-Denis" />
            </AvaField>
          </div>
          <AvaField label="Notes">
            <textarea style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations utiles, préférences…" />
          </AvaField>
        </AvaCard>

        {error && (
          <div style={{ marginTop: 12, font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>
        )}

        <div style={{ marginTop: 16 }}>
          <AvaDisclaimer />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link href="/clients" style={{ textDecoration: 'none', flex: 1 }}>
            <AvaButton kind="light" full>Annuler</AvaButton>
          </Link>
          <div style={{ flex: 1 }}>
            <AvaButton kind="primary" full type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </AvaButton>
          </div>
        </div>
      </form>
    </main>
  );
}
