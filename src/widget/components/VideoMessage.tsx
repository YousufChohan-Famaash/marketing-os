import { useRef, useState } from 'react';
import type { Message } from '../types/domain';
import { useT } from '../i18n';
import { PlayIcon } from '../utils/icons';
import { cn } from '../utils/cn';

interface VideoMessageProps {
  message: Message;
}

export function VideoMessage({ message }: VideoMessageProps) {
  const video = message.video;
  const ref = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(false);
  const t = useT();

  if (!video) return null;

  const isIntro = message.type === 'video_intro';

  const handlePlay = () => {
    if (!ref.current) return;
    void ref.current.play();
    setPlayed(true);
  };

  return (
    <div
      className={cn(
        'mx-auto my-2 w-full max-w-[340px] overflow-hidden rounded-lg shadow-sm',
        isIntro ? 'border border-hairline' : '',
      )}
    >
      <div className="relative bg-obsidian">
        <video
          ref={ref}
          src={video.url}
          poster={video.posterUrl}
          controls={played}
          preload="metadata"
          className="block h-auto w-full"
          aria-label={video.caption ?? t('Introduction video')}
        />
        {!played && (
          <button
            type="button"
            onClick={handlePlay}
            aria-label={t('Play introduction video')}
            className="absolute inset-0 flex items-center justify-center bg-obsidian/20 transition-colors hover:bg-obsidian/30"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-famaash shadow-lg">
              <PlayIcon size={26} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      {video.caption && (
        <p className="bg-white px-3 py-2 text-[13px] text-muted">{video.caption}</p>
      )}
    </div>
  );
}
