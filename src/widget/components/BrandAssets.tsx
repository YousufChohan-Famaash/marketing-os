import type { ReactNode, SVGProps } from 'react';

/**
 * Design-specific marks pulled from Figma (file cr6xpQoLmEbkgs2DsSSFbW).
 * Practice icons use the blue accent (#155DFC), distinct from brand purple.
 */

type Props = SVGProps<SVGSVGElement> & { size?: number };

/** Famaash 4-petal pinwheel mark on a soft circle. */
export function FamaashMark({ size = 32, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 58 58"
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="29" cy="29" r="28.57" fill="#F5F8FB" stroke="#fff" strokeWidth="0.87" />
      <path
        d="M38.1999 17.3597C38.9371 17.3578 39.3056 17.3568 39.5341 17.5846C39.7625 17.8124 39.7625 18.1794 39.7625 18.9133V21.9974C39.7625 22.465 39.7625 22.6988 39.6464 22.8866C39.5303 23.0745 39.3212 23.1791 38.903 23.3882L30.8127 27.4333C29.8004 27.9394 29.2942 28.1925 28.9247 27.9621C28.5552 27.7317 28.5597 27.1663 28.5686 26.0354C28.6334 17.8199 29.3889 17.3829 38.1999 17.3597Z"
        fill="#534FEB"
      />
      <path
        d="M28.5638 30.1202C28.5619 29.3831 28.5609 29.0145 28.7887 28.7861C29.0166 28.5576 29.3835 28.5576 30.1174 28.5576L33.2015 28.5576C33.6691 28.5576 33.9029 28.5576 34.0907 28.6737C34.2786 28.7898 34.3832 28.9989 34.5923 29.4171L38.6374 37.5074C39.1435 38.5197 39.3966 39.0259 39.1662 39.3954C38.9358 39.7649 38.3704 39.7605 37.2395 39.7515C29.024 39.6868 28.5871 38.9312 28.5638 30.1202Z"
        fill="#534FEB"
      />
      <path
        d="M18.9258 39.7563C18.1887 39.7583 17.8201 39.7592 17.5917 39.5314C17.3633 39.3036 17.3633 38.9366 17.3633 38.2027L17.3633 35.1186C17.3633 34.651 17.3633 34.4172 17.4794 34.2294C17.5955 34.0415 17.8046 33.937 18.2228 33.7279L26.313 29.6827C27.3254 29.1766 27.8315 28.9235 28.2011 29.1539C28.5706 29.3843 28.5661 29.9497 28.5572 31.0806C28.4924 39.2961 27.7369 39.7331 18.9258 39.7563Z"
        fill="#534FEB"
      />
      <path
        d="M28.562 26.9958C28.5639 27.733 28.5649 28.1015 28.3371 28.33C28.1092 28.5584 27.7423 28.5584 27.0084 28.5584H23.9242C23.4567 28.5584 23.2229 28.5584 23.035 28.4423C22.8472 28.3262 22.7426 28.1171 22.5335 27.6989L18.4884 19.6086C17.9822 18.5963 17.7292 18.0901 17.9595 17.7206C18.1899 17.3511 18.7554 17.3556 19.8863 17.3645C28.1017 17.4293 28.5387 18.1848 28.562 26.9958Z"
        fill="#534FEB"
      />
    </svg>
  );
}

/**
 * Accident / case-type glyphs, mirrored exactly from the Free Consultation flow
 * (FreeConsultationApp/src/consultation/icons.tsx) so the same matter shows the
 * identical icon in both surfaces. Stroke-based on a 24-unit viewBox, tinted by
 * --practice-accent.
 */
