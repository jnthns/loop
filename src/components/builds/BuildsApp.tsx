import { useState } from 'react';
import type { ArchetypeId } from '~/lib/builds/archetypes';
import type { BuildFit } from '~/lib/builds/types';
import type { PickSuggestion } from '~/lib/builds/types';
import type { Market } from '~/lib/schemas/market';
import type { Verdict } from '~/lib/nfl/types';
import { Chip, EmptyState, PosTag, SectionHead } from '~/components/ui/Primitives';
import type { Tone } from '~/lib/ui/tone';

export interface BuildEntry {
  fit: BuildFit;
  title: string;
  tagline: string;
  thesis: string;
  worksWhen: string[];
  failsWhen: string[];
  sources: { label: string; url: string }[];
  articleHref: string;
  picks: PickSuggestion[];
}

export interface BuildsAppProps {
  builds: BuildEntry[];
  market: Market;
  links: { team: string; knowledge: string };
}

const BAND_TONE: Record<BuildFit['band'], Tone> = {
  'BEST FIT': 'green',
  FITS: 'teal',
  STRETCH: 'amber',
  'FIGHTS THE FORMAT': 'rose',
};

const VERDICT_TONE: Record<Verdict, Tone> = {
  'STRONG PICK': 'green',
  PICK: 'teal',
  HOLD: 'amber',
  AVOID: 'rose',
};

export function BuildsApp({ builds, market, links }: BuildsAppProps) {
  const [activeId, setActiveId] = useState<ArchetypeId | null>(builds[0]?.fit.id ?? null);

  if (market.players.length === 0) {
    return (
      <EmptyState>
        No market data yet. Run <code className="font-mono">npm run sync:market</code> to pull
        dynasty values before builds can be scored.
      </EmptyState>
    );
  }

  const active = builds.find((b) => b.fit.id === activeId) ?? builds[0] ?? null;

  return (
    <div className="space-y-10">
      <section aria-labelledby="builds-heading">
        <SectionHead
          id="builds-heading"
          tone="amber"
          title="Builds"
          count={builds.length}
          note="Every named archetype, scored best-first against this format and draft slot."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {builds.map((build) => (
            <BuildCard
              key={build.fit.id}
              build={build}
              selected={build.fit.id === active?.fit.id}
              onSelect={() => setActiveId(build.fit.id)}
            />
          ))}
        </div>
      </section>

      {active && (
        <section aria-labelledby="picks-heading">
          <SectionHead
            id="picks-heading"
            tone="violet"
            title={`Your picks — ${active.title}`}
            count={active.picks.length}
            note="Rounds 1-8 are where this build is actually decided; 9-18 fill it out; 19-30 are dev stashes."
          />
          <PickSheet picks={active.picks} />
        </section>
      )}

      <p className="text-[13px] text-muted">
        Roster and budgets live on <a href={links.team} className="section-link">the team page</a>.
      </p>
    </div>
  );
}

