'use client';

import { Sparkles } from 'lucide-react';
import { dashboardTheme } from './theme';
import type { Story } from '@/features/stories/types';

type Props = {
  isLight: boolean;
  stories: Story[];
  isSeen: (id: string) => boolean;
  onOpen: (index: number) => void;
};

/**
 * Instagram-style strip of circular story thumbnails at the top of the
 * dashboard. Unwatched stories get a bright gradient ring; watched ones a
 * muted one. Renders nothing when there are no active stories.
 */
export default function StoriesBar({ isLight, stories, isSeen, onOpen }: Props) {
  const t = dashboardTheme(isLight);
  if (stories.length === 0) return null;

  return (
    <div className={`rounded-3xl sm:rounded-[32px] border p-4 sm:p-5 ${t.surfaceBg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className={isLight ? 'text-fuchsia-500' : 'text-fuchsia-400'} />
        <h3 className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${t.textStrong}`}>
          Yangiliklar
        </h3>
      </div>

      <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {stories.map((story, index) => {
          const seen = isSeen(story.id);
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpen(index)}
              className="group flex shrink-0 flex-col items-center gap-1.5 w-[76px] focus:outline-none"
            >
              <span
                className={`rounded-full p-[3px] transition-transform duration-200 group-active:scale-95 ${
                  seen ? (isLight ? 'bg-slate-200' : 'bg-white/15') : ''
                }`}
                style={
                  seen
                    ? undefined
                    : { background: 'conic-gradient(from 140deg, #f43f5e, #d946ef, #f59e0b, #f43f5e)' }
                }
              >
                <span className={`block rounded-full p-[2px] ${isLight ? 'bg-white' : 'bg-[#0f172a]'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.image_url}
                    alt=""
                    loading="lazy"
                    className="size-14 rounded-full object-cover"
                  />
                </span>
              </span>
              <span
                className={`w-full truncate text-center text-[10px] font-semibold leading-tight ${
                  seen ? t.textMuted : t.textStrong
                }`}
                title={story.title}
              >
                {story.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
