import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, User, ArrowRight, BookOpen, Clock, Tag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { getPhotoUrl, getAvatarUrl } from '../utils/helpers';
import { Pagination } from '../components/Pagination';
import { LoadingState, ErrorState } from '../components/States';

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
    user?: { id: string; name?: string; avatar?: string };
    viewsCount: number;
    likesCount: number;
};

type Category = {
    value: string;
    label: string;
    icon?: string;
};

type PageResponse<T> = {
    items: T[];
    limit: number;
    offset: number;
    total: number;
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
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
};

const toTags = (raw: string | undefined) => {
    return String(raw || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
};

export const Stories: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 9; // Grid layout usually works better with multiples of 3

    const {
        data,
        isLoading,
        isError,
        refetch,
    } = useQuery<PageResponse<ApiPhoto>>({
        queryKey: ['stories', 'page', page, pageSize],
        queryFn: async () => {
            const offset = (page - 1) * pageSize;
            const res = await api.get<PageResponse<ApiPhoto>>(`/photos/page?limit=${pageSize}&offset=${offset}&sortBy=createdAt&order=desc`);
            return res.data;
        },
    });

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get<Category[]>('/categories');
            return Array.isArray(res) ? res : (res as any).data || [];
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    const categoryMap = useMemo(() => {
        return categories.reduce((acc, cat) => {
            acc[cat.value] = cat.label;
            return acc;
        }, {} as Record<string, string>);
    }, [categories]);

    const handlePageChange = (newPage: number) => {
        setSearchParams({ page: String(newPage) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isLoading) return <LoadingState />;
    if (isError) return <ErrorState onRetry={refetch} />;

    const photos = data?.items || [];
    const total = data?.total || 0;

    return (
        <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black transition-colors duration-500">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-200/50 dark:border-white/10">
                    <div className="space-y-2">
                        <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            光影故事
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">
                            每一张照片背后都有一段独特的记忆。在这里，我记录下快门按下前后的思考、等待与感动。
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            STORIES & MOMENTS
                        </span>
                    </div>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {photos.map((photo, idx) => (
                        <article 
                            key={photo.id} 
                            className="group relative flex flex-col bg-white dark:bg-gray-800/50 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 dark:border-white/5 hover:-translate-y-1"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            {/* Image Container */}
                            <Link to={`/photo/${photo.id}`} className="block relative aspect-[4/3] overflow-hidden">
                                <img
                                    src={getPhotoUrl(photo, 'medium')}
                                    alt={photo.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    loading={idx < 3 ? 'eager' : 'lazy'}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white shadow-sm z-10">
                                    {categoryMap[photo.category] || photo.category}
                                </div>
                            </Link>

                            {/* Content */}
                            <div className="flex-1 flex flex-col p-6 space-y-4">
                                {/* Meta */}
                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {(() => { const exif = parseExif(photo.exif); return String(exif.date || toDateText(photo.createdAt)); })()}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        {Math.ceil((photo.description?.length || 0) / 300) || 1} 分钟阅读
                                    </div>
                                </div>

                                {/* Title & Description */}
                                <div className="space-y-3 flex-1">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        <Link to={`/photo/${photo.id}`}>
                                            {photo.title}
                                        </Link>
                                    </h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-3">
                                        {photo.description || '暂无描述...'}
                                    </p>
                                </div>

                                {/* Footer */}
                                <div className="pt-4 mt-auto border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                                    {photo.user && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                                                <img 
                                                    src={getAvatarUrl(photo.user)} 
                                                    alt={photo.user.name || 'User'} 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                {photo.user.name}
                                            </span>
                                        </div>
                                    )}
                                    
                                    <Link 
                                        to={`/photo/${photo.id}`} 
                                        className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary/80 transition-colors group/link"
                                    >
                                        阅读全文 
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                {/* Empty State */}
                {photos.length === 0 && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">暂无故事</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            开始上传照片，书写你的光影故事吧。
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {total > 0 && (
                    <div className="flex justify-center pt-8 border-t border-gray-200 dark:border-white/10">
                        <Pagination
                            total={total}
                            page={page}
                            pageSize={pageSize}
                            onPageChange={handlePageChange}
                            onPageSizeChange={() => {}} // Page size is fixed for grid layout
                        />
                    </div>
                )}
            </div>
        </main>
    );
};
