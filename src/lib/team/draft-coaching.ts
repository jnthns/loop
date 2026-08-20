/**
 * Draft-aware coaching for the roster health panel.
 *
 * During an active startup, weaknesses are not abstract — they are the next
 * decision. This module turns positional grades plus remaining pick numbers into
 * a concrete "what to take next" read without inventing rankings beyond the
 * manager's own targets and stored tiers.
 */

import type { Draft } from '~/lib/schemas/draft';
import type { Player, Position } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';
import { formatPickNumber } from '~/lib/picks/pick-math';
import { getDraftProgress, getTargetAvailability } from '~/lib/team/availability';
import type { HealthFacet, HealthFacetId, RosterHealth } from '~/lib/team/health';

const POSITION_FACETS: ReadonlySet<HealthFacetId> = new Set(['qb', 'rb', 'wr', 'te']);

const FACET_TO_POS: Partial<Record<HealthFacetId, Position>> = {
  qb: 'QB',
  rb: 'RB',
  wr: 'WR',
  te: 'TE',
};

export interface DraftPickSuggestion {
  playerId: string;
  playerName: string;
  pos: Position;
  slotLabel: string;
  rationale: string;
  priority: number;
}

export interface PositionDraftPriority {
  pos: Position;
  facetId: HealthFacetId;
  reason: string;
}

export interface DraftCoaching {
  active: boolean;
  myPicksMade: number;
  myPicksTotal: number;
  myPicksRemaining: number;
  nextPickNumber: number | null;
  picksUntilNext: number | null;
  /** One-line read for the next decision. */
  headline: string;
  positionPriority: PositionDraftPriority[];
  suggestions: DraftPickSuggestion[];
}

export function isDraftInProgress(draft?: Draft): boolean {
  return draft?.status === 'drafting' || draft?.status === 'paused';
}

/** Include my completed draft picks when roster slots are still empty mid-startup. */
export function rosteredPlayersIncludingDraft(
  team: Team,
  byId: Map<string, Player>,
  draft?: Draft,
): Player[] {
  const out: Player[] = [];
  const seen = new Set<string>();

  for (const entry of team.roster) {
    if (!entry.playerId || seen.has(entry.playerId)) continue;
    const player = byId.get(entry.playerId);
    if (!player) continue;
    seen.add(entry.playerId);
    out.push(player);
  }

  if (isDraftInProgress(draft)) {
    for (const pick of draft!.picks) {
      if (!pick.mine || !pick.playerId || seen.has(pick.playerId)) continue;
      const player = byId.get(pick.playerId);
      if (!player) continue;
      seen.add(pick.playerId);
      out.push(player);
    }
  }

  return out;
}

function buildPositionPriority(health: RosterHealth): PositionDraftPriority[] {
  const positional = health.priorities.filter((f) => POSITION_FACETS.has(f.id));
  const weakFirst = [...positional].sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));

  return weakFirst
    .map((facet) => {
      const pos = FACET_TO_POS[facet.id];
      if (!pos) return null;
      return {
        pos,
        facetId: facet.id,
        reason: facet.attention ?? facet.summary,
      };
    })
    .filter((row): row is PositionDraftPriority => row !== null);
}

function buildSuggestions(
  team: Team,
  players: Player[],
  draft: Draft,
  priority: PositionDraftPriority[],
): DraftPickSuggestion[] {
  if (priority.length === 0) return [];

  const byId = new Map(players.map((p) => [p.id, p]));
  const slotById = new Map(team.format.rosterSlots.map((s) => [s.id, s]));
  const wanted = new Set(priority.map((p) => p.pos));

  return [...team.targets]
    .sort((a, b) => a.priority - b.priority)
    .flatMap((target) => {
      const player = byId.get(target.playerId);
      if (!player || !wanted.has(player.pos)) return [];

      const avail = getTargetAvailability(target.playerId, player, team, draft);
      if (!avail.isAvailable) return [];

      const slotLabel = slotById.get(target.slotId)?.label ?? target.slotId;
      return [
        {
          playerId: target.playerId,
          playerName: player.name,
          pos: player.pos,
          slotLabel,
          rationale: target.rationale,
          priority: target.priority,
        },
      ];
    })
    .slice(0, 6);
}

