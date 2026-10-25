/** What a producer can post. The key is the on-chain `kind` symbol. */
export const CHECKIN_KINDS: {
  kind: string;
  label: string;
  hint: string;
  tile: string;
}[] = [
  {
    kind: "lab",
    label: "Lab reading",
    hint: "pH, sugar, alcohol, temperature",
    tile: "#FFF4E2",
  },
  {
    kind: "tasting",
    label: "Tasting note",
    hint: "What it tastes like today",
    tile: "#F7A8C8",
  },
  { kind: "photo", label: "Photo", hint: "How it looks", tile: "#F5B82E" },
  {
    kind: "racking",
    label: "Racking",
    hint: "Moved, topped up, bottled",
    tile: "#B8733E",
  },
  {
    kind: "started",
    label: "Started",
    hint: "The day it began",
    tile: "#7CC36B",
  },
  { kind: "other", label: "Update", hint: "Anything else", tile: "#7FD8D6" },
];

export const kindOf = (kind: string) =>
  CHECKIN_KINDS.find((k) => k.kind === kind) ?? CHECKIN_KINDS[5];
