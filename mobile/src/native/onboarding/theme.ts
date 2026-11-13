/** Palette and shared geometry for the onboarding (from the product spec). */

import { colors } from "../../theme";

/* ─── Palette ─────────────────────────────────────────────────────── */

export const TONE = {
  screenTop: "#2A1810",
  screenMid: "#1E0F0B",
  screenEdge: "#150A07",
  band: "#6B2A1F",
  cream: "#F4ECE6",
  subtext: "#D9CFC8",
  dotActive: "#C8402F",
  dotIdle: "#8A7A72",
  ctaTop: "#D8473A",
  ctaBottom: "#A82A20",
  red: "#C8402F",
  amber: "#EAA000",
  teal: colors.teal,
  chipBg: "rgba(24,13,10,0.88)",
  cardBg: "rgba(38,20,15,0.82)",
} as const;

/* ─── Slide geometry ──────────────────────────────────────────────── */

/** Geometry shared by every slide: header clearance, footer reservation and
 * the collage height. Keeps the artwork centred in the room actually left. */
export type Layout = {
  width: number;
  height: number;
  stageH: number;
  topPad: number;
  bottomPad: number;
};
