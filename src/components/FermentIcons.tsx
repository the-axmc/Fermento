import React from "react";
import type { Kind } from "../data/batches";

/* Flat, outlined pictograms for the ferment picker and market tiles. */

const INK = "#2B1B3D";
const stroke = {
  stroke: INK,
  strokeWidth: 2.4,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;
const line = { fill: "none", ...stroke } as const;

const Icon: React.FC<{ kind: Kind; size?: number }> = ({ kind, size = 52 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    "aria-hidden": true as const,
  };
  switch (kind) {
    case "kombucha":
      return (
        <svg {...common}>
          <rect
            x="14"
            y="12"
            width="20"
            height="30"
            rx="4"
            fill="#C8341E"
            {...stroke}
          />
          <rect
            x="16"
            y="6"
            width="16"
            height="7"
            rx="2"
            fill="#F5B82E"
            {...stroke}
          />
          <circle cx="24" cy="30" r="5" fill="#FFF4E2" {...stroke} />
        </svg>
      );
    case "kefir":
      return (
        <svg {...common}>
          <path d="M19 6h10v8l5 6v22H14V20l5-6z" fill="#FFF4E2" {...stroke} />
          <rect
            x="18"
            y="4"
            width="12"
            height="4"
            rx="1.5"
            fill="#F7A8C8"
            {...stroke}
          />
          <rect
            x="17"
            y="24"
            width="14"
            height="10"
            rx="2"
            fill="#F7A8C8"
            {...stroke}
          />
        </svg>
      );
    case "cider":
      return (
        <svg {...common}>
          <path
            d="M24 14c-7-5-15 0-14 9 1 10 7 17 14 17s13-7 14-17c1-9-7-14-14-9z"
            fill="#C8341E"
            {...stroke}
          />
          <path d="M24 14V8" {...line} />
          <path d="M24 9c3-4 8-4 9-1-3 3-7 3-9 1z" fill="#157A78" {...stroke} />
        </svg>
      );
    case "mead":
      return (
        <svg {...common}>
          <path
            d="M14 18c0-4 4-6 10-6s10 2 10 6v14c0 6-4 10-10 10s-10-4-10-10z"
            fill="#F5B82E"
            {...stroke}
          />
          <path d="M16 12V8h16v4" {...line} />
          <path d="M30 6l6 10" {...line} />
          <path d="M16 26h16M16 32h16" {...line} />
        </svg>
      );
    case "wine":
      return (
        <svg {...common}>
          <path
            d="M20 6h8v10c0 3 5 5 5 10v14c0 2-1 3-3 3H18c-2 0-3-1-3-3V26c0-5 5-7 5-10z"
            fill="#2B1B3D"
            {...stroke}
          />
          <rect
            x="19"
            y="4"
            width="10"
            height="5"
            rx="1.5"
            fill="#F5B82E"
            {...stroke}
          />
          <rect
            x="18"
            y="26"
            width="12"
            height="10"
            rx="2"
            fill="#FFF4E2"
            {...stroke}
          />
        </svg>
      );
    case "fortified":
      return (
        <svg {...common}>
          <path
            d="M20 6h8v10c0 3 5 5 5 10v14c0 2-1 3-3 3H18c-2 0-3-1-3-3V26c0-5 5-7 5-10z"
            fill="#7A1B2B"
            {...stroke}
          />
          <rect
            x="19"
            y="4"
            width="10"
            height="5"
            rx="1.5"
            fill="#F5B82E"
            {...stroke}
          />
          <rect
            x="18"
            y="26"
            width="12"
            height="10"
            rx="2"
            fill="#FFF4E2"
            {...stroke}
          />
          <text
            x="24"
            y="33.5"
            textAnchor="middle"
            fontFamily="'Shrikhand', Georgia, serif"
            fontSize="6"
            fill="#C8341E"
          >
            N&amp;R
          </text>
        </svg>
      );
    case "vinegar":
      return (
        <svg {...common}>
          <path
            d="M21 6h6v12c6 2 9 7 9 13 0 7-5 11-12 11S12 38 12 31c0-6 3-11 9-13z"
            fill="#FFF4E2"
            {...stroke}
          />
          <path d="M14 30c2 6 6 9 10 9s8-3 10-9z" fill="#8A4F28" {...stroke} />
          <rect
            x="20"
            y="4"
            width="8"
            height="4"
            rx="1.5"
            fill="#2B1B3D"
            {...stroke}
          />
        </svg>
      );
    case "kimchi":
      return (
        <svg {...common}>
          <path
            d="M13 14h22v22c0 4-3 6-6 6H19c-3 0-6-2-6-6z"
            fill="#8A4F28"
            {...stroke}
          />
          <rect
            x="11"
            y="9"
            width="26"
            height="6"
            rx="2"
            fill="#2B1B3D"
            {...stroke}
          />
          <path
            d="M18 22c3-2 9-2 12 0M18 28c3-2 9-2 12 0"
            stroke="#F7A8C8"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "cheese":
      return (
        <svg {...common}>
          <path d="M6 30l36-14v18H6z" fill="#F5B82E" {...stroke} />
          <path d="M6 30c0-4 36-18 36-14" {...line} />
          <circle cx="18" cy="29" r="2.5" fill="#FFF4E2" {...stroke} />
          <circle cx="30" cy="26" r="2" fill="#FFF4E2" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect
            x="14"
            y="12"
            width="20"
            height="30"
            rx="4"
            fill="#FFF4E2"
            {...stroke}
          />
          <rect
            x="16"
            y="6"
            width="16"
            height="7"
            rx="2"
            fill="#F5B82E"
            {...stroke}
          />
          <text
            x="24"
            y="33"
            textAnchor="middle"
            fontFamily="'Bricolage Grotesque', sans-serif"
            fontWeight="800"
            fontSize="16"
            fill="#C8341E"
          >
            ?
          </text>
        </svg>
      );
  }
};

export default Icon;
