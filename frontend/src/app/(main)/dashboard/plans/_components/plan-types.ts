/**
 * Client-safe plan type constants.
 *
 * Deliberately separate from `data.ts`: that module pulls in the server-only API
 * client, so importing these values from there drags server code into the browser
 * bundle.
 */

export const PLAN_TYPES = [
  "membership",
  "offer",
  "offer_package",
  "fitness_studio",
  "extra_service",
  "membership_extra_service",
] as const;

export type PlanType = (typeof PLAN_TYPES)[number];

/**
 * Plan type slugs are snake_case on the wire but camelCase in the message
 * catalogue, so the mapping is spelled out rather than derived.
 */
const MESSAGE_KEYS: Record<PlanType, string> = {
  extra_service: "extraService",
  fitness_studio: "fitnessStudio",
  membership: "membership",
  membership_extra_service: "membershipExtraService",
  offer: "offer",
  offer_package: "offerPackage",
};

export function planTypeMessageKey(type: PlanType): string {
  return `planTypes.${MESSAGE_KEYS[type]}`;
}
