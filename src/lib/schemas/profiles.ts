import { z } from 'zod';
import { HttpsUrlSchema } from './url';

/**
 * Scouting profiles — the qualitative half of a pick recommendation.
 *
 * Everything else the picks page reads is a number a sync wrote: a consensus
 * rank, a market value, a depth-chart slot. Those say *where* a player goes and
 * say nothing about *why*. This file is the why: role, scheme fit, and the
 * specific risk attached to the player.
 *
 * Two rules make it safe for the loop to write into unattended, and they are
 * enforced by the schema rather than by good intentions:
 *
 *   1. **`sources` is required and non-empty.** A profile is a claim about the
 *      real world. The knowledge collection already refuses uncited articles
 *      (see `src/content.config.ts`); a profile is the same kind of assertion
 *      rendered in a different place, so it earns the same gate.
 *   2. **`asOf` is required.** Roles churn — a camp split in August is a
 *      different fact in November. A profile that cannot say when it was true
 *      is a profile nobody can audit, so the date is mandatory and
 *      `tests/profiles.test.ts` fails the build once one goes stale.
 *
 * What does *not* belong here: rankings, projected points, or anything a
 * committed data file already carries. Duplicating `market.json` into prose is
 * how two sources of truth start disagreeing.
 */

export const ProfileSourceSchema = z.object({
  label: z.string().min(1),
  url: HttpsUrlSchema,
});

export const ProfileSchema = z.object({
  /** Our own slug — must resolve against `data/players.json`. */
  playerId: z.string().min(1),
  /**
   * One line, written to be read at speed. This is what a manager sees on the
   * clock with 90 seconds left, so it leads with the role, not the adjective.
   */
  headline: z.string().min(1),
  /** How the player is actually used: snaps, touches, target share, situation. */
  role: z.string().min(1),
  /** Scheme, quarterback, offensive context — why the situation helps or caps him. */
  fit: z.string().min(1),
  /**
   * The specific thing that could make this pick wrong. Never omitted and never
   * softened: a profile with no risk section is marketing, not scouting.
   */
  risk: z.string().min(1),
  /** When the reporting behind this profile was current. */
  asOf: z.string().min(1),
  sources: z
    .array(ProfileSourceSchema)
    .min(1, 'every scouting profile must cite at least one source'),
});

export const ProfilesSchema = z.array(ProfileSchema);

export type ProfileSource = z.infer<typeof ProfileSourceSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Profiles = z.infer<typeof ProfilesSchema>;
