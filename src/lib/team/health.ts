/**
 * 2026 dynasty roster audit.
 *
 * Scores the roster against the facets that reputable 2026 sources use to
 * grade a superflex team — positional rooms, age cliffs, youth-vs-floor,
 * injury, and bench insurance. Every threshold is taken from a cited source
 * in HEALTH_SOURCES; player quality comes only from our stored `tier` / `age`
 * / injury fields, never from invented rankings.
 *
 * Window bands (position-room total / 40) follow Roto Street Journal's 2026
 * preseason audit: 32–40 contend, 24–31 pick a direction, under 24 rebuild.
 */

import type { Draft } from '~/lib/schemas/draft';
import type { Player, Position, Tier } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';
import {
  applyDraftCoachingToHealth,
  buildDraftCoaching,
  rosteredPlayersIncludingDraft,
  type DraftCoaching,
} from '~/lib/team/draft-coaching';

export const HEALTH_SOURCES = [
  {
    id: 'rsj-2026',
    label: 'Roto Street Journal — roster equity and peak ages (Jul 2026)',
    url: 'https://www.rotostreetjournal.com/2026/07/18/dynasty-fantasy-football-strategy-using-roster-equity-and-peak-ages-to-build-monster-long-term-teams/',
  },
  {
    id: 'dlf-ffpc-2026',
    label: 'Dynasty League Football — FFPC roster construction by format (Jul 2026)',
    url: 'https://dynastyleaguefootball.com/2026/07/23/ffpc-roster-construction-in-different-dynasty-formats/',
  },
  {
    id: 'fantasypros-sf-mock-2026',
    label: 'FantasyPros — 2026 superflex dynasty startup mock',
    url: 'https://www.fantasypros.com/2026/03/fantasy-football-mock-draft-superflex-dynasty-startup/',
  },
  {
    id: 'playerprofiler-2026',
    label: 'PlayerProfiler — 2026 dynasty trade targets and RB age cliff',
    url: 'https://www.playerprofiler.com/article/dynasty-trade-targets-2026-buy-low-sell-high-before-kickoff/',
  },
  {
    id: 'dynasty-nerds-rebuild',
    label: 'Dynasty Nerds — rebuild windows and positional peak ages',
    url: 'https://www.dynastynerds.com/dynasty/ways-to-do-a-proper-rebuild-in-dynasty/',
  },
  {
    id: 'etr-2026-mock',
    label: 'Establish The Run — 2026 staff mock (YouTube)',
    url: 'https://www.youtube.com/watch?v=HyMR_7n32CA',
  },
  {
    id: 'dynasty-ballers-rb',
    label: 'Dynasty Ballers — team trajectories and RB depth (YouTube, May 2026)',
    url: 'https://www.youtube.com/watch?v=H2ks1LvpqnQ',
  },
  {
    id: 'smash-except-stier',
    label: 'Smash Except — S-tier superflex startup building blocks (YouTube)',
    url: 'https://www.youtube.com/watch?v=zE-pf0muavQ',
  },
  {
    id: 'knowledge-age-curves',
    label: 'This guide — age curves and positional value',
    url: '/knowledge/roster-construction/age-curves-and-positional-value',
  },
] as const;

export type HealthSourceId = (typeof HEALTH_SOURCES)[number]['id'];
export type HealthGrade = 'strong' | 'watch' | 'weak';
export type CompetitiveWindow = 'empty' | 'rebuild' | 'pivot' | 'contend';

export type HealthFacetId =
  | 'qb'
  | 'rb'
  | 'wr'
  | 'te'
  | 'age-stagger'
  | 'youth-floor'
  | 'availability'
  | 'depth';

export interface HealthFacet {
  id: HealthFacetId;
  title: string;
  score: number;
  grade: HealthGrade;
  summary: string;
  evidence: string[];
  attention: string | null;
  sourceIds: HealthSourceId[];
}