function BuildCard({
  build,
  selected,
  onSelect,
}: {
  build: BuildEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const { fit } = build;
  const score = Math.round(fit.score);
  return (
    <div data-testid="build-card" data-tone={BAND_TONE[fit.band]} className="card-tone">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        data-testid="build-select"
        className={`w-full text-left ${selected ? 'ring-2 ring-tone' : ''}`}
      >
        <div className="panel-head">
          <h3 className="panel-title">{build.title}</h3>
          <Chip tone={BAND_TONE[fit.band]}>{fit.band}</Chip>
        </div>
        <div className="px-3 pt-2.5">
          <p className="text-[13px] text-muted">{build.tagline}</p>
          <div className="mt-2 meter">
            <div className="meter__fill" style={{ width: `${score}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted" data-numeric>
            {score}/100 fit score
          </p>
        </div>
      </button>

      <div className="px-3 pb-3">
        <p className="mt-2 text-[13px]">{build.thesis}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rows">
            <h4 className="label px-3 py-1.5">Works when</h4>
            <ul className="divide-y divide-line text-[12.5px]">
              {build.worksWhen.map((line) => (
                <li key={line} className="px-3 py-1.5">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rows">
            <h4 className="label px-3 py-1.5">Fails when</h4>
            <ul className="divide-y divide-line text-[12.5px]">
              {build.failsWhen.map((line) => (
                <li key={line} className="px-3 py-1.5">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
          {(
            [
              ['Format', fit.components.formatFit],
              ['Supply', fit.components.supplyFit],
              ['Value edge', fit.components.valueEdge],
              ['Age', fit.components.ageFit],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-[0.375rem] border border-line px-1.5 py-1.5">
              <dt className="label">{label}</dt>
              <dd className="mt-0.5 font-bold" data-numeric>
                {value.toFixed(1)}
              </dd>
            </div>
          ))}
        </dl>

        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-tone">
            Why this score ({fit.reasons.length} reasons)
          </summary>
          <ol className="mt-2 space-y-2 text-[12.5px]">
            {fit.reasons.map((reason) => (
              <li key={reason.text}>
                <p>{reason.text}</p>
                <p className="text-[11px] text-muted">{reason.evidence}</p>
              </li>
            ))}
          </ol>
        </details>

        <p className="mt-3 text-[12px]">
          <a href={build.articleHref} className="section-link">
            Read the positional-builds article
          </a>
        </p>

        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" data-testid="build-sources">
          {build.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tone underline decoration-tone-line hover:decoration-tone"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PickRow({ pick }: { pick: PickSuggestion }) {
  return (
    <li data-testid="pick-row" data-pick={pick.pick} className="p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="w-14 shrink-0 text-[11px] text-muted" data-numeric>
          Pick {pick.pick} · R{pick.round}
        </span>
        <PosTag pos={pick.primary.pos} />
        <span className="font-bold">{pick.primary.name}</span>
        <span className="text-[11px] text-muted" data-numeric>
          value {pick.primary.valueSf} · ecr {pick.primary.ecrSf ?? '—'}
        </span>
        <Chip tone={VERDICT_TONE[pick.verdict]} className="ml-auto">
          {pick.verdict}
        </Chip>
      </div>
      <p className="mt-1 max-w-3xl text-muted">{pick.reason}</p>
      {pick.alternates.length > 0 && (
        <p className="mt-1 text-[12px] text-muted">
          Alternates:{' '}
          {pick.alternates.map((alt, i) => (
            <span key={alt.name}>
              {i > 0 ? ', ' : ''}
              {alt.name} ({alt.pos})
            </span>
          ))}
        </p>
      )}
      {pick.citations.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" data-testid="pick-citations">
          {pick.citations.map((citation) => (
            <li key={citation.url}>
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tone underline decoration-tone-line hover:decoration-tone"
              >
                {citation.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PickSheet({ picks }: { picks: PickSuggestion[] }) {
  const early = picks.filter((p) => p.round <= 8);
  const mid = picks.filter((p) => p.round >= 9 && p.round <= 18);
  const late = picks.filter((p) => p.round >= 19);

  const [midOpen, setMidOpen] = useState(false);
  const [lateOpen, setLateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rows">
        <h3 className="label px-3 py-1.5">Rounds 1-8 — the build is decided here</h3>
        <ol className="divide-y divide-line" data-testid="picks-early">
          {early.map((pick) => (
            <PickRow key={pick.pick} pick={pick} />
          ))}
        </ol>
      </div>

      {mid.length > 0 && (
        <div className="rows">
          <button
            type="button"
            onClick={() => setMidOpen((v) => !v)}
            aria-expanded={midOpen}
            className="label flex w-full items-center justify-between px-3 py-1.5 text-left"
          >
            Rounds 9-18 ({mid.length})
            <span aria-hidden="true">{midOpen ? '−' : '+'}</span>
          </button>
          {midOpen && (
            <ol className="divide-y divide-line" data-testid="picks-mid">
              {mid.map((pick) => (
                <PickRow key={pick.pick} pick={pick} />
              ))}
            </ol>
          )}
        </div>
      )}

      {late.length > 0 && (
        <div className="rows">
          <button
            type="button"
            onClick={() => setLateOpen((v) => !v)}
            aria-expanded={lateOpen}
            className="label flex w-full items-center justify-between px-3 py-1.5 text-left"
          >
            Rounds 19-30 — dev stashes ({late.length})
            <span aria-hidden="true">{lateOpen ? '−' : '+'}</span>
          </button>
          {lateOpen && (
            <ol className="divide-y divide-line" data-testid="picks-late">
              {late.map((pick) => (
                <PickRow key={pick.pick} pick={pick} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export default BuildsApp;
