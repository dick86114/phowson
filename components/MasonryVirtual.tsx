import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProgressiveImage } from './ProgressiveImage';

type Size = { width: number; height: number };

type MasonryItem<T> = {
  id: string;
  data: T;
  imageUrl: string;
  imageAlt?: string;
  href?: string;
  to?: string;
  onClick?: () => void;
  renderOverlay?: (data: T) => React.ReactNode;
};

type Props<T> = {
  items: Array<MasonryItem<T>>;
  gapPx?: number;
  overscanPx?: number;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const getColumnCount = (width: number) => {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
};

const NATURAL_SIZE_CACHE_MAX = 3000;
const naturalSizeCache = new Map<string, Size>();
const cacheSet = (id: string, size: Size) => {
  if (!id) return;
  const existing = naturalSizeCache.get(id);
  if (existing?.width === size.width && existing?.height === size.height) return;
  if (naturalSizeCache.has(id)) naturalSizeCache.delete(id);
  naturalSizeCache.set(id, size);
  while (naturalSizeCache.size > NATURAL_SIZE_CACHE_MAX) {
    const firstKey = naturalSizeCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    naturalSizeCache.delete(firstKey);
  }
};

export const MasonryVirtual = <T,>({ items, gapPx = 24, overscanPx = 2000 }: Props<T>) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [naturalSizes, setNaturalSizes] = useState<Record<string, Size>>(() => {
    const out: Record<string, Size> = {};
    for (const it of items) {
      const s = naturalSizeCache.get(it.id);
      if (s) out[it.id] = s;
    }
    return out;
  });

  useEffect(() => {
    setNaturalSizes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const it of items) {
        if (next[it.id]) continue;
        const s = naturalSizeCache.get(it.id);
        if (!s) continue;
        next[it.id] = s;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);

  useEffect(() => {
    const updateViewport = () => {
      setScrollTop(window.scrollY || 0);
      setViewportHeight(window.innerHeight || 0);
    };

    updateViewport();
    const raf1 = window.requestAnimationFrame(updateViewport);
    const t1 = window.setTimeout(updateViewport, 60);

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateViewport();
      });
    };

    const onPageShow = () => updateViewport();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pageshow', onPageShow);
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.cancelAnimationFrame(raf1);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const initial = el.getBoundingClientRect();
    setContainerWidth(initial?.width ? Math.floor(initial.width) : 0);
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      setContainerWidth(rect?.width ? Math.floor(rect.width) : 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const width = containerWidth;
    if (!width) return { columns: 1, positions: [], height: 0, itemWidth: 0 };

    const columns = getColumnCount(width);
    const itemWidth = (width - gapPx * (columns - 1)) / columns;

    const colHeights = Array.from({ length: columns }, () => 0);
    const positions = items.map((it) => {
      const natural = naturalSizes[it.id];
      const ratio = natural?.width && natural?.height ? natural.height / natural.width : 0.75;
      const height = Math.max(120, itemWidth * ratio);

      let targetCol = 0;
      for (let i = 1; i < columns; i += 1) {
        if (colHeights[i] < colHeights[targetCol]) targetCol = i;
      }

      const x = targetCol * (itemWidth + gapPx);
      const y = colHeights[targetCol];
      colHeights[targetCol] += height + gapPx;

      return {
        id: it.id,
        x,
        y,
        width: itemWidth,
        height,
      };
    });

    const height = colHeights.length ? Math.max(...colHeights) - gapPx : 0;
    return { columns, positions, height: Math.max(0, height), itemWidth };
  }, [containerWidth, gapPx, items, naturalSizes]);

  const visibleIds = useMemo(() => {
    const top = scrollTop - overscanPx;
    const bottom = scrollTop + viewportHeight + overscanPx;
    const set = new Set<string>();
    for (const p of layout.positions) {
      if (p.y > bottom) continue;
      if (p.y + p.height < top) continue;
      set.add(p.id);
    }
    return set;
  }, [layout.positions, overscanPx, scrollTop, viewportHeight]);

  const positionById = useMemo(() => {
    const map = new Map<string, (typeof layout.positions)[number]>();
    for (const p of layout.positions) map.set(p.id, p);
    return map;
  }, [layout.positions]);

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative" style={{ height: `${layout.height}px` }}>
        {items.map((it) => {
          if (!visibleIds.has(it.id)) return null;
          const p = positionById.get(it.id);
          if (!p) return null;

          const Wrapper: any = it.to ? Link : it.href ? 'a' : 'div';
          const wrapperProps = it.to ? { to: it.to } : it.href ? { href: it.href } : {};

          return (
            <Wrapper
              key={it.id}
              onClick={it.onClick}
              className="group absolute overflow-hidden rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border transition-all duration-300 hover:shadow-2xl shadow-sm"
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                width: `${p.width}px`,
                height: `${p.height}px`,
              }}
              {...wrapperProps}
            >
              <ProgressiveImage
                src={it.imageUrl}
                alt={it.imageAlt || ''}
                className="absolute inset-0"
                imgClassName="object-cover"
                loading="lazy"
                decoding="async"
                maxRetries={3}
                onImageLoad={(img) => {
                  const w = img.naturalWidth || 0;
                  const h = img.naturalHeight || 0;
                  if (!w || !h) return;
                  cacheSet(it.id, { width: w, height: h });
                  setNaturalSizes((prev) => {
                    const existing = prev[it.id];
                    if (existing?.width === w && existing?.height === h) return prev;
                    return { ...prev, [it.id]: { width: w, height: h } };
                  });
                }}
              />
              {it.renderOverlay ? it.renderOverlay(it.data) : null}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
};
