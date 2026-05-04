'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AvaButton, AvaCard, AvaField, AvaLabel, C, SANS } from '@/components/ava';

interface ProfileForm {
  full_name: string;
  company_name: string;
  siret: string;
  activity_sector: string;
  vat_default: number;
  is_drom: boolean;
  tutoiement: boolean;
}

export function SettingsForm({ initialProfile }: { initialProfile: ProfileForm }) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<ProfileForm>(initialProfile);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const { error: upErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...profile, vat_default: Number(profile.vat_default) });
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
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Lou Hoarau"
              style={{ height: 44 }}
            />
          </AvaField>
          <AvaField label="Entreprise">
            <input
              type="text"
              value={profile.company_name}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Lou Plomberie"
              style={{ height: 44 }}
            />
          </AvaField>
          <AvaField label="SIRET" hint="14 chiffres">
            <input
              type="text"
              maxLength={14}
              value={profile.siret}
              onChange={(e) => setProfile({ ...profile, siret: e.target.value })}
              style={{ height: 44 }}
            />
          </AvaField>
          <AvaField label="Secteur d'activité">
            <input
              type="text"
              value={profile.activity_sector}
              onChange={(e) => setProfile({ ...profile, activity_sector: e.target.value })}
              placeholder="Plomberie, électricité, …"
              style={{ height: 44 }}
            />
          </AvaField>
          <AvaField label="TVA par défaut" hint="20 % métropole, 8,5 % DROM, 0 % auto-entrepreneur">
            <select
              value={profile.vat_default}
              onChange={(e) => setProfile({ ...profile, vat_default: Number(e.target.value) })}
              style={{ height: 44 }}
            >
              <option value={20}>20 %</option>
              <option value={10}>10 %</option>
              <option value={8.5}>8,5 % (DROM)</option>
              <option value={5.5}>5,5 %</option>
              <option value={0}>0 %</option>
            </select>
          </AvaField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={profile.is_drom}
              onChange={(e) => setProfile({ ...profile, is_drom: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
              Je suis basé en DROM (Réunion, Martinique, Guadeloupe, Mayotte, Guyane)
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={profile.tutoiement}
              onChange={(e) => setProfile({ ...profile, tutoiement: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
              AVA me tutoie
            </span>
          </label>
        </div>
      </AvaCard>

      {error && <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <AvaButton kind="primary" full onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
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
