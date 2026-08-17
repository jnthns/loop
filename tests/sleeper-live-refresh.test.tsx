import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  applyLiveSnapshot,
  playerFromDraftPick,
  resolvePlayersForLiveRefresh,
} from '~/lib/sleeper/live-refresh';
import {
  SleeperDraftPickSchema,
  SleeperDraftSchema,
  SleeperLeagueSchema,
  SleeperRosterSchema,
} from '~/lib/schemas/sleeper';
import {
  LIVE_SYNC_STORAGE_KEY,
  clearLiveSnapshot,
  loadLiveSnapshot,
  mergePlayerPatches,
  saveLiveSnapshot,
} from '~/lib/team/live-storage';
import { STORAGE_KEY } from '~/lib/team/storage';
import { SleeperRefreshButton } from '~/components/SleeperRefreshButton';
import { fixturePlayers, fixtureTeam } from './fixtures/league';
import type { Player } from '~/lib/schemas/players';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/sleeper', name), 'utf8'));

const league = SleeperLeagueSchema.parse(fixture('league.json'));
const rosters = SleeperRosterSchema.array().parse(fixture('rosters.json'));
const myRoster = rosters[0];
const rawDraft = SleeperDraftSchema.parse(fixture('draft.json'));
const rawDraftPicks = SleeperDraftPickSchema.array().parse(fixture('draft-picks.json'));

afterEach(() => {
  localStorage.clear();
});

describe('playerFromDraftPick', () => {
  it('builds a schema-valid stub from pick metadata', () => {
    const stub = playerFromDraftPick(rawDraftPicks[0]);
    expect(stub).toMatchObject({
      id: 'ja-marr-chase',
      name: "Ja'Marr Chase",
      pos: 'WR',
      sleeperId: '6794',
      rosteredInLeague: true,
      age: 25,
    });
  });

  it('returns null without a usable position', () => {
    expect(
      playerFromDraftPick({
        ...rawDraftPicks[0],
        metadata: { first_name: 'X', last_name: 'Y', position: 'LS' },
      }),
    ).toBeNull();
  });
});

describe('resolvePlayersForLiveRefresh', () => {
  it('adds stubs for draft picks missing from the committed pool', () => {
    const thin: Player[] = fixturePlayers.filter((p) => p.sleeperId !== '6794');
    const { patches, players } = resolvePlayersForLiveRefresh(thin, rosters, rawDraftPicks);
    expect(patches.some((p) => p.sleeperId === '6794')).toBe(true);
    expect(players.some((p) => p.sleeperId === '6794')).toBe(true);
  });

  it('flags committed players as rostered when they appear on a league roster', () => {
    const withFlag = fixturePlayers.map((p) =>
      p.sleeperId === '6813' ? { ...p, rosteredInLeague: false } : p,
    );
    const { patches } = resolvePlayersForLiveRefresh(withFlag, rosters, []);
    const jayden = patches.find((p) => p.sleeperId === '6813');
    expect(jayden?.rosteredInLeague).toBe(true);
  });
});

describe('applyLiveSnapshot', () => {
  it('fills the manager roster and draft picks from fixtures without a player dump', () => {
    const result = applyLiveSnapshot({
      team: fixtureTeam,
      players: fixturePlayers,
      league,
      roster: myRoster,
      allRosters: rosters,
      userId: 'u1',
      season: '2026',
      teamName: 'Fixture Team',
      rawDraft: { ...rawDraft, status: 'drafting' },
      rawDraftPicks,
    });

    expect(result.draft.status).toBe('drafting');
    expect(result.draft.picks.length).toBe(rawDraftPicks.length);
    expect(result.draft.picks.filter((p) => p.mine).length).toBeGreaterThan(0);
    expect(result.team.roster.some((r) => r.playerId !== null)).toBe(true);
    expect(result.team.targets.length).toBe(fixtureTeam.targets.length);
  });
});

describe('live-storage', () => {
  it('round-trips a snapshot and merges player patches by sleeper id', () => {
    const snap = applyLiveSnapshot({
      team: fixtureTeam,
      players: fixturePlayers,
      league,
      roster: myRoster,
      allRosters: rosters,
      userId: 'u1',
      season: '2026',
      rawDraft,
      rawDraftPicks,
    });
    expect(saveLiveSnapshot(snap)).toBe(true);
    expect(loadLiveSnapshot()?.syncedAt).toBe(snap.syncedAt);

    const merged = mergePlayerPatches(fixturePlayers, [
      { ...fixturePlayers[0], rosteredInLeague: true },
    ]);
    expect(merged.find((p) => p.id === fixturePlayers[0].id)?.rosteredInLeague).toBe(true);

    clearLiveSnapshot();
    expect(loadLiveSnapshot()).toBeNull();
    expect(localStorage.getItem(LIVE_SYNC_STORAGE_KEY)).toBeNull();
  });
});

describe('SleeperRefreshButton', () => {
  it('calls the live refresh and stores a snapshot', async () => {
    const user = userEvent.setup();
    const snap = applyLiveSnapshot({
      team: fixtureTeam,
      players: fixturePlayers,
      league,
      roster: myRoster,
      allRosters: rosters,
      userId: 'u1',
      season: '2026',
      rawDraft: { ...rawDraft, status: 'drafting' },
      rawDraftPicks,
    });

    render(
      <SleeperRefreshButton
        config={{
          username: 'fixture',
          userId: 'u1',
          leagueId: 'league-1',
          season: '2026',
          lastPlayerSync: null,
          lastSyncedAt: null,
          candidateLeagues: [],
        }}
        team={fixtureTeam}
        players={fixturePlayers}
        refreshFn={async () => snap}
      />,
    );

    await user.click(screen.getByTestId('sleeper-refresh-button'));

    await waitFor(() => {
      expect(screen.getByTestId('sleeper-refresh-status')).toBeInTheDocument();
    });
    expect(loadLiveSnapshot()?.draft.picks.length).toBe(rawDraftPicks.length);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('surfaces an error when the league is not configured', async () => {
    render(
      <SleeperRefreshButton
        config={{
          username: 'fixture',
          userId: null,
          leagueId: null,
          season: null,
          lastPlayerSync: null,
          lastSyncedAt: null,
          candidateLeagues: [],
        }}
        team={fixtureTeam}
        players={fixturePlayers}
      />,
    );

    expect(screen.getByTestId('sleeper-refresh-button')).toBeDisabled();
    expect(screen.getByText(/sync:sleeper/)).toBeInTheDocument();
  });
});
