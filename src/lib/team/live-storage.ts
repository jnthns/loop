import { DraftSchema, NO_DRAFT, type Draft } from '~/lib/schemas/draft';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { TeamSchema, type Team } from '~/lib/schemas/team';

/**
 * Browser-side result of a live Sleeper refresh.
 *
 * The site is static (GitHub Pages), so a sidebar button cannot rewrite
 * `data/*.json`. Instead the refresh lands here until the next committed sync
 * (or until the manager discards it). Same idea as the team edit overlay —
 * local only, never secrets, never network-at-build.
 */

export const LIVE_SYNC_STORAGE_KEY = 'dynasty-guide:sleeper-live:v1';
export const SLEEPER_REFRESH_EVENT = 'dynasty-guide:sleeper-refreshed';

export interface LiveSleeperSnapshot {
  team: Team;
  draft: Draft;
  /**
   * Patches merged onto the committed player pool: new stubs for just-drafted
   * names, plus updated `rosteredInLeague` flags. Never a full dump.
   */
  playerPatches: Player[];
  syncedAt: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadLiveSnapshot(): LiveSleeperSnapshot | null {
  const store = storage();
  if (!store) return null;

  const raw = store.getItem(LIVE_SYNC_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      store.removeItem(LIVE_SYNC_STORAGE_KEY);
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const team = TeamSchema.safeParse(obj.team);
    const draft = DraftSchema.safeParse(obj.draft);
    const playerPatches = PlayersSchema.safeParse(obj.playerPatches ?? []);
    if (!team.success || !draft.success || !playerPatches.success) {
      store.removeItem(LIVE_SYNC_STORAGE_KEY);
      return null;
    }
    if (typeof obj.syncedAt !== 'string') {
      store.removeItem(LIVE_SYNC_STORAGE_KEY);
      return null;
    }
    return {
      team: team.data,
      draft: draft.data,
      playerPatches: playerPatches.data,
      syncedAt: obj.syncedAt,
    };
  } catch {
    store.removeItem(LIVE_SYNC_STORAGE_KEY);
    return null;
  }
}

export function saveLiveSnapshot(snapshot: LiveSleeperSnapshot): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearLiveSnapshot(): void {
  storage()?.removeItem(LIVE_SYNC_STORAGE_KEY);
}

/** Merge live patches onto the committed player list (by id, then sleeperId). */
export function mergePlayerPatches(committed: Player[], patches: Player[]): Player[] {
  if (patches.length === 0) return committed;

  const byId = new Map(committed.map((p) => [p.id, { ...p }]));
  const bySleeper = new Map(
    committed.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p.id]),
  );

  for (const patch of patches) {
    const existingId =
      (patch.sleeperId ? bySleeper.get(patch.sleeperId) : undefined) ??
      (byId.has(patch.id) ? patch.id : undefined);

    if (existingId) {
      const prior = byId.get(existingId)!;
      byId.set(existingId, {
        ...prior,
        rosteredInLeague: patch.rosteredInLeague ?? prior.rosteredInLeague,
        status: patch.status ?? prior.status,
        injuryStatus: patch.injuryStatus ?? prior.injuryStatus,
        sleeperId: prior.sleeperId ?? patch.sleeperId,
      });
    } else {
      byId.set(patch.id, patch);
      if (patch.sleeperId) bySleeper.set(patch.sleeperId, patch.id);
    }
  }

  return [...byId.values()];
}

export function dispatchSleeperRefreshed(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SLEEPER_REFRESH_EVENT));
}

/** Re-export for callers that only need the empty draft sentinel nearby. */
export { NO_DRAFT };
