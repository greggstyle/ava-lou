'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AvaButton, AvaCard, AvaField, AvaLabel, C, SANS, SERIF } from '@/components/ava';
import { IbanScanButton } from '@/components/iban-scan-button';

interface OnboardingWizardProps {
  initialFullName: string;
  initialCompanyName: string;
  initialSiret: string;
  initialIban: string;
  initialBic: string;
  initialIsDrom: boolean;
  email: string;
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

type Step = 1 | 2 | 3;

/**
 * Three-step onboarding wizard shown as a fullscreen overlay on first visit
 * when the profile is incomplete. Each step has "Plus tard" to dismiss the
 * wizard for this session (sets onboarding_dismissed_at). Only "Terminer" on
 * step 3 marks it completed permanently.
 *
 * Step 1: identité (nom + entreprise + DROM)
 * Step 2: SIRET (auto-lookup via data.gouv)
 * Step 3: coordonnées bancaires (IBAN/BIC)
 */
export function OnboardingWizard(props: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [fullName, setFullName] = React.useState(props.initialFullName);
  const [companyName, setCompanyName] = React.useState(props.initialCompanyName);
  const [siret, setSiret] = React.useState(props.initialSiret);
  const [iban, setIban] = React.useState(props.initialIban);
  const [bic, setBic] = React.useState(props.initialBic);
  const [bankName, setBankName] = React.useState('');
  const [isDrom, setIsDrom] = React.useState(props.initialIsDrom);
  const [siretLookup, setSiretLookup] = React.useState<{ status: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ status: 'idle' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function lookupSiret() {
    const cleaned = siret.replace(/\D/g, '');
    if (cleaned.length !== 14) {
      setSiretLookup({ status: 'err', msg: 'SIRET incomplet (14 chiffres requis).' });
      return;
    }
    setSiretLookup({ status: 'busy' });
    try {
      const r = await fetch(`/api/lookup/siret?siret=${cleaned}`);
      if (!r.ok) {
        setSiretLookup({ status: 'err', msg: 'SIRET non trouvé.' });
        return;
      }
      const j = await r.json();
      const name = j?.nom_complet || j?.denominationUniteLegale || j?.company_name || j?.name;
      if (name && !companyName) setCompanyName(name);
      setSiretLookup({ status: 'ok', msg: name ?? 'OK' });
    } catch {
      setSiretLookup({ status: 'err', msg: 'Erreur réseau.' });
    }
  }

  async function persist(opts: { complete: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const payload: Record<string, unknown> = { id: user.id };
      if (fullName) payload.full_name = fullName;
      if (companyName) payload.company_name = companyName;
      if (siret) payload.siret = siret.replace(/\D/g, '');
      if (iban) payload.iban = iban.replace(/\s+/g, '').toUpperCase();
      if (bic) payload.bic = bic.replace(/\s+/g, '').toUpperCase();
      if (bankName) payload.bank_name = bankName;
      payload.is_drom = isDrom;
      payload.vat_default = isDrom ? 8.5 : 20;

      if (opts.complete) {
        payload.onboarding_completed_at = new Date().toISOString();
      } else {
        payload.onboarding_dismissed_at = new Date().toISOString();
      }

      const { error: upErr } = await supabase.from('profiles').upsert(payload);
      if (upErr) throw upErr;
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(11, 29, 51, 0.65)',
      // Centré verticalement (desktop + mobile) plutôt que collé en bas —
      // donne une impression de modale soignée sur grand écran et reste
      // confortable au pouce sur iPhone (le scroll interne s'en charge).
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 12px',
    }}>
      <div style={{
        background: C.bone,
        borderRadius: 18,
        width: '100%',
        maxWidth: 440,
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 20px 60px rgba(11, 29, 51, 0.18)',
      }}>
        {/* Header */}
        <div>
          <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.4 }}>
            Étape {step} / 3
          </div>
          <h2 style={{ font: `400 30px/1.15 ${SERIF}`, color: C.ink, margin: '6px 0 4px', letterSpacing: '-0.01em' }}>
            {step === 1 && (<>Bienvenue sur <em style={{ fontStyle: 'italic' }}>AVA</em></>)}
            {step === 2 && (<>Vos <em style={{ fontStyle: 'italic' }}>mentions légales</em></>)}
            {step === 3 && (<>Vos <em style={{ fontStyle: 'italic' }}>coordonnées</em> bancaires</>)}
          </h2>
          <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.ink2 }}>
            {step === 1 && "Deux-trois infos pour personnaliser votre espace. Vous pourrez tout modifier plus tard dans Paramètres."}
            {step === 2 && "Le SIRET permet à AVA de pré-remplir votre raison sociale et de générer des factures conformes (mentions L441-9)."}
            {step === 3 && "Affichées sur vos factures pour que vos clients règlent par virement. Sans IBAN, ils devront vous le demander."}
          </div>
        </div>

        {/* Step content */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AvaField label="Votre prénom">
              <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Lou Hoarau" autoFocus />
            </AvaField>
            <AvaField label="Nom de votre entreprise" hint="Sera pré-rempli avec le SIRET à l'étape suivante si non renseigné">
              <input style={inputStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Hoarau Plomberie" />
            </AvaField>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 0' }}>
              <input type="checkbox" checked={isDrom} onChange={(e) => setIsDrom(e.target.checked)} style={{ width: 20, height: 20 }} />
              <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
                Je suis basé en DROM (TVA 8,5 % par défaut)
              </span>
            </label>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, padding: 8, background: C.soft, borderRadius: 6 }}>
              Compte : {props.email}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AvaField label="SIRET" hint="14 chiffres — collez ou tapez">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={siret}
                  inputMode="numeric"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => setSiret(e.target.value)}
                  placeholder="123 456 789 00012"
                  autoFocus
                />
                <AvaButton kind="light" onClick={lookupSiret} disabled={siretLookup.status === 'busy'}>
                  {siretLookup.status === 'busy' ? '...' : 'Vérifier'}
                </AvaButton>
              </div>
            </AvaField>
            {siretLookup.status === 'ok' && (
              <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.green, padding: 8, background: C.greenSoft, borderRadius: 6 }}>
                ✓ {siretLookup.msg}
              </div>
            )}
            {siretLookup.status === 'err' && (
              <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn, padding: 8, background: C.soft, borderRadius: 6 }}>
                {siretLookup.msg}
              </div>
            )}
            <div style={{ font: `400 12px/1.45 ${SANS}`, color: C.muted }}>
              Sans SIRET, vos factures ne portent pas les mentions légales obligatoires (L441-9 / D441-5).
              Vous pouvez l&apos;ajouter plus tard, mais aucune facture émise dans cette période ne sera conforme.
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <IbanScanButton
              tone="primary"
              onResult={(r) => {
                if (r.iban) setIban(r.iban);
                if (r.bic) setBic(r.bic);
                if (r.bank_name) setBankName(r.bank_name);
              }}
            />
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 }}>
              Ou saisissez à la main
            </div>
            <AvaField label="IBAN" hint="ex FR76 1234 5678 9012 3456 7890 123">
              <input
                style={inputStyle}
                value={iban}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 …"
              />
            </AvaField>
            <AvaField label="BIC / SWIFT" hint="Pas obligatoire pour un IBAN français">
              <input
                style={inputStyle}
                value={bic}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setBic(e.target.value)}
                placeholder="BNPAFRPPXXX"
              />
            </AvaField>
            <AvaField label="Nom de la banque">
              <input style={inputStyle} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Crédit Agricole Réunion" />
            </AvaField>
          </div>
        )}

        {error && (
          <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn, padding: 10, background: C.soft, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {step < 3 && (
            <AvaButton kind="primary" full onClick={async () => {
              if (step === 1) {
                await persist({ complete: false });
              } else if (step === 2) {
                await persist({ complete: false });
              }
              setStep((step + 1) as Step);
            }} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Continuer'}
            </AvaButton>
          )}
          {step === 3 && (
            <AvaButton kind="validate" full onClick={() => void persist({ complete: true })} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Terminer'}
            </AvaButton>
          )}
          <AvaButton kind="ghost" full onClick={() => void persist({ complete: false })} disabled={busy}>
            Plus tard
          </AvaButton>
        </div>
      </div>
    </div>
  );
}
