'use client';

/**
 * AVA · Direction "Onde" — Primitives portées en TSX
 * Source : AVA Onde Design System / ui_kits/ava_mobile/AvaPrimitives.jsx
 * Visuels conservés à l'identique. Inline styles pour rester fidèle au design system.
 */

import * as React from 'react';

export const C = {
  paper: '#FFFFFF', bone: '#F4F3EE', soft: '#F7F5EE',
  ink: '#0B1D33', ink2: '#23344B', muted: '#6B7480', line: '#E5E3DA',
  green: '#1F9D55', green2: '#22B865', greenSoft: '#E6F6EC',
  orange: '#E87B3A', warn: '#C0552E', warmYellow: '#FFF5CC',
  whatsapp: '#25D366',
} as const;

export const SERIF = '"Instrument Serif", Georgia, serif';
export const SANS = '"Inter Tight", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
export const TNUM: React.CSSProperties = {
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
  fontVariantNumeric: 'tabular-nums',
};

// ── Label ──────────────────────────────────────────────────────────────────
export function AvaLabel({
  children,
  color = C.muted,
  style = {},
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        font: `600 11px/1.2 ${SANS}`,
        textTransform: 'uppercase',
        letterSpacing: 1.4,
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Button ─────────────────────────────────────────────────────────────────
export type AvaButtonKind = 'primary' | 'validate' | 'ghost' | 'whatsapp' | 'light' | 'danger';

export function AvaButton({
  kind = 'primary',
  children,
  full = false,
  onClick,
  icon,
  disabled = false,
  type = 'button',
  style = {},
}: {
  kind?: AvaButtonKind;
  children: React.ReactNode;
  full?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}) {
  const palette: Record<AvaButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: C.ink, fg: C.paper },
    validate: { bg: C.green, fg: C.paper },
    ghost: { bg: 'transparent', fg: C.muted },
    whatsapp: { bg: C.whatsapp, fg: C.paper },
    light: { bg: C.paper, fg: C.ink, border: `1px solid ${C.line}` },
    danger: { bg: 'transparent', fg: C.warn, border: `1px solid ${C.warn}` },
  };
  const p = palette[kind];
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
      style={{
        height: 50,
        padding: '0 18px',
        whiteSpace: 'nowrap',
        width: full ? '100%' : undefined,
        background: p.bg,
        color: p.fg,
        border: p.border ?? 'none',
        borderRadius: 14,
        font: `600 16px/1 ${SANS}`,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        filter: pressed ? 'brightness(0.88)' : 'none',
        transition: 'transform 80ms cubic-bezier(0.2,0.6,0.2,1), filter 80ms cubic-bezier(0.2,0.6,0.2,1)',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
export function AvaCard({
  children,
  padding = 20,
  style = {},
}: {
  children: React.ReactNode;
  padding?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Pill / Badge ───────────────────────────────────────────────────────────
export type AvaPillKind = 'drom' | 'success' | 'warn' | 'neutral' | 'ava' | 'onDark';

export function AvaPill({
  kind = 'neutral',
  children,
  style = {},
}: {
  kind?: AvaPillKind;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const palette: Record<AvaPillKind, { bg: string; fg: string; border?: string }> = {
    drom: { bg: C.warmYellow, fg: '#6B4F00' },
    success: { bg: C.greenSoft, fg: C.green },
    warn: { bg: '#FBE6DD', fg: C.warn },
    neutral: { bg: C.soft, fg: C.ink2, border: `1px solid ${C.line}` },
    ava: { bg: '#FCEBDD', fg: C.orange },
    onDark: { bg: 'rgba(255,255,255,0.1)', fg: C.paper },
  };
  const p = palette[kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 12,
        font: `600 12px/1 ${SANS}`,
        background: p.bg,
        color: p.fg,
        border: p.border ?? '1px solid transparent',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ── Disclaimer ─────────────────────────────────────────────────────────────
export function AvaDisclaimer({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.soft,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: '12px 14px',
        color: C.ink2,
        font: `400 13px/1.45 ${SANS}`,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        ...style,
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: 3, background: C.orange, marginTop: 7, flex: 'none' }} />
      <div>
        <em style={{ fontFamily: SERIF, fontStyle: 'italic' }}>Brouillon</em> — rien n&apos;est envoyé sans votre accord.
      </div>
    </div>
  );
}

// ── Waveform ───────────────────────────────────────────────────────────────
export type AvaWaveformKind = 'mini' | 'playback' | 'full' | 'pause';

export function AvaWaveform({
  kind = 'mini',
  bars,
  color,
  height,
  animate = false,
  level,
}: {
  kind?: AvaWaveformKind;
  bars?: number;
  color?: string;
  height?: number;
  animate?: boolean;
  level?: number; // 0..1, optional live audio level
}) {
  const k: Record<AvaWaveformKind, { count: number; color: string; h: number }> = {
    mini: { count: 11, color: C.green, h: 18 },
    playback: { count: 11, color: C.orange, h: 18 },
    full: { count: 24, color: C.paper, h: 88 },
    pause: { count: 11, color: C.muted, h: 18 },
  };
  const settings = k[kind];
  const count = bars ?? settings.count;
  const barColor = color ?? settings.color;
  const totalH = height ?? settings.h;

  const seed = React.useMemo(
    () => Array.from({ length: count }, (_, i) => 0.3 + (Math.sin(i * 13.37 + 1) * 0.5 + 0.5) * 0.65),
    [count],
  );

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!animate) return;
    let raf: number;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 90) {
        setTick((x) => x + 1);
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: totalH }}>
      {seed.map((s, i) => {
        let h = s;
        if (kind === 'pause') h = 0.5;
        else if (animate) {
          const jitter = Math.sin((i + tick) * 0.91) * 0.18;
          const mul = level !== undefined ? Math.max(0.3, Math.min(1.4, level * 1.4)) : 1;
          h = Math.max(0.18, Math.min(0.98, (s + jitter) * mul));
        }
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: `${h * 100}%`,
              background: barColor,
              borderRadius: 2,
              transition: animate ? 'height 90ms linear' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Mic Button ─────────────────────────────────────────────────────────────
export type MicState = 'idle' | 'recording' | 'stop';

export function AvaMic({
  state = 'idle',
  size = 88,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: {
  state?: MicState;
  size?: number;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
}) {
  const palette: Record<
    MicState,
    { bg: string; fg: string; shadow: string; ring: boolean; border?: string }
  > = {
    idle: { bg: C.ink, fg: C.paper, shadow: 'none', ring: false },
    recording: { bg: C.green, fg: C.paper, shadow: '0 12px 32px rgba(31,157,85,0.36)', ring: true },
    stop: { bg: C.paper, fg: C.ink, shadow: 'none', ring: false, border: `1px solid ${C.line}` },
  };
  const p = palette[state];
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {p.ring && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: C.green,
            opacity: 0.22,
            animation: 'ava-pulse 1.4s cubic-bezier(0.2,0.6,0.2,1) infinite',
          }}
        />
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        aria-label="Maintenir pour parler"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: p.bg,
          color: p.fg,
          border: p.border ?? 'none',
          boxShadow: p.shadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 180ms cubic-bezier(0.2,0.6,0.2,1)',
          position: 'relative',
        }}
      >
        {state === 'stop' ? (
          <div
            style={{
              width: size * 0.27,
              height: size * 0.27,
              borderRadius: 4,
              background: 'currentColor',
            }}
          />
        ) : (
          <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3.5a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 0 0 7 0V7A3.5 3.5 0 0 0 12 3.5Z" />
            <path d="M5.5 11a.75.75 0 0 1 .75.75V13a5.75 5.75 0 0 0 11.5 0v-1.25a.75.75 0 0 1 1.5 0V13a7.25 7.25 0 0 1-6.5 7.21V22a.75.75 0 0 1-1.5 0v-1.79A7.25 7.25 0 0 1 4.75 13v-1.25A.75.75 0 0 1 5.5 11Z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Avatar (initials) ──────────────────────────────────────────────────────
export function AvaAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: C.bone,
        color: C.ink2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `600 ${Math.round(size * 0.32)}px/1 ${SANS}`,
        flex: 'none',
      }}
    >
      {initials || '?'}
    </div>
  );
}

// ── List Row ───────────────────────────────────────────────────────────────
export function AvaListRow({
  name,
  sub,
  amount,
  status,
  onClick,
}: {
  name: string;
  sub?: string;
  amount?: string;
  status?: 'paid' | 'overdue' | 'draft' | 'sent' | string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        font: SANS,
      }}
    >
      <AvaAvatar name={name} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <div style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>{name}</div>
        {sub && <div style={{ font: `500 12px/1.3 ${SANS}`, color: C.muted }}>{sub}</div>}
      </div>
      {amount && (
        <div
          style={{
            textAlign: 'right',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            flex: 'none',
          }}
        >
          <div
            style={{
              font: `600 16px/1 ${SERIF}`,
              color: status === 'overdue' ? C.warn : C.ink,
              whiteSpace: 'nowrap',
              ...TNUM,
            }}
          >
            {amount}
          </div>
          {status === 'paid' && (
            <AvaPill kind="success" style={{ padding: '3px 8px', fontSize: 10 }}>✓</AvaPill>
          )}
          {status === 'overdue' && (
            <AvaPill kind="warn" style={{ padding: '3px 8px', fontSize: 10 }}>en retard</AvaPill>
          )}
        </div>
      )}
    </button>
  );
}

// ── Top bar (mini-waveform + greeting / title) ─────────────────────────────
export function AvaTopBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        height: 52,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: C.bone,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Retour"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.ink,
              padding: 4,
              marginLeft: -4,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <svg width="28" height="14" viewBox="0 0 56 28">
            <g fill={C.ink}>
              <rect x="0" y="11" width="3" height="6" rx="1.5" />
              <rect x="6" y="7" width="3" height="14" rx="1.5" />
              <rect x="12" y="3" width="3" height="22" rx="1.5" />
              <rect x="18" y="0" width="3" height="28" rx="1.5" />
              <rect x="24" y="5" width="3" height="18" rx="1.5" />
              <rect x="30" y="9" width="3" height="10" rx="1.5" />
              <rect x="36" y="12" width="3" height="4" rx="1.5" />
            </g>
          </svg>
        )}
        <div style={{ font: `600 15px/1 ${SANS}`, color: C.ink }}>{title}</div>
      </div>
      <div>{right}</div>
    </div>
  );
}

// ── Field (input wrappers with label) ──────────────────────────────────────
export function AvaField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AvaLabel>{label}</AvaLabel>
      {children}
      {hint && <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted }}>{hint}</div>}
    </label>
  );
}
