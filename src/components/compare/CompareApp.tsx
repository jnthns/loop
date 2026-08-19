import { useMemo, useState } from 'react';
import {
  compare,
  FAMILIES,
  MAX_COMPARE,
  type ComparedPlayer,
  type CompareOptions,
  type CompareRow,
  type SourceFamily,
} from '~/lib/compare/compare';
import type { DataSource } from '~/lib/data/sources';
import { Chip, DepthTag, EmptyState, PosTag, SectionHead, StatusTag } from '~/components/ui/Primitives';
import type { Tone } from '~/lib/ui/tone';

/**
 * The compare page: "these two are close — which one do I actually want?"
 *
 * A ranking answers that question badly, because every ranking on this site is
 * one source's opinion and two of them share an upstream. What the reader needs
 * is the same two players held against *every* source at once, with the
 * agreements and the disagreements both named:
 *
 *   - the analyst consensus (FantasyPros ECR and the DynastyProcess value
 *     derived from it), grouped together because they are one opinion;
 *   - Sleeper's search rank and add/drop counts, flagged as the only genuinely
 *     independent read;
 *   - the nflverse depth chart, which is opportunity rather than talent;
 *   - and the qualitative half — the cited scouting profile and the recent
 *     tagged news — because no number on the page explains *why* a player moved.
 *
 * The math is in `~/lib/compare/compare`; this file only renders it and owns
 * the selection.
 */

export interface CompareAppProps {
  /** Every comparable player, joined to each upstream at build time. */
  dossiers: ComparedPlayer[];
  options: CompareOptions;
  /** Selection the page opens with — the manager's own targets, usually. */
  initialIds: string[];
  /** Registry entries behind the numbers, for the credits block. */
  sources: DataSource[];
  capturedAt: { market: string; trending: string; depth: string };
  links: { team: string; picks: string; knowledge: string };
}

const FAMILY_TONE: Record<SourceFamily, Tone> = {
  consensus: 'violet',
  independent: 'teal',
  opportunity: 'green',
  context: 'slate',
};

const AGREEMENT_TONE: Record<'agree' | 'split' | 'unknown', Tone> = {
  agree: 'green',
  split: 'amber',
  unknown: 'slate',
};

