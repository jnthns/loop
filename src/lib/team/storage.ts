import { TeamSchema, type Team } from '~/lib/schemas/team';

/**
 * The localStorage overlay.
 *
 * `data/team.json` is the committed baseline the loop reads; edits made in the
 * browser live here until you export them back. Anything stored that no longer
 * matches the schema — because the committed shape moved on — is discarded
 * rather than merged, so a stale overlay can never corrupt the page.
 */

export const STORAGE_KEY = 'dynasty-guide:team:v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Private-mode browsers throw on access rather than returning null.
    return null;
  }
}

export function loadOverlay(): Team | null {
  const store = storage();
  if (!store) return null;

  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = TeamSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    store.removeItem(STORAGE_KEY);
    return null;
  } catch {
    store.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveOverlay(team: Team): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(team));
    return true;
  } catch {
    return false;
  }
}

export function clearOverlay(): void {
  storage()?.removeItem(STORAGE_KEY);
}

/** The committed baseline, or the overlay when one is present and still valid. */
export function resolveTeam(committed: Team): Team {
  return loadOverlay() ?? committed;
}

/** Exactly what belongs in data/team.json — trailing newline included. */
export function serializeTeam(team: Team): string {
  return `${JSON.stringify(team, null, 2)}\n`;
}

export function hasOverlay(): boolean {
  return loadOverlay() !== null;
}
