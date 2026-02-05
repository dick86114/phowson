import React, { useEffect, useMemo, useRef, useState } from 'react';

type Size = { width: number; height: number };

type MasonryItem<T> = {
  id: string;
  data: T;
  imageUrl: string;
  imageAlt?: string;
  renderOverlay?: (data: T) => React.ReactNode;
  onClick?: () => void;
  href?: string;
};

type Props<T> = {
  items: Array<MasonryItem<T>>;
  columnClassName?: string;
  rowHeightPx?: number;
  gapClassName?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const MasonryGrid = <T,>({
  items,
  columnClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  rowHeightPx = 10,
  gapClassName = 'gap-6',
}: Props<T>) => {
  const [naturalSizes, setNaturalSizes] = useState<Record<string, Size>>({});
  const [itemWidths, setItemWidths] = useState<Record<string, number>>({});
  const gridRef = useRef<HTMLDivElement | null>(null);

  const computeAndSetItemWidths = () => {
    const grid = gridRef.current;
    if (!grid) return;
    const next: Record<string, number> = {};
    const nodes = grid.querySelectorAll<HTMLElement>('[data-masonry-id]');
    nodes.forEach((el) => {
      const id = el.dataset.masonryId;
      if (!id) return;
      next[id] = el.getBoundingClientRect().width;
    });
    setItemWidths(next);
  };

  useEffect(() => {
    computeAndSetItemWidths();

    const grid = gridRef.current;
    if (!grid) return;
    const ro = new ResizeObserver(() => computeAndSetItemWidths());
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);

  const rowStyle = useMemo(() => ({ gridAutoRows: `${rowHeightPx}px` }), [rowHeightPx]);

  const itemSpan = (id: string) => {
    const natural = naturalSizes[id];
    const width = itemWidths[id];
    if (!natural?.width || !natural?.height || !width) return 40;
    const ratio = natural.height / natural.width;
    const displayHeight = width * ratio;
    const span = Math.ceil(displayHeight / rowHeightPx);
    return clamp(span, 20, 300);
  };

  return (
    <div ref={gridRef} className={`grid ${columnClassName} ${gapClassName}`} style={rowStyle}>
      {items.map((it) => {
        const span = itemSpan(it.id);
        const Wrapper: any = it.href ? 'a' : 'div';
        const wrapperProps = it.href
          ? { href: it.href }
          : { role: it.onClick ? 'button' : undefined, tabIndex: it.onClick ? 0 : undefined };

        return (
          <Wrapper
            key={it.id}
            data-masonry-id={it.id}
            onClick={it.onClick}
            className="group block overflow-hidden rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 shadow-sm"
            style={{ gridRowEnd: `span ${span}` }}
            {...wrapperProps}
          >
            <div className="relative w-full h-full">
              <img
                src={it.imageUrl}
                alt={it.imageAlt || ''}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const w = img.naturalWidth || 0;
                  const h = img.naturalHeight || 0;
                  if (!w || !h) return;
                  setNaturalSizes((prev) => {
                    const existing = prev[it.id];
                    if (existing?.width === w && existing?.height === h) return prev;
                    return { ...prev, [it.id]: { width: w, height: h } };
                  });
                }}
              />
              {it.renderOverlay ? it.renderOverlay(it.data) : null}
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
};