export interface RosterHealth {
  /** Sum of the four positional rooms, 0–40, matching the RSJ 2026 audit. */
  positionTotal: number;
  window: CompetitiveWindow;
  windowLabel: string;
  windowAdvice: string;
  facets: HealthFacet[];
  /** Weak first, then watch — the work list. */
  priorities: HealthFacet[];
  rosteredCount: number;
  /** Present during an active draft — next-pick coaching from weaknesses + targets. */
  draftCoaching: DraftCoaching | null;
}

const STARTABLE: ReadonlySet<Tier> = new Set(['cornerstone', 'starter', 'win-now']);
const ELITE: ReadonlySet<Tier> = new Set(['cornerstone']);
const INJURED = /^(out|ir|pup|doubtful|sus|injured reserve|non football injury)$/i;

function clamp(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function gradeFor(score: number): HealthGrade {
  if (score >= 8) return 'strong';
  if (score >= 5) return 'watch';
  return 'weak';
}

function rosteredPlayers(team: Team, byId: Map<string, Player>): Player[] {
  const out: Player[] = [];
  const seen = new Set<string>();
  for (const entry of team.roster) {
    if (!entry.playerId || seen.has(entry.playerId)) continue;
    const player = byId.get(entry.playerId);
    if (!player) continue;
    seen.add(entry.playerId);
    out.push(player);
  }
  return out;
}

function ofPos(players: Player[], pos: Position): Player[] {
  return players.filter((p) => p.pos === pos);
}

function startable(players: Player[]): Player[] {
  return players.filter((p) => STARTABLE.has(p.tier));
}

function elite(players: Player[]): Player[] {
  return players.filter((p) => ELITE.has(p.tier));
}

function names(players: Player[]): string {
  return players.map((p) => `${p.name} (${p.age})`).join(', ') || 'none';
}

function scoreQb(players: Player[], superflex: boolean): HealthFacet {
  const qbs = ofPos(players, 'QB');
  const able = startable(qbs);
  const studs = elite(qbs);
  const insurance = able.length;
  const aging = able.filter((p) => p.age >= 32);
  const dualThreatPeak = able.filter((p) => p.age >= 27 && p.age < 32);

  let score = 0;
  if (able.length === 0) score = qbs.length === 0 ? 0 : 1;
  else if (able.length === 1) score = superflex ? 3 : 6;
  else if (able.length === 2) score = studs.length >= 1 ? 7 : 5;
  else score = studs.length >= 1 ? 9 : 7;
  if (studs.length >= 2 && able.length >= 2) score = 10;
  if (superflex && able.length < 3 && score >= 7) score -= 1;
  if (aging.length === able.length && able.length > 0) score -= 2;

  score = clamp(score);
  const grade = gradeFor(score);
  const attention =
    grade === 'strong'
      ? null
      : superflex
        ? able.length < 2
          ? 'Superflex starts two quarterbacks most weeks — a one-QB roster is a structural hole, not a style.'
          : able.length < 3
            ? 'Add a third startable QB before the remaining quality starters are gone.'
            : 'The QB room is producing, but the age mix is a sell-or-hold decision this year.'
        : 'A second startable quarterback is cheap insurance even in 1QB.';

  return {
    id: 'qb',
    title: superflex ? 'Quarterback room (superflex)' : 'Quarterback room',
    score,
    grade,
    summary:
      able.length === 0
        ? 'No startable quarterback on the roster.'
        : `${able.length} startable QB${able.length === 1 ? '' : 's'}, ${studs.length} cornerstone.`,
    evidence: [
      `On roster: ${names(qbs)}`,
      `Startable (cornerstone / starter / win-now): ${able.length}${superflex ? ' — superflex wants two weekly plus a third' : ''}`,
      aging.length > 0
        ? `Age 32+: ${names(aging)} — Dynasty Nerds treats 32 as the rebuild-sell line at QB`
        : dualThreatPeak.length > 0
          ? `Age 27–31: ${names(dualThreatPeak)} — rushing-QB peak is ~26.1; pocket peak ~30.6`
          : 'No QB is at a published age cliff yet',
    ],
    attention,
    sourceIds: ['rsj-2026', 'dlf-ffpc-2026', 'fantasypros-sf-mock-2026', 'dynasty-nerds-rebuild'],
  };
}

function scoreRb(players: Player[]): HealthFacet {
  const rbs = ofPos(players, 'RB');
  const able = startable(rbs);
  const young = able.filter((p) => p.age <= 26);
  const cliff = able.filter((p) => p.age >= 27);

  let score = 0;
  if (able.length === 0) score = rbs.length === 0 ? 0 : 2;
  else if (young.length >= 2) score = cliff.length === 0 ? 9 : 8;
  else if (young.length === 1) score = cliff.length >= 1 ? 6 : 7;
  else score = cliff.length >= 2 ? 5 : 3;
  if (able.length === 1) score = Math.min(score, 5);
  score = clamp(score);

  const grade = gradeFor(score);
  const attention =
    grade === 'strong'
      ? null
      : cliff.length > 0
        ? 'RBs lose 35–50% of trade value within a year of their peak — sell a year early, not a year late, unless you are a true contender.'
        : able.length < 2
          ? 'You need at least one young workhorse and a second startable back; committee dart-throws are not a room.'
          : 'Add a pass-catching or young volume back so bye weeks and injuries do not zero the position.';

  return {
    id: 'rb',
    title: 'Running back room',
    score,
    grade,
    summary:
      able.length === 0
        ? 'No startable running back.'
        : `${young.length} young startable (≤26), ${cliff.length} at or past the 27+ cliff.`,
    evidence: [
      `On roster: ${names(rbs)}`,
      `Peak season age has sat at 24.8 since 2016; 93.8% of peak RB seasons come before 29`,
      cliff.length > 0 ? `At the cliff: ${names(cliff)}` : 'No startable RB is 27+ yet',
    ],
    attention,
    sourceIds: ['rsj-2026', 'playerprofiler-2026', 'dynasty-ballers-rb', 'knowledge-age-curves'],
  };
}

function scoreWr(players: Player[]): HealthFacet {
  const wrs = ofPos(players, 'WR');
  const able = startable(wrs);
  const alphas = elite(wrs).filter((p) => p.age >= 22 && p.age <= 27);
  const peakHold = able.filter((p) => p.age >= 28 && p.age < 30);
  const fading = able.filter((p) => p.age >= 30);

  let score = 0;
  if (able.length === 0) score = wrs.length === 0 ? 0 : 2;
  else if (alphas.length >= 2 && able.length >= 4) score = 10;
  else if (alphas.length >= 2 && able.length >= 3) score = 9;
  else if (alphas.length >= 1 && able.length >= 3) score = 7;
  else if (able.length >= 3) score = 5;
  else if (able.length === 2) score = alphas.length >= 1 ? 5 : 4;
  else score = 2;
  if (fading.length >= 2) score -= 1;
  score = clamp(score);

  const grade = gradeFor(score);
  const attention =
    grade === 'strong'
      ? null
      : alphas.length === 0
        ? 'WRs are the long-term ballast — you want at least one 23–27 alpha who commands volume, not a row of WR3s.'
        : able.length < 4
          ? 'This format starts three WRs plus flex. Depth at WR is startable production, not bench wallpaper.'
          : 'The room scores, but the age mix is drifting toward the 30+ drop-off.';

  return {
    id: 'wr',
    title: 'Wide receiver core',
    score,
    grade,
    summary:
      able.length === 0
        ? 'No startable wide receiver.'
        : `${alphas.length} young alpha${alphas.length === 1 ? '' : 's'} (cornerstone, 22–27), ${able.length} startable.`,
    evidence: [
      `On roster: ${names(wrs)}`,
      `WR peak ~27; high-end WRs show no significant PPG drop until 30`,
      peakHold.length > 0 ? `Holding peak value: ${names(peakHold)}` : 'No WR sitting on the 28–29 plateau',
      fading.length > 0 ? `Age 30+: ${names(fading)}` : 'No WR is past the published PPG drop-off',
    ],
    attention,
    sourceIds: ['rsj-2026', 'etr-2026-mock', 'smash-except-stier', 'knowledge-age-curves'],
  };
}

function scoreTe(players: Player[], tePremium: number): HealthFacet {
  const tes = ofPos(players, 'TE');
  const able = startable(tes);
  const studs = elite(tes);
  const youngStuds = studs.filter((p) => p.age <= 26);

  let score = 0;
  if (able.length === 0) score = tes.length === 0 ? 0 : 2;
  else if (youngStuds.length >= 1) score = 10;
  else if (studs.length >= 1) score = 8;
  else if (able.some((p) => p.tier === 'starter' && p.age <= 27)) score = 7;
  else if (able.length >= 1) score = 5;
  else score = 2;
  if (tePremium > 0 && score >= 1 && score <= 4) score = Math.max(1, score - 1);
  score = clamp(score);

  const grade = gradeFor(score);
  const premiumNote =
    tePremium > 0
      ? `This league is +${tePremium} TE premium — a difference-maker here is a weekly advantage.`
      : 'Even without TE premium, a top-tier every-down TE is a positional win.';
  const attention =
    grade === 'strong'
      ? null
      : able.length === 0
        ? `${premiumNote} You are streaming touchdowns.`
        : `${premiumNote} Upgrade from a replacement-level TE if the cost is a WR3 or a future first.`;

  return {
    id: 'te',
    title: tePremium > 0 ? 'Tight end (premium)' : 'Tight end',
    score,
    grade,
    summary:
      able.length === 0
        ? 'No startable tight end — TD-or-bust every week.'
        : `${studs.length} cornerstone, ${able.length} startable. Average TE peak (outliers removed) is 26.8.`,
    evidence: [
      `On roster: ${names(tes)}`,
      tePremium > 0
        ? `TE premium is +${tePremium} — DLF and Superflex TEP rooms hoard high-end TEs`
        : 'No TE premium, so do not overpay past the top tier',
    ],
    attention,
    sourceIds: ['rsj-2026', 'dlf-ffpc-2026', 'dynasty-nerds-rebuild'],
  };
}

function scoreAgeStagger(players: Player[]): HealthFacet {
  const skill = players.filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.pos) && STARTABLE.has(p.tier));
  if (skill.length === 0) {
    return {
      id: 'age-stagger',
      title: 'Age stagger',
      score: 0,
      grade: 'weak',
      summary: 'No startable skill players to age-profile.',
      evidence: ['An empty or dart-throw-only roster has no window yet.'],
      attention: 'Fill the roster before the age mix can be diagnosed.',
      sourceIds: ['rsj-2026', 'knowledge-age-curves'],
    };
  }
  const young = skill.filter((p) => p.age <= 24);
  const prime = skill.filter((p) => p.age >= 25 && p.age <= 28);
  const old = skill.filter((p) => p.age >= 29);
  let score = 5;
  if (young.length >= 2 && prime.length >= 2) score = 9;
  else if (young.length >= 1 && prime.length >= 1 && old.length <= 2) score = 7;
  else if (old.length >= Math.ceil(skill.length / 2)) score = 3;
  else if (young.length === skill.length) score = 6;
  score = clamp(score);

  const grade = gradeFor(score);
  return {
    id: 'age-stagger',
    title: 'Age stagger',
    score,
    grade,
    summary: `${young.length} ≤24, ${prime.length} in prime (25–28), ${old.length} 29+ among startable skill players.`,
    evidence: [
      young.length ? `Youth: ${names(young)}` : 'No startable player is 24 or younger',
      old.length ? `29+: ${names(old)}` : 'No startable skill player is 29+',
      'A roster that ages out together is one bet made many times',
    ],
    attention:
      grade === 'strong'
        ? null
        : old.length >= young.length
          ? 'You are a contender whether you planned to be — either buy the last pieces or sell before equity hits zero.'
          : 'Add a veteran floor or a young piece so the window is staggered, not a single cliff.',
    sourceIds: ['rsj-2026', 'knowledge-age-curves'],
  };
}

