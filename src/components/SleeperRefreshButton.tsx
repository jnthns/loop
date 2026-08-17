import { useCallback, useEffect, useState } from 'react';
import type { Player } from '~/lib/schemas/players';
import type { SleeperConfig } from '~/lib/schemas/sleeper';
import type { Team } from '~/lib/schemas/team';
import {
  fetchLiveSleeperRefresh,
  type LiveRefreshResult,
} from '~/lib/sleeper/live-refresh';
import {
  SLEEPER_REFRESH_EVENT,
  clearLiveSnapshot,
  dispatchSleeperRefreshed,
  loadLiveSnapshot,
  saveLiveSnapshot,
} from '~/lib/team/live-storage';
import { clearOverlay, saveOverlay as saveTeamOverlay } from '~/lib/team/storage';

export interface SleeperRefreshButtonProps {
  config: SleeperConfig;
  team: Team;
  players: Player[];
  /** Injectable for tests — defaults to the real Sleeper fetch. */
  refreshFn?: (input: {
    config: SleeperConfig;
    team: Team;
    players: Player[];
  }) => Promise<LiveRefreshResult>;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; syncedAt: string; pickCount: number; filledSlots: number }
  | { kind: 'error'; message: string };

function formatSyncedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/**
 * Sidebar control: pull live roster + draft status from Sleeper into this
 * browser. Cannot rewrite committed `data/*.json` on GitHub Pages — results
 * land in localStorage and TeamApp listens for the refresh event.
 *
 * Compact on the mobile top bar; fuller card in the lg left rail.
 */
export function SleeperRefreshButton({
  config,
  team,
  players,
  refreshFn = fetchLiveSleeperRefresh,
}: SleeperRefreshButtonProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const configured = Boolean(config.leagueId && config.userId);

  useEffect(() => {
    function syncFromStorage() {
      const existing = loadLiveSnapshot();
      if (existing) {
        setStatus({
          kind: 'ok',
          syncedAt: existing.syncedAt,
          pickCount: existing.draft.picks.length,
          filledSlots: existing.team.roster.filter((r) => r.playerId).length,
        });
      } else {
        setStatus({ kind: 'idle' });
      }
    }
    syncFromStorage();
    window.addEventListener(SLEEPER_REFRESH_EVENT, syncFromStorage);
    return () => window.removeEventListener(SLEEPER_REFRESH_EVENT, syncFromStorage);
  }, []);

  const refresh = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const result = await refreshFn({ config, team, players });
      const snapshot = {
        team: result.team,
        draft: result.draft,
        playerPatches: result.playerPatches,
        syncedAt: result.syncedAt,
      };
      if (!saveLiveSnapshot(snapshot)) {
        throw new Error('Could not save the live snapshot in this browser.');
      }
      // Mirror onto the team edit overlay so export still works from /team.
      saveTeamOverlay(result.team);
      dispatchSleeperRefreshed();
      setStatus({
        kind: 'ok',
        syncedAt: result.syncedAt,
        pickCount: result.draft.picks.length,
        filledSlots: result.team.roster.filter((r) => r.playerId).length,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Sleeper refresh failed',
      });
    }
  }, [config, team, players, refreshFn]);

  function discard() {
    clearLiveSnapshot();
    clearOverlay();
    setStatus({ kind: 'idle' });
    dispatchSleeperRefreshed();
  }

  return (
    <div data-testid="sleeper-refresh" data-tone="blue" className="min-w-0 lg:w-full">
      {/* Compact control for the mobile top bar */}
      <button
        type="button"
        data-testid="sleeper-refresh-button"
        onClick={() => void refresh()}
        disabled={!configured || status.kind === 'loading'}
        aria-label="Refresh roster from Sleeper"
        title={
          !configured
            ? 'Run npm run sync:sleeper once to lock league id'
            : 'Pull live roster and draft status from Sleeper'
        }
        className="rounded-[0.5rem] border border-line bg-surface-alt px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 lg:hidden"
      >
        {status.kind === 'loading' ? '…' : 'Sleeper'}
      </button>

      {/* Full card in the left rail */}
      <div className="hidden rounded-[0.5rem] border border-tone-line bg-tone-soft/40 p-2.5 lg:block">
        <p className="label mb-1.5 text-tone">Sleeper roster</p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={!configured || status.kind === 'loading'}
          className="w-full rounded-[0.375rem] border border-tone-line bg-surface px-2.5 py-1.5 text-xs font-bold text-tone transition-colors hover:bg-tone-soft disabled:opacity-40"
        >
          {status.kind === 'loading' ? 'Refreshing…' : 'Refresh from Sleeper'}
        </button>
        {!configured && (
          <p className="mt-1.5 text-[10px] leading-snug text-muted">
            Run <code className="font-mono">npm run sync:sleeper</code> once to lock league id.
          </p>
        )}
        {status.kind === 'ok' && (
          <p
            className="mt-1.5 text-[10px] leading-snug text-muted"
            data-testid="sleeper-refresh-status"
          >
            Live · {formatSyncedAt(status.syncedAt)} · {status.filledSlots} rostered ·{' '}
            {status.pickCount} pick{status.pickCount === 1 ? '' : 's'}
            <button
              type="button"
              onClick={discard}
              className="ml-1 font-semibold text-tone underline-offset-2 hover:underline"
            >
              Discard
            </button>
          </p>
        )}
        {status.kind === 'error' && (
          <p
            className="mt-1.5 text-[10px] leading-snug text-warn"
            data-testid="sleeper-refresh-error"
            role="alert"
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default SleeperRefreshButton;
