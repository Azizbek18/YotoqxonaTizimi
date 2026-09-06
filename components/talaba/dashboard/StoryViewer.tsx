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

  // Keyboard + scroll lock.
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

  const onPointerDown = (e: React.PointerEvent) => {
    downY.current = e.clientY;
    holdFired.current = false;
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      setPaused(true);
    }, 220);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPaused(false);
    if (holdFired.current) return;

    // Swipe down to dismiss.
    if (e.clientY - downY.current > 90) {
      onCloseRef.current();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.32) goPrev();
    else goNext();
  };

  if (!current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black select-none">
      <div className="story-card relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-neutral-950 sm:h-[92vh] sm:rounded-2xl">
        {/* Progress segments */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2.5">
          {stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                  transition: i === index ? 'width 80ms linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 px-3 pt-7 pb-6 bg-gradient-to-b from-black/60 to-transparent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.image_url} alt="" className="size-8 rounded-full object-cover ring-1 ring-white/40" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{current.author_name}</p>
            <p className="text-[10px] text-white/70">{formatElonDate(current.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="rounded-full p-1.5 text-white/90 transition-colors hover:bg-white/15"
          >
            <X size={20} />
          </button>
        </div>

        {/* Image + tap surface */}
        <div
          className="relative flex-1 touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            if (holdTimer.current) clearTimeout(holdTimer.current);
            setPaused(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.image_url}
            alt={current.title}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>

        {/* Caption */}
        <div className="absolute inset-x-0 bottom-0 z-20 space-y-2 bg-gradient-to-t from-black/75 to-transparent px-4 pb-6 pt-10">
          <h3 className="text-sm font-black leading-tight text-white">{current.title}</h3>
          {current.caption && (
            <p className="text-xs leading-relaxed text-white/85 line-clamp-4">{current.caption}</p>
          )}
          {current.link_url && (
            <a
              href={current.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900"
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
