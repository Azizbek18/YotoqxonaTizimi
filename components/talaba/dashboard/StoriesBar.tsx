'use client';

import type { Story } from '@/features/stories/types';

type Props = {
  isLight: boolean;
  stories: Story[];
  isSeen: (id: string) => boolean;
  onOpen: (index: number) => void;
};

// Fixed pixel geometry, set inline so no missing/overridden utility can blow
// the thumbnail up.
const CARD_W = 76;
const IMG_H = 100;

const RING_ACTIVE = 'linear-gradient(145deg,#f43f5e 0%,#d946ef 45%,#fb923c 100%)';

/**
 * Instagram-style story tray that sits at the very top of the student home
 * page (above the quick-action row). A horizontal strip of rounded-rectangle
 * thumbnails; unwatched stories get a bright gradient frame, watched ones a
 * muted one. Renders nothing when there are no active stories.
 *
 * Every story is a <button>, and the talaba layout's `body.talaba-ui` rule
 * force-paints EVERY button with a blue→cyan gradient + shelf shadow
 * (`!important`). `data-student-button="plain"` is the documented opt-out —
 * without it the card gets a cyan wash bleeding through behind the label.
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
      aria-label="Diqqat markazida"
      className="mb-6 sm:mb-8"
      style={{ borderBottom: `1px solid ${isLight ? 'rgba(226,232,240,0.9)' : 'rgba(255,255,255,0.1)'}`, paddingBottom: 16 }}
    >
      <p
        className="mb-2.5 ml-1 text-[9px] font-black uppercase tracking-[0.2em] sm:text-[10px]"
        style={{ color: labelColor }}
      >
        Diqqat markazida
      </p>

      <div
        className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {stories.map((story, index) => {
          const seen = isSeen(story.id);
          return (
            <button
              key={story.id}
              type="button"
              data-student-button="plain"
              onClick={() => onOpen(index)}
              className="group shrink-0 no-shelf"
              style={{
                width: CARD_W,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: 0,
                boxShadow: 'none',
                WebkitTapHighlightColor: 'transparent',
                outline: 'none',
              }}
            >
              {/* gradient / muted frame */}
              <span
                style={{
                  display: 'block',
                  borderRadius: 16,
                  padding: 2.5,
                  background: seen ? ringSeen : RING_ACTIVE,
                }}
              >
                {/* image box: explicit height + overflow hidden — the image can
                    never overflow or be the wrong size regardless of object-fit
                    support or the source aspect ratio. */}
                <span
                  style={{
                    display: 'block',
                    position: 'relative',
                    height: IMG_H,
                    borderRadius: 13,
                    overflow: 'hidden',
                    background: innerBg,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </span>
              </span>

              <span
                style={{
                  color: seen ? titleSeen : titleActive,
                  fontSize: 10,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  textAlign: 'center',
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
