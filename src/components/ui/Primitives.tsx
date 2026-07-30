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
