import { parseCsv, parseCsvRecords, assertHeader } from '../market/csv';
import type { PlayerIdRow } from '../market/dynastyprocess';
import type { DepthEntry } from '~/lib/schemas/depth';
import type { Player } from '~/lib/schemas/players';
import { normalizeName } from '../market/dynastyprocess';

/**
 * nflverse depth charts -> our shapes. Pure (no fs, no fetch) so it is testable
 * against a committed fixture.
 *
 * The join runs espn_id -> db_playerids.espn_id -> sleeper_id -> our player,
 * because every id in that chain is a real identifier. Name matching is the
 * fallback only, and an ambiguous name is never guessed — two players sharing a
 * name go to `unmatched` rather than silently swapping depth charts.
 */

const DEPTH_HEADER = [
  'dt',
  'team',
  'player_name',
  'espn_id',
  'gsis_id',
  'pos_grp_id',
  'pos_grp',
  'pos_id',
  'pos_name',
  'pos_abb',
  'pos_slot',
  'pos_rank',
];

/** The only positions this league starts. Offensive line and defense are noise here. */
const SKILL = new Set(['QB', 'RB', 'WR', 'TE']);

export interface DepthRow {
  dt: string;
  team: string;
  playerName: string;
  espnId: string | null;
  pos: string;
  depthRank: number;
}

function str(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v && v !== 'NA' ? v : null;
}

/**
 * Parse the release CSV, keeping only the newest snapshot's skill-position rows.
 *
 * The file carries every snapshot taken during the season (143 of them by August),
 * so filtering to `max(dt)` is what turns 420k rows into the ~800 that describe
 * the league as it stands today.
 */
export function parseDepthCharts(csv: string): { snapshotAt: string; rows: DepthRow[] } {
  assertHeader(parseCsv(csv)[0] ?? [], DEPTH_HEADER);
  const records = parseCsvRecords(csv);

  let snapshotAt = '';
  for (const r of records) {
    const dt = r.dt?.trim() ?? '';
    if (dt > snapshotAt) snapshotAt = dt;
  }
  if (!snapshotAt) return { snapshotAt: '', rows: [] };

  const rows: DepthRow[] = [];
  for (const r of records) {
    if (r.dt?.trim() !== snapshotAt) continue;

    const pos = r.pos_abb?.trim().toUpperCase() ?? '';
    if (!SKILL.has(pos)) continue;

    const depthRank = Number(r.pos_rank);
    if (!Number.isFinite(depthRank) || depthRank < 1) continue;

    const playerName = r.player_name?.trim() ?? '';
    if (!playerName) continue;

    rows.push({
      dt: snapshotAt,
      team: r.team?.trim().toUpperCase() ?? '',
      playerName,
      espnId: str(r.espn_id),
      pos,
      depthRank,
    });
  }

  return { snapshotAt, rows };
}

export interface DepthJoinResult {
  entries: DepthEntry[];
  unmatched: string[];
}

/**
 * Depth rows -> entries for the players we actually track.
 *
 * A chart row for someone outside our player pool is not "unmatched" — it is
 * simply not our concern, and counting it as a failure would make the match
 * rate meaningless. `unmatched` means "this looks like a player we track and we
 * still could not place him", which is the only case worth a human's attention.
 */
export function joinDepthToPlayers(
  rows: DepthRow[],
  playerIds: PlayerIdRow[],
  ourPlayers: Player[],
): DepthJoinResult {
  const sleeperByEspn = new Map<string, string>();
  for (const row of playerIds) {
    if (row.espnId && row.sleeperId) sleeperByEspn.set(row.espnId, row.sleeperId);
  }

  const bySleeperId = new Map<string, Player>();
  for (const p of ourPlayers) {
    if (p.sleeperId) bySleeperId.set(p.sleeperId, p);
  }

  // Name fallback, keyed name|pos. Ambiguous keys are recorded and never guessed.
  const byName = new Map<string, Player | null>();
  for (const p of ourPlayers) {
    const key = `${normalizeName(p.name)}|${p.pos}`;
    byName.set(key, byName.has(key) ? null : p);
  }

  const entries: DepthEntry[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const viaId = row.espnId ? sleeperByEspn.get(row.espnId) : undefined;
    const matched =
      (viaId ? bySleeperId.get(viaId) : undefined) ??
      byName.get(`${normalizeName(row.playerName)}|${row.pos}`) ??
      null;

    if (!matched) {
      // Only worth reporting when the name exists in our pool at another
      // position — otherwise it is a practice-squad body we never tracked.
      if (ourPlayers.some((p) => normalizeName(p.name) === normalizeName(row.playerName))) {
        unmatched.push(`${row.playerName} (${row.team} ${row.pos})`);
      }
      continue;
    }

    // One chart slot per player: a name appearing twice keeps the better rank.
    const existing = seen.has(matched.id)
      ? entries.find((e) => e.id === matched.id)
      : undefined;
    if (existing) {
      if (row.depthRank < existing.depthRank) existing.depthRank = row.depthRank;
      continue;
    }

    seen.add(matched.id);
    entries.push({
      id: matched.id,
      name: matched.name,
      pos: matched.pos,
      nflTeam: row.team.length >= 2 ? row.team.slice(0, 3) : matched.nflTeam,
      depthRank: row.depthRank,
      sleeperId: matched.sleeperId,
    });
  }

  entries.sort((a, b) =>
    a.nflTeam === b.nflTeam
      ? a.pos === b.pos
        ? a.depthRank - b.depthRank
        : a.pos.localeCompare(b.pos)
      : a.nflTeam.localeCompare(b.nflTeam),
  );

  return { entries, unmatched };
}
