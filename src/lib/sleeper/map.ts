import type { Player, Position } from '~/lib/schemas/players';
import { POSITIONS } from '~/lib/schemas/players';
import type {
  Budget,
  LeagueFormat,
  RosterEntry,
  RosterSlot,
  SlotKind,
  Team,
} from '~/lib/schemas/team';
import { eligiblePositions as eligibleFor } from '~/lib/schemas/team';
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from '~/lib/schemas/sleeper';

/**
 * Sleeper's shapes -> ours. Everything here is pure and tested against committed
 * fixtures, because this is where a sync can quietly corrupt a roster: the API
 * calls are trivial, the mapping is not.
 */

/* --------------------------------- slots --------------------------------- */

const SLOT_MAP: Record<string, SlotKind> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  FLEX: 'FLEX',
  WRRB_FLEX: 'FLEX',
  REC_FLEX: 'FLEX',
  SUPER_FLEX: 'SUPERFLEX',
  K: 'K',
  DEF: 'DEF',
  BN: 'BN',
  TAXI: 'TAXI',
  IR: 'IR',
};

const LABELS: Record<SlotKind, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  FLEX: 'FLEX',
  SUPERFLEX: 'SUPERFLEX',
  K: 'K',
  DEF: 'D/ST',
  BN: 'Bench',
  TAXI: 'Taxi',
  IR: 'IR',
};

/**
 * `roster_positions` is an ordered list with repeats ("QB","RB","RB","WR",...).
 * Repeats get numbered so slot ids stay stable and labels read like a lineup.
 * Unknown position codes are skipped rather than guessed at — a slot we cannot
 * name is worse than a slot we do not show.
 */
export function rosterPositionsToSlots(positions: string[]): RosterSlot[] {
  const seen = new Map<SlotKind, number>();
  const totals = new Map<SlotKind, number>();

  for (const raw of positions) {
    const kind = SLOT_MAP[raw];
    if (kind) totals.set(kind, (totals.get(kind) ?? 0) + 1);
  }

  const slots: RosterSlot[] = [];
  for (const raw of positions) {
    const kind = SLOT_MAP[raw];
    if (!kind) continue;

    const n = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, n);

    const multiple = (totals.get(kind) ?? 0) > 1;
    slots.push({
      id: `${kind.toLowerCase()}-${n}`,
      kind,
      label: multiple ? `${LABELS[kind]}${kind === 'BN' || kind === 'TAXI' ? ` ${n}` : n}` : LABELS[kind],
    });
  }
  return slots;
}

/* -------------------------------- format --------------------------------- */

export function leagueToFormat(league: SleeperLeague): LeagueFormat {
  const rosterSlots = rosterPositionsToSlots(league.roster_positions);
  return {
    teams: league.total_rosters,
    superflex: rosterSlots.some((s) => s.kind === 'SUPERFLEX'),
    ppr: league.scoring_settings.rec ?? 0,
    tePremium: league.scoring_settings.bonus_rec_te ?? 0,
    rosterSlots,
  };
}

/* -------------------------------- players -------------------------------- */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPosition(raw: SleeperPlayer): Position | null {
  const candidates = [raw.position, ...(raw.fantasy_positions ?? [])].filter(Boolean) as string[];
  for (const c of candidates) {
    const upper = c.toUpperCase();
    if ((POSITIONS as readonly string[]).includes(upper)) return upper as Position;
    if (upper === 'DST' || upper === 'D/ST') return 'DEF';
  }
  return null;
}

/**
 * Dynasty tier from what Sleeper actually knows: age and position. This is a
 * coarse starting point, not an evaluation — the age curves in the knowledge
 * base are the reasoning behind the thresholds. A human or the curator loop is
 * expected to overwrite `tier` and `notes` with something better.
 */
export function defaultTier(pos: Position, age: number): Player['tier'] {
  if (pos === 'K' || pos === 'DEF') return 'depth';
  if (pos === 'RB') {
    if (age <= 24) return 'starter';
    if (age <= 26) return 'win-now';
    return 'depth';
  }
  if (pos === 'QB') return age <= 27 ? 'starter' : 'win-now';
  // WR / TE age more gently.
  if (age <= 25) return 'starter';
  if (age <= 29) return 'win-now';
  return 'depth';
}

