import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { getPhotoUrl } from '../utils/helpers';
import { ProgressiveImage } from '../components/ProgressiveImage';

type ApiPhoto = {
    id: string;
    url: string;
    thumbUrl?: string | null;
    mediumUrl?: string | null;
    originalUrl?: string | null;
    title: string;
    description: string;
    category: string;
    tags: string;
    exif: string;
    createdAt: string;
    user?: { name?: string };
};

type PageResponse<T> = {
    items: T[];
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number;
};

const parseExif = (raw: string): Record<string, any> => {
    try {
        const v = JSON.parse(raw || '{}');
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
};

const toDateText = (raw: string | undefined) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toISOString().slice(0, 10);
};

const toTags = (raw: string | undefined) => {
    return String(raw || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
};

export const Stories: React.FC = () => {
    const pageSize = 12;
    const {
        data,
        status,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
    } = useInfiniteQuery<PageResponse<ApiPhoto>>({
        queryKey: ['stories', 'photos', 'page', pageSize],
        initialPageParam: 0,
        queryFn: async ({ pageParam }) => {
            const res = await api.get<PageResponse<ApiPhoto>>(`/photos/page?limit=${pageSize}&offset=${pageParam}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
    });

    const photos = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!hasNextPage) return;
        const el = sentinelRef.current;
        if (!el) return;

        const io = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                if (isFetchingNextPage) return;
                fetchNextPage();
            },
            { root: null, rootMargin: '400px 0px', threshold: 0 }
        );

        io.observe(el);
        return () => io.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    return (
        <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto bg-background-light dark:bg-background-dark transition-colors duration-300">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">光影故事</h1>
                    <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        每一张照片背后都有一段独特的记忆。在这里，我记录下快门按下前后的思考、等待与感动。
                    </p>
                </div>

                <div className="grid gap-12">
                    {photos.map((photo, idx) => (
                        <article key={photo.id} className="glass-card flex flex-col md:flex-row gap-8 items-start rounded-2xl overflow-hidden p-6">
                            <div className="w-full md:w-1/3 aspect-[4/3] rounded-lg overflow-hidden shrink-0">
                                <ProgressiveImage
                                    src={getPhotoUrl(photo, 'thumb')}
                                    alt={photo.title}
                                    className="w-full h-full"
                                    imgClassName="object-cover transition-transform hover:scale-105 duration-500"
                                    loading={idx < 2 ? 'eager' : 'lazy'}
                                    decoding="async"
                                    maxRetries={3}
                                />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3 text-xs text-primary font-medium uppercase tracking-wider">
                                    <span>{photo.category}</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></span>
                                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                        <Calendar className="w-3 h-3" />
                                        {(() => { const exif = parseExif(photo.exif); return String(exif.date || toDateText(photo.createdAt)); })()}
                                    </div>
                                    {photo.user?.name && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></span>
                                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                <User className="w-3 h-3" />
                                                {photo.user.name}
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    <Link to={`/photo/${photo.id}`} className="hover:text-primary transition-colors">
                                        {photo.title}
                                    </Link>
                                </h2>
                                
                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                                    {photo.description}
                                </p>

                                <div className="pt-4 flex items-center justify-between">
                                     <div className="flex flex-wrap gap-2">
                                        {toTags(photo.tags).slice(0,3).map(tag => (
                                            <span key={tag} className="text-xs text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/10 px-2 py-1 rounded backdrop-blur-sm">#{tag}</span>
                                        ))}
                                    </div>
                                    <Link 
                                        to={`/photo/${photo.id}`} 
                                        className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-white hover:text-primary transition-colors"
                                    >
                                        阅读全文 <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                {status === 'pending' && (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400">加载中...</div>
                )}

                {status === 'error' && (
                    <div className="text-center py-10">
                        <div className="text-gray-500 dark:text-gray-400">加载失败</div>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
                        >
                            重试
                        </button>
                    </div>
                )}

                {status === 'success' && photos.length === 0 && (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400">暂无故事</div>
                )}

                <div ref={sentinelRef} />

                {status === 'success' && hasNextPage && (
                    <div className="flex items-center justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="glass-card inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isFetchingNextPage ? '加载中...' : '加载更多'}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
};
