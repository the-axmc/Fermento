/**
 * Presentation data for the batches the app knows about.
 *
 * Everything that changes (price, shares left, maturity, mark, stage) is read
 * from the contracts. What lives here is the story and the artwork: name,
 * producer, description, label colours. Keyed by the on-chain batch id.
 */

export type Kind =
  | "kombucha"
  | "kefir"
  | "cider"
  | "mead"
  | "wine"
  | "fortified"
  | "vinegar"
  | "kimchi"
  | "cheese"
  | "other";

export interface BatchInfo {
  /** On-chain batch id, shared by registry, shares and oracle. */
  batchId: number;
  kind: Kind;
  /** Short category shown on the label, e.g. "Moscatel". */
  cat: string;
  name: string;
  /** "Batch Nº 014" */
  label: string;
  vintage: string;
  description: string;
  producer: string;
  producerSlug: string;
  region: string;
  category: string;
  /** What one unit is when redeeming: a bottle, a wheel, a case. */
  unit: string;
  /** Account that receives sales, set for batches listed through the producer API. */
  producerAddress?: string;
  /** False for ferments the producer only tracks: registered, never offered. */
  onSale?: boolean;
  /** From the producer API: a listed sale waits for an inspector's attestation. */
  saleStatus?: "tracking" | "awaiting-inspection" | "open";
  /** Confidential wrapper of the share token, when the batch has one. */
  confidentialToken?: string;
  /* Artwork */
  glass: string;
  cap: string;
  labelColor: string;
  tile: string;
}

export const batches: BatchInfo[] = [
  {
    batchId: 14,
    kind: "fortified",
    cat: "Moscatel",
    name: "Moscatel de Setúbal",
    label: "Batch Nº 014",
    vintage: "2026",
    description:
      "A fortified Moscatel from the Setúbal Peninsula, south of Lisbon, resting in oak at Quinta exemplo until it's ready to bottle.",
    producer: "Quinta exemplo",
    producerSlug: "quinta-exemplo",
    region: "Setúbal, Portugal",
    category: "Moscatel de Setúbal · fortified",
    unit: "bottle",
    confidentialToken:
      "CD6LRJ3HQKWTLYMKTFQWSCH6FEZM636JFK54534QR3WUMBISRJZQBZ5J",
    glass: "#2B1B3D",
    cap: "#F7A8C8",
    labelColor: "#F5B82E",
    tile: "#F5B82E",
  },
  {
    batchId: 15,
    kind: "fortified",
    cat: "Moscatel",
    name: "Moscatel de Setúbal",
    label: "Batch Nº 015",
    vintage: "2026",
    description:
      "The second cask of the year at Quinta exemplo, filled from the same Moscatel must and aging beside Nº 014.",
    producer: "Quinta exemplo",
    producerSlug: "quinta-exemplo",
    region: "Setúbal, Portugal",
    category: "Moscatel de Setúbal · fortified",
    unit: "bottle",
    glass: "#2B1B3D",
    cap: "#157A78",
    labelColor: "#F5B82E",
    tile: "#F7A8C8",
  },
  {
    batchId: 3,
    kind: "cheese",
    cat: "Serra",
    name: "Queijo Serra da Estrela",
    label: "Batch Nº 003",
    vintage: "2026",
    description:
      "Raw ewe's milk cheese curdled with thistle, maturing in a cool cellar in the Serra da Estrela until the paste turns soft and buttery.",
    producer: "Queijaria exemplo",
    producerSlug: "queijaria-exemplo",
    region: "Serra da Estrela, Portugal",
    category: "Queijo Serra da Estrela DOP · cured",
    unit: "wheel",
    glass: "#F5B82E",
    cap: "#C8341E",
    labelColor: "#F7A8C8",
    tile: "#F07C2B",
  },
];

export const findBatch = (id: string | number | undefined) =>
  batches.find((b) => b.batchId === Number(id));