function scoreYouthFloor(players: Player[]): HealthFacet {
  const skill = players.filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.pos));
  const floor = skill.filter((p) => p.tier === 'cornerstone' || p.tier === 'starter');
  const ceiling = skill.filter((p) => p.age <= 24 && (p.tier === 'cornerstone' || p.tier === 'starter' || p.tier === 'dart-throw'));
  const winNow = skill.filter((p) => p.tier === 'win-now');

  let score = 4;
  if (floor.length >= 4 && ceiling.length >= 2) score = 9;
  else if (floor.length >= 3 && ceiling.length >= 1) score = 7;
  else if (floor.length >= 3 && ceiling.length === 0) score = 5;
  else if (floor.length <= 1 && ceiling.length >= 3) score = 4;
  else if (winNow.length >= 3 && floor.length <= 2) score = 3;
  if (skill.length === 0) score = 0;
  score = clamp(score);
  const grade = gradeFor(score);

  return {
    id: 'youth-floor',
    title: 'Floor and ceiling',
    score,
    grade,
    summary: `${floor.length} proven starters, ${ceiling.length} young pieces (≤24), ${winNow.length} win-now.`,
    evidence: [
      'Championship rosters need a floor (boring veterans) and a ceiling (youth that can still break out)',
      'S-tier pieces are the 20–24 names you can build around for 5–7 years',
      floor.length ? `Floor: ${names(floor)}` : 'No cornerstone/starter skill players',
    ],
    attention:
      grade === 'strong'
        ? null
        : floor.length < 3
          ? 'Too much of the lineup is hope. Consolidate dart-throws into one proven starter.'
          : 'The floor is fine; you are missing young pieces whose value can still rise.',
    sourceIds: ['smash-except-stier', 'etr-2026-mock', 'dynasty-nerds-rebuild'],
  };
}

