import { useEffect, useMemo, useState } from 'react';
import type { Player } from '~/lib/schemas/players';
import type { Budget, RosterSlot, SlotKind, Team } from '~/lib/schemas/team';
import { eligiblePositions } from '~/lib/schemas/team';
import { allocated, formatMoney, isOverspent, perSlotRemaining, remaining } from '~/lib/team/budget';
import { clearOverlay, saveOverlay, loadOverlay, serializeTeam } from '~/lib/team/storage';

export interface TeamAppProps {
  committed: Team;
  players: Player[];
}

const GROUPS: { key: string; title: string; kinds: SlotKind[]; note?: string }[] = [
  {
    key: 'starters',
    title: 'Starters',
    kinds: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K', 'DEF'],
  },
  { key: 'bench', title: 'Bench', kinds: ['BN'] },
  {
    key: 'taxi',
    title: 'Taxi',
    kinds: ['TAXI'],
    note: 'Developmental spots. Stashing here is nearly free — treat it as the cheapest lottery ticket on the roster.',
  },
  { key: 'ir', title: 'Injured reserve', kinds: ['IR'] },
];

export function TeamApp({ committed, players }: TeamAppProps) {
  const [team, setTeam] = useState<Team>(committed);
  const [overlayActive, setOverlayActive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

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

      <section aria-labelledby="overlay-state" className="border border-line bg-surface-alt p-3">
        <h2 id="overlay-state" className="label mb-1">
          Where these edits live
        </h2>
        <p className="text-[13px] text-muted">
          {overlayActive ? (
            <>
              You have unsaved local edits. They live in this browser only —{' '}
              <strong className="font-semibold text-ink">the loop still reads the committed
              file</strong>, so export and commit them before expecting tailored advice.
            </>
          ) : (
            <>
              Showing the committed <code className="font-mono">data/team.json</code>. Edits here
              are stored in this browser until you export them back.
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportJson}
            className="border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold"
          >
            Export team.json
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!overlayActive}
            className="border border-line px-2.5 py-1 text-xs disabled:opacity-40"
          >
            Discard local edits
          </button>
        </div>
      </section>

      {GROUPS.map((group) => {
        const slots = team.format.rosterSlots.filter((s) => group.kinds.includes(s.kind));
        if (slots.length === 0) return null;
        return (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
              <h2 id={`group-${group.key}`} className="text-sm font-semibold">
                {group.title}
              </h2>
              <span className="label">{slots.length} slots</span>
            </div>
            {group.note && <p className="mb-2 text-xs text-muted">{group.note}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label w-28 py-1.5">Slot</th>
                  <th className="label py-1.5">Player</th>
                  <th className="label w-16 py-1.5">Pos</th>
                  <th className="label w-16 py-1.5">Team</th>
                  <th className="label w-14 py-1.5">Age</th>
                  <th className="label w-32 py-1.5">Tier</th>
                  <th className="label w-24 py-1.5">Options</th>
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
          </section>
        );
      })}

      <section aria-labelledby="budgets">
        <div className="mb-3 border-b border-line pb-1.5">
          <h2 id="budgets" className="text-sm font-semibold">
            Budgets
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
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

function FormatBar({ team, openSlots }: { team: Team; openSlots: number }) {
  const facts: [string, string][] = [
    ['League', team.leagueName],
    ['Teams', String(team.format.teams)],
    ['QB', team.format.superflex ? 'Superflex' : 'Single QB'],
    ['PPR', String(team.format.ppr)],
    ['TE premium', team.format.tePremium ? `+${team.format.tePremium}` : 'none'],
    ['Open slots', String(openSlots)],
  ];
  return (
    <dl
      data-testid="format-bar"
      className="grid grid-cols-2 gap-x-6 gap-y-2 border border-line bg-surface-alt p-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="label">{label}</dt>
          <dd className="text-sm font-medium" data-numeric>
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
      <tr data-testid="slot-row" data-slot={slot.id} className="border-b border-line align-top">
        <td className="py-1.5 font-medium">{slot.label}</td>
        <td className="py-1.5">
          <select
            aria-label={`${slot.label} player`}
            value={playerId ?? ''}
            onChange={(e) => onAssign(e.target.value === '' ? null : e.target.value)}
            className="w-full max-w-64 border border-line bg-surface px-1.5 py-1 text-sm"
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
        <td className="py-1.5 text-muted">{current?.pos ?? '—'}</td>
        <td className="py-1.5 text-muted">{current?.nflTeam ?? '—'}</td>
        <td className="py-1.5 text-muted" data-numeric>
          {current?.age ?? '—'}
        </td>
        <td className="py-1.5 text-muted">{current?.tier ?? '—'}</td>
        <td className="py-1.5">
          {targets.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="text-xs text-accent hover:underline"
            >
              {expanded ? 'Hide' : `${targets.length} alt${targets.length === 1 ? '' : 's'}`}
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr data-testid="targets-row" data-slot={slot.id}>
          <td colSpan={7} className="border-b border-line bg-surface-alt px-3 py-2">
            <h3 className="label mb-1.5">Alternatives for {slot.label}</h3>
            <ol className="space-y-2">
              {targets.map((target) => {
                const player = playerById.get(target.playerId);
                return (
                  <li key={target.id} data-testid="target" className="text-[13px]">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">
                        {target.priority}. {player?.name ?? target.playerId}
                      </span>
                      {player && (
                        <span className="text-muted">
                          {player.pos} · {player.nflTeam} · age {player.age} · {player.tier}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onAssign(target.playerId)}
                        className="ml-auto border border-line px-2 py-0.5 text-xs"
                      >
                        Move into {slot.label}
                      </button>
                    </div>
                    <p className="mt-0.5 max-w-3xl text-muted">{target.rationale}</p>
                    {target.cost && (
                      <p className="mt-0.5 text-[12px]">
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
    <div data-testid="budget" data-budget={budget.id} className="border border-line">
      <div className="flex items-baseline justify-between gap-3 border-b border-line bg-surface-alt px-3 py-2">
        <h3 className="text-sm font-semibold">{budget.label}</h3>
        <span className="label">{budget.kind}</span>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        <div className="px-2 py-2">
          <dt className="label">Total</dt>
          <dd>
            <input
              type="number"
              aria-label={`${budget.label} total`}
              value={budget.total}
              min={0}
              onChange={(e) => onChange({ ...budget, total: Number(e.target.value) || 0 })}
              className="w-full border border-line bg-surface px-1 py-0.5 text-center text-sm"
              data-numeric
            />
          </dd>
        </div>
        <div className="px-2 py-2">
          <dt className="label">Allocated</dt>
          <dd className="pt-1 text-sm font-medium" data-numeric data-testid="allocated">
            {formatMoney(allocated(budget), budget.kind)}
          </dd>
        </div>
        <div className="px-2 py-2">
          <dt className="label">Remaining</dt>
          <dd
            className={`pt-1 text-sm font-semibold ${over ? 'text-warn' : ''}`}
            data-numeric
            data-testid="remaining"
          >
            {formatMoney(left, budget.kind)}
          </dd>
        </div>
      </dl>

      {over && (
        <p className="border-b border-line bg-warn-soft px-3 py-1.5 text-xs">
          Over the ceiling by {formatMoney(Math.abs(left), budget.kind)}.
        </p>
      )}

      {perSlot !== null && !over && (
        <p className="border-b border-line px-3 py-1.5 text-xs text-muted">
          {formatMoney(perSlot, budget.kind)} per open slot ({openSlots} left to fill).
        </p>
      )}

      <ul className="divide-y divide-line">
        {budget.entries.map((entry) => (
          <li key={entry.id} data-testid="budget-entry" className="flex items-center gap-2 px-3 py-1.5">
            <input
              aria-label={`${entry.label} label`}
              value={entry.label}
              onChange={(e) => setEntry(entry.id, { label: e.target.value })}
              className="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-line focus:border-line"
            />
            <input
              type="number"
              aria-label={`${entry.label} amount`}
              value={entry.amount}
              onChange={(e) => setEntry(entry.id, { amount: Number(e.target.value) || 0 })}
              className="w-20 border border-line bg-surface px-1 py-0.5 text-right text-sm"
              data-numeric
            />
            <button
              type="button"
              aria-label={`Remove ${entry.label}`}
              onClick={() =>
                onChange({ ...budget, entries: budget.entries.filter((e) => e.id !== entry.id) })
              }
              className="px-1 text-xs text-muted hover:text-warn"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-3 py-2">
        <button type="button" onClick={addEntry} className="text-xs text-accent hover:underline">
          Add entry
        </button>
      </div>
    </div>
  );
}

export default TeamApp;
