import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickNumbersForSlot, toDraft, teamNameFor } from '~/lib/sleeper/map';
import {
  formatPickNumber,
  inferReversalRound,
  roundIsReversed,
} from '~/lib/picks/pick-math';
import {
  SleeperDraftPickSchema,
  SleeperDraftSchema,
  SleeperLeagueUserSchema,
} from '~/lib/schemas/sleeper';
import { DraftSchema, NO_DRAFT, draftSummary, isPreDraft } from '~/lib/schemas/draft';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/sleeper', name), 'utf8'));

const rawDraft = SleeperDraftSchema.parse(fixture('draft.json'));
const rawPicks = SleeperDraftPickSchema.array().parse(fixture('draft-picks.json'));

describe('pickNumbersForSlot — snake', () => {
  it('reverses every other round', () => {
    // Slot 7 of 12: round 1 is pick 7, round 2 reverses to position 6 → pick 18.
    expect(pickNumbersForSlot(7, 12, 5, 'snake')).toEqual([7, 18, 31, 42, 55]);
  });

  it('handles the turn — first slot picks last in even rounds', () => {
    expect(pickNumbersForSlot(1, 12, 4, 'snake')).toEqual([1, 24, 25, 48]);
  });

  it('handles the other end of the turn', () => {
    expect(pickNumbersForSlot(12, 12, 4, 'snake')).toEqual([12, 13, 36, 37]);
  });

  it('gives one pick per round', () => {
    expect(pickNumbersForSlot(5, 12, 26, 'snake')).toHaveLength(26);
  });

  it('never repeats a pick number across the draft', () => {
    const all = Array.from({ length: 12 }, (_, i) => pickNumbersForSlot(i + 1, 12, 3, 'snake'));
    const flat = all.flat();
    expect(new Set(flat).size).toBe(flat.length);
    // And together they cover every pick in the draft.
    expect(flat.sort((a, b) => a - b)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
  });
});

describe('pickNumbersForSlot — other formats', () => {
  it('does not reverse a linear draft', () => {
    expect(pickNumbersForSlot(7, 12, 3, 'linear')).toEqual([7, 19, 31]);
  });

  it('returns nothing for an auction — there are no pick numbers', () => {
    expect(pickNumbersForSlot(7, 12, 3, 'auction')).toEqual([]);
  });

  it('rejects a slot outside the league', () => {
    expect(pickNumbersForSlot(0, 12, 3, 'snake')).toEqual([]);
    expect(pickNumbersForSlot(13, 12, 3, 'snake')).toEqual([]);
  });
});

describe('toDraft', () => {
  const draft = toDraft({ draft: rawDraft, picks: rawPicks, userId: 'u1', rosterId: 1 });

  it('produces a schema-valid draft', () => {
    const parsed = DraftSchema.safeParse(draft);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('reads status, type, and size', () => {
    expect(draft.status).toBe('pre_draft');
    expect(draft.type).toBe('snake');
    expect(draft.teams).toBe(12);
    expect(draft.rounds).toBe(26);
  });

  it('converts the epoch start time to ISO', () => {
    expect(draft.startTime).toBe(new Date(1788292800000).toISOString());
  });

  it('finds this manager’s slot from draft_order', () => {
    expect(draft.myDraftSlot).toBe(7);
  });

  it('computes this manager’s pick numbers', () => {
    expect(draft.myPicks.slice(0, 4)).toEqual([7, 18, 31, 42]);
    expect(draft.myPicks).toHaveLength(26);
  });

  it('falls back to slot_to_roster_id when draft_order has no entry', () => {
    const noOrder = toDraft({
      draft: { ...rawDraft, draft_order: null },
      picks: [],
      userId: 'unknown-user',
      rosterId: 2,
    });
    expect(noOrder.myDraftSlot).toBe(3);
  });

  it('reports no slot rather than guessing when neither source knows', () => {
    const unknown = toDraft({
      draft: { ...rawDraft, draft_order: null, slot_to_roster_id: null },
      picks: [],
      userId: 'nobody',
      rosterId: 99,
    });
    expect(unknown.myDraftSlot).toBeNull();
    expect(unknown.myPicks).toEqual([]);
  });

  it('maps picks in order and marks which are mine', () => {
    expect(draft.picks.map((p) => p.pick)).toEqual([1, 7, 18]);
    expect(draft.picks.filter((p) => p.mine).map((p) => p.pick)).toEqual([7, 18]);
  });

  it('reads player names and uppercases teams from pick metadata', () => {
    expect(draft.picks[1]).toMatchObject({
      playerName: 'Bijan Robinson',
      pos: 'RB',
      nflTeam: 'ATL',
    });
  });

  it('resolves picked players to our slugs when a mapping is supplied', () => {
    const withIds = toDraft({
      draft: rawDraft,
      picks: rawPicks,
      userId: 'u1',
      rosterId: 1,
      sleeperIdToPlayerId: new Map([['8138', 'bijan-robinson']]),
    });
    expect(withIds.picks.find((p) => p.pick === 7)!.playerId).toBe('bijan-robinson');
    // Unmapped players stay null rather than inventing an id.
    expect(withIds.picks.find((p) => p.pick === 1)!.playerId).toBeNull();
  });

  it('maps an unknown Sleeper status to none rather than trusting it', () => {
    const weird = toDraft({
      draft: { ...rawDraft, status: 'some_new_status' },
      picks: [],
      userId: 'u1',
      rosterId: 1,
    });
    expect(weird.status).toBe('none');
  });
});

describe('draft helpers', () => {
  it('treats a missing or unstarted draft as pre-draft', () => {
    expect(isPreDraft(NO_DRAFT)).toBe(true);
    expect(isPreDraft({ ...NO_DRAFT, status: 'pre_draft' })).toBe(true);
  });

  it('does not treat a finished draft as pre-draft', () => {
    expect(isPreDraft({ ...NO_DRAFT, status: 'complete' })).toBe(false);
    expect(isPreDraft({ ...NO_DRAFT, status: 'drafting' })).toBe(false);
  });

  it('summarizes each state in a sentence', () => {
    expect(draftSummary(NO_DRAFT)).toMatch(/No draft scheduled/);
    expect(draftSummary({ ...NO_DRAFT, status: 'pre_draft' })).toMatch(/not yet scheduled/);
    expect(
      draftSummary({ ...NO_DRAFT, status: 'pre_draft', startTime: '2026-08-15T00:00:00.000Z' }),
    ).toMatch(/scheduled for/);
    expect(draftSummary({ ...NO_DRAFT, status: 'complete' })).toBe('Draft complete.');
  });
});

describe('teamNameFor', () => {
  const users = SleeperLeagueUserSchema.array().parse([
    { user_id: 'u1', display_name: 'comebackedOnYou', metadata: { team_name: 'DyNasty Warriors' } },
    { user_id: 'u2', display_name: 'someone-else', metadata: null },
  ]);

  it('prefers the explicit team name', () => {
    expect(teamNameFor(users, 'u1')).toBe('DyNasty Warriors');
  });

  it('falls back to the display name when no team name is set', () => {
    expect(teamNameFor(users, 'u2')).toBe('someone-else');
  });

  it('returns null for an unknown user rather than a wrong name', () => {
    expect(teamNameFor(users, 'nobody')).toBeNull();
  });

  it('ignores a blank team name', () => {
    const blank = SleeperLeagueUserSchema.array().parse([
      { user_id: 'u3', display_name: 'fallback', metadata: { team_name: '   ' } },
    ]);
    expect(teamNameFor(blank, 'u3')).toBe('fallback');
  });
});

describe('reversal rounds — the league this app actually tracks', () => {
  /** Slots for one full round, in the order they pick. */
  const roundSlots = (round: number, teams: number, reversed: boolean) =>
    Array.from({ length: teams }, (_, i) => ({
      pick: (round - 1) * teams + i + 1,
      round,
      slot: reversed ? teams - i : i + 1,
    }));

  /** A draft with third-round reversal: rounds 1,4,6,8 forward; 2,3,5,7 reverse. */
  const thirdRoundReversal = (rounds: number, teams = 12) =>
    Array.from({ length: rounds }, (_, i) => i + 1).flatMap((round) =>
      roundSlots(round, teams, roundIsReversed(round, { type: 'snake', reversalRound: 3 })),
    );

  it('repeats the previous round’s direction in the reversal round', () => {
    expect(roundIsReversed(2, { type: 'snake', reversalRound: 3 })).toBe(true);
    expect(roundIsReversed(3, { type: 'snake', reversalRound: 3 })).toBe(true);
    expect(roundIsReversed(4, { type: 'snake', reversalRound: 3 })).toBe(false);
    expect(roundIsReversed(5, { type: 'snake', reversalRound: 3 })).toBe(true);
  });

  it('moves every pick from the reversal round on', () => {
    // Slot 4 of 12: identical for two rounds, then four picks earlier from R3.
    expect(pickNumbersForSlot(4, 12, 6, 'snake', 3)).toEqual([4, 21, 33, 40, 57, 64]);
    expect(pickNumbersForSlot(4, 12, 6, 'snake')).toEqual([4, 21, 28, 45, 52, 69]);
  });

  it('still covers every pick exactly once', () => {
    const flat = Array.from({ length: 12 }, (_, i) => pickNumbersForSlot(i + 1, 12, 4, 'snake', 3)).flat();
    expect(flat.sort((a, b) => a - b)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
  });

  it('infers the reversal round from the picks already made', () => {
    expect(inferReversalRound(thirdRoundReversal(8), 12)).toBe(3);
  });

  it('reads a plain snake as no reversal', () => {
    const plain = Array.from({ length: 8 }, (_, i) => i + 1).flatMap((round) =>
      roundSlots(round, 12, round % 2 === 0),
    );
    expect(inferReversalRound(plain, 12)).toBe(0);
  });

  it('guesses nothing from a draft too thin to read', () => {
    expect(inferReversalRound([{ pick: 1, round: 1, slot: 1 }], 12)).toBe(0);
    expect(inferReversalRound([], 12)).toBe(0);
  });

  it('labels a pick with the slot it truly lands on', () => {
    expect(formatPickNumber(33, { teams: 12, type: 'snake', reversalRound: 3 })).toBe('3.04 (#33)');
    expect(formatPickNumber(33, { teams: 12, type: 'snake' })).toBe('3.09 (#33)');
  });

  it('trusts the picks made over the draft settings', () => {
    const picks = thirdRoundReversal(4).map((p) => ({
      pick_no: p.pick,
      round: p.round,
      draft_slot: p.slot,
      roster_id: p.slot,
      player_id: null,
      metadata: null,
    }));
    const draft = toDraft({
      draft: {
        ...rawDraft,
        status: 'drafting',
        settings: { teams: 12, rounds: 30 },
        draft_order: { u1: 4 },
        slot_to_roster_id: { '4': 4 },
      },
      picks,
      userId: 'u1',
      rosterId: 4,
    });

    expect(draft.reversalRound).toBe(3);
    expect(draft.myPicks.slice(0, 6)).toEqual([4, 21, 33, 40, 57, 64]);
  });

  it('keeps a pick that was made out of slot under whoever used it', () => {
    // Roster 4 used pick 2 as well as its own slot-4 pick.
    const draft = toDraft({
      draft: {
        ...rawDraft,
        status: 'drafting',
        settings: { teams: 12, rounds: 3 },
        draft_order: { u1: 4 },
        slot_to_roster_id: { '4': 4 },
      },
      picks: [
        { pick_no: 1, round: 1, draft_slot: 1, roster_id: 1, player_id: null, metadata: null },
        { pick_no: 2, round: 1, draft_slot: 2, roster_id: 4, player_id: null, metadata: null },
        { pick_no: 3, round: 1, draft_slot: 3, roster_id: 3, player_id: null, metadata: null },
        { pick_no: 4, round: 1, draft_slot: 4, roster_id: 4, player_id: null, metadata: null },
      ],
      userId: 'u1',
      rosterId: 4,
    });

    expect(draft.myPicks.slice(0, 3)).toEqual([2, 4, 21]);
  });
});

describe('the committed draft snapshot', () => {
  const committed = DraftSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), 'data/draft.json'), 'utf8')),
  );

  it('agrees with the picks Sleeper has already recorded', () => {
    const observed = inferReversalRound(committed.picks, committed.teams);
    expect(committed.reversalRound).toBe(observed);
  });

  it('never claims a pick another roster already used', () => {
    const takenByOthers = new Set(
      committed.picks.filter((p) => !p.mine).map((p) => p.pick),
    );
    expect(committed.myPicks.filter((n) => takenByOthers.has(n))).toEqual([]);
  });

  it('claims every pick this manager has actually made', () => {
    const mine = committed.picks.filter((p) => p.mine).map((p) => p.pick);
    expect(mine.every((n) => committed.myPicks.includes(n))).toBe(true);
  });
});