function scoreAvailability(players: Player[]): HealthFacet {
  const hurt = players.filter(
    (p) =>
      (p.injuryStatus && INJURED.test(p.injuryStatus)) ||
      (p.status && /injured reserve|pup|inactive/i.test(p.status)),
  );
  const score = clamp(hurt.length === 0 ? 10 : hurt.length === 1 ? 6 : hurt.length === 2 ? 4 : 2);
  const grade = gradeFor(score);
  return {
    id: 'availability',
    title: 'Health and availability',
    score,
    grade,
    summary:
      hurt.length === 0
        ? 'No stored injury designation on the roster.'
        : `${hurt.length} player${hurt.length === 1 ? '' : 's'} carry an injury/IR/PUP designation.`,
    evidence:
      hurt.length === 0
        ? ['Sleeper designations only — we never invent an injury']
        : hurt.map((p) => `${p.name}: ${p.injuryStatus ?? p.status}`),
    attention:
      grade === 'strong'
        ? null
        : 'Injured starters shrink this week’s ceiling. Confirm IR eligibility and whether the depth behind them is actually startable.',
    sourceIds: ['dynasty-ballers-rb'],
  };
}

function scoreDepth(team: Team, players: Player[]): HealthFacet {
  const starterSlotCount = team.format.rosterSlots.filter(
    (s) => !['BN', 'TAXI', 'IR'].includes(s.kind),
  ).length;
  const able = startable(players.filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.pos)));
  const extra = Math.max(0, able.length - Math.min(starterSlotCount, 10));
  const thirdQb = startable(ofPos(players, 'QB')).length >= 3;
  const secondTe = startable(ofPos(players, 'TE')).length >= 2;

  let score = 3;
  if (able.length === 0) score = 0;
  else if (extra >= 4 && thirdQb) score = 9;
  else if (extra >= 3) score = 7;
  else if (extra >= 1) score = 5;
  else score = 3;
  if (team.format.superflex && !thirdQb && score >= 6) score -= 1;
  score = clamp(score);
  const grade = gradeFor(score);

  return {
    id: 'depth',
    title: 'Bench insurance',
    score,
    grade,
    summary: `${able.length} startable skill players against ${starterSlotCount} starting slots (${extra} extras).`,
    evidence: [
      thirdQb ? 'Third startable QB is present' : 'No third startable QB — bye/injury at SUPERFLEX is a zero',
      secondTe ? 'Second startable TE is present' : 'No TE handcuff if the starter is out',
      'Ask: can the bench survive byes, and can it keep you competitive through injuries?',
    ],
    attention:
      grade === 'strong'
        ? null
        : 'Depth is how you survive July through December. A start-10 with no extras loses the weeks the studs sit.',
    sourceIds: ['dlf-ffpc-2026', 'etr-2026-mock', 'dynasty-ballers-rb'],
  };
}

