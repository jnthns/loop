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
import type { Draft, DraftPick, DraftStatus } from '~/lib/schemas/draft';
import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPlayer,
  SleeperRoster,
} from '~/lib/schemas/sleeper';

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
    rank: raw.search_rank ?? undefined,
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

/* --------------------------------- draft --------------------------------- */

/**
 * Overall pick numbers for a given draft slot.
 *
 * Snake drafts reverse every other round, which is exactly the arithmetic people
 * get wrong under pressure — and in a startup, knowing that your picks are
 * 7, 18, 31, 42 rather than 7, 19, 31, 43 changes who you plan to take.
 * Linear drafts do not reverse. Auctions have no pick numbers at all.
 */
export function pickNumbersForSlot(
  slot: number,
  teams: number,
  rounds: number,
  type: string,
): number[] {
  if (slot < 1 || slot > teams || teams < 1 || rounds < 1) return [];
  if (type.includes('auction')) return [];

  const snake = !type.includes('linear');
  const picks: number[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const reversed = snake && round % 2 === 0;
    const positionInRound = reversed ? teams - slot + 1 : slot;
    picks.push((round - 1) * teams + positionInRound);
  }
  return picks;
}

const DRAFT_STATUS_MAP: Record<string, DraftStatus> = {
  pre_draft: 'pre_draft',
  drafting: 'drafting',
  paused: 'paused',
  complete: 'complete',
};

export interface DraftInput {
  draft: SleeperDraft;
  picks: SleeperDraftPick[];
  /** This manager's Sleeper user id — how we find their slot in draft_order. */
  userId: string;
  rosterId: number | null;
  /** Resolves a Sleeper player id to our slug, for picks already made. */
  sleeperIdToPlayerId?: Map<string, string>;
}

export function toDraft(input: DraftInput): Draft {
  const { draft, picks, userId, rosterId } = input;

  const teams = Number(draft.settings.teams ?? 12) || 12;
  const rounds = Number(draft.settings.rounds ?? 1) || 1;
  const type = draft.type ?? '';

  // Sleeper gives the slot two ways; draft_order is keyed by user, which is the
  // one that survives a roster id changing hands.
  const fromOrder = draft.draft_order?.[userId];
  const fromSlots =
    rosterId === null
      ? undefined
      : Object.entries(draft.slot_to_roster_id ?? {}).find(([, r]) => r === rosterId)?.[0];
  const myDraftSlot = fromOrder ?? (fromSlots ? Number(fromSlots) : null) ?? null;

  const mappedPicks: DraftPick[] = picks
    .map((p) => ({
      pick: p.pick_no,
      round: p.round,
      slot: p.draft_slot,
      rosterId: p.roster_id ?? null,
      playerId: p.player_id
        ? (input.sleeperIdToPlayerId?.get(p.player_id) ?? null)
        : null,
      playerName: [p.metadata?.first_name, p.metadata?.last_name].filter(Boolean).join(' '),
      pos: p.metadata?.position ?? '',
      nflTeam: (p.metadata?.team ?? '').toUpperCase(),
      mine: rosterId !== null && p.roster_id === rosterId,
    }))
    .sort((a, b) => a.pick - b.pick);

  return {
    draftId: draft.draft_id,
    status: DRAFT_STATUS_MAP[draft.status] ?? 'none',
    type,
    startTime:
      typeof draft.start_time === 'number' && draft.start_time > 0
        ? new Date(draft.start_time).toISOString()
        : null,
    teams,
    rounds,
    myDraftSlot,
    myPicks: myDraftSlot ? pickNumbersForSlot(myDraftSlot, teams, rounds, type) : [],
    picks: mappedPicks,
  };
}

/** Team name lives on the league user, not the league. */
export function teamNameFor(users: SleeperLeagueUser[], userId: string): string | null {
  const me = users.find((u) => u.user_id === userId);
  if (!me) return null;
  const named = me.metadata?.team_name?.trim();
  return named || me.display_name?.trim() || null;
}

/* --------------------------------- pool ----------------------------------- */

/** Fantasy-relevant skill positions worth a draft pool — excludes K/DEF. */
const DRAFT_POOL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

/**
 * The top N players by Sleeper's `search_rank`, restricted to active QB/RB/WR/TE.
 * `search_rank` is Sleeper's own relevance ordering (lower = more relevant), so
 * this is "the players anyone would draft" rather than an opinion of ours.
 */
export function topRankedPlayers(
  players: Record<string, SleeperPlayer>,
  limit: number,
): string[] {
  return Object.values(players)
    .filter((p) => {
      if (typeof p.search_rank !== 'number') return false;
      if (p.status && p.status !== 'Active') return false;
      const positions = [p.position, ...(p.fantasy_positions ?? [])].filter(Boolean) as string[];
      return positions.some((pos) => DRAFT_POOL_POSITIONS.has(pos.toUpperCase()));
    })
    .sort((a, b) => (a.search_rank ?? Infinity) - (b.search_rank ?? Infinity))
    .slice(0, limit)
    .map((p) => p.player_id);
}

