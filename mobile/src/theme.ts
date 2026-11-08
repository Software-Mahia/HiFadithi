// Measured HiFadithi dark tokens (source: mobile/HiFadithi_Designs/*).
// The mockups are binding: the app is dark at all times, regardless of the OS
// appearance setting. Palette values below are sampled from the designs.
import { Platform } from "react-native";
export const colors = {
  // Surfaces
  background: "#120F0E",
  splash: "#0F0B0B",
  surface: "#1E1918",
  elevated: "#2A2321",
  border: "#352624",
  borderStrong: "#3D2E2B",

  // Text
  text: "#F5EFEA",
  muted: "#9A8876",
  mutedDeep: "#927B67",

  // Brand + semantic
  primary: "#C24339",
  brick: "#C24339",
  brickDark: "#AA2216",
  deepRed: "#7D231E",
  amber: "#EAA000",
  teal: "#00B4C2",
  draft: "#8A7F7B",
  info: "#3A7CA5",
  success: "#00B4C2",
  danger: "#C24339",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(10, 8, 8, 0.72)",

  // Back-compat aliases used by older components.
  ink: "#0F0B0B",
  paper: "#120F0E",
  line: "#352624",

  // Light museum-gallery surfaces used only by the interactive 3D stage.
  museumLight: "#F2EFE9",
  museumFloor: "#D8D1C7",
  museumInk: "#332C28",
};

// Poppins ships via @expo-google-fonts; weights are separate families, so
// components that need a specific weight set fontFamily + fontWeight.
export const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

/** React Native Web treats a numeric `lineHeight` as a unitless CSS value
 * (so 34 becomes 34× the font size). Pass line heights through this helper on
 * web so the browser receives an explicit pixel value; native is unchanged. */
export function lh(value: number) {
  return (Platform.OS === "web" ? `${value}px` : value) as unknown as number;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

// Floating nav pill shadow — dark and soft, never a light halo.
export const raisedShadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.45,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 12,
};

export const softShadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.25,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

// Status colours shared by badges, rows and job screens.
export const statusTone = {
  draft: { fg: "#9A8876", bg: "rgba(154,136,118,0.14)" },
  processing: { fg: "#EAA000", bg: "rgba(234,160,0,0.14)" },
  ready: { fg: "#00B4C2", bg: "rgba(0,180,194,0.14)" },
  published: { fg: "#00B4C2", bg: "rgba(0,180,194,0.14)" },
  failed: { fg: "#C24339", bg: "rgba(194,67,57,0.16)" },
} as const;