export function windowFromTotal(positionTotal: number, rosteredCount: number): {
  window: CompetitiveWindow;
  windowLabel: string;
  windowAdvice: string;
} {
  if (rosteredCount === 0) {
    return {
      window: 'empty',
      windowLabel: 'No roster to grade yet',
      windowAdvice:
        'Refresh from Sleeper or fill slots. The audit needs players, not empty slots.',
    };
  }
  if (positionTotal >= 32) {
    return {
      window: 'contend',
      windowLabel: 'Contend — push the chips in',
      windowAdvice:
        '32–40 on the positional audit: weaponize depth to buy weekly difference-makers. Do not sit in the middle.',
    };
  }
  if (positionTotal >= 24) {
    return {
      window: 'pivot',
      windowLabel: 'Pivot — pick a direction',
      windowAdvice:
        '24–31: either consolidate depth for a stud or liquidate aging pieces for future value. The middle is where seasons die.',
    };
  }
  return {
    window: 'rebuild',
    windowLabel: 'Rebuild — start a productive struggle',
    windowAdvice:
      'Under 24: move veterans now, before the market forces you to. Build around elite youth and draft capital.',
  };
}

export function diagnoseRosterHealth(
  team: Team,
  players: Player[],
  draft?: Draft,
): RosterHealth {
  const byId = new Map(players.map((p) => [p.id, p]));
  const rostered = draft
    ? rosteredPlayersIncludingDraft(team, byId, draft)
    : rosteredPlayers(team, byId);

  const qb = scoreQb(rostered, team.format.superflex);
  const rb = scoreRb(rostered);
  const wr = scoreWr(rostered);
  const te = scoreTe(rostered, team.format.tePremium);
  const stagger = scoreAgeStagger(rostered);
  const youthFloor = scoreYouthFloor(rostered);
  const availability = scoreAvailability(rostered);
  const depth = scoreDepth(team, rostered);

  const facets = [qb, rb, wr, te, stagger, youthFloor, availability, depth];
  const positionTotal = qb.score + rb.score + wr.score + te.score;
  const { window, windowLabel, windowAdvice } = windowFromTotal(positionTotal, rostered.length);
  const priorities = [...facets]
    .filter((f) => f.grade !== 'strong')
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));

  const base: RosterHealth = {
    positionTotal,
    window,
    windowLabel,
    windowAdvice,
    facets,
    priorities,
    rosteredCount: rostered.length,
    draftCoaching: null,
  };

  const coaching = buildDraftCoaching(team, players, draft, base);
  return applyDraftCoachingToHealth(base, coaching);
}
