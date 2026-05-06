/**
 * IBAN helpers — validation côté serveur pour les retours OCR.
 *
 * On garde simple : longueur, charset, et checksum mod-97 (norme ISO 13616).
 * Ne valide pas que l'IBAN est "actif" en banque — c'est la responsabilité
 * du virement, pas de l'app.
 */

const IBAN_LENGTHS: Record<string, number> = {
  FR: 27, BE: 16, LU: 20, CH: 21, MC: 27, DE: 22, ES: 24, IT: 27,
  NL: 18, PT: 25, IE: 22, GB: 22, AT: 20, FI: 18, DK: 18, SE: 24, NO: 15,
};

/** Normalise : majuscules + suppression espaces. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Vérifie qu'un IBAN est conforme (charset, longueur attendue pour le pays,
 * checksum mod-97 = 1). Retourne { valid: boolean, reason?: string }.
 */
export function validateIban(input: string): { valid: boolean; reason?: string } {
  const iban = normalizeIban(input);
  if (!/^[A-Z0-9]+$/.test(iban)) return { valid: false, reason: 'Caractères invalides' };
  if (iban.length < 15 || iban.length > 34) return { valid: false, reason: 'Longueur hors limites ISO' };

  const country = iban.slice(0, 2);
  const expected = IBAN_LENGTHS[country];
  if (expected && iban.length !== expected) {
    return { valid: false, reason: `Longueur attendue ${expected} pour ${country}, reçu ${iban.length}` };
  }

  // Mod-97 : déplacer les 4 premiers caractères à la fin, remplacer chaque
  // lettre par sa position (A=10, B=11, ... Z=35), et calculer le mod 97.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') numeric += ch;
    else numeric += String(ch.charCodeAt(0) - 55); // 'A'=65 → 10
  }
  // Big number mod 97 sans BigInt — division par chunks
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }
  if (remainder !== 1) return { valid: false, reason: 'Checksum mod-97 invalide' };
  return { valid: true };
}

/** Format pretty avec un espace tous les 4 chars (FR76 1234 5678…). */
export function formatIbanGroups(iban: string): string {
  const c = normalizeIban(iban);
  return c.replace(/(.{4})/g, '$1 ').trim();
}
