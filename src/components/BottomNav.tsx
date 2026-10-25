import React from "react";
import { Link, useLocation } from "react-router-dom";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const RED = "#C8341E";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";

/* ---------------------------------- Items ---------------------------------- */

interface Item {
  to: string;
  label: string;
  /** Path prefixes that mark this item as the current page */
  match: string[];
  icon: React.ReactNode;
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const items: Item[] = [
  {
    to: "/market",
    label: "Market",
    match: ["/market", "/batch", "/cask"],
    icon: (
      <svg {...iconProps}>
        <path d="M3.5 9.5 5 4h14l1.5 5.5" />
        <path d="M3.5 9.5a2.8 2.8 0 0 0 5.67 0 2.8 2.8 0 0 0 5.66 0 2.8 2.8 0 0 0 5.67 0" />
        <path d="M5 12v8h14v-8" />
        <path d="M10 20v-4.5h4V20" />
      </svg>
    ),
  },
  {
    to: "/portfolio",
    label: "Portfolio",
    match: ["/portfolio", "/producer", "/certify"],
    icon: (
      <svg {...iconProps}>
        <path d="M7 3h10c1.6 3 1.6 15 0 18H7C5.4 18 5.4 6 7 3z" />
        <path d="M5.9 8.5h12.2M5.9 15.5h12.2" />
      </svg>
    ),
  },
  {
    to: "/produce",
    label: "Add ferment",
    match: ["/produce"],
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    to: "/wallet",
    label: "Wallet",
    match: ["/wallet"],
    icon: (
      <svg {...iconProps} strokeWidth={2.2}>
        <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0-2 2" />
        <path d="M3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1" />
        <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
];

/* --------------------------------- Component ------------------------------- */

/** Floating tab bar fixed to the bottom of the viewport. Rendered once by the app shell. */
const BottomNav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(100% - 32px, var(--frame) - 32px)",
        bottom: "var(--nav-bottom)",
        height: 64,
        boxSizing: "border-box",
        padding: "0 10px",
        borderRadius: 32,
        background: "rgba(255, 244, 226, 0.62)",
        backdropFilter: "blur(14px) saturate(1.4)",
        WebkitBackdropFilter: "blur(14px) saturate(1.4)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "0 10px 30px rgba(43, 27, 61, 0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 20,
      }}
    >
      {items.map((item) => {
        const current = item.match.some((m) => pathname.startsWith(m));
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={current ? "page" : undefined}
            style={{
              minWidth: 64,
              height: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: current ? RED : INK,
              fontFamily: SANS,
              textDecoration: "none",
            }}
          >
            {item.icon}
            <span
              style={{
                fontSize: 10,
                fontWeight: current ? 800 : 700,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
