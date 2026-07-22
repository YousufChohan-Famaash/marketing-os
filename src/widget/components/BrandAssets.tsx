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
function Glyph({
  size = 18,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
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
  heart: <path d="M12 20s-7-4.6-9.2-9A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 9.2 5C19 15.4 12 20 12 20z" />,
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
  // Motorcycle before car and with specific tokens, so "Motor Vehicle" still
  // lands on car (not motorcycle) and "Motorcycle" never falls back to a car.
  if (/motorcycle|motorbike|moped/.test(s)) return 'motorcycle';
  if (/car|auto|motor vehicle|mva|vehicle/.test(s)) return 'car';
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

// --- Exact case-type icons from the James Vasquez landing-page Figma, tinted
// --- via currentColor. Their native viewBoxes are kept, so paths aren't rescaled.

function WorkplaceGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 27 27" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22.5 24.75V21.375C22.5 18.193 22.5 16.602 21.5115 15.6135C20.523 14.625 18.932 14.625 15.75 14.625H11.25C8.06802 14.625 6.47703 14.625 5.48851 15.6135C4.5 16.602 4.5 18.193 4.5 21.375C4.5 22.4234 4.5 22.9476 4.67127 23.361C4.89963 23.9124 5.33765 24.3504 5.88896 24.5787C6.30245 24.75 6.82663 24.75 7.875 24.75" />
      <path d="M10.6875 14.625L14.0625 24.75M7.875 15.1875V24.75" />
      <path d="M13.5 21.375H16.3125C17.2445 21.375 18 22.1305 18 23.0625C18 23.9945 17.2445 24.75 16.3125 24.75H14.0625" />
      <path d="M17.4375 7.3125V6.1875C17.4375 4.01288 15.6746 2.25 13.5 2.25C11.3254 2.25 9.5625 4.01288 9.5625 6.1875V7.3125C9.5625 9.48712 11.3254 11.25 13.5 11.25C15.6746 11.25 17.4375 9.48712 17.4375 7.3125Z" />
    </svg>
  );
}

function MedicalGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 27 27" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.125 8.49046C10.125 6.25454 12.0207 4.045 13.3513 2.76953C14.0739 2.07682 15.1761 2.07682 15.8987 2.76953C17.2293 4.045 19.125 6.25454 19.125 8.49046C19.125 10.6827 17.4209 12.9375 14.625 12.9375C11.8291 12.9375 10.125 10.6827 10.125 8.49046Z" />
      <path d="M4.5 15.75H7.19417C7.52509 15.75 7.85146 15.8246 8.14744 15.9678L10.4447 17.0793C10.7406 17.2225 11.067 17.297 11.3979 17.297H12.5709C13.7053 17.297 14.625 18.187 14.625 19.2847C14.625 19.3291 14.5946 19.3681 14.5505 19.3803L11.692 20.1706C11.1792 20.3124 10.6301 20.263 10.1531 20.0322L7.69737 18.844" />
      <path d="M14.625 18.5625L19.7919 16.975C20.7078 16.6896 21.698 17.028 22.2717 17.8226C22.6866 18.3971 22.5177 19.2197 21.9133 19.5684L13.4582 24.4468C12.9205 24.7571 12.2861 24.8328 11.6945 24.6573L4.5 22.5224" />
    </svg>
  );
}

function BicycleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 27 27" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8124 23.6239C22.987 23.6239 24.7499 21.8611 24.7499 19.6865C24.7499 17.5118 22.987 15.749 20.8124 15.749C18.6378 15.749 16.8749 17.5118 16.8749 19.6865C16.8749 21.8611 18.6378 23.6239 20.8124 23.6239Z" />
      <path d="M6.18759 23.6239C8.3622 23.6239 10.1251 21.8611 10.1251 19.6865C10.1251 17.5118 8.3622 15.749 6.18759 15.749C4.01298 15.749 2.2501 17.5118 2.2501 19.6865C2.2501 21.8611 4.01298 23.6239 6.18759 23.6239Z" />
      <path d="M16.875 6.7497C17.4963 6.7497 18 6.24602 18 5.6247C18 5.00338 17.4963 4.49971 16.875 4.49971C16.2537 4.49971 15.75 5.00338 15.75 5.6247C15.75 6.24602 16.2537 6.7497 16.875 6.7497Z" />
      <path d="M13.5001 19.6869V15.7494L10.1251 12.3744L14.6251 8.99941L16.8751 12.3744H19.1251" />
    </svg>
  );
}

function SlipGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path fill="currentColor" stroke="none" d="M12.4775 3.51758C13.1361 2.43454 14.7027 2.42624 15.3564 3.5127C15.6887 4.06487 15.7022 4.65255 15.374 5.21289C14.8383 6.12781 14.2842 7.03223 13.7354 7.93848C13.4555 8.40056 13.0256 8.63527 12.5166 8.74902C12.2559 8.80736 11.9965 8.87058 11.7373 8.93555L10.958 9.13184C10.9524 9.13325 10.9465 9.13497 10.9395 9.1377C11.1652 9.65144 11.3892 10.1626 11.6182 10.6836C11.7567 10.6404 11.8907 10.5985 12.0244 10.5566C12.8349 10.3026 13.6445 10.0408 14.459 9.7959C14.9918 9.63578 15.5159 9.70066 15.9922 9.98535C16.8842 10.5187 17.7673 11.0675 18.6533 11.6094C18.9379 11.7834 19.2239 11.9569 19.5078 12.1328C20.1537 12.5328 20.4825 13.1186 20.4766 13.874C20.4691 14.814 19.719 15.6265 18.7842 15.7432C18.3069 15.8026 17.8712 15.6976 17.4668 15.4502C16.6091 14.9253 15.7511 14.4005 14.8945 13.874C14.8703 13.8592 14.8534 13.8533 14.8389 13.8516C14.8318 13.8508 14.8238 13.8508 14.8145 13.8525L14.7822 13.8623C14.4891 13.989 14.193 14.1095 13.8857 14.2373C14.0907 14.3517 14.2855 14.4618 14.4814 14.5703C14.7986 14.7459 15.1215 14.9177 15.4375 15.0986C15.841 15.3297 16.126 15.6684 16.293 16.0996C16.7463 17.2701 17.2001 18.4413 17.6475 19.6143C18.0894 20.7727 17.3042 22.0644 16.0723 22.2168C15.1748 22.3277 14.3403 21.8468 14.0049 21.0049C13.6444 20.0993 13.2989 19.1849 12.9434 18.2783C12.9263 18.2349 12.8841 18.1877 12.8447 18.168C11.4606 17.474 10.0742 16.7828 8.6875 16.0938C8.04551 15.7746 7.58075 15.2924 7.2959 14.6328C6.6794 13.2055 6.0578 11.7805 5.43359 10.3564C4.75588 8.8107 5.60309 7.00242 7.22461 6.58105C8.13506 6.34441 9.05402 6.1365 9.9668 5.91602C10.36 5.82089 10.7528 5.72718 11.1436 5.62598C11.1827 5.61578 11.2308 5.58068 11.252 5.5459C11.6638 4.87015 12.066 4.19441 12.4775 3.51758ZM14.291 4.06348C14.159 3.91485 13.9944 3.8589 13.7969 3.90625C13.652 3.94085 13.5565 4.03817 13.4766 4.1709C13.0326 4.90905 12.5875 5.6463 12.1465 6.38574C12.0394 6.56536 11.8924 6.68423 11.6807 6.72656C11.5426 6.75419 11.4093 6.79285 11.2676 6.82715C10.0445 7.12244 8.82173 7.42183 7.59668 7.71094C6.66306 7.93118 6.13049 8.94224 6.50684 9.81836C7.1382 11.2879 7.78124 12.7522 8.4209 14.2188C8.56813 14.556 8.80764 14.8122 9.13477 14.9795C9.68212 15.2594 10.2335 15.5318 10.7842 15.8066C11.7274 16.2771 12.6698 16.7483 13.6143 17.2158C13.7878 17.3017 13.9042 17.4301 13.9727 17.6094C14.2053 18.2201 14.4413 18.8296 14.6768 19.4395C14.8267 19.8275 14.9697 20.216 15.1289 20.5977C15.2672 20.9286 15.624 21.1016 15.9824 21.0244C16.3342 20.9487 16.5881 20.6448 16.5693 20.292C16.5611 20.1358 16.5023 19.9752 16.4414 19.8154C16.0289 18.7334 15.6098 17.655 15.1953 16.5732C15.114 16.3612 14.9823 16.2026 14.7832 16.0977L14.4072 15.8916C13.6885 15.494 12.9693 15.0968 12.251 14.6982C12.1389 14.6361 12.0508 14.5551 11.9941 14.4551C11.9373 14.3546 11.9143 14.2379 11.9268 14.1074C11.95 13.8628 12.0922 13.6989 12.3125 13.6064C13.0732 13.2879 13.8344 12.9702 14.5928 12.6475C14.8285 12.547 15.0472 12.5626 15.2646 12.7002C15.6287 12.9305 15.9978 13.1524 16.3662 13.3779C16.9658 13.7448 17.5572 14.1199 18.1631 14.4717C18.6561 14.7578 19.2833 14.3962 19.2842 13.7227V13.7109C19.2734 13.514 19.137 13.3032 18.8838 13.1484C17.7412 12.4498 16.5986 11.7507 15.458 11.0488C15.219 10.9016 14.9794 10.8736 14.709 10.96C13.6495 11.2988 12.5872 11.6291 11.5264 11.9619C11.3417 12.0198 11.1768 12.0218 11.0361 11.958C10.8954 11.8942 10.7882 11.7686 10.71 11.5908C10.3335 10.7358 9.95742 9.88084 9.58203 9.02539C9.49282 8.82208 9.48638 8.62811 9.56445 8.46875C9.64254 8.30947 9.79986 8.19544 10.0166 8.14062C10.7902 7.94509 11.5642 7.74994 12.3398 7.56152C12.5288 7.51557 12.6589 7.4158 12.7578 7.25C13.2202 6.47491 13.6885 5.70282 14.1533 4.92969C14.2314 4.79978 14.3102 4.67659 14.3701 4.54492C14.449 4.37164 14.4183 4.20678 14.291 4.06348Z" />
      <path fill="currentColor" stroke="none" d="M7.03564 1.07617C8.47519 1.07667 9.52801 2.13014 9.52686 3.56934C9.52559 5.00163 8.46502 6.04578 7.01709 6.04395C5.58291 6.04195 4.536 4.98408 4.5376 3.54004C4.53921 2.1229 5.60215 1.07571 7.03564 1.07617ZM7.03174 2.2666C6.59491 2.26323 6.27401 2.41744 6.06104 2.65332C5.84713 2.8903 5.7377 3.2142 5.73486 3.55566C5.7316 3.94741 5.86261 4.2707 6.08838 4.49609C6.31422 4.72155 6.63955 4.85352 7.03271 4.85352C7.46861 4.85949 7.78941 4.70559 8.00244 4.46973C8.21638 4.2328 8.32637 3.9081 8.32959 3.56543L8.32471 3.42188C8.29905 3.09474 8.1737 2.82382 7.97607 2.62695C7.75015 2.40194 7.42507 2.2697 7.03174 2.2666Z" />
      <path d="M6.28955 19.8359H10.8113" />
      <path d="M3.46338 22.6641L10.246 22.6641" />
      <path d="M20.4199 9.09375V10.7894" />
      <path d="M22.6812 13.5859L24.942 13.6213" />
      <path d="M23.8114 9.66406L22.1157 11.3597" />
    </svg>
  );
}

