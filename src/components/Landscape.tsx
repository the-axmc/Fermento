import React from "react";

/**
 * Hills, cypresses and a farmhouse that close the bottom of a page frame.
 * The wrapper grows to fill whatever height the page leaves free (see
 * `.landscape` in index.css); the drawing stays anchored at the bottom and is
 * cropped from the top when the page is tall.
 */
const Landscape: React.FC = () => (
  <div className="landscape" aria-hidden="true">
    <svg viewBox="0 0 390 260">
      <g fill="#FFF4E2" opacity="0.85">
        <path d="M40 60 q12 -14 26 -4 q12 -8 20 4 q10 0 8 8 h-62 q-4 -8 8 -8z" />
        <path d="M210 34 q9 -10 20 -3 q9 -6 15 3 q8 0 6 6 h-47 q-3 -6 6 -6z" />
      </g>
      <path
        d="M0 150 C60 108 120 104 190 130 C250 152 300 120 390 112 L390 260 L0 260 Z"
        fill="#F5B82E"
      />
      <g fill="none" stroke="#E0951F" strokeWidth="2.5" strokeLinecap="round">
        <path d="M20 152 C70 122 120 118 180 140" />
        <path d="M30 166 C80 138 130 134 190 156" />
        <path d="M210 150 C260 160 310 136 380 128" />
        <path d="M214 166 C264 176 314 152 384 144" />
      </g>
      <path
        d="M0 192 C70 160 150 166 220 186 C290 206 340 178 390 170 L390 260 L0 260 Z"
        fill="#7CC36B"
      />
      <g fill="#5BA650">
        <circle cx="40" cy="196" r="3" />
        <circle cx="64" cy="190" r="3" />
        <circle cx="88" cy="186" r="3" />
        <circle cx="112" cy="185" r="3" />
        <circle cx="136" cy="186" r="3" />
        <circle cx="50" cy="210" r="3" />
        <circle cx="76" cy="204" r="3" />
        <circle cx="102" cy="200" r="3" />
        <circle cx="128" cy="200" r="3" />
        <circle cx="154" cy="203" r="3" />
      </g>
      <g fill="#1F5E3A">
        <path d="M262 192 C256 170 260 150 266 136 C272 150 276 170 270 192 Z" />
        <path d="M282 186 C277 168 280 152 285 140 C290 152 293 168 288 186 Z" />
        <path d="M352 176 C347 158 350 142 355 130 C360 142 363 158 358 176 Z" />
      </g>
      <g>
        <rect x="300" y="166" width="34" height="22" fill="#FFF4E2" />
        <path d="M296 168 L317 152 L338 168 Z" fill="#C8341E" />
        <rect x="313" y="176" width="8" height="12" fill="#2B1B3D" />
      </g>
      <path
        d="M0 226 C80 204 170 212 250 228 C310 240 350 226 390 218 L390 260 L0 260 Z"
        fill="#2E8B57"
      />
      <g fill="none" stroke="#24744A" strokeWidth="3" strokeLinecap="round">
        <path d="M20 240 C90 224 170 230 240 244" />
        <path d="M260 246 C300 252 340 242 380 236" />
      </g>
      <g transform="translate(70 206)">
        <path
          d="M4 0 C0 9 0 23 4 32 L28 32 C32 23 32 9 28 0 Z"
          fill="#B8733E"
          stroke="#2B1B3D"
          strokeWidth="2"
        />
        <g fill="none" stroke="#2B1B3D" strokeWidth="3">
          <path d="M2 8 Q16 11 30 8" />
          <path d="M2 24 Q16 27 30 24" />
        </g>
        <ellipse
          cx="16"
          cy="0"
          rx="12"
          ry="3"
          fill="#D99358"
          stroke="#2B1B3D"
          strokeWidth="2"
        />
      </g>
    </svg>
  </div>
);

export default Landscape;
