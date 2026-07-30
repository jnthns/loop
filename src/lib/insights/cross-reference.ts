import type { NewsItem } from '~/lib/schemas/news';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';
import { FACETS, type FacetId } from '~/lib/knowledge/facets';
import { daysSince } from '~/lib/time';

/**
 * Roster x news x knowledge.
 *
 * The dashboard's whole job is answering "does any of this actually concern
 * me?", which is a set-intersection problem, not a rendering one — so it lives
 * here, pure and tested, rather than inside a component.
 */

export type Relation = 'rostered' | 'target';

export interface Alert {
  item: NewsItem;
  /** Players from this manager's orbit that the item mentions. */
  matches: { player: Player; relation: Relation }[];
  /** 'rostered' outranks 'target' — news about a player you own matters more. */
  relation: Relation;
}

export interface WatchLists {
  rostered: Set<string>;
  targeted: Set<string>;
}

export function watchLists(team: Team): WatchLists {
  const rostered = new Set(
    team.roster.map((r) => r.playerId).filter((id): id is string => Boolean(id)),
  );
  // A player you already own is not also a target, whatever the target list says.
  const targeted = new Set(team.targets.map((t) => t.playerId).filter((id) => !rostered.has(id)));
  return { rostered, targeted };
}

export interface AlertOptions {
  limit?: number;
  /** Ignore anything older than this. Stale news is not an alert. */
  maxAgeDays?: number;
  now?: Date;
}

/**
 * News items that mention a player this manager owns or is chasing, newest
 * first, with owned players ranked ahead of targets at equal recency.
 */
export function rosterAlerts(
  news: NewsItem[],
  team: Team,
  players: Player[],
  options: AlertOptions = {},
): Alert[] {
  const { limit = 8, maxAgeDays = 30, now = new Date() } = options;
  const { rostered, targeted } = watchLists(team);
  const byId = new Map(players.map((p) => [p.id, p]));

  const alerts: Alert[] = [];

  for (const item of news) {
    if (daysSince(item.publishedAt, now) > maxAgeDays) continue;

    const matches = item.players
      .map((id) => {
        const player = byId.get(id);
        if (!player) return null;
        if (rostered.has(id)) return { player, relation: 'rostered' as const };
        if (targeted.has(id)) return { player, relation: 'target' as const };
        return null;
      })
      .filter((m): m is { player: Player; relation: Relation } => m !== null);

    if (matches.length === 0) continue;

    alerts.push({
      item,
      matches,
      relation: matches.some((m) => m.relation === 'rostered') ? 'rostered' : 'target',
    });
  }

  return alerts
    .sort((a, b) => {
      if (a.relation !== b.relation) return a.relation === 'rostered' ? -1 : 1;
      return b.item.publishedAt.localeCompare(a.item.publishedAt);
    })
    .slice(0, limit);
}

export interface FacetCoverage {
  id: FacetId;
  title: string;
  count: number;
  /** Days since the newest article in this facet; Infinity when empty. */
  ageDays: number;
  reason: 'empty' | 'stale' | 'covered';
}

export interface CoverageInput {
  facet: string;
  updated: Date | string;
}

/**
 * Which facets the curator loop should visit next: empty ones first, then the
 * stalest. This is the app telling the loop where its own gaps are.
 */
export function facetCoverage(
  articles: CoverageInput[],
  options: { staleAfterDays?: number; now?: Date } = {},
): FacetCoverage[] {
  const { staleAfterDays = 90, now = new Date() } = options;

  return FACETS.map((facet) => {
    const mine = articles.filter((a) => a.facet === facet.id);
    const ageDays = mine.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(...mine.map((a) => daysSince(a.updated, now)));

    const reason: FacetCoverage['reason'] =
      mine.length === 0 ? 'empty' : ageDays > staleAfterDays ? 'stale' : 'covered';

    return { id: facet.id, title: facet.title, count: mine.length, ageDays, reason };
  }).sort((a, b) => {
    const rank = (c: FacetCoverage) => (c.reason === 'empty' ? 0 : c.reason === 'stale' ? 1 : 2);
    return rank(a) - rank(b) || b.ageDays - a.ageDays;
  });
}

/** Facets that need attention — what the dashboard nudges about. */
export function coverageGaps(coverage: FacetCoverage[]): FacetCoverage[] {
  return coverage.filter((c) => c.reason !== 'covered');
}

/** Slots with no player assigned — the roster's own to-do list. */
export function openSlots(team: Team): { slotId: string; label: string }[] {
  const labels = new Map(team.format.rosterSlots.map((s) => [s.id, s.label]));
  return team.roster
    .filter((r) => r.playerId === null)
    .map((r) => ({ slotId: r.slotId, label: labels.get(r.slotId) ?? r.slotId }));
}