/** Case types whose glyph is a full JV Figma icon (own viewBox), overriding ACCIDENT_GLYPHS. */
const FIGMA_GLYPHS: Partial<Record<string, (size: number) => ReactNode>> = {
  workplace: (s) => <WorkplaceGlyph size={s} />,
  medical: (s) => <MedicalGlyph size={s} />,
  pedestrian: (s) => <BicycleGlyph size={s} />,
  slip: (s) => <SlipGlyph size={s} />,
};

function renderGlyph(key: string, size: number): ReactNode {
  const figma = FIGMA_GLYPHS[key];
  if (figma) return figma(size);
  return <Glyph size={size}>{ACCIDENT_GLYPHS[key]}</Glyph>;
}

/**
 * Returns the case-type glyph for a label, or null if it doesn't map to one.
 * Colour is inherited (currentColor), so the glyph matches the surrounding text
 * (e.g. a chat bubble). A plain free-text message gets no icon.
 */
export function matchPracticeIcon(label: string, size = 18) {
  const key = accidentKey(label);
  return key ? renderGlyph(key, size) : null;
}

/**
 * Practice-picker pill icon: the correct glyph for a known case type, or null.
 * No filler icon for anything unmapped (a wrong/placeholder icon reads worse
 * than none). Colour is inherited from the caller.
 */
export function practiceIconFor(label: string, size = 22) {
  const key = accidentKey(label);
  return key ? renderGlyph(key, size) : null;
}