/**
 * One Sleeper player -> one of ours. Returns null when the row cannot be made
 * schema-valid (no usable position, no age, no name) rather than inventing
 * values — a fabricated age would silently poison every age-based judgement in
 * the app.
 */
export function toPlayer(raw: SleeperPlayer, previous?: Player): Player | null {
  const name = raw.full_name ?? [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim();
  if (!name) return null;

  const pos = toPosition(raw);
  if (!pos) return null;

  // Team defenses have no age; the schema requires one, so use a documented
  // sentinel rather than dropping D/ST rows entirely (see data/README.md).
  const age = raw.age ?? (pos === 'DEF' ? 30 : null);
  if (age === null || age < 18 || age > 50) return null;

  const nflTeam = (raw.team ?? 'FA').toUpperCase().slice(0, 3);

  return {
    id: previous?.id ?? slugify(name),
    name,
    pos,
    nflTeam: nflTeam.length >= 2 ? nflTeam : 'FA',
    age: Math.round(age),
    // Hand-written tiers and notes survive a sync; Sleeper does not know them.
    tier: previous?.tier ?? defaultTier(pos, Math.round(age)),
    notes: previous?.notes ?? '',
    sleeperId: raw.player_id,
  };
}

/* --------------------------------- roster -------------------------------- */

/**
 * Sleeper roster -> our slot assignments.
 *
 * `starters` is positional: index i corresponds to roster_positions[i] among the
 * starting slots, with '0' meaning empty. Reserve and taxi fill IR and TAXI;
 * whatever is left over goes to the bench in a stable order.
 */
export interface RosterMapping {
  entries: RosterEntry[];
  /** Sleeper ids with no room left on the configured bench — reported, never dropped silently. */
  overflow: string[];
  /** Sleeper ids the player file could not resolve — usually a stale player dump. */
  unresolved: string[];
}

export function rosterToEntries(
  roster: SleeperRoster,
  slots: RosterSlot[],
  sleeperIdToPlayerId: Map<string, string>,
): RosterMapping {
  const unresolved: string[] = [];
  const resolve = (sleeperId: string | undefined): string | null => {
    if (!sleeperId || sleeperId === '0') return null;
    const mapped = sleeperIdToPlayerId.get(sleeperId);
    if (!mapped) unresolved.push(sleeperId);
    return mapped ?? null;
  };

  const startingSlots = slots.filter((s) => !['BN', 'TAXI', 'IR'].includes(s.kind));
  const benchSlots = slots.filter((s) => s.kind === 'BN');
  const taxiSlots = slots.filter((s) => s.kind === 'TAXI');
  const irSlots = slots.filter((s) => s.kind === 'IR');

  const starters = roster.starters ?? [];
  const reserve = roster.reserve ?? [];
  const taxi = roster.taxi ?? [];
  const all = roster.players ?? [];

  const entries: RosterEntry[] = [];
  const placed = new Set<string>();

  startingSlots.forEach((slot, i) => {
    const sleeperId = starters[i];
    const playerId = resolve(sleeperId);
    if (sleeperId && sleeperId !== '0') placed.add(sleeperId);
    entries.push({ slotId: slot.id, playerId, acquired: '', notes: '' });
  });

  const fill = (targetSlots: RosterSlot[], ids: string[]) => {
    targetSlots.forEach((slot, i) => {
      const sleeperId = ids[i];
      if (sleeperId) placed.add(sleeperId);
      entries.push({ slotId: slot.id, playerId: resolve(sleeperId), acquired: '', notes: '' });
    });
  };

  fill(irSlots, reserve);
  fill(taxiSlots, taxi);

  const benched = all.filter((id) => !placed.has(id));
  fill(benchSlots, benched);

  return {
    entries,
    // Anything past the configured bench size would otherwise vanish silently.
    overflow: benched.slice(benchSlots.length),
    unresolved: [...new Set(unresolved)],
  };
}

/* --------------------------------- FAAB ---------------------------------- */

/**
 * League waiver budget + this roster's spend. Sleeper knows the totals; it does
 * not know what each bid was for, so prior hand-written entries are preserved
 * and only the derived "spent to date" line is rewritten.
 */
export function faabBudget(
  league: SleeperLeague,
  roster: SleeperRoster,
  previous: Budget | undefined,
  season: string,
): Budget {
  const total = Number(league.settings.waiver_budget ?? 100);
  const used = Number(roster.settings.waiver_budget_used ?? 0);

  const SYNCED_ENTRY_ID = 'faab-spent-to-date';
  const handWritten = (previous?.entries ?? []).filter((e) => e.id !== SYNCED_ENTRY_ID);
  const handWrittenTotal = handWritten.reduce((sum, e) => sum + e.amount, 0);

  // Sleeper reports cumulative spend; subtract anything already itemized by hand
  // so the ledger does not double-count.
  const remainder = Math.max(0, used - handWrittenTotal);

  return {
    id: previous?.id ?? `faab-${season}`,
    label: previous?.label ?? `FAAB — ${season} season`,
    kind: 'faab',
    total,
    entries: remainder > 0
      ? [...handWritten, { id: SYNCED_ENTRY_ID, label: 'Spent to date (from Sleeper)', amount: remainder, date: '' }]
      : handWritten,
  };
}

/* ------------------------------ team assembly ----------------------------- */

export interface SyncInput {
  league: SleeperLeague;
  roster: SleeperRoster;
  players: Player[];
  season: string;
  teamName?: string;
}

export interface SyncResult {
  team: Team;
  overflow: string[];
  unresolved: string[];
  /** Targets whose player is now on the roster — reported so a human can prune them. */
  satisfiedTargets: string[];
}

/**
 * Merge a Sleeper snapshot into the committed team, overwriting only what
 * Sleeper genuinely owns.
 *
 * Preserved without exception: every entry in `targets` (the rationale and cost
 * are yours and an automated sync has no business deleting prose), the `auction`
 * budget, and any budget kind other than the synced FAAB ledger. Where a slot
 * still holds the same player, its hand-written `notes` and `acquired` text
 * survive too.
 */
export function applySleeperToTeam(previous: Team, input: SyncInput): SyncResult {
  const format = leagueToFormat(input.league);
  const sleeperIdToPlayerId = new Map(
    input.players.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p.id]),
  );
  const mapping = rosterToEntries(input.roster, format.rosterSlots, sleeperIdToPlayerId);

  // Carry hand-written per-slot notes and acquisition text across the sync.
  const priorBySlot = new Map(previous.roster.map((r) => [r.slotId, r]));
  const roster = mapping.entries.map((entry) => {
    const prior = priorBySlot.get(entry.slotId);
    return prior && prior.playerId === entry.playerId
      ? { ...entry, acquired: prior.acquired, notes: prior.notes }
      : entry;
  });

  const previousFaab = previous.budgets.find((b) => b.kind === 'faab');
  const otherBudgets = previous.budgets.filter((b) => b.kind !== 'faab');

  const rosteredIds = new Set(roster.map((r) => r.playerId).filter(Boolean));
  // Targets that have since been acquired are reported, not deleted — pruning
  // someone's written rationale is a human's call.
  const satisfiedTargets = previous.targets
    .filter((t) => rosteredIds.has(t.playerId))
    .map((t) => t.id);

  // Slot ids change with the league's roster settings, so a target pointing at a
  // slot that no longer exists gets reattached to the first slot that can hold
  // its position rather than silently failing referential integrity.
  const slotIds = new Set(format.rosterSlots.map((s) => s.id));
  const playerPos = new Map(input.players.map((p) => [p.id, p.pos]));
  const targets = previous.targets.map((target) => {
    if (slotIds.has(target.slotId)) return target;
    const pos = playerPos.get(target.playerId);
    const fallback = format.rosterSlots.find(
      (s) => pos && eligibleFor(s.kind).includes(pos),
    );
    return fallback ? { ...target, slotId: fallback.id } : target;
  });

  return {
    team: {
      leagueName: input.league.name,
      teamName: input.teamName ?? previous.teamName,
      format,
      roster,
      targets,
      budgets: [
        ...otherBudgets,
        faabBudget(input.league, input.roster, previousFaab, input.season),
      ],
    },
    overflow: mapping.overflow,
    unresolved: mapping.unresolved,
    satisfiedTargets,
  };
}
