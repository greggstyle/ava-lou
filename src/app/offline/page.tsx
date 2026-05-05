import { AvaCard, AvaButton, C, SANS, SERIF } from '@/components/ava';

export const metadata = {
  title: 'Hors-ligne — AVA',
};

export default function OfflinePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: C.paper }}>
      <AvaCard padding={24}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginBottom: 12, letterSpacing: '-0.01em' }}>
          Vous êtes <em style={{ fontStyle: 'italic' }}>hors-ligne</em>
        </h1>
        <p style={{ font: `400 15px/1.55 ${SANS}`, color: C.ink2, marginBottom: 18 }}>
          AVA a besoin d&apos;internet pour transcrire votre voix, créer une facture ou
          envoyer un email. Reconnectez-vous, puis réessayez.
        </p>
        <p style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginBottom: 18 }}>
          Les pages déjà ouvertes restent consultables, mais aucune création n&apos;est
          possible hors-ligne — c&apos;est volontaire pour éviter les doublons.
        </p>
        <a href="/" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Réessayer</AvaButton>
        </a>
      </AvaCard>
    </main>
  );
}
