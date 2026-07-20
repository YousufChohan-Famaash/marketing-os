import type { SVGProps } from 'react';

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

function PracticeBase({ size = 22, children, ...rest }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke="var(--practice-accent)"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CarIcon = (p: Props) => (
  <PracticeBase {...p}>
    <path d="M17.4193 15.5837H19.2526C19.8026 15.5837 20.1693 15.217 20.1693 14.667V11.917C20.1693 11.092 19.5276 10.3587 18.7943 10.1753C17.1443 9.71699 14.6693 9.16699 14.6693 9.16699C14.6693 9.16699 13.4776 7.88366 12.6526 7.05866C12.1943 6.69199 11.6443 6.41699 11.0026 6.41699H4.58594C4.03594 6.41699 3.5776 6.78366 3.3026 7.24199L2.01927 9.90033C1.89789 10.2544 1.83594 10.6261 1.83594 11.0003V14.667C1.83594 15.217 2.2026 15.5837 2.7526 15.5837H4.58594" />
    <path d="M6.41927 17.4167C7.43179 17.4167 8.2526 16.5959 8.2526 15.5833C8.2526 14.5708 7.43179 13.75 6.41927 13.75C5.40675 13.75 4.58594 14.5708 4.58594 15.5833C4.58594 16.5959 5.40675 17.4167 6.41927 17.4167Z" />
    <path d="M8.25 15.583H13.75" />
    <path d="M15.5833 17.4167C16.5959 17.4167 17.4167 16.5959 17.4167 15.5833C17.4167 14.5708 16.5959 13.75 15.5833 13.75C14.5708 13.75 13.75 14.5708 13.75 15.5833C13.75 16.5959 14.5708 17.4167 15.5833 17.4167Z" />
  </PracticeBase>
);

export const TruckIcon = (p: Props) => (
  <PracticeBase {...p}>
    <path d="M12.6047 15.7989V6.20202C12.6047 5.77781 12.4362 5.37098 12.1362 5.07102C11.8363 4.77106 11.4294 4.60254 11.0052 4.60254H4.60729C4.18308 4.60254 3.77625 4.77106 3.47629 5.07102C3.17633 5.37098 3.00781 5.77781 3.00781 6.20202V14.9992C3.00781 15.2113 3.09207 15.4147 3.24205 15.5647C3.39203 15.7146 3.59545 15.7989 3.80755 15.7989H5.40703" />
    <path d="M13.4 15.7988H8.60156" />
    <path d="M16.6003 15.7982H18.1997C18.4118 15.7982 18.6153 15.7139 18.7652 15.5639C18.9152 15.414 18.9995 15.2105 18.9995 14.9984V12.0794C18.9992 11.8979 18.9371 11.7219 18.8235 11.5804L16.0404 8.10148C15.9656 8.00782 15.8708 7.93216 15.7628 7.88011C15.6548 7.82806 15.5365 7.80095 15.4166 7.80078H12.6016" />
    <path d="M14.9979 17.3982C15.8813 17.3982 16.5974 16.6821 16.5974 15.7987C16.5974 14.9153 15.8813 14.1992 14.9979 14.1992C14.1145 14.1992 13.3984 14.9153 13.3984 15.7987C13.3984 16.6821 14.1145 17.3982 14.9979 17.3982Z" />
    <path d="M7.00573 17.3982C7.8891 17.3982 8.60521 16.6821 8.60521 15.7987C8.60521 14.9153 7.8891 14.1992 7.00573 14.1992C6.12236 14.1992 5.40625 14.9153 5.40625 15.7987C5.40625 16.6821 6.12236 17.3982 7.00573 17.3982Z" />
  </PracticeBase>
);

export const PremisesIcon = (p: Props) => (
  <PracticeBase {...p}>
    <path d="M12.9193 18.5898V11.8121C12.9193 11.5874 12.83 11.3719 12.6711 11.213C12.5122 11.0541 12.2967 10.9648 12.072 10.9648H8.68316C8.45846 10.9648 8.24297 11.0541 8.08408 11.213C7.9252 11.3719 7.83594 11.5874 7.83594 11.8121V18.5898" />
    <path d="M2.75 9.2705C2.74994 9.02402 2.80366 8.78049 2.9074 8.5569C3.01115 8.33331 3.16243 8.13505 3.35068 7.97595L9.28124 2.89346C9.58707 2.63498 9.97457 2.49316 10.375 2.49316C10.7754 2.49316 11.1629 2.63498 11.4688 2.89346L17.3993 7.97595C17.5876 8.13505 17.7389 8.33331 17.8426 8.5569C17.9463 8.78049 18.0001 9.02402 18 9.2705V16.8955C18 17.3449 17.8215 17.7759 17.5037 18.0937C17.1859 18.4114 16.7549 18.5899 16.3056 18.5899H4.44444C3.99505 18.5899 3.56406 18.4114 3.24629 18.0937C2.92852 17.7759 2.75 17.3449 2.75 16.8955V9.2705Z" />
  </PracticeBase>
);

export const BusIcon = (p: Props) => (
  <PracticeBase {...p}>
    <rect x="3.5" y="3.5" width="15" height="11" rx="1.8" />
    <path d="M3.5 9h15" />
    <circle cx="7" cy="16.5" r="1.4" />
    <circle cx="15" cy="16.5" r="1.4" />
  </PracticeBase>
);

export const BoatIcon = (p: Props) => (
  <PracticeBase {...p}>
    <path d="M2.5 14.5h17l-2.4 4H4.9z" />
    <path d="M11 3v11.5" />
    <path d="M11 5l5.5 6.5H11" />
  </PracticeBase>
);

export const DogIcon = (p: Props) => (
  <PracticeBase {...p}>
    <ellipse cx="11" cy="13.5" rx="3.6" ry="2.9" />
    <circle cx="6" cy="9.5" r="1.4" />
    <circle cx="9" cy="7" r="1.4" />
    <circle cx="13" cy="7" r="1.4" />
    <circle cx="16" cy="9.5" r="1.4" />
  </PracticeBase>
);

export const NursingHomeIcon = (p: Props) => (
  <PracticeBase {...p}>
    <path d="M4.5 19V5.5L11 3l6.5 2.5V19" />
    <path d="M2.5 19h17" />
    <path d="M11 7.5v3.5M9.25 9.25h3.5" />
  </PracticeBase>
);

export const ProductIcon = (p: Props) => (
  <PracticeBase {...p}>
    <path d="M11 2.5l7.5 4.2v8.6L11 19.5 3.5 15.3V6.7z" />
    <path d="M3.5 6.7l7.5 4.2 7.5-4.2" />
    <path d="M11 10.9v8.6" />
  </PracticeBase>
);

/** Returns the matching practice icon, or null if the label doesn't map to one. */
export function matchPracticeIcon(label: string, size = 18) {
  const l = label.toLowerCase();
  if (l.includes('truck') || l.includes('commercial')) return <TruckIcon size={size} />;
  if (/\bbus\b/.test(l)) return <BusIcon size={size} />; // regex so "abuse" doesn't match
  if (l.includes('boat') || l.includes('marine') || l.includes('vessel')) return <BoatIcon size={size} />;
  if (l.includes('slip') || l.includes('premises') || l.includes('fall') || l.includes('property'))
    return <PremisesIcon size={size} />;
  if (l.includes('dog') || l.includes('animal') || l.includes('bite')) return <DogIcon size={size} />;
  if (l.includes('nursing') || l.includes('elder')) return <NursingHomeIcon size={size} />;
  if (l.includes('product') || l.includes('defect')) return <ProductIcon size={size} />;
  if (l.includes('car') || l.includes('motor') || l.includes('vehicle') || l.includes('accident'))
    return <CarIcon size={size} />;
  return null;
}

/** Maps a practice-area label to its icon. Falls back to a generic dot. */
export function practiceIconFor(label: string, size = 22) {
  return (
    matchPracticeIcon(label, size) ?? (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: 999,
          border: '2px solid var(--practice-accent)',
        }}
      />
    )
  );
}