export interface SelectPlayersInput {
  players: Record<string, SleeperPlayer>;
  rosters: { players?: string[] | null }[];
  myRoster: { players?: string[] | null; reserve?: string[] | null; taxi?: string[] | null };
  trendingAdds: { player_id: string }[];
  trendingDrops: { player_id: string }[];
  targetPlayerIds: string[];
  existing: Player[];
  /** Cap on the pre-draft ranked pool. Defaults to 250 — a real startup-sized pool. */
  preDraftPoolSize?: number;
}

/**
 * Keep only the players that matter: your roster, everyone rostered in the
 * league, your targets, what the league is trending on — and, pre-draft, the
 * top ranked players overall. The full player dump is thousands of rows of
 * noise that would dominate every diff.
 *
 * Pre-draft, nobody is rostered anywhere in the league, so the first three
 * sources are all empty and the pool would otherwise collapse to whatever
 * happens to be trending on the waiver wire — which is how an earlier sync of
 * a real league ended up with only 8 QBs, mostly bench and practice-squad
 * names, in a superflex format where QB is the defining asset. The ranked
 * branch covers that gap with Sleeper's own relevance ordering rather than an
 * opinion of ours.
 */
export function selectPlayers(input: SelectPlayersInput): Player[] {
  const { players, rosters, myRoster, trendingAdds, trendingDrops, targetPlayerIds, existing } =
    input;
  const existingBySleeperId = new Map(existing.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p]));
  const existingById = new Map(existing.map((p) => [p.id, p]));

  const mine = new Set([
    ...(myRoster.players ?? []),
    ...(myRoster.reserve ?? []),
    ...(myRoster.taxi ?? []),
  ]);
  const leagueRostered = new Set(rosters.flatMap((r) => r.players ?? []));
  const trendingIds = [...trendingAdds.map((t) => t.player_id), ...trendingDrops.map((t) => t.player_id)];

  // Nobody rostered anywhere means the draft hasn't happened — pull in a real
  // startup-sized pool rather than leaving the app to infer relevance from
  // waiver churn alone.
  const preDraft = leagueRostered.size === 0;
  const rankedIds = preDraft ? topRankedPlayers(players, input.preDraftPoolSize ?? 250) : [];

  const wanted = new Set([...mine, ...leagueRostered, ...trendingIds, ...rankedIds]);

  const out: Player[] = [];
  const seenIds = new Set<string>();

  for (const sleeperId of wanted) {
    const raw = players[sleeperId];
    if (!raw) continue;
    const mapped = toPlayer(raw, existingBySleeperId.get(sleeperId));
    if (!mapped) continue;

    // Slug collisions (two players with the same name) get disambiguated rather
    // than silently overwriting each other.
    let id = mapped.id;
    if (seenIds.has(id)) id = `${id}-${mapped.pos.toLowerCase()}-${sleeperId}`;
    seenIds.add(id);

    out.push({ ...mapped, id, rosteredInLeague: leagueRostered.has(sleeperId) });
  }

  // Never drop a player a target still points at, even if they left the league.
  for (const targetId of targetPlayerIds) {
    if (seenIds.has(targetId)) continue;
    const prior = existingById.get(targetId);
    if (prior) {
      out.push(prior);
      seenIds.add(targetId);
    }
  }

  return out.sort((a, b) => a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name));
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
  // slot that no longer exists is reattached rather than left dangling.
  //
  // Match on slot KIND first. Matching on position eligibility alone moved the
  // superflex QB targets onto QB1 the first time the real league synced, because
  // that format calls the slot `superflex-1` rather than `sflex-1` — technically
  // eligible, but it silently changed what the target meant.
  const slotById = new Map(format.rosterSlots.map((s) => [s.id, s]));
  const previousSlotKind = new Map(previous.format.rosterSlots.map((s) => [s.id, s.kind]));
  const playerPos = new Map(input.players.map((p) => [p.id, p.pos]));

  const targets = previous.targets.map((target) => {
    if (slotById.has(target.slotId)) return target;

    const oldKind = previousSlotKind.get(target.slotId);
    const sameKind = oldKind && format.rosterSlots.find((s) => s.kind === oldKind);
    if (sameKind) return { ...target, slotId: sameKind.id };

    const pos = playerPos.get(target.playerId);
    const eligible = format.rosterSlots.find((s) => pos && eligibleFor(s.kind).includes(pos));
    if (eligible) return { ...target, slotId: eligible.id };

    // Last resort: the bench, which can hold anyone. Reached when the target's
    // player is not in the player file at all — a target for someone outside the
    // league, say. Leaving the target pointing at a slot that no longer exists
    // would break referential integrity and fail the build, which is a worse
    // outcome than filing it on the bench for a human to re-slot.
    const bench = format.rosterSlots.find((s) => s.kind === 'BN') ?? format.rosterSlots[0];
    return bench ? { ...target, slotId: bench.id } : target;
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
