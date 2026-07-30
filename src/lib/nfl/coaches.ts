import type { CoachProfile } from './types';

/**
 * Curated head-coach offensive profiles. ESPN/Sleeper do not expose coaching
 * scheme data, so this map is maintained by hand. Head coaching changes after
 * each season — update this file when staffs turn over. Unknown teams fall
 * back to `UNKNOWN_COACH` in `coachForTeam()`.
 */
export const COACHES: Record<string, CoachProfile> = {
  ARI: {
    teamAbbrev: 'ARI',
    name: 'Jonathan Gannon',
    title: 'Head Coach',
    styleTag: 'Balanced rebuild',
    offense:
      'Defensive-minded HC with a run-first, play-action offense built around a mobile QB. Wants efficient, low-mistake football while the roster matures.',
  },
  ATL: {
    teamAbbrev: 'ATL',
    name: 'Raheem Morris',
    title: 'Head Coach',
    styleTag: 'Vertical play-action',
    offense:
      'Rams-tree influence: under-center run looks feeding deep play-action shots to outside receivers, with the RB featured as a true three-down weapon.',
  },
  BAL: {
    teamAbbrev: 'BAL',
    name: 'John Harbaugh',
    title: 'Head Coach',
    styleTag: 'Heavy run / dual-threat QB',
    offense:
      'Built around a generational dual-threat QB: heavy personnel, option and designed QB runs, with downhill backs and play-action shots off the run threat.',
  },
  BUF: {
    teamAbbrev: 'BUF',
    name: 'Sean McDermott',
    title: 'Head Coach',
    styleTag: 'QB-centric spread',
    offense:
      'Everything flows through an MVP-caliber QB in a spread system: shotgun runs, deep sideline shots, and receivers who win with route precision.',
  },
  CAR: {
    teamAbbrev: 'CAR',
    name: 'Dave Canales',
    title: 'Head Coach',
    styleTag: 'QB-friendly rhythm pass',
    offense:
      'Seattle/Tampa tree: quick-rhythm passing to rebuild QB confidence, schemed easy completions, and a committee backfield that protects the pass game.',
  },
  CHI: {
    teamAbbrev: 'CHI',
    name: 'Ben Johnson',
    title: 'Head Coach',
    styleTag: 'Creative schemed YAC',
    offense:
      'The league’s most copied young play-designer: heavy motion and misdirection, play-action, and schemed YAC that manufactures touches for versatile weapons.',
  },
  CIN: {
    teamAbbrev: 'CIN',
    name: 'Zac Taylor',
    title: 'Head Coach',
    styleTag: 'Pass-first spread',
    offense:
      'Pass-first spread built on an elite QB-WR battery: 11 personnel, option routes, and deep sideline timing throws. Volume concentrates on the alpha wideouts.',
  },
  CLE: {
    teamAbbrev: 'CLE',
    name: 'Kevin Stefanski',
    title: 'Head Coach',
    styleTag: 'Wide-zone play-action',
    offense:
      'Shanahan-tree wide zone with heavy play-action and boots. The feature back is the engine; tight ends feast on bootleg crossers.',
  },
  DAL: {
    teamAbbrev: 'DAL',
    name: 'Brian Schottenheimer',
    title: 'Head Coach',
    styleTag: 'Balanced West Coast',
    offense:
      'West Coast roots with modern spacing: timing routes for the QB, a true WR1 as the volume hub, and backs used heavily in the screen and checkdown game.',
  },
  DEN: {
    teamAbbrev: 'DEN',
    name: 'Sean Payton',
    title: 'Head Coach',
    styleTag: 'Precision timing pass',
    offense:
      'Saints-tree precision: B-gap runs, screens by design, and a “joker” pass-catching back/TE role. Slot receivers and backs get manufactured touches.',
  },
  DET: {
    teamAbbrev: 'DET',
    name: 'Dan Campbell',
    title: 'Head Coach',
    styleTag: 'Aggressive power run',
    offense:
      'Identity is violence up front: power/gap run game with a two-back thunder-lightning split, play-action crossers, and fourth-down aggression that boosts scoring volume.',
  },
  GB: {
    teamAbbrev: 'GB',
    name: 'Matt LaFleur',
    title: 'Head Coach',
    styleTag: 'Wide-zone illusion',
    offense:
      'Shanahan/McVay tree: wide zone, heavy motion, and the “illusion of complexity.” Spreads targets across multiple receivers rather than one alpha.',
  },
  HOU: {
    teamAbbrev: 'HOU',
    name: 'DeMeco Ryans',
    title: 'Head Coach',
    styleTag: 'Play-action deep shots',
    offense:
      '49ers-tree offense around a franchise QB: outside zone setting up deep play-action daggers to boundary receivers.',
  },
  IND: {
    teamAbbrev: 'IND',
    name: 'Shane Steichen',
    title: 'Head Coach',
    styleTag: 'RPO spread option',
    offense:
      'Eagles-tree RPO spread: QB run threat stresses defenses horizontally, feature back eats light boxes, receivers win on in-breakers and deep overs.',
  },
  JAX: {
    teamAbbrev: 'JAX',
    name: 'Liam Coen',
    title: 'Head Coach',
    styleTag: 'McVay-tree spacing',
    offense:
      'McVay-tree spacing concepts: condensed formations, play-action crossers, and schemed touches that put athletic receivers in space.',
  },
  KC: {
    teamAbbrev: 'KC',
    name: 'Andy Reid',
    title: 'Head Coach',
    styleTag: 'West Coast spread RPO',
    offense:
      'The modern West Coast template: motion-heavy spread, RPOs, shovel passes, and a Hall of Fame QB-TE connection. Speed receivers get schemed touches.',
  },
  LAC: {
    teamAbbrev: 'LAC',
    name: 'Jim Harbaugh',
    title: 'Head Coach',
    styleTag: 'Power run / play-action',
    offense:
      'Old-school power run game with heavy personnel, designed to open shot plays off play-action for outside receivers. RB volume is bankable.',
  },
  LAR: {
    teamAbbrev: 'LAR',
    name: 'Sean McVay',
    title: 'Head Coach',
    styleTag: 'Play-action shot scheme',
    offense:
      'The original McVay scheme: outside zone, condensed splits, jet motion, and play-action bombs. Concentrates targets on one or two elite receivers.',
  },
  LV: {
    teamAbbrev: 'LV',
    name: 'Pete Carroll',
    title: 'Head Coach',
    styleTag: 'Establish-the-run',
    offense:
      'Seattle formula: commit to the run game and play-action deep balls off it. Backs get volume; the WR1 sees designed vertical shots.',
  },
  MIA: {
    teamAbbrev: 'MIA',
    name: 'Mike McDaniel',
    title: 'Head Coach',
    styleTag: 'Speed motion scheme',
    offense:
      'The NFL’s speed laboratory: track-star receivers, endless pre-snap motion, and schemed YAC. Fast players get touches manufactured in space.',
  },
  MIN: {
    teamAbbrev: 'MIN',
    name: "Kevin O'Connell",
    title: 'Head Coach',
    styleTag: 'Pass-happy McVay tree',
    offense:
      'McVay tree with a pass-happy lean: an elite alpha WR as the hub, heavy 11 personnel, and aggressive shot-calling that inflates receiver volume.',
  },
  NE: {
    teamAbbrev: 'NE',
    name: 'Mike Vrabel',
    title: 'Head Coach',
    styleTag: 'Physical complementary',
    offense:
      'Titans-style complementary football: physical run game, play-action over the middle, and tight ends featured as chain-movers.',
  },
  NO: {
    teamAbbrev: 'NO',
    name: 'Kellen Moore',
    title: 'Head Coach',
    styleTag: 'Spread timing offense',
    offense:
      'Eagles/Cowboys-tree spread: RPO-flavored timing offense that funnels volume to a do-everything RB and a target-hog WR1.',
  },
  NYG: {
    teamAbbrev: 'NYG',
    name: 'Brian Daboll',
    title: 'Head Coach',
    styleTag: 'Adaptive spread',
    offense:
      'Adapts scheme to personnel: spread concepts, designed QB runs, and quick-game answers. Rookie skill talent gets force-fed early.',
  },
  NYJ: {
    teamAbbrev: 'NYJ',
    name: 'Aaron Glenn',
    title: 'Head Coach',
    styleTag: 'Run game identity',
    offense:
      'Defensive HC installing a run-centered identity: backs and mobile QBs carry the offense while the young receiving corps develops.',
  },
  PHI: {
    teamAbbrev: 'PHI',
    name: 'Nick Sirianni',
    title: 'Head Coach',
    styleTag: 'RPO tush-push machine',
    offense:
      'Elite offensive line powers RPOs, the brotherly shove, and a dominant alpha WR1. Efficiency plus red-zone dominance lifts all skill volume.',
  },
  PIT: {
    teamAbbrev: 'PIT',
    name: 'Mike Tomlin',
    title: 'Head Coach',
    styleTag: 'Veteran-led balance',
    offense:
      'Field-position football with a veteran QB: play-action to outside receivers, dependable TE usage, and a back who handles the dirty work.',
  },
  SEA: {
    teamAbbrev: 'SEA',
    name: 'Mike Macdonald',
    title: 'Head Coach',
    styleTag: 'Kubiak-tree play-action',
    offense:
      'Kubiak/Shanahan-tree wide zone with deep play-action crossers. A target-earning WR1 and receiving backs profile as the stable producers.',
  },
  SF: {
    teamAbbrev: 'SF',
    name: 'Kyle Shanahan',
    title: 'Head Coach',
    styleTag: 'Wide-zone YAC machine',
    offense:
      'The YAC factory: wide zone, endless motion, and schemed touches that turn versatile backs, receivers, and tight ends into open-field runners.',
  },
  TB: {
    teamAbbrev: 'TB',
    name: 'Todd Bowles',
    title: 'Head Coach',
    styleTag: 'Vertical boundary pass',
    offense:
      'Defensive HC with a pass-leaning staff: vertical boundary shots to big receivers and heavy red-zone usage for the WR1.',
  },
  TEN: {
    teamAbbrev: 'TEN',
    name: 'Brian Callahan',
    title: 'Head Coach',
    styleTag: 'Bengals-tree spread',
    offense:
      'Bengals-tree spread passing game installed around a young QB: rhythm throws, option routes, and slot receivers as volume hubs.',
  },
  WAS: {
    teamAbbrev: 'WAS',
    name: 'Dan Quinn',
    title: 'Head Coach',
    styleTag: 'Dual-threat vertical',
    offense:
      'Kliff Kingsbury-flavored spread around a dynamic dual-threat QB: quick game, designed QB runs, and a veteran WR1 as the security blanket.',
  },
};

const UNKNOWN_COACH: Omit<CoachProfile, 'teamAbbrev'> = {
  name: 'Staff TBD',
  title: 'Head Coach',
  styleTag: 'Unknown scheme',
  offense:
    'Coaching staff not yet in the curated map — treat scheme fit as neutral until this profile is updated.',
};

export function coachForTeam(abbrev: string): CoachProfile {
  const coach = COACHES[abbrev];
  return coach ?? { teamAbbrev: abbrev, ...UNKNOWN_COACH };
}
