import QRCode from 'qrcode';

/**
 * Server-side QR code rendering en SVG inline. Pas d'aller-retour PNG, pas
 * de canvas client-side, pas de dépendance externe : on génère le SVG côté
 * server et on l'injecte dans le HTML.
 *
 * Usage : <QrCodeSvg data="https://..." size={140} />
 *
 * Aspect Onde : pas de fond (transparent), foreground = navy, masquage léger
 * du logo central possible plus tard.
 */
interface QrCodeSvgProps {
  data: string;
  size?: number;
  /** Couleur du QR (modules sombres). Défaut = navy ink Onde. */
  color?: string;
}

export async function QrCodeSvg({ data, size = 140, color = '#0B1D33' }: QrCodeSvgProps) {
  // qrcode.toString returns a Promise<string> with full SVG document.
  // Niveau de correction M = 15% — suffisant pour impression sans logo central.
  let svg = '';
  try {
    svg = await QRCode.toString(data, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: color, light: '#ffffff00' },
      width: size,
    });
  } catch {
    return null;
  }

  // Strip the outer <?xml ... ?> declaration if present (we inject inside HTML)
  svg = svg.replace(/<\?xml[^?]*\?>/, '').trim();

  return (
    <span
      style={{ display: 'inline-block', lineHeight: 0 }}
      // server component — dangerouslySetInnerHTML is the way to inline SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
