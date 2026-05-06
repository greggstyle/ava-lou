import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, C, SANS, SERIF } from '@/components/ava';
import { SettingsForm } from '@/components/settings-form';
import { AnonymousEmailLinkForm } from '@/components/anonymous-email-link-form';

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

        {user.is_anonymous ? (
          <AnonymousEmailLinkForm />
        ) : (
          <AvaCard padding={16}>
            <AvaLabel>Compte</AvaLabel>
            <div style={{ font: `400 15px/1.45 ${SANS}`, color: C.ink, marginTop: 6 }}>{user.email}</div>
          </AvaCard>
        )}

        <SettingsForm
          initialProfile={{
            full_name: profile?.full_name ?? '',
            company_name: profile?.company_name ?? '',
            siret: profile?.siret ?? '',
            activity_sector: profile?.activity_sector ?? '',
            vat_default: profile?.vat_default ?? 20,
            is_drom: profile?.is_drom ?? false,
            tutoiement: profile?.tutoiement ?? false,
            address: profile?.address ?? '',
            postal_code: profile?.postal_code ?? '',
            city: profile?.city ?? '',
            naf_code: profile?.naf_code ?? '',
            naf_label: profile?.naf_label ?? '',
            legal_form: (profile?.legal_form as never) ?? '',
            capital_social: profile?.capital_social != null ? String(profile.capital_social) : '',
            rcs: profile?.rcs ?? '',
            vat_intra: profile?.vat_intra ?? '',
            tva_franchise: profile?.tva_franchise ?? true,
            late_penalty_rate: profile?.late_penalty_rate != null ? String(profile.late_penalty_rate) : '10.5',
            payment_terms_days: profile?.payment_terms_days != null ? String(profile.payment_terms_days) : '30',
            b2c_mediator: profile?.b2c_mediator ?? '',
            iban: profile?.iban ?? '',
            bic: profile?.bic ?? '',
            bank_name: profile?.bank_name ?? '',
            payment_link_url: profile?.payment_link_url ?? '',
            payment_link_provider: profile?.payment_link_provider ?? '',
          }}
        />
      </div>
    </main>
  );
}
