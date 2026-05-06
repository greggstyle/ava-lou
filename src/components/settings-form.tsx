'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AvaButton, AvaCard, AvaField, AvaLabel, C, SANS, SERIF } from '@/components/ava';
import type { LegalForm } from '@/lib/types';
import { TtsPrefToggle } from '@/components/tts-pref-toggle';
import { IbanScanButton } from '@/components/iban-scan-button';

export interface ProfileForm {
  full_name: string;
  company_name: string;
  siret: string;
  activity_sector: string;
  vat_default: number;
  is_drom: boolean;
  tutoiement: boolean;
  // Legal
  address: string;
  postal_code: string;
  city: string;
  naf_code: string;
  naf_label: string;
  legal_form: LegalForm | '';
  capital_social: string;
  rcs: string;
  vat_intra: string;
  tva_franchise: boolean;
  late_penalty_rate: string;
  payment_terms_days: string;
  b2c_mediator: string;
  // Bank coordinates — used in PDF + public invoice page so clients can virer
  iban: string;
  bic: string;
  bank_name: string;
  payment_link_url: string;
  payment_link_provider: string;
}

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

export function SettingsForm({ initialProfile }: { initialProfile: ProfileForm }) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<ProfileForm>(initialProfile);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [siretLookup, setSiretLookup] = React.useState<{ status: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ status: 'idle' });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      // Coerce numerics back to numbers / null
      const payload: Record<string, unknown> = {
        id: user.id,
        full_name: profile.full_name || null,
        company_name: profile.company_name || null,
        siret: profile.siret || null,
        activity_sector: profile.activity_sector || null,
        vat_default: Number(profile.vat_default),
        is_drom: profile.is_drom,
        tutoiement: profile.tutoiement,
        address: profile.address || null,
        postal_code: profile.postal_code || null,
        city: profile.city || null,
        naf_code: profile.naf_code || null,
        naf_label: profile.naf_label || null,
        legal_form: profile.legal_form || null,
        capital_social: profile.capital_social ? Number(profile.capital_social) : null,
        rcs: profile.rcs || null,
        vat_intra: profile.vat_intra || null,
        tva_franchise: profile.tva_franchise,
        late_penalty_rate: profile.late_penalty_rate ? Number(profile.late_penalty_rate) : 10.5,
        payment_terms_days: profile.payment_terms_days ? Number(profile.payment_terms_days) : 30,
        b2c_mediator: profile.b2c_mediator || null,
        iban: profile.iban ? profile.iban.replace(/\s+/g, '').toUpperCase() : null,
        bic: profile.bic ? profile.bic.replace(/\s+/g, '').toUpperCase() : null,
        bank_name: profile.bank_name || null,
        payment_link_url: profile.payment_link_url || null,
        payment_link_provider: profile.payment_link_provider || null,
      };
      const { error: upErr } = await supabase.from('profiles').upsert(payload);
      if (upErr) throw upErr;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  }

  async function lookupSiret() {
    if (!profile.siret || profile.siret.replace(/\D/g, '').length !== 14) {
      setSiretLookup({ status: 'err', msg: 'SIRET incomplet (14 chiffres requis).' });
      return;
    }
    setSiretLookup({ status: 'busy' });
    try {
      const res = await fetch(`/api/lookup/siret?siret=${encodeURIComponent(profile.siret)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Lookup échoué');
      }
      const data = await res.json();
      setProfile((p) => ({
        ...p,
        company_name: data.denomination ?? p.company_name,
        address: data.address ?? p.address,
        postal_code: data.postal_code ?? p.postal_code,
        city: data.city ?? p.city,
        naf_code: data.naf_code ?? p.naf_code,
        naf_label: data.naf_label ?? p.naf_label,
        legal_form: (data.legal_form_label as LegalForm) ?? p.legal_form,
        // Auto-set franchise flag for auto-entrepreneurs
        tva_franchise: data.is_individual ? true : p.tva_franchise,
      }));
      setSiretLookup({ status: 'ok', msg: `Trouvé : ${data.denomination}` });
    } catch (err) {
      setSiretLookup({ status: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <>
      <AvaCard padding={16}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AvaField label="Nom complet">
            <input type="text" style={inputStyle} value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Lou Hoarau" />
          </AvaField>
          <AvaField label="Entreprise / raison sociale">
            <input type="text" style={inputStyle} value={profile.company_name}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Lou Plomberie" />
          </AvaField>
          <AvaField label="SIRET" hint="14 chiffres — bouton Vérifier pour auto-remplir">
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" style={{ ...inputStyle, flex: 1 }} maxLength={14}
                inputMode="numeric"
                value={profile.siret}
                onChange={(e) => setProfile({ ...profile, siret: e.target.value })} />
              <AvaButton kind="light" onClick={lookupSiret}
                disabled={siretLookup.status === 'busy'}>
                {siretLookup.status === 'busy' ? 'Recherche…' : 'Vérifier'}
              </AvaButton>
            </div>
            {siretLookup.status === 'ok' && (
              <div style={{ marginTop: 6, font: `500 12px/1.4 ${SANS}`, color: C.green }}>{siretLookup.msg}</div>
            )}
            {siretLookup.status === 'err' && (
              <div style={{ marginTop: 6, font: `500 12px/1.4 ${SANS}`, color: C.warn }}>{siretLookup.msg}</div>
            )}
          </AvaField>
          <AvaField label="Secteur d'activité">
            <input type="text" style={inputStyle} value={profile.activity_sector}
              onChange={(e) => setProfile({ ...profile, activity_sector: e.target.value })}
              placeholder="Plomberie, électricité, …" />
          </AvaField>
          <AvaField label="TVA par défaut" hint="20 % métropole, 8,5 % DROM, 0 % auto-entrepreneur en franchise">
            <select style={inputStyle} value={profile.vat_default}
              onChange={(e) => setProfile({ ...profile, vat_default: Number(e.target.value) })}>
              <option value={20}>20 %</option>
              <option value={10}>10 %</option>
              <option value={8.5}>8,5 % (DROM)</option>
              <option value={5.5}>5,5 %</option>
              <option value={0}>0 %</option>
            </select>
          </AvaField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={profile.is_drom}
              onChange={(e) => setProfile({ ...profile, is_drom: e.target.checked })}
              style={{ width: 18, height: 18 }} />
            <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
              Je suis basé en DROM (Réunion, Martinique, Guadeloupe, Mayotte, Guyane)
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={profile.tutoiement}
              onChange={(e) => setProfile({ ...profile, tutoiement: e.target.checked })}
              style={{ width: 18, height: 18 }} />
            <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>AVA me tutoie</span>
          </label>
          <TtsPrefToggle />
        </div>
      </AvaCard>

      <AvaCard padding={16}>
        <AvaLabel style={{ marginBottom: 6 }}>Informations légales</AvaLabel>
        <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginBottom: 14 }}>
          Renseigner ces champs rend vos factures conformes <em style={{ fontFamily: SERIF, fontStyle: 'italic' }}>art. L441-9</em> du Code de commerce.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AvaField label="Adresse">
            <input type="text" style={inputStyle} value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder="12 rue des Lilas" />
          </AvaField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <AvaField label="Code postal">
              <input type="text" style={inputStyle} maxLength={5} inputMode="numeric"
                value={profile.postal_code}
                onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
                placeholder="97400" />
            </AvaField>
            <AvaField label="Ville">
              <input type="text" style={inputStyle} value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="Saint-Denis" />
            </AvaField>
          </div>
          <AvaField label="Forme juridique">
            <select style={inputStyle} value={profile.legal_form}
              onChange={(e) => setProfile({ ...profile, legal_form: e.target.value as LegalForm | '' })}>
              <option value="">Non précisée</option>
              <option value="auto-entrepreneur">Auto-entrepreneur / Micro-entreprise</option>
              <option value="EI">EI (Entreprise individuelle)</option>
              <option value="EURL">EURL</option>
              <option value="SARL">SARL</option>
              <option value="SAS">SAS</option>
              <option value="SASU">SASU</option>
              <option value="autre">Autre</option>
            </select>
          </AvaField>
          {(profile.legal_form === 'EURL' ||
            profile.legal_form === 'SARL' ||
            profile.legal_form === 'SAS' ||
            profile.legal_form === 'SASU') && (
            <AvaField label="Capital social (€)" hint="Pour société uniquement">
              <input type="text" style={inputStyle} inputMode="decimal"
                value={profile.capital_social}
                onChange={(e) => setProfile({ ...profile, capital_social: e.target.value })}
                placeholder="1000" />
            </AvaField>
          )}
          <AvaField label="Code NAF/APE" hint="ex 4321A — Travaux d'installation électrique">
            <input type="text" style={inputStyle} value={profile.naf_code}
              onChange={(e) => setProfile({ ...profile, naf_code: e.target.value })}
              placeholder="4321A" />
          </AvaField>
          <AvaField label="RCS" hint="ex RCS Saint-Denis 123 456 789">
            <input type="text" style={inputStyle} value={profile.rcs}
              onChange={(e) => setProfile({ ...profile, rcs: e.target.value })} />
          </AvaField>
          <AvaField label="N° TVA intracommunautaire" hint="ex FR12345678901">
            <input type="text" style={inputStyle} value={profile.vat_intra}
              onChange={(e) => setProfile({ ...profile, vat_intra: e.target.value })} />
          </AvaField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={profile.tva_franchise}
              onChange={(e) => setProfile({ ...profile, tva_franchise: e.target.checked })}
              style={{ width: 18, height: 18 }} />
            <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
              Franchise de TVA (mention &laquo; TVA non applicable, art. 293 B du CGI &raquo;)
            </span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <AvaField label="Pénalités retard (% an)" hint="défaut 10,5">
              <input type="text" style={inputStyle} inputMode="decimal"
                value={profile.late_penalty_rate}
                onChange={(e) => setProfile({ ...profile, late_penalty_rate: e.target.value })} />
            </AvaField>
            <AvaField label="Délai paiement (jours)" hint="défaut 30">
              <input type="text" style={inputStyle} inputMode="numeric"
                value={profile.payment_terms_days}
                onChange={(e) => setProfile({ ...profile, payment_terms_days: e.target.value })} />
            </AvaField>
          </div>
          <AvaField label="Médiateur de la consommation" hint="Pour clients particuliers, art. L612-1">
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              value={profile.b2c_mediator}
              onChange={(e) => setProfile({ ...profile, b2c_mediator: e.target.value })}
              placeholder="Ex: CNPM Médiation, 27 av. Henri Frenay — 13002 Marseille — cnpm-mediation-consommation.eu" />
          </AvaField>
        </div>
      </AvaCard>

      <AvaCard padding={16}>
        <AvaLabel>Coordonnées bancaires</AvaLabel>
        <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.muted, marginTop: 6, marginBottom: 12 }}>
          Affichées sur les factures pour permettre à vos clients de payer par virement.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IbanScanButton
            tone="soft"
            onResult={(r) => {
              setProfile({
                ...profile,
                iban: r.iban ?? profile.iban,
                bic: r.bic ?? profile.bic,
                bank_name: r.bank_name ?? profile.bank_name,
              });
            }}
          />
          <AvaField label="IBAN" hint="ex FR76 1234 5678 9012 3456 7890 123">
            <input type="text" style={inputStyle}
              value={profile.iban}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setProfile({ ...profile, iban: e.target.value })}
              placeholder="FR76 …" />
          </AvaField>
          <AvaField label="BIC / SWIFT" hint="8 ou 11 caractères, ex BNPAFRPP">
            <input type="text" style={inputStyle}
              value={profile.bic}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setProfile({ ...profile, bic: e.target.value })}
              placeholder="BNPAFRPPXXX" />
          </AvaField>
          <AvaField label="Nom de la banque" hint="ex Crédit Agricole Réunion">
            <input type="text" style={inputStyle}
              value={profile.bank_name}
              onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })} />
          </AvaField>
        </div>
      </AvaCard>

      <AvaCard padding={16}>
        <AvaLabel>Lien de paiement en ligne</AvaLabel>
        <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.muted, marginTop: 6, marginBottom: 12 }}>
          Si vous avez créé un lien Stripe / SumUp / Lydia / PayPal.me, collez-le ici.
          AVA l&apos;inclura dans les emails de relance pour permettre un règlement
          par carte en 1 clic, en plus du virement.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AvaField label="URL du lien de paiement" hint="Ex: https://buy.stripe.com/abc123 ou https://pay.sumup.com/b2c/XXX">
            <input
              type="url"
              style={inputStyle}
              value={profile.payment_link_url}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setProfile({ ...profile, payment_link_url: e.target.value })}
              placeholder="https://buy.stripe.com/…"
            />
          </AvaField>
          <AvaField label="Fournisseur" hint="Affiché au client pour transparence — ex: Stripe, SumUp, PayPal">
            <input
              type="text"
              style={inputStyle}
              value={profile.payment_link_provider}
              onChange={(e) => setProfile({ ...profile, payment_link_provider: e.target.value })}
              placeholder="Stripe"
            />
          </AvaField>
        </div>
      </AvaCard>

      {error && <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <AvaButton kind="primary" full onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement…' : saved ? 'Enregistré' : 'Enregistrer'}
        </AvaButton>
      </div>

      <AvaCard padding={16}>
        <AvaLabel>Déconnexion</AvaLabel>
        <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.muted, marginTop: 6, marginBottom: 12 }}>
          Vous serez déconnecté de cet appareil.
        </div>
        <AvaButton kind="danger" onClick={handleSignOut}>Se déconnecter</AvaButton>
      </AvaCard>
    </>
  );
}
