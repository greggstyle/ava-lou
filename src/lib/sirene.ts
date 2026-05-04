/**
 * Sirene/SIREN autocomplete via the public recherche-entreprises API.
 * No auth, ~7 req/sec/IP rate limit, French data only.
 *
 * https://api.gouv.fr/documentation/api-recherche-entreprises
 */

export interface SireneResult {
  siret: string;
  siren: string;
  denomination: string;
  legal_form: string | null;     // raw nature_juridique code (e.g. '1000')
  legal_form_label: string | null;
  naf_code: string | null;
  naf_label: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  is_active: boolean;
  is_individual: boolean;
}

const ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search';

function cleanSiret(input: string): string {
  return input.replace(/\D/g, '');
}

// Mapping a small set of common nature_juridique codes -> friendly form
function mapLegalForm(code: string | null | undefined): string | null {
  if (!code) return null;
  // INSEE nomenclature: https://www.insee.fr/fr/information/2028129
  if (code === '1000' || code.startsWith('10')) return 'auto-entrepreneur';
  if (code.startsWith('5499') || code === '5499') return 'SARL';
  if (code.startsWith('5710') || code === '5710' || code === '5720') return 'SAS';
  if (code === '5499' || code === '5485') return 'EURL';
  if (code === '5710') return 'SASU';
  return null;
}

interface RawEtablissement {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  etat_administratif?: string;
}

interface RawResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  activite_principale?: string;
  siege?: RawEtablissement;
  matching_etablissements?: RawEtablissement[];
}

function shapeResult(r: RawResult, preferredSiret?: string): SireneResult | null {
  const matching =
    (preferredSiret &&
      (r.matching_etablissements?.find((e) => e.siret === preferredSiret) ??
        (r.siege?.siret === preferredSiret ? r.siege : undefined))) ??
    r.siege ??
    r.matching_etablissements?.[0];
  if (!matching || !matching.siret) return null;
  const code = r.nature_juridique ?? null;
  return {
    siret: matching.siret,
    siren: r.siren ?? matching.siret.slice(0, 9),
    denomination: r.nom_complet ?? r.nom_raison_sociale ?? '',
    legal_form: code,
    legal_form_label: mapLegalForm(code),
    naf_code: matching.activite_principale ?? r.activite_principale ?? null,
    naf_label: matching.libelle_activite_principale ?? null,
    address: matching.adresse ?? null,
    postal_code: matching.code_postal ?? null,
    city: matching.libelle_commune ?? null,
    is_active: matching.etat_administratif === 'A',
    is_individual: code ? code.startsWith('1') : false,
  };
}

export async function lookupBySiret(siret: string): Promise<SireneResult | null> {
  const cleaned = cleanSiret(siret);
  if (cleaned.length !== 14) return null;
  const url = `${ENDPOINT}?q=${cleaned}&page=1&per_page=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Sirene API ${res.status}`);
  const json = (await res.json()) as { results?: RawResult[] };
  const r = json.results?.[0];
  return r ? shapeResult(r, cleaned) : null;
}

export async function searchByName(query: string, limit = 5): Promise<SireneResult[]> {
  if (query.trim().length < 3) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&page=1&per_page=${limit}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: RawResult[] };
  return (json.results ?? [])
    .map((r) => shapeResult(r))
    .filter((x): x is SireneResult => x !== null);
}
