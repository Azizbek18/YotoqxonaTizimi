'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import { formatElonDate } from './helpers';
import type { Story } from '@/features/stories/types';

const DURATION_MS = 7000;

type Props = {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  onSeen: (id: string) => void;
};

// This viewer is deliberately ALWAYS dark (Instagram-style), in both light and
// dark app themes. globals.css light-mode retrofit force-overrides literal
// `text-white` / `bg-black/` / `bg-neutral-*` class strings even inside
// portals, so every colour here is an inline style or an arbitrary hex the
// retrofit's class-string matcher can't touch.
const WHITE = '#ffffff';
const SCRIM_TOP = 'linear-gradient(180deg, rgba(0,0,0,0.62), rgba(0,0,0,0))';
const SCRIM_BOTTOM = 'linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0))';

/**
 * Fullscreen Instagram-style story viewer: a segmented progress bar, 7s per
 * image with auto-advance, tap left/right to navigate, press-and-hold to
 * pause, Escape / swipe-down / ✕ to close.
 */
export default function StoryViewer({ stories, startIndex, onClose, onSeen }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every manual navigation so the timer restarts even when the
  // index doesn't change (tapping "previous" on the first story).
  const [restartNonce, setRestartNonce] = useState(0);

  const pausedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onSeenRef = useRef(onSeen);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onSeenRef.current = onSeen; }, [onSeen]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => setIndex(startIndex), [startIndex]);

  const current = stories[index];

  const goNext = useCallback(() => {
    setRestartNonce((n) => n + 1);
    setIndex((i) => {
      if (i + 1 < stories.length) return i + 1;
      onCloseRef.current();
      return i;
    });
  }, [stories.length]);

  const goPrev = useCallback(() => {
    setRestartNonce((n) => n + 1);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Mark the story watched as soon as it's on screen.
  useEffect(() => {
    if (current) onSeenRef.current(current.id);
  }, [current]);

  // Body scroll lock while the viewer is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Per-story progress timer.
  useEffect(() => {
    if (!current) return;
    setProgress(0);
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      if (!pausedRef.current) {
        elapsed += now - last;
        const ratio = Math.min(1, elapsed / DURATION_MS);
        setProgress(ratio);
        if (ratio >= 1) {
          goNext();
          return;
        }
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, current, goNext, restartNonce]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  // Tap zones + press-and-hold to pause.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFired = useRef(false);
  const downY = useRef(0);
  const downX = useRef(0);

  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    downY.current = e.clientY;
    downX.current = e.clientX;
    holdFired.current = false;
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      setPaused(true);
    }, 220);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    clearHold();
    setPaused(false);
    if (holdFired.current) return;
    if (e.clientY - downY.current > 80) {
      onCloseRef.current();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.32) goPrev();
    else goNext();
  };

  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex select-none items-center justify-center"
      style={{ background: '#000', WebkitTapHighlightColor: 'transparent' }}
    >
      <div
        className="story-card relative flex h-full w-full max-w-[460px] flex-col overflow-hidden sm:h-[94vh] sm:rounded-3xl"
        style={{ background: '#0b0b0f' }}
      >
        {/* Image */}
        <div
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { clearHold(); setPaused(false); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.image_url}
            alt={current.title}
            className="h-full w-full"
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Top scrim + progress + header */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pb-8 pt-2"
          style={{ background: SCRIM_TOP }}
        >
          <div className="flex gap-1">
            {stories.map((s, i) => (
              <span
                key={s.id}
                className="h-[2.5px] flex-1 overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.32)' }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    background: WHITE,
                    width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                    transition: i === index ? 'width 90ms linear' : 'none',
                  }}
                />
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.image_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.5)' }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold" style={{ color: WHITE }}>
                {current.author_name}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {formatElonDate(current.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="pointer-events-auto no-shelf rounded-full p-1.5"
              style={{ color: WHITE }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Bottom scrim + caption */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-7 pt-12"
          style={{ background: SCRIM_BOTTOM }}
        >
          <h3
            className="text-[15px] font-black leading-tight"
            style={{
              color: WHITE,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {current.title}
          </h3>
          {current.caption && (
            <p
              className="mt-1.5 line-clamp-4 text-xs leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.88)' }}
            >
              {current.caption}
            </p>
          )}
          {current.link_url && (
            <a
              href={current.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto no-shelf mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider"
              style={{ background: WHITE, color: '#0f172a' }}
            >
              Batafsil <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
