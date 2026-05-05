import type { Metadata } from 'next';
import Link from 'next/link';
import { C, SANS, SERIF } from '@/components/ava';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — AVA',
  description: "Politique de confidentialité d'AVA, l'assistance vocale administrative pour artisans des DROM.",
};

export default function PrivacyPage() {
  return (
    <main>
      <Link href="/" style={{ font: `500 13px/1 ${SANS}`, color: C.muted, textDecoration: 'none' }}>← Retour à AVA</Link>
      <h1 style={{ font: `400 36px/1.1 ${SERIF}`, color: C.ink, marginTop: 16, letterSpacing: '-0.01em' }}>
        Politique de <em style={{ fontStyle: 'italic', color: C.green }}>confidentialité</em>
      </h1>
      <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginTop: 8 }}>
        Dernière mise à jour : 5 mai 2026 · Version 1.0
      </div>

      <div style={{ font: `400 16px/1.7 ${SANS}`, color: C.ink2, marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Identité du responsable</h2>
          <p>
            AVA est édité par <strong>DigiDataLe</strong>, contact :{' '}
            <a href="mailto:greg@gonnected.com" style={{ color: C.green }}>greg@gonnected.com</a>.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Données collectées</h2>
          <p>AVA collecte uniquement les données nécessaires à son fonctionnement :</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li><strong>Compte</strong> : votre adresse email (pour le magic link de connexion).</li>
            <li><strong>Profil</strong> : nom, raison sociale, SIRET, adresse, code NAF, forme juridique — saisis volontairement par vous.</li>
            <li><strong>Clients</strong> : nom, email, téléphone, adresse, SIRET — que vous saisissez ou dictez.</li>
            <li><strong>Documents</strong> : factures, devis, lignes de prestation, montants.</li>
            <li><strong>Audio vocal</strong> : enregistrement temporaire pendant la dictée. Transmis à OpenAI Whisper pour transcription puis supprimé.</li>
            <li><strong>Transcriptions et intentions</strong> : le texte issu de vos dictées et l&apos;analyse Claude (intent + entités) sont conservés dans la base pour traçabilité (table <code>ava_actions</code>).</li>
          </ul>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Sous-traitants techniques</h2>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li><strong>Supabase</strong> (hébergement base de données + auth) — région UE.</li>
            <li><strong>Vercel</strong> (hébergement application) — réseau global avec edge UE.</li>
            <li><strong>OpenAI</strong> (Whisper API, transcription audio) — transmission ponctuelle uniquement, pas de conservation côté AVA.</li>
            <li><strong>Anthropic</strong> (Claude API, extraction d&apos;intent) — transmission ponctuelle.</li>
            <li><strong>recherche-entreprises.api.gouv.fr</strong> (INSEE Sirene) — open data, pas de transmission de vos données.</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Pour la conformité optimale en production, AVA configure progressivement le mode
            <em> zero-data-retention</em> chez OpenAI et Anthropic afin d&apos;éviter toute rétention chez ces sous-traitants.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Base légale</h2>
          <p>
            Le traitement repose sur l&apos;exécution du contrat (vous utilisez AVA pour gérer votre activité)
            et votre consentement (acceptation des conditions et de l&apos;usage du micro).
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Conservation</h2>
          <p>
            Les documents (factures, devis) sont conservés <strong>10 ans</strong> conformément au Code de commerce français.
            Les clips audio sont supprimés sous 2 minutes après transcription.
            Les transcriptions et intentions sont conservées tant que votre compte est actif.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez des droits d&apos;accès, de rectification, de suppression,
            de portabilité, et d&apos;opposition. Pour les exercer, contactez{' '}
            <a href="mailto:greg@gonnected.com" style={{ color: C.green }}>greg@gonnected.com</a>.
          </p>
          <p style={{ marginTop: 8 }}>
            Vous pouvez introduire une réclamation auprès de la <strong>CNIL</strong> (cnil.fr).
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Cookies & tracking</h2>
          <p>
            AVA utilise uniquement des cookies fonctionnels (session d&apos;authentification Supabase).
            Aucun cookie publicitaire, aucun tracker tiers.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Sécurité</h2>
          <p>
            Connexion HTTPS, isolation par <em>Row-Level Security</em> (chaque artisan ne voit que ses propres données),
            authentification par magic link sans mot de passe,
            secrets API stockés côté serveur uniquement.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Modifications</h2>
          <p>
            Cette politique peut évoluer. Toute modification substantielle vous sera notifiée par email
            (ou dans l&apos;application au prochain login).
          </p>
        </section>
      </div>
    </main>
  );
}
