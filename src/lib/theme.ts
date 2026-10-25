/** Colours and type shared by the producer pages. */

export const INK = "#2B1B3D";
export const INK_SOFT = "#3F2F4A";
export const CREAM = "#FFF4E2";
export const RED = "#C8341E";
export const ORANGE = "#F07C2B";
export const PINK = "#F7A8C8";
export const YELLOW = "#F5B82E";
export const TEAL = "#157A78";
export const TEAL_DARK = "#08403E";
export const GREEN = "#7CC36B";
export const RULE = "rgba(43, 27, 61, 0.22)";
export const BG = "#7FD8D6";

export const DISPLAY = "'Shrikhand', Georgia, serif";
export const SANS =
  "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
export const MONO = "'Space Mono', monospace";

export const bigButton = (
  background = INK,
  color = CREAM,
): React.CSSProperties => ({
  height: 56,
  minHeight: 56,
  flexShrink: 0,
  borderRadius: 28,
  border: 0,
  background,
  color,
  fontFamily: SANS,
  fontWeight: 800,
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  textDecoration: "none",
});

export const pill = (
  background: string,
  color: string,
): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  padding: "0 12px",
  borderRadius: 15,
  background,
  color,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

export const fieldLabel: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 17,
  color: RED,
  letterSpacing: "-0.01em",
};

export const fieldInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 48,
  padding: 0,
  border: 0,
  borderBottom: `2px solid ${INK}`,
  borderRadius: 0,
  background: "transparent",
  fontFamily: SANS,
  fontSize: 20,
  fontWeight: 600,
  color: INK,
  outline: "none",
};

/** Back chevron and the two-line wordmark used at the top of inner pages. */
export const BACK_ICON_PATH = "M15 5l-7 7 7 7";
