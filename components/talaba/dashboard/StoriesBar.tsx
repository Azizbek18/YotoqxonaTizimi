'use client';

import type { Story } from '@/features/stories/types';

type Props = {
  isLight: boolean;
  stories: Story[];
  isSeen: (id: string) => boolean;
  onOpen: (index: number) => void;
};

// Fixed pixel geometry, set inline so no missing/overridden utility can blow
// the thumbnail up (which is what broke earlier versions on phones).
const CARD_W = 76;
const IMG_H = 100;

const RING_ACTIVE = 'linear-gradient(145deg,#f43f5e 0%,#d946ef 45%,#fb923c 100%)';

/**
 * Instagram-style story tray that sits directly under the dashboard header:
 * a horizontal strip of rounded-rectangle thumbnails. Unwatched stories get a
 * bright gradient frame, watched ones a muted one. Renders nothing when there
 * are no active stories.
 */
export default function StoriesBar({ isLight, stories, isSeen, onOpen }: Props) {
  if (stories.length === 0) return null;

  const ringSeen = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.16)';
  const innerBg = isLight ? '#ffffff' : '#0b1120';
  const titleActive = isLight ? '#0f172a' : '#f1f5f9';
  const titleSeen = isLight ? '#94a3b8' : '#64748b';
  const labelColor = isLight ? '#64748b' : '#94a3b8';

  return (
    <section
      aria-label="Yangiliklar"
      className="-mt-3 border-b pb-4 sm:mt-0 sm:pb-5"
      style={{ borderColor: isLight ? 'rgba(226,232,240,0.9)' : 'rgba(255,255,255,0.1)' }}
    >
      <h2
        className="mb-2.5 text-[10px] font-black uppercase tracking-[0.2em]"
        style={{ color: labelColor }}
      >
        Yangiliklar
      </h2>

      <div
        className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {stories.map((story, index) => {
          const seen = isSeen(story.id);
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpen(index)}
              className="group flex shrink-0 flex-col items-stretch gap-1.5 no-shelf"
              style={{ width: CARD_W, WebkitTapHighlightColor: 'transparent', outline: 'none' }}
            >
              <span
                className="block rounded-[16px] transition-transform duration-150 group-active:scale-95"
                style={{ padding: 2.5, background: seen ? ringSeen : RING_ACTIVE }}
              >
                <span
                  className="block overflow-hidden rounded-[13px]"
                  style={{ padding: 2, background: innerBg }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="block rounded-[10px]"
                    style={{ width: '100%', height: IMG_H, objectFit: 'cover' }}
                  />
                </span>
              </span>

              <span
                className="w-full text-center text-[10px] font-semibold leading-[1.2]"
                style={{
                  color: seen ? titleSeen : titleActive,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {story.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
