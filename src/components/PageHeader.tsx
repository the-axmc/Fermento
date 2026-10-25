import React from "react";
import { Link } from "react-router-dom";
import { DISPLAY, INK, RED } from "../lib/theme";

/** Back chevron, the two-line wordmark and an optional action on the right. */
const PageHeader: React.FC<{
  back: string;
  backLabel?: string;
  right?: React.ReactNode;
  color?: string;
  title?: React.ReactNode;
}> = ({ back, backLabel = "Back", right, color = INK, title }) => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      minHeight: 44,
    }}
  >
    <Link
      to={back}
      aria-label={backLabel}
      style={{
        width: 44,
        height: 44,
        marginLeft: -12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        flexShrink: 0,
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
    <div
      style={{
        flex: 1,
        textAlign: "center",
        fontFamily: DISPLAY,
        fontSize: 20,
        lineHeight: 1,
        color: RED,
      }}
    >
      {title ?? (
        <>
          Fermentos
          <br />
          Norberto <span style={{ color }}>&amp;</span> Raimunda
        </>
      )}
    </div>
    <div
      style={{
        width: 44,
        height: 44,
        marginRight: -12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {right}
    </div>
  </div>
);

export default PageHeader;
