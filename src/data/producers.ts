/**
 * Producer profiles. Live profiles come from the producer API; these seeds
 * back the batches in `batches.ts` so the demo pages render when the API is
 * down. Keyed by slug.
 */

import type { Kind } from "./batches";

export type ProducerTier = "amateur" | "certified";

export type CertificationStatus = "pending" | "approved" | "rejected";

export interface Certification {
  id: string;
  status: CertificationStatus;
  legalName: string;
  country: string;
  website?: string;
  submittedAt: string;
  reviewedAt?: string;
  documentName?: string;
}

export interface Producer {
  /** Account that receives sales and signs check-ins. */
  address: string;
  slug: string;
  name: string;
  location: string;
  story: string;
  kinds: Kind[];
  website?: string;
  since: number;
  tier: ProducerTier;
  /** Square SVG or PNG data URL, certified producers only. */
  logo?: string;
  /** Last rating the keeper posted on chain, in bps. */
  ratingBps?: number;
  certification?: Certification;
}

const quintaLogo =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#FFF4E2"/><text x="50" y="62" text-anchor="middle" font-family="Shrikhand, Georgia, serif" font-size="34" fill="#C8341E">QE</text></svg>`,
  );

export const seededProducers: Producer[] = [
  {
    address: "GBJDBO3D4OD7KGFEBNIR4H2GFAJEABNX6HP237664RHI66U3M7XV24RA",
    slug: "quinta-exemplo",
    name: "Quinta exemplo",
    location: "Setúbal, Portugal",
    story:
      "A family quinta on the Setúbal Peninsula. We age Moscatel in old oak casks and fill a few for Fermentos holders every harvest.",
    kinds: ["fortified", "wine"],
    website: "quinta-exemplo.pt",
    since: 2024,
    tier: "certified",
    logo: quintaLogo,
    certification: {
      id: "seed-quinta",
      status: "approved",
      legalName: "Quinta Exemplo, Lda.",
      country: "Portugal",
      website: "quinta-exemplo.pt",
      submittedAt: "2026-09-01T00:00:00.000Z",
      reviewedAt: "2026-09-04T00:00:00.000Z",
    },
  },
  {
    address: "",
    slug: "queijaria-exemplo",
    name: "Queijaria exemplo",
    location: "Serra da Estrela, Portugal",
    story:
      "Raw ewe's milk, thistle flower and a cool stone cellar. Two of us, forty wheels a season.",
    kinds: ["cheese"],
    since: 2025,
    tier: "amateur",
  },
];

export const findSeededProducer = (key: string | undefined) =>
  seededProducers.find((p) => p.slug === key || (key && p.address === key));

/** Two-letter monogram for producers without a logo. */
export const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
