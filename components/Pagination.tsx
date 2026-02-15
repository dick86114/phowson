import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const buildPageItems = (current: number, totalPages: number) => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const items: Array<number | '...'> = [];
    const c = clamp(current, 1, totalPages);
    const left = Math.max(2, c - 1);
    const right = Math.min(totalPages - 1, c + 1);

    items.push(1);
    if (left > 2) items.push('...');
    for (let p = left; p <= right; p++) items.push(p);
    if (right < totalPages - 1) items.push('...');
    items.push(totalPages);
    return items;
};

export const getPaginationModel = (total: number, page: number, pageSize: number) => {
    const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
    const safePage = clamp(page, 1, totalPages);
    const rangeText =
        total <= 0
            ? '0 条'
            : `${(safePage - 1) * pageSize + 1}-${Math.min(total, safePage * pageSize)} / ${total} 条`;
    const pageItems = buildPageItems(safePage, totalPages);
    return { totalPages, safePage, rangeText, pageItems };
};

export const Pagination: React.FC<PaginationProps> = ({
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50, 100],
    className,
}) => {
    const { totalPages, safePage, rangeText, pageItems } = useMemo(
        () => getPaginationModel(total, page, pageSize),
        [page, pageSize, total]
    );
    const [jump, setJump] = useState<string>(String(safePage));

    return (
        <div className={`w-full ${className || ''}`}>
            {/* Mobile View */}
            <div className="md:hidden flex items-center justify-between gap-3">
                 <button
                    onClick={() => onPageChange(safePage - 1)}
                    disabled={safePage <= 1}
                    className="flex-1 h-11 flex items-center justify-center gap-1 rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 active:scale-95 transition-transform shadow-sm"
                 >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                 </button>
                 <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
                    {safePage} / {totalPages}
                 </span>
                 <button
                    onClick={() => onPageChange(safePage + 1)}
                    disabled={safePage >= totalPages}
                    className="flex-1 h-11 flex items-center justify-center gap-1 rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border text-sm font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50 active:scale-95 transition-transform shadow-sm"
                 >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                 </button>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{rangeText}</span>
                    {onPageSizeChange ? (
                        <label className="flex items-center gap-2">
                            <span>每页</span>
                            <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-xl px-2 py-1 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
        >
                                {pageSizeOptions.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                </div>

                <div className="flex items-center justify-end gap-3">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onPageChange(safePage - 1)}
                            disabled={safePage <= 1}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                            aria-label="上一页"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1">
                            {pageItems.map((it, idx) =>
                                it === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={it}
                                        type="button"
                                        onClick={() => onPageChange(it as number)}
                                        className={`min-w-9 h-9 px-2 rounded-xl border text-sm font-medium transition-colors ${
                                            it === safePage
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-surface-border text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary'
                                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark`}
                                        aria-label={`第 ${it} 页`}
                                        aria-current={it === safePage ? 'page' : undefined}
                                    >
                                        {it}
                                    </button>
                                )
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => onPageChange(safePage + 1)}
                            disabled={safePage >= totalPages}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                            aria-label="下一页"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const next = clamp(Number(jump), 1, totalPages);
                            onPageChange(next);
                        }}
                    >
                        <span className="text-xs text-gray-500 dark:text-gray-400">跳转</span>
                        <input
                            value={jump}
                            onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ''))}
                            inputMode="numeric"
                            className="w-16 h-9 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-xl px-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                            aria-label="跳转到页码"
                        />
                        <button
                            type="submit"
                            className="h-9 px-3 rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-dark text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                        >
                            确定
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
