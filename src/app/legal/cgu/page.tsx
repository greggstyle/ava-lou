import type { Metadata } from 'next';
import Link from 'next/link';
import { C, SANS, SERIF } from '@/components/ava';

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — AVA",
};

export default function CGUPage() {
  return (
    <main>
      <Link href="/" style={{ font: `500 13px/1 ${SANS}`, color: C.muted, textDecoration: 'none' }}>← Retour à AVA</Link>
      <h1 style={{ font: `400 36px/1.1 ${SERIF}`, color: C.ink, marginTop: 16, letterSpacing: '-0.01em' }}>
        Conditions générales <em style={{ fontStyle: 'italic', color: C.green }}>d&apos;utilisation</em>
      </h1>
      <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginTop: 8 }}>
        Dernière mise à jour : 5 mai 2026 · Version 1.0
      </div>

      <div style={{ font: `400 16px/1.7 ${SANS}`, color: C.ink2, marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Objet</h2>
          <p>
            AVA (« le Service ») est une assistance vocale administrative destinée aux artisans
            et indépendants français, notamment en DROM. Le Service permet de créer, gérer et envoyer
            des factures et devis à partir de commandes vocales.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Statut V0 — non production</h2>
          <p>
            Cette version d&apos;AVA est un <strong>MVP</strong> (V0) destiné à des tests utilisateurs.
            <strong> N&apos;utilisez pas AVA pour des factures réelles ayant un impact fiscal</strong>
            sans validation préalable par votre expert-comptable.
            Les calculs, mentions légales et conformité sont fournis « tels quels », sans garantie.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Compte utilisateur</h2>
          <p>
            L&apos;accès au Service nécessite une adresse email valide. Vous êtes responsable de la
            confidentialité de votre boîte mail (l&apos;authentification se fait par magic link).
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Responsabilités</h2>
          <p>
            Vous êtes seul responsable du contenu que vous saisissez ou dictez (noms de clients,
            montants, prestations). AVA n&apos;est pas une PA/PDP au sens de la facturation électronique
            obligatoire 2026/2027 — pour cette transmission, AVA passera par une plateforme certifiée.
          </p>
          <p style={{ marginTop: 8 }}>
            Vous devez respecter les règles fiscales et légales applicables à votre activité
            (mention de TVA, conservation 10 ans, mentions obligatoires art. L441-9 du Code de commerce).
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Disponibilité</h2>
          <p>
            Le Service est fourni « tel que disponible ». Aucune garantie de disponibilité, de
            performance ou de continuité n&apos;est offerte en V0. Des interruptions sont possibles.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Propriété</h2>
          <p>
            Vous restez propriétaire des données que vous saisissez (clients, factures, devis).
            Vous pouvez exporter ou supprimer vos données à tout moment en contactant{' '}
            <a href="mailto:greg@gonnected.com" style={{ color: C.green }}>greg@gonnected.com</a>.
          </p>
        </section>

        <section>
          <h2 style={{ font: `500 22px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>Loi applicable</h2>
          <p>
            Droit français. Tout litige sera soumis aux juridictions compétentes de la République française.
          </p>
        </section>
      </div>
    </main>
  );
}
