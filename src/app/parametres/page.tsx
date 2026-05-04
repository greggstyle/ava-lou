import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, C, SANS, SERIF } from '@/components/ava';
import { SettingsForm } from '@/components/settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Paramètres" />

      <div style={{ padding: '8px 20px 60px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ font: `600 26px/1.15 ${SERIF}`, color: C.ink, marginTop: 6 }}>
          Votre <em style={{ fontStyle: 'italic' }}>profil</em>
        </h1>

        <AvaCard padding={16}>
          <AvaLabel>Compte</AvaLabel>
          <div style={{ font: `400 15px/1.45 ${SANS}`, color: C.ink, marginTop: 6 }}>{user.email}</div>
        </AvaCard>

        <SettingsForm
          initialProfile={{
            full_name: profile?.full_name ?? '',
            company_name: profile?.company_name ?? '',
            siret: profile?.siret ?? '',
            activity_sector: profile?.activity_sector ?? '',
            vat_default: profile?.vat_default ?? 20,
            is_drom: profile?.is_drom ?? false,
            tutoiement: profile?.tutoiement ?? false,
          }}
        />
      </div>
    </main>
  );
}