function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CompareApp({
  dossiers,
  options,
  initialIds,
  sources,
  capturedAt,
  links,
}: CompareAppProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    initialIds.filter((id) => dossiers.some((d) => d.id === id)).slice(0, MAX_COMPARE),
  );
  const [query, setQuery] = useState('');

  const comparison = useMemo(() => compare(dossiers, selected, options), [dossiers, selected, options]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return dossiers
      .filter((d) => !selected.includes(d.id) && d.name.toLowerCase().includes(q))
      // Best-known first: a search rank exists for anyone Sleeper tracks, so it
      // is the closest thing to "how likely is this the player you meant".
      .sort((a, b) => (a.sleeperRank ?? Infinity) - (b.sleeperRank ?? Infinity))
      .slice(0, 8);
  }, [dossiers, query, selected]);

  if (dossiers.length === 0) {
    return (
      <EmptyState>
        No players to compare yet. Run <code className="font-mono">npm run sync:sleeper</code> and{' '}
        <code className="font-mono">npm run sync:market</code> to pull the league and the rankings.
      </EmptyState>
    );
  }

  const add = (id: string) => {
    setSelected((ids) => (ids.length >= MAX_COMPARE || ids.includes(id) ? ids : [...ids, id]));
    setQuery('');
  };
  const remove = (id: string) => setSelected((ids) => ids.filter((x) => x !== id));

  const { players } = comparison;

  return (
    <div className="space-y-10">
      <section aria-labelledby="picker-heading">
        <SectionHead
          id="picker-heading"
          tone="orange"
          title="Who are you weighing up?"
          count={players.length}
          note={`Compare up to ${MAX_COMPARE} players at once. Every row below names the source it came from.`}
        />

        <div className="card p-3" data-testid="compare-picker">
          <div className="flex flex-wrap items-center gap-2">
            {players.map((player) => (
              <span key={player.id} className="chip chip-tone flex items-center gap-1.5" data-tone="orange">
                <PosTag pos={player.pos} />
                {player.name}
                <button
                  type="button"
                  onClick={() => remove(player.id)}
                  aria-label={`Remove ${player.name} from the comparison`}
                  className="font-bold"
                >
                  ×
                </button>
              </span>
            ))}
            {players.length === 0 && <span className="text-[13px] text-muted">Nobody selected yet.</span>}
          </div>

          <div className="mt-3">
            <label htmlFor="compare-search" className="label">
              Add a player
            </label>
            <input
              id="compare-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={players.length >= MAX_COMPARE}
              placeholder={
                players.length >= MAX_COMPARE
                  ? `Remove one to add another (${MAX_COMPARE} max)`
                  : 'Search by name…'
              }
              className="mt-1 w-full max-w-sm rounded-[0.5rem] border border-line bg-surface-alt px-2.5 py-1.5 text-sm"
            />
            {matches.length > 0 && (
              <ul className="rows mt-2 max-w-sm" data-testid="compare-matches">
                {matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => add(match.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-surface-alt"
                    >
                      <PosTag pos={match.pos} />
                      <span className="font-semibold">{match.name}</span>
                      <span className="text-[11px] text-muted">{match.nflTeam}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p
          className="card-tone mt-4 p-3 text-[13px]"
          data-tone={AGREEMENT_TONE[comparison.agreement]}
          data-testid="compare-headline"
          data-agreement={comparison.agreement}
        >
          {comparison.headline}
        </p>
      </section>

      {players.length > 0 && (
        <section aria-labelledby="table-heading">
          <SectionHead
            id="table-heading"
            tone="violet"
            title="Source by source"
            note="Grouped by upstream, not by how flattering the number is. Two of these families share a provenance, and the grouping says so."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-[13px]" data-testid="compare-table">
              <caption className="sr-only">
                Every tracked source&rsquo;s read on {players.map((p) => p.name).join(', ')}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="label w-56 p-2 text-left align-bottom">
                    Metric
                  </th>
                  {players.map((player) => (
                    <th
                      key={player.id}
                      scope="col"
                      data-testid="player-column"
                      className="border-b border-line p-2 text-left align-bottom"
                    >
                      <PlayerHeading player={player} />
                    </th>
                  ))}
                </tr>
              </thead>
              {FAMILIES.map((family) => {
                const rows = comparison.rows.filter((row) => row.family === family.id);
                if (rows.length === 0) return null;
                return (
                  <tbody key={family.id} data-tone={FAMILY_TONE[family.id]} data-testid="compare-family">
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={players.length + 1}
                        className="border-y border-line bg-tone-soft p-2 text-left"
                      >
                        <span className="eyebrow">{family.label}</span>
                        {!family.independent && (
                          <Chip tone="amber" className="ml-2">
                            SHARES AN UPSTREAM
                          </Chip>
                        )}
                        <span className="mt-1 block text-[12px] font-normal text-muted">{family.note}</span>
                      </th>
                    </tr>
                    {rows.map((row) => (
                      <MetricRow key={row.id} row={row} />
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </section>
      )}

      {players.length > 0 && (
        <section aria-labelledby="dossier-heading">
          <SectionHead
            id="dossier-heading"
            tone="blue"
            title="What the sources actually say"
            count={players.length}
            note="The half a table cannot carry: the cited scouting profile, the stories that moved him, and the sources that have nothing on him at all."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {players.map((player) => (
              <Dossier key={player.id} player={player} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="credits-heading">
        <SectionHead
          id="credits-heading"
          tone="slate"
          title="Where these numbers come from"
          note={`Market snapshot ${shortDate(capturedAt.market)} · Sleeper trending ${shortDate(capturedAt.trending)} · depth chart ${shortDate(capturedAt.depth)}.`}
        />
        <ul className="rows" data-testid="compare-sources">
          {sources.map((source) => (
            <li key={source.id} className="p-3 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-tone underline decoration-tone-line hover:decoration-tone"
                >
                  {source.label}
                </a>
                <Chip>{source.license}</Chip>
                {source.attributionRequired && <Chip tone="teal">ATTRIBUTION REQUIRED</Chip>}
              </div>
              <p className="mt-1 text-muted">{source.caveat}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-muted">
          Roster and budgets live on <a href={links.team} className="section-link">the team page</a>; who
          to take next is on <a href={links.picks} className="section-link">picks</a>; the reasoning
          behind the age curves is in <a href={links.knowledge} className="section-link">the knowledge base</a>.
        </p>
      </section>
    </div>
  );
}

function PlayerHeading({ player }: { player: ComparedPlayer }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        <PosTag pos={player.pos} />
        <span className="text-[14px] font-bold">{player.name}</span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-normal text-muted">
        <span>{player.nflTeam}</span>
        <StatusTag status={player.status} injuryStatus={player.injuryStatus} />
        <DepthTag rank={player.depthRank ?? undefined} />
        {player.onMyRoster && <Chip tone="green">ON YOUR ROSTER</Chip>}
        {player.isTarget && <Chip tone="orange">TARGET</Chip>}
        {!player.onMyRoster && !player.isTarget && player.rosteredInLeague && (
          <Chip>ROSTERED IN LEAGUE</Chip>
        )}
      </span>
    </>
  );
}

function MetricRow({ row }: { row: CompareRow }) {
  return (
    <tr data-testid="compare-row" data-row={row.id} className="border-b border-line align-top">
      <th scope="row" className="p-2 text-left font-semibold">
        {row.label}
        <span className="mt-0.5 block text-[11px] font-normal text-muted">{row.note}</span>
      </th>
      {row.cells.map((cell) => (
        <td
          key={cell.playerId}
          data-testid="compare-cell"
          data-leader={cell.leader ? 'true' : 'false'}
          className={`p-2 ${cell.leader ? 'font-bold text-tone' : ''} ${cell.value === null ? 'text-muted' : ''}`}
          data-numeric
        >
          {cell.display}
          {cell.leader && <span className="sr-only"> — best of those compared</span>}
        </td>
      ))}
    </tr>
  );
}

function Dossier({ player }: { player: ComparedPlayer }) {
  return (
    <div className="card-tone" data-tone="blue" data-testid="player-dossier" data-player={player.id}>
      <div className="panel-head">
        <h3 className="panel-title">{player.name}</h3>
        <span className="text-[11px] text-muted" data-numeric>
          {player.consensusRank !== null && `Analysts #${player.consensusRank}`}
          {player.consensusRank !== null && player.attentionRank !== null && ' · '}
          {player.attentionRank !== null && `Sleeper #${player.attentionRank}`}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {player.attentionGap !== null && player.attentionGap !== 0 && (
          <p className="text-[13px]">
            {player.attentionGap > 0
              ? 'Sleeper’s managers rate him above where the analysts have him — attention running ahead of consensus, which is usually news the market has not priced yet.'
              : 'The analysts rate him above where Sleeper’s managers do — consensus running ahead of attention, which is usually the quieter, safer side of a comparison.'}
          </p>
        )}

        {player.profile ? (
          <div className="rows">
            <p className="px-3 py-1.5 text-[13px] font-semibold">{player.profile.headline}</p>
            <dl className="divide-y divide-line text-[12.5px]">
              {(
                [
                  ['Role', player.profile.role],
                  ['Fit', player.profile.fit],
                  ['Risk', player.profile.risk],
                ] as const
              ).map(([label, text]) => (
                <div key={label} className="px-3 py-1.5">
                  <dt className="label">{label}</dt>
                  <dd className="mt-0.5">{text}</dd>
                </div>
              ))}
            </dl>
            <div className="px-3 py-1.5">
              <p className="text-[11px] text-muted">As of {player.profile.asOf}</p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" data-testid="profile-sources">
                {player.profile.sources.map((source) => (
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
        ) : (
          <p className="text-[12.5px] text-muted">
            No scouting profile written for him yet — every profile on this site has to cite its
            reporting, so there is nothing here rather than a guess.
          </p>
        )}

        {player.news.length > 0 ? (
          <ul className="rows" data-testid="player-news">
            {player.news.map((item) => (
              <li key={item.id} className="px-3 py-1.5 text-[12.5px]">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-tone underline decoration-tone-line hover:decoration-tone"
                >
                  {item.title}
                </a>
                <p className="text-[11px] text-muted">
                  {item.source} · {shortDate(item.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-muted">No tagged news in the current snapshot.</p>
        )}

        {player.missing.length > 0 && (
          <p className="text-[11px] text-muted" data-testid="player-missing">
            No data for him from: {player.missing.join(', ')}. A blank cell above is that, not a bad
            number.
          </p>
        )}
      </div>
    </div>
  );
}

export default CompareApp;
