import { useEffect, useMemo, useState } from 'react';
import type { Player } from '~/lib/schemas/players';
import type { Budget, RosterSlot, SlotKind, Team } from '~/lib/schemas/team';
import { eligiblePositions } from '~/lib/schemas/team';
import {
  allocated,
  formatMoney,
  isOverspent,
  perSlotRemaining,
  remaining,
} from '~/lib/team/budget';
import { clearOverlay, saveOverlay, loadOverlay, serializeTeam } from '~/lib/team/storage';
import { NO_DRAFT, type Draft } from '~/lib/schemas/draft';
import DraftPanel from '~/components/DraftPanel';
import { PosTag, SectionHead } from '~/components/ui/Primitives';
import type { Tone } from '~/lib/ui/tone';

export interface TeamAppProps {
  committed: Team;
  players: Player[];
  draft?: Draft;
}

const GROUPS: { key: string; title: string; kinds: SlotKind[]; tone: Tone; note?: string }[] = [
  {
    key: 'starters',
    title: 'Starters',
    tone: 'green',
    kinds: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K', 'DEF'],
  },
  { key: 'bench', title: 'Bench', tone: 'slate', kinds: ['BN'] },
  {
    key: 'taxi',
    title: 'Taxi',
    tone: 'teal',
    kinds: ['TAXI'],
    note: 'Developmental spots. Stashing here is nearly free — treat it as the cheapest lottery ticket on the roster.',
  },
  { key: 'ir', title: 'Injured reserve', tone: 'rose', kinds: ['IR'] },
];

