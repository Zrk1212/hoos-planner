/**
 * Wire Rotunda glyph on a 64-unit grid, shared by the header/footer mark and app/icon.svg (keep them in sync):
 * dome with two parallels, meridians and the oculus, stepped rings, drum, pediment with its round window,
 * six columns, steps. No background: it draws in currentColor.
 */
export const MARK = {
  heavy: "M9 31A23 15 0 0 1 55 31M8 33.5H56M16 40.5L32 34L48 40.5ZM16.5 40.5H47.5M16.5 43.5H47.5M13 54H51M10 57.5H54",
  light: "M13.6 22.4Q32 25.6 50.4 22.4M19.7 15.4Q32 17.4 44.3 15.4M17 31.6Q19.5 20 32 16M47 31.6Q44.5 20 32 16M24.5 31.9Q26 21 32 16M39.5 31.9Q38 21 32 16M9.5 33.5V54M54.5 33.5V54",
  cols: "M19.5 44.5V53M24.3 44.5V53M29.1 44.5V53M34.9 44.5V53M39.7 44.5V53M44.5 44.5V53",
} as const;
