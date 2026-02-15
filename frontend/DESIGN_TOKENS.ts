/**
 * ClawHouse Design Tokens (TypeScript)
 *
 * Central location for all design tokens used throughout the application.
 * Useful for programmatic access to design values in TypeScript components.
 */

export const DESIGN_TOKENS = {
  /* ========== COLORS ========== */
  colors: {
    /* Neutral */
    base: {
      black: "#000000",
      white: "#FFFFFF",
      gray: {
        50: "#F9F9F9",
        100: "#F3F3F3",
        200: "#E8E8E8",
        300: "#D4D4D4",
        400: "#A1A1A1",
        500: "#6B6B6B",
        600: "#3D3D3D",
        700: "#262626",
        800: "#1A1A1A",
        900: "#0F0F0F",
      },
    },
    /* Primary: Cyan */
    primary: {
      50: "#F0F9FF",
      100: "#E1F3FF",
      200: "#BAE6FF",
      300: "#7DD3FC",
      400: "#38BDF8",
      500: "#0EA5E9",
      600: "#0284C7",
      700: "#0369A1",
      800: "#075985",
      900: "#0C3A66",
    },
    /* Secondary: Magenta */
    secondary: {
      50: "#FDF2F8",
      100: "#FCE7F3",
      200: "#FBCFE8",
      300: "#F8B4DD",
      400: "#F472B6",
      500: "#EC4899",
      600: "#DB2777",
      700: "#BE185D",
      800: "#9D174D",
      900: "#831843",
    },
    /* Tertiary: Yellow */
    tertiary: {
      50: "#FFFAED",
      100: "#FEF3C7",
      200: "#FDE68A",
      300: "#FCD34D",
      400: "#FBBF24",
      500: "#F59E0B",
      600: "#D97706",
      700: "#B45309",
      800: "#92400E",
      900: "#78350F",
    },
    /* Utility */
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },

  /* ========== TYPOGRAPHY ========== */
  fonts: {
    display: "'Space Grotesk', system-ui, sans-serif",
    sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },

  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
    "7xl": "4.5rem",
    "8xl": "6rem",
  },

  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },

  /* ========== SPACING ========== */
  space: {
    0: "0px",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    6: "1.5rem",
    8: "2rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
    32: "8rem",
    48: "12rem",
    64: "16rem",
  },

  /* ========== BORDERS ========== */
  borders: {
    width: {
      thin: "1px",
      default: "2px",
      thick: "4px",
      extraThick: "6px",
    },
    radius: {
      none: "0px",
      sm: "0.125rem",
      default: "0px",
      md: "0.25rem",
      lg: "0.5rem",
      full: "9999px",
    },
  },

  /* ========== SHADOWS ========== */
  shadows: {
    none: "none",
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  },

  /* ========== ANIMATIONS ========== */
  animations: {
    durations: {
      fast: "0.15s",
      normal: "0.3s",
      slow: "0.5s",
      slower: "1s",
    },
    timingFunctions: {
      ease: "ease",
      easeIn: "ease-in",
      easeOut: "ease-out",
      easeInOut: "ease-in-out",
      linear: "linear",
    },
  },

  /* ========== BREAKPOINTS ========== */
  breakpoints: {
    mobile: "375px",
    tablet: "768px",
    desktop: "1024px",
    wide: "1280px",
  },

  /* ========== Z-INDEX ========== */
  zIndex: {
    dropdown: 100,
    sticky: 50,
    fixed: 100,
    modal: 999,
    toast: 9999,
  },
};

/* ========== HELPER FUNCTIONS ========== */

/**
 * Get a color from the design tokens
 * @example getColor('primary', '500') → '#0EA5E9'
 * @example getColor('base.gray', '600') → '#3D3D3D'
 */
export function getColor(
  path: string,
  shade?: string
): string | Record<string, string> {
  const keys = path.split(".");
  let current: any = DESIGN_TOKENS.colors;

  for (const key of keys) {
    current = current[key];
    if (!current) return "#000000";
  }

  if (shade && typeof current === "object") {
    return current[shade] || "#000000";
  }

  return current;
}

/**
 * Combine color and opacity
 * @example rgba('primary.500', 0.5) → 'rgba(14, 165, 233, 0.5)'
 */
export function rgba(colorPath: string, opacity: number): string {
  const color = getColor(colorPath) as string;
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/* ========== TYPE EXPORTS ========== */

export type ColorPath = keyof typeof DESIGN_TOKENS.colors;
export type FontFamily = keyof typeof DESIGN_TOKENS.fonts;
export type FontSize = keyof typeof DESIGN_TOKENS.fontSize;
export type SpaceValue = keyof typeof DESIGN_TOKENS.space;
export type Breakpoint = keyof typeof DESIGN_TOKENS.breakpoints;
