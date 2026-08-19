import { useMemo, useState } from 'react';
import type { BoardEntry, BoardPos, PositionBoards } from '~/lib/picks/board';
import type {
  PickRecommendations,
  PositionNeed,
  Recommendation,
  ScoreFactor,
} from '~/lib/picks/recommend';
import {
  Chip,
  DepthTag,
  EmptyState,
  PosTag,
  SectionHead,
  StatusTag,
} from '~/components/ui/Primitives';
import type { Tone } from '~/lib/ui/tone';
import { DATA_SOURCES, type SourceStability } from '~/lib/data/sources';

/**
 * The picks page: "who should I take next, and why?"
 *
 * The page used to be four consensus lists side by side, which answered a
 * narrower question — the next name off the board at a position. That is
 * genuinely useful on the clock, so it is still here as a mode. But a ranked
 * list cannot tell you whether to take the best receiver or the running back
 * you actually need, because a consensus rank has never seen your roster.
 *
 * So the default view is now a recommendation: every available player scored
 * against your own positional holes, this league's scoring settings, two
 * independent market opinions, and the published age curve for the position —
 * with the arithmetic shown on every row. The scoring lives in
 * `~/lib/picks/recommend`; this file only renders it.
 *
 * Four modes, one filter set:
 *   - **Recommended** — the flat ranked list. "Who is the best pick, full stop."
 *   - **By need** — the same players grouped under the hole they fill, most
 *     urgent hole first. "Who is best at the thing I am short of."
 *   - **Position board** — consensus order per position, the old draft-day view.
 *   - **Waiver trending** — Sleeper add counts, for in-season Tuesdays.
 */

export type ListMode = 'recommended' | 'need' | 'platforms' | 'board' | 'trending';

export interface PicksAppProps {
  data: PositionBoards;
  recs: PickRecommendations;
  /** Base-path-aware links, resolved by the Astro page (see `src/lib/url.ts`). */
  links: { team: string; compare: string };
}

const POS_TONE: Record<BoardPos, Tone> = {
  QB: 'rose',
  RB: 'green',
  WR: 'blue',
  TE: 'amber',
};

const GRADE_TONE: Record<PositionNeed['grade'], Tone> = {
  weak: 'rose',
  watch: 'amber',
  strong: 'green',
};

const AVAILABILITY_LABEL: Record<BoardEntry['availability'], string> = {
  available: 'FREE',
  drafted: 'DRAFTED',
  rostered: 'ROSTERED',
};

const AVAILABILITY_TONE: Record<BoardEntry['availability'], Tone> = {
  available: 'green',
  drafted: 'slate',
  rostered: 'slate',
};

/** How much a source can be relied on — the label the credits block leads with. */
const STABILITY_LABEL: Record<SourceStability, string> = {
  'open-dataset': 'OPEN DATASET',
  'official-api': 'OFFICIAL API',
  'public-feed': 'PUBLIC FEED',
  undocumented: 'UNDOCUMENTED',
};

/** Amber, not green, for the undocumented endpoint — it is the fragile one. */
const STABILITY_TONE: Record<SourceStability, Tone> = {
  'open-dataset': 'green',
  'official-api': 'green',
  'public-feed': 'slate',
  undocumented: 'amber',
};

const MODES: [ListMode, string][] = [
  ['recommended', 'Recommended'],
  ['need', 'By need'],
  ['platforms', 'Platform split'],
  ['board', 'Position board'],
  ['trending', 'Waiver trending'],
];

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function matches(needle: string, name: string, nflTeam: string): boolean {
  if (!needle) return true;
  return name.toLowerCase().includes(needle) || nflTeam.toLowerCase().includes(needle);
}

