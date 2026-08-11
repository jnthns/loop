import type { ReactNode } from 'react';
import type { Tone } from '~/lib/ui/tone';

/**
 * The shared visual vocabulary. Four pieces do most of the work across the app:
 * a section header, a count badge, a position tag, and an empty state. They are
 * here rather than duplicated per island so the color coding stays consistent —
 * a section is a tone, a position is a fixed hue, and neither is re-decided
 * locally.
 */

export function SectionHead({
  id,
  title,
  note,
  count,
  tone,
  link,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  count?: number;
  tone: Tone;
  link?: { href: string; label: string };
  /** Extra controls rendered on the header's right edge. */
  children?: ReactNode;
}) {
  return (
    <div className="section-head" data-tone={tone}>
      <div className="section-head__row">
        {/* The count sits beside the heading, not inside it, so the accessible
            name of the section stays the title alone. */}
        <div className="flex items-center gap-2">
          <h2 id={id} className="section-head__title">
            {title}
          </h2>
          {count !== undefined && (
            <span className="badge" data-numeric>
              {count}
            </span>
          )}
        </div>
        {link && (
          <a href={link.href} className="section-link">
            {link.label}
            <span aria-hidden="true"> →</span>
          </a>
        )}
        {children}
      </div>
      {note && <p className="section-head__note">{note}</p>}
    </div>
  );
}

/** A position key — QB rose, RB green, WR blue, TE amber, and so on. */
export function PosTag({ pos, className = '' }: { pos?: string | null; className?: string }) {
  if (!pos) return <span className={`text-muted ${className}`}>—</span>;
  return (
    <span className={`pos-tag ${className}`} data-pos={pos.toUpperCase()}>
      {pos.toUpperCase()}
    </span>
  );
}

export function Chip({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  /** When set, the chip is tinted in that tone instead of neutral. */
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`chip ${tone ? 'chip-tone' : ''} ${className}`} data-tone={tone}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/**
 * A player's availability, when there is something to say about it.
 *
 * Renders nothing for a healthy active player — that is the overwhelming
 * majority, and a green "Active" badge on 250 rows is decoration that trains the
 * eye to skip the row where it matters. Only a real designation earns pixels.
 */
export function StatusTag({
  status,
  injuryStatus,
  className = '',
}: {
  status?: string | null;
  injuryStatus?: string | null;
  className?: string;
}) {
  // Injury designation wins: 'Active' + 'Questionable' is a questionable player.
  const label = injuryStatus?.trim() || (status?.trim() && status.trim() !== 'Active' ? status.trim() : '');
  if (!label) return null;

  const severe = /^(out|ir|injured reserve|pup|doubtful|sus|non football injury)$/i.test(label);

  return (
    <span
      data-testid="status-tag"
      data-severe={severe ? 'true' : 'false'}
      title={`Sleeper status: ${[status, injuryStatus].filter(Boolean).join(' · ')}`}
      className={`chip chip-tone ${className}`}
      data-tone={severe ? 'rose' : 'amber'}
    >
      {label}
    </span>
  );
}

/**
 * Where a player sits on his NFL team's depth chart.
 *
 * `undefined` means nflverse does not list him, which is not the same as being
 * buried — rookies and camp bodies churn — so it renders nothing rather than
 * implying a rank we do not have.
 */
export function DepthTag({ rank, className = '' }: { rank?: number; className?: string }) {
  if (!rank) return null;
  return (
    <span
      data-testid="depth-tag"
      data-rank={rank}
      title={
        rank === 1
          ? "Listed first at his position on his team's depth chart"
          : `Listed ${rank}${rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} at his position on his team's depth chart`
      }
      className={`chip ${className}`}
    >
      DC{rank}
    </span>
  );
}
