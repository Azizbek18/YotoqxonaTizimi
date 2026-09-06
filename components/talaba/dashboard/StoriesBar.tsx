'use client';

import { dashboardTheme } from './theme';
import type { Story } from '@/features/stories/types';

type Props = {
  isLight: boolean;
  stories: Story[];
  isSeen: (id: string) => boolean;
  onOpen: (index: number) => void;
};

// Fixed pixel geometry — set inline so a missing/overridden utility can never
// blow the thumbnail up (which is what broke the first version on phones).
const CARD_W = 74;
const CARD_H = 104;

/**
 * Instagram-style story tray that sits directly under the dashboard header:
 * a horizontal strip of rounded-rectangle thumbnails. Unwatched stories get a
 * bright gradient frame, watched ones a muted one. Renders nothing when there
 * are no active stories.
 */
export default function StoriesBar({ isLight, stories, isSeen, onOpen }: Props) {
  const t = dashboardTheme(isLight);
  if (stories.length === 0) return null;

  return (
    <section
      aria-label="Yangiliklar"
      className={`-mt-3 border-b pb-4 sm:mt-0 sm:pb-5 ${isLight ? 'border-slate-200/70' : 'border-white/10'}`}
    >
      <h2 className={`mb-2.5 text-[10px] font-black uppercase tracking-[0.2em] ${t.textMuted}`}>
        Yangiliklar
      </h2>

      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 no-scrollbar [-webkit-overflow-scrolling:touch]">
        {stories.map((story, index) => {
          const seen = isSeen(story.id);
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpen(index)}
              className="group flex shrink-0 flex-col items-stretch gap-1.5 focus:outline-none"
              style={{ width: CARD_W }}
            >
              {/* gradient / muted frame */}
              <span
                className="block rounded-2xl p-[2.5px] transition-transform duration-150 group-active:scale-95"
                style={{
                  background: seen
                    ? isLight
                      ? '#e2e8f0'
                      : 'rgba(255,255,255,0.14)'
                    : 'linear-gradient(140deg,#f43f5e 0%,#d946ef 48%,#f59e0b 100%)',
                }}
              >
                <span
                  className={`block overflow-hidden rounded-[13px] p-[2px] ${isLight ? 'bg-white' : 'bg-[#0b1120]'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="block w-full rounded-[10px] object-cover"
                    style={{ height: CARD_H, width: '100%' }}
                  />
                </span>
              </span>

              <span
                className={`line-clamp-2 w-full text-center text-[9.5px] font-semibold leading-[1.2] ${
                  seen ? t.textMuted : t.textStrong
                }`}
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