export function PicksApp({ data, recs, links }: PicksAppProps) {
  const [mode, setMode] = useState<ListMode>('recommended');
  // Taken players are hidden by default. Mid-draft the top of every board is
  // mostly names that are already gone, and a list you have to read past to
  // find the next pick is not a shortlist. Unticking brings them back, struck
  // through and in place, for anyone reading the run rather than picking.
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [query, setQuery] = useState('');
  const [posFilter, setPosFilter] = useState<BoardPos | 'ALL'>('ALL');

  const needle = query.trim().toLowerCase();

  const recommended = useMemo(
    () =>
      recs.recommendations.filter(
        (r) => (posFilter === 'ALL' || r.pos === posFilter) && matches(needle, r.name, r.nflTeam),
      ),
    [recs.recommendations, posFilter, needle],
  );

  const needGroups = useMemo(
    () =>
      recs.byNeed
        .filter((g) => posFilter === 'ALL' || g.need.pos === posFilter)
        .map((g) => ({ ...g, players: g.players.filter((p) => matches(needle, p.name, p.nflTeam)) })),
    [recs.byNeed, posFilter, needle],
  );

  const lists = useMemo(
    () =>
      data.boards
        .filter((board) => posFilter === 'ALL' || board.pos === posFilter)
        .map((board) => {
          const rows = mode === 'trending' ? board.trending : board.board;
          const visible = rows.filter((row) => {
            if (onlyAvailable && row.availability !== 'available') return false;
            return matches(needle, row.name, row.nflTeam);
          });
          return { pos: board.pos, total: rows.length, rows: visible };
        }),
    [data.boards, mode, onlyAvailable, needle, posFilter],
  );

  const noBoardData = data.boards.every((b) => b.board.length === 0 && b.trending.length === 0);
  if (noBoardData && recs.recommendations.length === 0) {
    return (
      <EmptyState>
        No board data yet. Run <code className="font-mono">npm run sync:market</code> and{' '}
        <code className="font-mono">npm run sync:sleeper</code> to pull consensus ranks and
        trending adds.
      </EmptyState>
    );
  }

  const sourceNote =
    mode === 'trending'
      ? `Sleeper adds across every league in the last ${data.trendingLookbackHours}h, captured ${formatWhen(
          data.trendingCapturedAt,
        )}.`
      : mode === 'board'
        ? `Expert consensus rank, captured ${formatWhen(data.marketCapturedAt)}. Lower is more popular.`
        : mode === 'platforms'
          ? `Three rankings side by side, captured ${formatWhen(recs.marketCapturedAt)}. FantasyPros and DynastyProcess share an upstream; only Sleeper is independent.`
          : `Scored against your roster from the ${formatWhen(recs.marketCapturedAt)} market snapshot. The score is relative to the best player still on the board, not an absolute rating.`;

  return (
    <div className="space-y-6">
      <NeedHeader recs={recs} />

      <div className="flex flex-wrap items-center gap-3" data-testid="picks-controls">
        <div role="group" aria-label="List" className="flex flex-wrap gap-1">
          {MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-testid={`mode-${value}`}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`chip ${mode === value ? 'chip-tone' : ''}`}
              data-tone={mode === value ? 'violet' : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Position" className="flex gap-1">
          {(['ALL', 'QB', 'RB', 'WR', 'TE'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              data-testid={`pos-${pos}`}
              aria-pressed={posFilter === pos}
              onClick={() => setPosFilter(pos)}
              className={`chip ${posFilter === pos ? 'chip-tone' : ''}`}
              data-tone={posFilter === pos && pos !== 'ALL' ? POS_TONE[pos] : undefined}
            >
              {pos}
            </button>
          ))}
        </div>

        {(mode === 'board' || mode === 'trending') && (
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input
              type="checkbox"
              data-testid="only-available"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            Hide players already taken
          </label>
        )}

        <label className="ml-auto flex items-center gap-1.5 text-[12.5px]">
          <span className="label">Filter</span>
          <input
            type="search"
            data-testid="picks-filter"
            value={query}
            placeholder="name or NFL team"
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-[0.375rem] border border-line bg-surface px-2 py-1"
          />
        </label>
      </div>

      <p className="text-[12px] text-muted" data-testid="picks-source-note">
        {sourceNote}
      </p>

      {mode === 'recommended' && (
        <section aria-labelledby="picks-recommended" data-testid="recommended-list">
          <SectionHead
            id="picks-recommended"
            tone="violet"
            title="Recommended picks"
            count={recommended.length}
            note="Every available player scored against your roster gaps, this league's scoring, and both market sources. Open a row to see the arithmetic."
          />
          {recommended.length === 0 ? (
            <EmptyState>No available player matches the current filter.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {recommended.map((rec) => (
                <RecommendationCard key={rec.key} rec={rec} />
              ))}
            </ol>
          )}
        </section>
      )}

      {mode === 'need' && (
        <div className="space-y-8" data-testid="need-groups">
          {needGroups.map((group) => (
            <section
              key={group.need.pos}
              aria-labelledby={`need-${group.need.pos}`}
              data-testid="need-group"
              data-pos={group.need.pos}
            >
              <SectionHead
                id={`need-${group.need.pos}`}
                tone={POS_TONE[group.need.pos]}
                title={`${group.need.pos} — need ${Math.round(group.need.needWeight * 100)}/100`}
                count={group.players.length}
                note={group.need.summary}
              />
              {group.need.attention && (
                <p className="mb-3 text-[12.5px] text-muted">{group.need.attention}</p>
              )}
              {group.players.length === 0 ? (
                <EmptyState>No available {group.need.pos} matches the current filter.</EmptyState>
              ) : (
                <ol className="space-y-3">
                  {group.players.map((rec) => (
                    <RecommendationCard key={rec.key} rec={rec} />
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}

      {mode === 'platforms' && <PlatformSplit rows={recommended} recs={recs} />}

      {(mode === 'board' || mode === 'trending') && (
        <div className="grid gap-6 lg:grid-cols-2">
          {lists.map((list) => (
            <section
              key={list.pos}
              aria-labelledby={`picks-${list.pos}`}
              data-testid="position-list"
              data-pos={list.pos}
            >
              <SectionHead
                id={`picks-${list.pos}`}
                tone={POS_TONE[list.pos]}
                title={list.pos}
                count={list.rows.length}
                note={
                  mode === 'board'
                    ? 'Consensus order — the next name off the board at this position.'
                    : 'Most-added at this position across Sleeper.'
                }
              />
              {list.rows.length === 0 ? (
                <EmptyState>
                  {list.total === 0
                    ? 'No rows for this position in the current snapshot.'
                    : 'Every row is filtered out. Clear the filter or show taken players.'}
                </EmptyState>
              ) : (
                <ol className="rows divide-y divide-line">
                  {list.rows.map((row) => (
                    <PickRow key={row.key} row={row} mode={mode} />
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}

      <ScoringKey recs={recs} />

      <div className="space-y-1 text-[12px] text-muted">
        <p>
          Roster and budgets live on{' '}
          <a href={links.team} className="section-link">
            the team page
          </a>
          ; two players held against every source at once live on{' '}
          <a href={links.compare} className="section-link">
            compare
          </a>
          .
        </p>
      </div>

      <DataSourceCredits />
    </div>
  );
}

/**
 * Where every number on this page came from.
 *
 * This is not decoration. nflverse publishes its depth charts under CC-BY-4.0,
 * which makes attribution a license term rather than a courtesy, and the
 * obligation runs to whoever reads the page — so it has to render here, not sit
 * in a source comment. Every `DC1` badge on this page is nflverse data.
 *
 * The rest earns its space for a different reason: a recommender that will not
 * say where its inputs come from, how fresh they are, or which of them is an
 * undocumented endpoint that could vanish, is asking to be trusted instead of
 * checked.
 */
function DataSourceCredits() {
  return (
    <details className="card p-3" data-testid="data-sources">
      <summary className="cursor-pointer text-[12.5px] font-semibold">
        Where this data comes from
      </summary>
      <ul className="mt-3 space-y-3 text-[12px]">
        {DATA_SOURCES.map((source) => (
          <li key={source.id} className="space-y-1" data-testid="data-source" data-source={source.id}>
            <div className="flex flex-wrap items-baseline gap-2">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-semibold text-tone underline decoration-tone-line hover:decoration-tone"
              >
                {source.label}
              </a>
              <Chip tone={STABILITY_TONE[source.stability]}>{STABILITY_LABEL[source.stability]}</Chip>
              {source.licenseUrl ? (
                <a
                  href={source.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted underline"
                >
                  {source.license}
                </a>
              ) : (
                <span className="text-[11px] text-muted">{source.license}</span>
              )}
            </div>
            <p className="text-muted">{source.provides}</p>
            <p className="text-muted">{source.caveat}</p>
            <p className="text-[11px] text-muted">
              {source.cadence} Lands in {source.writesTo.join(', ')}.
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The gap read, above everything else.
 *
 * This is the question the page exists to answer, so it is not buried in a
 * sidebar: the next pick, the coach's one-liner, and the four rooms ordered by
 * how badly each one needs help.
 */
function NeedHeader({ recs }: { recs: PickRecommendations }) {
  return (
    <div className="card-tone" data-tone="violet" data-testid="need-header">
      <div className="panel-head" data-tone="violet">
        <span className="eyebrow">Your next pick</span>
        {recs.nextPickNumber !== null && (
          <span className="text-[12px] text-muted" data-numeric>
            #{recs.nextPickNumber}
            {recs.picksUntilNext !== null &&
              ` · ${recs.picksUntilNext === 0 ? 'on the clock' : `${recs.picksUntilNext} picks away`}`}
          </span>
        )}
      </div>
      <div className="space-y-3 p-3">
        <p className="text-[13.5px]" data-testid="need-headline">
          {recs.headline}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="need-strip">
          {recs.needs.map((need, i) => (
            <li
              key={need.pos}
              className="space-y-1 rounded-[0.375rem] border border-line p-2"
              data-testid="need-cell"
              data-pos={need.pos}
            >
              <div className="flex items-center gap-1.5">
                <PosTag pos={need.pos} />
                <Chip tone={GRADE_TONE[need.grade]}>{need.facetScore}/10</Chip>
                {i === 0 && <Chip tone="rose">BIGGEST GAP</Chip>}
              </div>
              <div className="meter" data-tone={POS_TONE[need.pos]}>
                <div
                  className="meter__fill"
                  style={{ width: `${Math.round(need.needWeight * 100)}%` }}
                />
              </div>
              <p className="text-[11.5px] text-muted">{need.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One recommendation: the score, the arithmetic behind it, and the prose. */
function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <li
      className="card overflow-hidden"
      data-testid="recommendation"
      data-pos={rec.pos}
      data-rank={rec.rank}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-3 py-2">
        <span className="w-6 shrink-0 text-[11px] text-muted" data-numeric>
          {rec.rank}
        </span>
        <PosTag pos={rec.pos} />
        <span className="font-bold">{rec.name}</span>
        <span className="text-[11px] text-muted">
          {rec.nflTeam}
          {rec.age !== null ? ` · ${rec.age.toFixed(1)}y` : ''}
        </span>
        <DepthTag rank={rec.depthRank ?? undefined} />
        <StatusTag status={rec.status} injuryStatus={rec.injuryStatus} />
        {rec.fillsTopNeed && <Chip tone="rose">TOP NEED</Chip>}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted" data-numeric>
          {rec.ecr !== null && <span title="Format-aware expert consensus rank">ecr {rec.ecr}</span>}
          <Chip tone="violet">
            <span data-numeric>{rec.score.toFixed(0)}</span>
          </Chip>
        </span>
      </div>

      <div className="space-y-3 p-3">
        <PlatformStrip rec={rec} />

        <ul className="space-y-1.5" data-testid="recommendation-why">
          {rec.why.map((line, i) => (
            <li key={`${rec.key}-why-${i}`} className="text-[13px] leading-snug">
              {line}
            </li>
          ))}
        </ul>

        <details>
          <summary className="cursor-pointer text-[12px] text-muted">Score breakdown</summary>
          <ul className="mt-2 space-y-1.5" data-testid="recommendation-factors">
            {rec.factors.map((factor) => (
              <FactorRow key={factor.id} factor={factor} tone={POS_TONE[rec.pos]} />
            ))}
          </ul>
        </details>

        {rec.profile && (
          <div className="space-y-2 rounded-[0.375rem] border border-line p-2.5" data-testid="profile">
            <p className="text-[13px] font-semibold">{rec.profile.headline}</p>
            <dl className="space-y-1.5 text-[12.5px]">
              <div>
                <dt className="label inline">Role </dt>
                <dd className="inline">{rec.profile.role}</dd>
              </div>
              <div>
                <dt className="label inline">Fit </dt>
                <dd className="inline">{rec.profile.fit}</dd>
              </div>
              <div>
                <dt className="label inline">Risk </dt>
                <dd className="inline">{rec.profile.risk}</dd>
              </div>
            </dl>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" data-testid="profile-sources">
              {rec.profile.sources.map((source) => (
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
            <p className="text-[11px] text-muted">Reporting current as of {rec.profile.asOf}.</p>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Every platform's ranking in one table, one row per player.
 *
 * The point of the view is the *spread* between the columns, so the widest
 * disagreement gets its own column rather than making the reader subtract two
 * numbers on every row. Only the Sleeper-versus-consensus gap is reported as
 * disagreement, because the other pair shares an upstream.
 */
function PlatformSplit({ rows, recs }: { rows: Recommendation[]; recs: PickRecommendations }) {
  return (
    <section aria-labelledby="picks-platforms" data-testid="platform-split">
      <SectionHead
        id="picks-platforms"
        tone="teal"
        title="Platform split"
        count={rows.length}
        note="Each platform's rank at the player's position, among everyone still available. Two of the three columns share an upstream — the table says which."
      />

      <ul className="mb-4 space-y-1 text-[12px] text-muted" data-testid="platform-notes">
        {recs.platformNotes.map((note) => (
          <li key={note.id} data-platform={note.id}>
            <span className="label">{note.label}</span>{' '}
            <Chip tone={note.independent ? 'green' : 'slate'}>
              {note.independent ? 'INDEPENDENT' : 'SHARES UPSTREAM'}
            </Chip>{' '}
            {note.note}
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <EmptyState>No available player matches the current filter.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="label py-1.5 pr-2">
                  Player
                </th>
                {recs.platformNotes.map((note) => (
                  <th key={note.id} scope="col" className="label py-1.5 pr-2">
                    {note.label}
                  </th>
                ))}
                <th scope="col" className="label py-1.5 pr-2" title="Sleeper rank minus consensus rank">
                  Spread
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rec) => (
                <tr
                  key={rec.key}
                  className="border-b border-line"
                  data-testid="platform-row"
                  data-pos={rec.pos}
                >
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <PosTag pos={rec.pos} />
                      <span className="font-semibold">{rec.name}</span>
                      <span className="text-[11px] text-muted">{rec.nflTeam}</span>
                    </span>
                  </th>
                  {rec.platforms.map((platform) => (
                    <td key={platform.id} className="py-1.5 pr-2" data-platform={platform.id}>
                      <span data-numeric className="font-semibold">
                        {platform.posRank !== null ? `${rec.pos}${platform.posRank}` : '—'}
                      </span>{' '}
                      <span className="text-[11px] text-muted" data-numeric>
                        {platform.display}
                      </span>
                    </td>
                  ))}
                  <td className="py-1.5 pr-2" data-numeric data-testid="platform-spread">
                    {rec.sleeperVsConsensus === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Chip
                        tone={
                          Math.abs(rec.sleeperVsConsensus) < 3
                            ? 'slate'
                            : rec.sleeperVsConsensus > 0
                              ? 'green'
                              : 'amber'
                        }
                      >
                        {rec.sleeperVsConsensus > 0 ? '+' : ''}
                        {rec.sleeperVsConsensus}
                      </Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11.5px] text-muted">
        Spread is the consensus rank minus Sleeper&rsquo;s, at the player&rsquo;s position. Positive
        means Sleeper&rsquo;s managers are higher on him than the analysts; negative means the
        analysts are higher than the people actually drafting.
      </p>
    </section>
  );
}

/**
 * The three platform ranks, side by side.
 *
 * The `SAME SOURCE` marker on two of the three columns is the whole reason this
 * is a component and not a row of numbers: FantasyPros and DynastyProcess look
 * like independent corroboration and are not — DynastyProcess builds its value
 * curve from the FantasyPros consensus. Showing three columns without saying so
 * would manufacture confidence out of one opinion counted twice.
 */
function PlatformStrip({ rec }: { rec: Recommendation }) {
  return (
    <div className="space-y-1" data-testid="platform-strip">
      <ul className="grid gap-1.5 sm:grid-cols-3">
        {rec.platforms.map((platform) => (
          <li
            key={platform.id}
            className="rounded-[0.375rem] border border-line px-2 py-1.5"
            data-testid="platform-cell"
            data-platform={platform.id}
            data-independent={platform.independent ? 'true' : 'false'}
            title={platform.note}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="label">{platform.label}</span>
              {!platform.independent && (
                <span className="text-[9.5px] tracking-wide text-muted">SAME SOURCE</span>
              )}
            </div>
            <div className="flex items-baseline gap-2 text-[12.5px]">
              <span data-numeric className="font-semibold">
                {platform.posRank !== null ? `${rec.pos}${platform.posRank}` : '—'}
              </span>
              <span className="text-[11px] text-muted" data-numeric>
                {platform.display}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {rec.sleeperVsConsensus !== null && Math.abs(rec.sleeperVsConsensus) >= 3 && (
        <p className="text-[11px] text-muted" data-testid="platform-disagreement">
          {rec.sleeperVsConsensus > 0
            ? `Sleeper is ${rec.sleeperVsConsensus} spots higher on him than the analysts.`
            : `The analysts are ${Math.abs(rec.sleeperVsConsensus)} spots higher on him than Sleeper.`}
        </p>
      )}
    </div>
  );
}

/**
 * One line of the arithmetic.
 *
 * The bar is drawn from the factor's share of its own maximum, and negative
 * factors are labeled rather than drawn — a penalty rendered as a bar reads as
 * a positive contribution at a glance, which is the opposite of the truth.
 */
function FactorRow({ factor, tone }: { factor: ScoreFactor; tone: Tone }) {
  const share = factor.max > 0 ? Math.max(0, Math.min(1, factor.points / factor.max)) : 0;
  const negative = factor.points < 0;

  return (
    <li className="space-y-1" data-testid="factor" data-factor={factor.id}>
      <div className="flex items-baseline gap-2 text-[12px]">
        <span className="label">{factor.label}</span>
        <span className="ml-auto text-muted" data-numeric>
          {factor.points > 0 ? '+' : ''}
          {factor.points.toFixed(1)}
        </span>
      </div>
      {!negative && (
        <div className="meter" data-tone={tone}>
          <div className="meter__fill" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
      <p className="text-[11.5px] text-muted">{factor.detail}</p>
    </li>
  );
}

/**
 * The model, in the open.
 *
 * A recommender that will not show its weights is asking to be trusted rather
 * than checked. This renders the same constants the scorer used, so a manager
 * who disagrees with the weighting can see exactly what to argue with.
 */
function ScoringKey({ recs }: { recs: PickRecommendations }) {
  const { weights } = recs;
  return (
    <details className="card p-3" data-testid="scoring-key">
      <summary className="cursor-pointer text-[12.5px] font-semibold">
        How these scores are calculated
      </summary>
      <div className="mt-3 space-y-3 text-[12.5px]">
        <p>
          Base score is {weights.valuePoints} points of DynastyProcess trade value, plus{' '}
          {weights.consensusPoints} points of FantasyPros expert consensus rank, plus{' '}
          {weights.sleeperPoints} points of Sleeper platform rank. That base is then multiplied by
          your roster gap at the position (up to +{Math.round(weights.maxNeedBoost * 100)}%) and by
          this league&rsquo;s scoring weight for the position (±
          {Math.round(weights.formatSwing * 100)}%). Age against the published positional peak and
          depth-chart opportunity are added last, and can be negative. Every score is then scaled so
          the best player still on the board reads 100 — it is a comparison against the current
          field, not an absolute rating.
        </p>
        <p>
          The first two inputs are weighted as one opinion on purpose. DynastyProcess builds its
          value model from the FantasyPros consensus, so they agree by construction — 69.5% of
          players land in the identical position when the snapshot is sorted both ways. Sleeper is
          the only independent read, which is why it is scored separately and why the platform split
          marks the other two as sharing an upstream.
        </p>
        <ul className="space-y-1" data-testid="format-weights">
          {weights.byPosition.map((row) => (
            <li key={row.pos} className="flex flex-wrap items-baseline gap-2">
              <PosTag pos={row.pos} />
              <span data-numeric className="text-muted">
                {row.weight.toFixed(2)}
              </span>
              <span className="text-muted">{row.reason}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted">
          No projections are invented here. Every number comes from a committed data file, and the
          role, fit and risk notes come from <code className="font-mono">data/profiles.json</code>,
          where the schema refuses an uncited claim.
        </p>
      </div>
    </details>
  );
}

function PickRow({ row, mode }: { row: BoardEntry; mode: ListMode }) {
  const taken = row.availability !== 'available';
  return (
    <li
      data-testid="pick-row"
      data-pos={row.pos}
      data-availability={row.availability}
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 text-[13px] ${
        taken ? 'opacity-60' : ''
      }`}
    >
      <span className="w-6 shrink-0 text-[11px] text-muted" data-numeric>
        {row.rank}
      </span>
      <PosTag pos={row.pos} />
      <span className={`font-bold ${taken ? 'line-through decoration-line' : ''}`}>{row.name}</span>
      <span className="text-[11px] text-muted">
        {row.nflTeam}
        {row.age !== null ? ` · ${Math.round(row.age)}y` : ''}
      </span>
      <DepthTag rank={row.depthRank ?? undefined} />
      <StatusTag status={row.status} injuryStatus={row.injuryStatus} />
      <span className="ml-auto flex items-center gap-2 text-[11px] text-muted" data-numeric>
        {mode === 'trending' ? (
          <>
            <span title="Sleeper adds in the lookback window">
              +{row.adds?.toLocaleString() ?? '—'}
            </span>
            <span title="Expert consensus rank">ecr {row.ecr ?? '—'}</span>
          </>
        ) : (
          <>
            <span title="Expert consensus rank">ecr {row.ecr ?? '—'}</span>
            {row.adds !== null && (
              <span title="Sleeper adds in the lookback window">+{row.adds.toLocaleString()}</span>
            )}
          </>
        )}
        <Chip tone={AVAILABILITY_TONE[row.availability]}>{AVAILABILITY_LABEL[row.availability]}</Chip>
      </span>
    </li>
  );
}

export default PicksApp;