function Glyph({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--practice-accent)"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ACCIDENT_GLYPHS: Record<string, ReactNode> = {
  truck: (
    <>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M15 8h4l3 4v5h-3" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
  car: (
    <>
      <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
      <path d="M4 13h16v4H4z" />
      <circle cx="7.5" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </>
  ),
  rideshare: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 10h.01M15 10h.01" />
    </>
  ),
  motorcycle: (
    <>
      <circle cx="5.5" cy="16.5" r="3" />
      <circle cx="18.5" cy="16.5" r="3" />
      <path d="M5.5 16.5h6l3-5h4M14 8h3M8.5 16.5l3-5" />
    </>
  ),
  pedestrian: (
    <>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M12 7v6M12 9l-3 2M12 9l3 2M12 13l-2.5 6M12 13l2.5 6" />
    </>
  ),
  workplace: (
    <>
      <path d="M14.5 6.5a3.5 3.5 0 0 0-4.9 4.9l-6 6L6 20l6-6a3.5 3.5 0 0 0 4.9-4.9l-2.2 2.2-2-2 2.2-2.2z" />
    </>
  ),
  slip: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-9.2-9A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 9.2 5C19 15.4 12 20 12 20z" />,
  medical: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M4 10h16" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </>
  ),
  boat: (
    <>
      <path d="M3 16h18l-2.5 4H5.5z" />
      <path d="M12 3v13" />
      <path d="M12 5l6 7H12" />
    </>
  ),
  premises: (
    <>
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  dog: (
    <>
      <ellipse cx="12" cy="15" rx="4" ry="3.2" />
      <circle cx="6.5" cy="10.5" r="1.6" />
      <circle cx="10" cy="7.5" r="1.6" />
      <circle cx="14" cy="7.5" r="1.6" />
      <circle cx="17.5" cy="10.5" r="1.6" />
    </>
  ),
  nursinghome: (
    <>
      <path d="M5 21V6l7-3 7 3v15" />
      <path d="M3 21h18" />
      <path d="M12 8.5v4M10 10.5h4" />
    </>
  ),
  product: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
};

/**
 * Map a case-type label to a glyph key, or null when nothing specific matches.
 * Mirrors FreeConsultationApp's `accidentIcon` resolver, including order (bus
 * before car, nursing home before medical, premises before slip).
 */
function accidentKey(label: string): keyof typeof ACCIDENT_GLYPHS | null {
  const s = label.toLowerCase();
  if (/truck|semi|18|commercial/.test(s)) return 'truck';
  if (/\bbus\b/.test(s)) return 'bus';
  if (/boat|marine|watercraft|vessel|maritime/.test(s)) return 'boat';
  if (/rideshare|uber|lyft/.test(s)) return 'rideshare';
  if (/car|auto|motor vehicle|mva|vehicle/.test(s)) return 'car';
  if (/motorcycle|bike\b|moto/.test(s)) return 'motorcycle';
  if (/pedestrian|bicycle|bike|walk/.test(s)) return 'pedestrian';
  if (/dog|animal|\bbite\b/.test(s)) return 'dog';
  if (/work|construction|job|labor/.test(s)) return 'workplace';
  if (/nursing|elder|assisted living/.test(s)) return 'nursinghome';
  if (/premises|property/.test(s)) return 'premises';
  if (/slip|trip|fall/.test(s)) return 'slip';
  if (/product|defect/.test(s)) return 'product';
  if (/medical|malpractice|doctor|hospital|negligen/.test(s)) return 'medical';
  if (/wrongful|death|fatal/.test(s)) return 'heart';
  return null;
}

/**
 * Returns the case-type glyph for a label, or null if it doesn't map to one.
 * Used inline in chat bubbles, so a plain free-text message gets no icon.
 */
export function matchPracticeIcon(label: string, size = 18) {
  const key = accidentKey(label);
  return key ? <Glyph size={size}>{ACCIDENT_GLYPHS[key]}</Glyph> : null;
}

/**
 * Practice-picker pill icon: always renders a glyph, falling back to the neutral
 * "dots" mark (same as Free Consultation) rather than an empty accent ring.
 */
export function practiceIconFor(label: string, size = 22) {
  return <Glyph size={size}>{ACCIDENT_GLYPHS[accidentKey(label) ?? 'dots']}</Glyph>;
}
