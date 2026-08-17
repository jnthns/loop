import { SectionHead } from '~/components/ui/Primitives';
import type { Tone } from '~/lib/ui/tone';
import {
  HEALTH_SOURCES,
  type HealthFacet,
  type HealthGrade,
  type RosterHealth,
} from '~/lib/team/health';
import { href } from '~/lib/url';

const GRADE_TONE: Record<HealthGrade, Tone> = {
  strong: 'green',
  watch: 'amber',
  weak: 'rose',
};

function sourceHref(url: string): string {
  if (url.startsWith('/')) return href(url);
  return url;
}

function FacetCard({ facet, emphasized }: { facet: HealthFacet; emphasized: boolean }) {
  const tone = GRADE_TONE[facet.grade];
  return (
    <article
      data-testid="health-facet"
      data-facet={facet.id}
      data-grade={facet.grade}
      data-tone={tone}
      className={`card-tone p-3.5 ${emphasized ? 'ring-1 ring-tone' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="panel-title text-[0.8125rem]">{facet.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="chip chip-tone" data-tone={tone}>
            {facet.grade}
          </span>
          <span className="text-sm font-bold text-tone" data-numeric>
            {facet.score}/10
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] text-ink">{facet.summary}</p>
      {facet.attention && (
        <p className="mt-2 text-[13px] font-semibold text-tone" data-testid="health-attention">
          {facet.attention}
        </p>
      )}
      <ul className="mt-2 space-y-1 text-[12px] text-muted">
        {facet.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

export function RosterHealthPanel({ health }: { health: RosterHealth }) {
  const windowTone: Tone =
    health.window === 'contend' ? 'green' : health.window === 'pivot' ? 'amber' : 'rose';
  const needsWork = health.priorities.length;

  return (
    <section aria-labelledby="roster-health" data-testid="roster-health">
      <SectionHead
        id="roster-health"
        tone={windowTone}
        title="Where this roster is weak"
        count={needsWork}
        note="2026 superflex audit: positional rooms, age cliffs, floor vs ceiling, health, and bench insurance. Grades use your stored tiers and ages — not invented rankings."
      />

      <div
        data-testid="health-window"
        data-window={health.window}
        data-tone={windowTone}
        className="card-tone mb-4 p-3.5"
      >
        <p className="label text-tone">Competitive window</p>
        <p className="mt-1 text-[0.9375rem] font-bold text-ink">
          {health.windowLabel}{' '}
          <span className="text-tone" data-numeric>
            {health.positionTotal}/40
          </span>
        </p>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">{health.windowAdvice}</p>
      </div>

      {health.draftCoaching?.active && (
        <div
          data-testid="draft-coaching"
          data-tone="violet"
          className="card-tone mb-4 p-3.5"
        >
          <p className="label text-tone">Next pick coaching</p>
          <p className="mt-1 text-[0.9375rem] font-bold text-ink" data-testid="draft-coaching-headline">
            {health.draftCoaching.headline}
          </p>
          <p className="mt-1 text-[12px] text-muted" data-numeric>
            {health.draftCoaching.myPicksMade} of {health.draftCoaching.myPicksTotal} picks made ·{' '}
            {health.draftCoaching.myPicksRemaining} remaining
          </p>
          {health.draftCoaching.positionPriority.length > 0 && (
            <ol className="mt-3 space-y-1.5 text-[13px]">
              {health.draftCoaching.positionPriority.slice(0, 4).map((row, i) => (
                <li key={row.pos} data-testid="draft-pos-priority" data-pos={row.pos}>
                  <span className="font-bold text-ink">
                    {i + 1}. {row.pos}
                  </span>
                  <span className="text-muted"> — {row.reason}</span>
                </li>
              ))}
            </ol>
          )}
          {health.draftCoaching.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="label mb-1.5">Available from your target list</p>
              <ul className="space-y-2">
                {health.draftCoaching.suggestions.map((s) => (
                  <li
                    key={s.playerId}
                    data-testid="draft-suggestion"
                    data-pos={s.pos}
                    className="text-[13px]"
                  >
                    <span className="font-bold text-ink">{s.playerName}</span>
                    <span className="text-muted">
                      {' '}
                      · {s.pos} · for {s.slotLabel}
                    </span>
                    <p className="mt-0.5 text-muted">{s.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {needsWork > 0 && (
        <div className="mb-4">
          <p className="label mb-2">Needs attention</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {health.priorities.map((facet) => (
              <FacetCard key={facet.id} facet={facet} emphasized />
            ))}
          </div>
        </div>
      )}

      {health.facets.some((f) => f.grade === 'strong') && (
        <details className="mb-4">
          <summary className="cursor-pointer text-[13px] font-semibold">
            Strong rooms ({health.facets.filter((f) => f.grade === 'strong').length})
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {health.facets
              .filter((f) => f.grade === 'strong')
              .map((facet) => (
                <FacetCard key={facet.id} facet={facet} emphasized={false} />
              ))}
          </div>
        </details>
      )}

      <p className="label mb-1.5">Sources for the 2026 bars</p>
      <ul data-testid="health-sources" className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {HEALTH_SOURCES.map((source) => (
          <li key={source.id}>
            <a href={sourceHref(source.url)} className="underline-offset-2 hover:text-ink hover:underline">
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RosterHealthPanel;