function buildHeadline(
  draft: Draft,
  progress: ReturnType<typeof getDraftProgress>,
  priority: PositionDraftPriority[],
  suggestions: DraftPickSuggestion[],
  myPicksTotal: number,
): string {
  const { nextPickNumber, picksAhead, myPicksMade } = progress;
  const remaining = myPicksTotal - myPicksMade;

  if (nextPickNumber === null || remaining <= 0) {
    return 'Draft complete — shift from pick strategy to roster construction.';
  }

  const pickLabel = formatPickNumber(nextPickNumber, draft);
  const turn =
    picksAhead === 0
      ? 'You are on the clock.'
      : picksAhead === 1
        ? 'One pick until you are on the clock.'
        : picksAhead !== null
          ? `${picksAhead} picks until your turn.`
          : 'Your next pick is coming up.';

  const need =
    priority.length > 0
      ? `Prioritize ${priority
          .slice(0, 3)
          .map((p) => p.pos)
          .join(', then ')}.`
      : 'Positional rooms look fine — take best player available.';

  const names =
    suggestions.length > 0
      ? ` On the board from your list: ${suggestions
          .slice(0, 3)
          .map((s) => s.playerName)
          .join(', ')}.`
      : '';

  const runway =
    remaining > 1
      ? ` You still have ${remaining} picks left after this one — do not panic-reach.`
      : ' This is your final pick — fill the biggest starter hole.';

  return `Pick ${pickLabel} is next. ${turn} ${need}${names}${runway}`;
}

export function buildDraftCoaching(
  team: Team,
  players: Player[],
  draft: Draft | undefined,
  health: RosterHealth,
): DraftCoaching | null {
  if (!draft || !isDraftInProgress(draft)) return null;

  const progress = getDraftProgress(draft);
  const myPicksTotal = draft.myPicks.length;
  const myPicksRemaining = myPicksTotal - progress.myPicksMade;

  if (myPicksRemaining <= 0 && progress.nextPickNumber === null) {
    return {
      active: false,
      myPicksMade: progress.myPicksMade,
      myPicksTotal,
      myPicksRemaining: 0,
      nextPickNumber: null,
      picksUntilNext: null,
      headline: 'All of your picks are in — grade the finished roster, not the board.',
      positionPriority: [],
      suggestions: [],
    };
  }

  const positionPriority = buildPositionPriority(health);
  const suggestions = buildSuggestions(team, players, draft, positionPriority);

  return {
    active: true,
    myPicksMade: progress.myPicksMade,
    myPicksTotal,
    myPicksRemaining,
    nextPickNumber: progress.nextPickNumber,
    picksUntilNext: progress.picksAhead,
    headline: buildHeadline(draft, progress, positionPriority, suggestions, myPicksTotal),
    positionPriority,
    suggestions,
  };
}

/** Append draft-turn context to positional weakness callouts. */
export function enrichFacetForDraft(facet: HealthFacet, coaching: DraftCoaching | null): HealthFacet {
  if (!coaching?.active || !POSITION_FACETS.has(facet.id) || facet.grade === 'strong') {
    return facet;
  }

  const pos = FACET_TO_POS[facet.id];
  if (!pos) return facet;

  const rank = coaching.positionPriority.findIndex((p) => p.pos === pos);
  if (rank === -1) return facet;

  let draftLine: string;
  if (rank === 0 && coaching.nextPickNumber !== null) {
    draftLine = `Draft read: this is your top need before pick #${coaching.nextPickNumber}.`;
  } else if (rank <= 2) {
    draftLine = `Draft read: stack ${pos} on your next turn if the board allows — you still have ${coaching.myPicksRemaining} pick${coaching.myPicksRemaining === 1 ? '' : 's'} left.`;
  } else {
    draftLine = `Draft read: address higher-priority holes first; ${pos} can wait with ${coaching.myPicksRemaining} picks remaining.`;
  }

  const attention = facet.attention ? `${facet.attention} ${draftLine}` : draftLine;

  return { ...facet, attention };
}

export function applyDraftCoachingToHealth(
  health: RosterHealth,
  coaching: DraftCoaching | null,
): RosterHealth {
  if (!coaching) return { ...health, draftCoaching: null };

  const facets = health.facets.map((f) => enrichFacetForDraft(f, coaching));
  const priorities = health.priorities.map((f) => enrichFacetForDraft(f, coaching));

  return { ...health, facets, priorities, draftCoaching: coaching };
}
