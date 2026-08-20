import type { Draft, DraftPick } from '~/lib/schemas/draft';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';

export type TargetAvailabilityStatus = 'available' | 'drafted_by_me' | 'taken';

export interface TargetAvailability {
  status: TargetAvailabilityStatus;
  label: string;
  pick?: DraftPick;
  slotLabel?: string;
  isAvailable: boolean;
  isDraftedByMe: boolean;
  isTaken: boolean;
}

/**
 * Determine whether a target player has been drafted by you, drafted by another
 * team, or is still available on the draft board.
 */
export function getTargetAvailability(
  targetPlayerId: string,
  targetPlayer: Player | undefined,
  team: Team,
  draft?: Draft,
): TargetAvailability {
  // 1. Check if the player is currently assigned on your roster
  const rosterSlot = team.roster.find((r) => r.playerId === targetPlayerId);
  if (rosterSlot) {
    const slotDef = team.format.rosterSlots.find((s) => s.id === rosterSlot.slotId);
    return {
      status: 'drafted_by_me',
      label: 'Drafted by you',
      slotLabel: slotDef?.label ?? rosterSlot.slotId,
      isAvailable: false,
      isDraftedByMe: true,
      isTaken: false,
    };
  }

  // 2. Check draft picks from data/draft.json
  if (draft?.picks && draft.picks.length > 0) {
    const targetNameLower = targetPlayer?.name.toLowerCase();

    // Check if drafted by me
    const myPick = draft.picks.find(
      (p) =>
        p.mine &&
        (p.playerId === targetPlayerId || (targetNameLower && p.playerName.toLowerCase() === targetNameLower)),
    );
    if (myPick) {
      const pickStr = `${myPick.round}.${String(myPick.slot).padStart(2, '0')}`;
      return {
        status: 'drafted_by_me',
        label: `Drafted by you (Pick ${pickStr})`,
        pick: myPick,
        isAvailable: false,
        isDraftedByMe: true,
        isTaken: false,
      };
    }

    // Check if drafted by someone else
    const otherPick = draft.picks.find(
      (p) =>
        !p.mine &&
        (p.playerId === targetPlayerId || (targetNameLower && p.playerName.toLowerCase() === targetNameLower)),
    );
    if (otherPick) {
      const pickStr = `${otherPick.round}.${String(otherPick.slot).padStart(2, '0')}`;
      return {
        status: 'taken',
        label: `Taken (Pick ${pickStr})`,
        pick: otherPick,
        isAvailable: false,
        isDraftedByMe: false,
        isTaken: true,
      };
    }
  }

  // 3. Check if rostered in league by someone else
  if (targetPlayer?.rosteredInLeague) {
    return {
      status: 'taken',
      label: 'Rostered by another team',
      isAvailable: false,
      isDraftedByMe: false,
      isTaken: true,
    };
  }

  // 4. Still available
  return {
    status: 'available',
    label: 'Available',
    isAvailable: true,
    isDraftedByMe: false,
    isTaken: false,
  };
}

/**
 * Filter all draft picks made by the user.
 */
export function getMyDraftedPicks(draft?: Draft): DraftPick[] {
  if (!draft?.picks) return [];
  return draft.picks.filter((p) => p.mine);
}

export interface DraftProgress {
  totalPicksMade: number;
  myPicksMade: number;
  nextPickNumber: number | null;
  picksUntilNextTurn: number | null;
  /**
   * Picks other managers make before this manager is up — `picksUntilNextTurn`
   * minus the manager's own pick. 0 means on the clock. This is the number a
   * human means by "how long until my turn"; `picksUntilNextTurn` counts the
   * manager's own pick too and is kept for callers that already read it.
   */
  picksAhead: number | null;
  /** Every pick this manager still owns, ascending. Empty when the draft is done. */
  upcomingPicks: number[];
}

/**
 * Compute key draft stats: total picks made, manager's picks, and next upcoming turn.
 */
export function getDraftProgress(draft?: Draft): DraftProgress {
  const picks = draft?.picks ?? [];
  const totalPicksMade = picks.length;
  const myPicks = picks.filter((p) => p.mine);
  const myPicksMade = myPicks.length;

  const completedNumbers = new Set(picks.map((p) => p.pick));
  const upcomingPicks = (draft?.myPicks ?? []).filter((n) => !completedNumbers.has(n));
  const nextPickNumber = upcomingPicks.length > 0 ? upcomingPicks[0] : null;
  const picksUntilNextTurn = nextPickNumber !== null ? nextPickNumber - totalPicksMade : null;

  return {
    totalPicksMade,
    myPicksMade,
    nextPickNumber,
    picksUntilNextTurn,
    picksAhead: picksUntilNextTurn === null ? null : Math.max(0, picksUntilNextTurn - 1),
    upcomingPicks,
  };
}