export function TeamApp({ committed, players, draft = NO_DRAFT }: TeamAppProps) {
  const [team, setTeam] = useState<Team>(committed);
  const [overlayActive, setOverlayActive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showEmptyRoster, setShowEmptyRoster] = useState(false);

  // Read the overlay after mount so the server-rendered markup matches the
  // committed baseline and hydration stays stable.
  useEffect(() => {
    const overlay = loadOverlay();
    if (overlay) {
      setTeam(overlay);
      setOverlayActive(true);
    }
  }, []);

  function update(next: Team) {
    setTeam(next);
    setOverlayActive(saveOverlay(next));
  }

  function reset() {
    clearOverlay();
    setTeam(committed);
    setOverlayActive(false);
  }

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const slotById = useMemo(
    () => new Map(team.format.rosterSlots.map((s) => [s.id, s])),
    [team.format.rosterSlots],
  );
  const assignedIds = useMemo(
    () => new Set(team.roster.map((r) => r.playerId).filter((id): id is string => Boolean(id))),
    [team.roster],
  );
  const openSlots = useMemo(
    () => team.roster.filter((r) => r.playerId === null).length,
    [team.roster],
  );

  // An entirely empty roster before a draft is the expected state, not a bug —
  // and rendering 26 blank rows implies otherwise. Lead with the draft instead.
  const rosterIsEmpty = openSlots === team.roster.length && team.roster.length > 0;
  const preDraft = rosterIsEmpty && draft.status !== 'complete';

  const targetsBySlot = useMemo(() => {
    const map = new Map<string, typeof team.targets>();
    for (const target of [...team.targets].sort((a, b) => a.priority - b.priority)) {
      map.set(target.slotId, [...(map.get(target.slotId) ?? []), target]);
    }
    return map;
  }, [team.targets]);

  function setSlotPlayer(slotId: string, playerId: string | null) {
    update({
      ...team,
      roster: team.roster.map((entry) =>
        entry.slotId === slotId ? { ...entry, playerId } : entry,
      ),
    });
  }

  function setBudget(next: Budget) {
    update({ ...team, budgets: team.budgets.map((b) => (b.id === next.id ? next : b)) });
  }

  function exportJson() {
    const json = serializeTeam(team);
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'team.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-10">
      <FormatBar team={team} openSlots={openSlots} />

      <section
        aria-labelledby="overlay-state"
        data-tone={overlayActive ? 'amber' : 'slate'}
        className="card-tone p-3.5"
      >
        <h2 id="overlay-state" className="label mb-1 text-tone">
          Where these edits live
        </h2>
        <p className="text-[13px] text-muted">
          {overlayActive ? (
            <>
              You have unsaved local edits. They live in this browser only —{' '}
              <strong className="font-semibold text-ink">
                the loop still reads the committed file
              </strong>
              , so export and commit them before expecting tailored advice.
            </>
          ) : (
            <>
              Showing the committed <code className="font-mono">data/team.json</code>. Edits here
              are stored in this browser until you export them back.
            </>
          )}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportJson}
            className="rounded-[0.375rem] border border-tone-line bg-tone-soft px-2.5 py-1 text-xs font-bold text-tone"
          >
            Export team.json
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!overlayActive}
            className="rounded-[0.375rem] border border-line bg-surface px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
          >
            Discard local edits
          </button>
        </div>
      </section>

      {preDraft && (
        <DraftPanel
          draft={draft}
          rosterSize={team.roster.length}
          auctionTotal={team.budgets.find((b) => b.kind === 'auction')?.total ?? null}
        />
      )}

      {preDraft && (
        <section data-testid="empty-roster-notice" data-tone="slate" className="empty">
          <h2 className="text-[0.9375rem] font-bold text-ink">Roster is empty until the draft</h2>
          <p className="mt-1 max-w-2xl text-[13px]">
            All {team.roster.length} slots are unfilled — that is what Sleeper reports, not a sync
            failure. Your shortlist below is the useful surface right now; the roster table fills
            itself the moment the draft happens.
          </p>
          <button
            type="button"
            onClick={() => setShowEmptyRoster((v) => !v)}
            aria-expanded={showEmptyRoster}
            className="mt-2.5 rounded-[0.375rem] border border-line bg-surface px-2.5 py-1 text-xs font-semibold"
          >
            {showEmptyRoster ? 'Hide empty roster' : 'Show empty roster anyway'}
          </button>
        </section>
      )}

      {preDraft && team.targets.length > 0 && (
        <ShortlistSection team={team} playerById={playerById} onAssign={setSlotPlayer} />
      )}

      {(!preDraft || showEmptyRoster) &&
        GROUPS.map((group) => {
          const slots = team.format.rosterSlots.filter((s) => group.kinds.includes(s.kind));
          if (slots.length === 0) return null;
          return (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <SectionHead
                id={`group-${group.key}`}
                tone={group.tone}
                title={group.title}
                count={slots.length}
                note={group.note}
              />
              <div className="rows overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-alt text-left">
                      <th className="label w-28 px-3 py-2">Slot</th>
                      <th className="label px-3 py-2">Player</th>
                      <th className="label w-20 px-3 py-2">Pos</th>
                      <th className="label w-16 px-3 py-2">Team</th>
                      <th className="label w-14 px-3 py-2">Age</th>
                      <th className="label w-32 px-3 py-2">Tier</th>
                      <th className="label w-24 px-3 py-2">Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        playerId={team.roster.find((r) => r.slotId === slot.id)?.playerId ?? null}
                        players={players}
                        playerById={playerById}
                        assignedIds={assignedIds}
                        targets={targetsBySlot.get(slot.id) ?? []}
                        expanded={expanded === slot.id}
                        onToggle={() => setExpanded((v) => (v === slot.id ? null : slot.id))}
                        onAssign={(id) => setSlotPlayer(slot.id, id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

      <section aria-labelledby="budgets">
        <SectionHead
          id="budgets"
          tone="amber"
          title="Budgets"
          note="Auction dollars and FAAB. Remaining is the ceiling minus everything you have committed."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          {team.budgets.map((budget) => (
            <BudgetLedger
              key={budget.id}
              budget={budget}
              openSlots={openSlots}
              onChange={setBudget}
            />
          ))}
        </div>
      </section>

      {slotById.size === 0 && <p className="text-sm text-muted">No roster slots configured.</p>}
    </div>
  );
}

/**
 * Pre-draft, the target list stops being "alternatives for a slot" and becomes
 * the shortlist — the thing you actually work from on draft night. Same data,
 * grouped by slot need instead of buried under empty rows.
 */
function ShortlistSection({
  team,
  playerById,
  onAssign,
}: {
  team: Team;
  playerById: Map<string, Player>;
  onAssign: (slotId: string, playerId: string) => void;
}) {
  const slotLabel = new Map(team.format.rosterSlots.map((s) => [s.id, s.label]));
  const slotKind = new Map(team.format.rosterSlots.map((s) => [s.id, s.kind]));
  const bySlot = new Map<string, Team['targets']>();
  for (const target of [...team.targets].sort((a, b) => a.priority - b.priority)) {
    bySlot.set(target.slotId, [...(bySlot.get(target.slotId) ?? []), target]);
  }

  return (
    <section aria-labelledby="shortlist" data-testid="shortlist">
      <SectionHead
        id="shortlist"
        tone="violet"
        title="Draft shortlist"
        count={team.targets.length}
        note="Grouped by the need each player fills, in priority order."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {[...bySlot.entries()].map(([slotId, targets]) => (
          <div
            key={slotId}
            data-testid="shortlist-group"
            data-slot={slotId}
            data-pos={slotKind.get(slotId)}
            className="card-tone"
          >
            <div className="panel-head">
              <h3 className="panel-title text-[0.8125rem]">{slotLabel.get(slotId) ?? slotId}</h3>
              <span className="label">
                {targets.length} option{targets.length === 1 ? '' : 's'}
              </span>
            </div>
            <ol className="divide-y divide-line">
              {targets.map((target) => {
                const player = playerById.get(target.playerId);
                return (
                  <li key={target.id} data-testid="shortlist-target" className="p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-bold">
                        {target.priority}. {player?.name ?? target.playerId}
                      </span>
                      {player && (
                        <>
                          <PosTag pos={player.pos} />
                          <span className="text-[11px] text-muted">
                            {player.nflTeam} · age {player.age}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onAssign(slotId, target.playerId)}
                        className="ml-auto rounded-[0.375rem] border border-line bg-surface px-2 py-0.5 text-xs font-semibold"
                      >
                        Drafted
                      </button>
                    </div>
                    <p className="mt-1 max-w-2xl text-muted">{target.rationale}</p>
                    {target.cost && (
                      <p className="mt-1 text-[12px]">
                        <span className="label">Likely cost</span>{' '}
                        <span className="text-muted">{target.cost}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function FormatBar({ team, openSlots }: { team: Team; openSlots: number }) {
  const facts: [string, string, Tone][] = [
    ['League', team.leagueName, 'blue'],
    ['Teams', String(team.format.teams), 'slate'],
    ['QB', team.format.superflex ? 'Superflex' : 'Single QB', 'violet'],
    ['PPR', String(team.format.ppr), 'teal'],
    ['TE premium', team.format.tePremium ? `+${team.format.tePremium}` : 'none', 'amber'],
    ['Open slots', String(openSlots), openSlots > 0 ? 'orange' : 'green'],
  ];
  return (
    <dl
      data-testid="format-bar"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
    >
      {facts.map(([label, value, tone]) => (
        <div key={label} data-tone={tone} className="card-tone px-3 py-2">
          <dt className="label">{label}</dt>
          <dd className="mt-0.5 text-sm font-bold text-tone" data-numeric>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface SlotRowProps {
  slot: RosterSlot;
  playerId: string | null;
  players: Player[];
  playerById: Map<string, Player>;
  assignedIds: Set<string>;
  targets: Team['targets'];
  expanded: boolean;
  onToggle: () => void;
  onAssign: (playerId: string | null) => void;
}

function SlotRow({
  slot,
  playerId,
  players,
  playerById,
  assignedIds,
  targets,
  expanded,
  onToggle,
  onAssign,
}: SlotRowProps) {
  const eligible = eligiblePositions(slot.kind);
  const options = players
    .filter((p) => eligible.includes(p.pos))
    .sort((a, b) => a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name));
  const current = playerId ? playerById.get(playerId) : undefined;

  return (
    <>
      <tr
        data-testid="slot-row"
        data-slot={slot.id}
        data-pos={slot.kind}
        className="border-b border-line align-middle last:border-b-0 hover:bg-surface-alt"
      >
        <td className="px-3 py-2">
          <span className="flex items-center gap-2 font-semibold">
            <span className="h-4 w-1 rounded-full bg-tone" aria-hidden="true" />
            {slot.label}
          </span>
        </td>
        <td className="px-3 py-2">
          <select
            aria-label={`${slot.label} player`}
            value={playerId ?? ''}
            onChange={(e) => onAssign(e.target.value === '' ? null : e.target.value)}
            className="w-full max-w-64 rounded-[0.375rem] border border-line bg-surface px-1.5 py-1 text-sm"
          >
            <option value="">— empty —</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.pos})
                {assignedIds.has(p.id) && p.id !== playerId ? ' · rostered' : ''}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2">
          <PosTag pos={current?.pos} />
        </td>
        <td className="px-3 py-2 text-muted">{current?.nflTeam ?? '—'}</td>
        <td className="px-3 py-2 text-muted" data-numeric>
          {current?.age ?? '—'}
        </td>
        <td className="px-3 py-2">
          {current?.tier ? <span className="chip">{current.tier}</span> : <span className="text-muted">—</span>}
        </td>
        <td className="px-3 py-2">
          {targets.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {expanded ? 'Hide' : `${targets.length} alt${targets.length === 1 ? '' : 's'}`}
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr data-testid="targets-row" data-slot={slot.id} data-pos={slot.kind}>
          <td colSpan={7} className="border-b border-line border-l-[3px] border-l-tone bg-surface-alt px-3 py-2.5">
            <h3 className="label mb-2">Alternatives for {slot.label}</h3>
            <ol className="space-y-2.5">
              {targets.map((target) => {
                const player = playerById.get(target.playerId);
                return (
                  <li key={target.id} data-testid="target" className="text-[13px]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-bold">
                        {target.priority}. {player?.name ?? target.playerId}
                      </span>
                      {player && (
                        <>
                          <PosTag pos={player.pos} />
                          <span className="text-[11px] text-muted">
                            {player.nflTeam} · age {player.age} · {player.tier}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onAssign(target.playerId)}
                        className="ml-auto rounded-[0.375rem] border border-line bg-surface px-2 py-0.5 text-xs font-semibold"
                      >
                        Move into {slot.label}
                      </button>
                    </div>
                    <p className="mt-1 max-w-3xl text-muted">{target.rationale}</p>
                    {target.cost && (
                      <p className="mt-1 text-[12px]">
                        <span className="label">Likely cost</span>{' '}
                        <span className="text-muted">{target.cost}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </td>
        </tr>
      )}
    </>
  );
}

function BudgetLedger({
  budget,
  openSlots,
  onChange,
}: {
  budget: Budget;
  openSlots: number;
  onChange: (next: Budget) => void;
}) {
  const left = remaining(budget);
  const perSlot = perSlotRemaining(budget, openSlots);
  const over = isOverspent(budget);
  const spent = allocated(budget);
  const used = budget.total > 0 ? Math.min(100, Math.round((spent / budget.total) * 100)) : 0;

  function setEntry(id: string, patch: Partial<Budget['entries'][number]>) {
    onChange({
      ...budget,
      entries: budget.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  function addEntry() {
    onChange({
      ...budget,
      entries: [
        ...budget.entries,
        { id: `e-${Date.now()}-${budget.entries.length}`, label: 'New entry', amount: 0, date: '' },
      ],
    });
  }

  return (
    <div
      data-testid="budget"
      data-budget={budget.id}
      data-tone={over ? 'rose' : 'green'}
      className="card-tone"
    >
      <div className="panel-head">
        <h3 className="panel-title">{budget.label}</h3>
        <span className="chip chip-tone">{budget.kind}</span>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        <div className="px-2 py-2.5">
          <dt className="label">Total</dt>
          <dd className="mt-1">
            <input
              type="number"
              aria-label={`${budget.label} total`}
              value={budget.total}
              min={0}
              onChange={(e) => onChange({ ...budget, total: Number(e.target.value) || 0 })}
              className="w-full rounded-[0.375rem] border border-line bg-surface px-1 py-0.5 text-center text-sm"
              data-numeric
            />
          </dd>
        </div>
        <div className="px-2 py-2.5">
          <dt className="label">Allocated</dt>
          <dd className="pt-1.5 text-[0.9375rem] font-bold" data-numeric data-testid="allocated">
            {formatMoney(spent, budget.kind)}
          </dd>
        </div>
        <div className="px-2 py-2.5">
          <dt className="label">Remaining</dt>
          <dd
            className="pt-1.5 text-[0.9375rem] font-bold text-tone"
            data-numeric
            data-testid="remaining"
          >
            {formatMoney(left, budget.kind)}
          </dd>
        </div>
      </dl>

      <div className="border-b border-line px-3 py-2.5">
        <div className="meter">
          <div className="meter__fill" style={{ width: `${used}%` }} />
        </div>
        {over ? (
          <p className="mt-2 text-xs font-semibold text-tone">
            Over the ceiling by {formatMoney(Math.abs(left), budget.kind)}.
          </p>
        ) : perSlot !== null ? (
          <p className="mt-2 text-xs text-muted">
            {formatMoney(perSlot, budget.kind)} per open slot ({openSlots} left to fill).
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted" data-numeric>
            {used}% of the ceiling committed.
          </p>
        )}
      </div>

      <ul className="divide-y divide-line">
        {budget.entries.map((entry) => (
          <li
            key={entry.id}
            data-testid="budget-entry"
            className="flex items-center gap-2 px-3 py-1.5"
          >
            <input
              aria-label={`${entry.label} label`}
              value={entry.label}
              onChange={(e) => setEntry(entry.id, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-[0.375rem] border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-line focus:border-line"
            />
            <input
              type="number"
              aria-label={`${entry.label} amount`}
              value={entry.amount}
              onChange={(e) => setEntry(entry.id, { amount: Number(e.target.value) || 0 })}
              className="w-20 rounded-[0.375rem] border border-line bg-surface px-1 py-0.5 text-right text-sm"
              data-numeric
            />
            <button
              type="button"
              aria-label={`Remove ${entry.label}`}
              onClick={() =>
                onChange({ ...budget, entries: budget.entries.filter((e) => e.id !== entry.id) })
              }
              className="px-1 text-sm text-muted hover:text-warn"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={addEntry}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Add entry
        </button>
      </div>
    </div>
  );
}

export default TeamApp;
