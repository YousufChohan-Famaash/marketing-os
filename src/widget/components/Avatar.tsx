import { useState } from 'react';
import { cn } from '../utils/cn';

interface AvatarProps {
  /** Headshot/photo URL. Falls back to initials, then a person glyph. */
  src?: string;
  /** Used for initials and as the alt text. */
  name?: string;
  /** Pixel diameter. */
  size?: number;
  /**
   * What to show when there's no photo (or it fails to load):
   *   'initials' (default) — initials, then a neutral person glyph
   *   'none' — render nothing (used for the lead, who only gets an avatar
   *            when a real Gravatar exists)
   */
  fallback?: 'initials' | 'none';
  className?: string;
}

function initials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Round chat avatar. Renders the photo when given, gracefully falling back to
 * the name's initials, then a neutral person glyph — so it always shows a
 * "face" even before the firm configures an assistant photo.
 */
export function Avatar({ src, name, size = 28, fallback = 'initials', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };
  const showImg = Boolean(src) && !failed;
  const text = initials(name);

  // 'none' fallback: only ever a photo — nothing while loading or on failure.
  if (fallback === 'none' && !showImg) return null;

  // No photo → a confident brand "orb" (the firm's colour, white monogram),
  // not a faint 10%-opacity letter. The firm can upload a real avatar/monogram
  // (assistantAvatarUrl) to replace it; this is the fallback.
  const orb = fallback !== 'none';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
        orb ? 'bg-famaash text-white' : 'bg-transparent text-famaash',
        className,
      )}
      style={dim}
      aria-hidden="true"
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          style={dim}
          onError={() => setFailed(true)}
        />
      ) : text ? (
        <span className="font-bold leading-none" style={{ fontSize: Math.round(size * 0.4) }}>{text}</span>
      ) : (
        <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6Z" />
        </svg>
      )}
    </span>
  );
}
