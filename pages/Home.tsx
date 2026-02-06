import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Camera, Grid, Image as ImageIcon, User, Plane, Flame, Heart, MessageCircle, ChevronDown, X, Search } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { MasonryVirtual } from '../components/MasonryVirtual';
import { Heatmap } from '../components/Heatmap';
import { useAuth } from '../hooks/useAuth';

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
    likesCount: number;
    comments: Array<unknown>;
};

type ApiCategory = {
    value: string;
    label: string;
    sortOrder: number;
};

type ActivitySummary = {
    today: string;
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActiveDay: string | null;
};

type HeatmapData = {
    startDate: string;
    endDate: string;
    days: Record<string, number>;
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

const toMediaUrl = (url: string | null | undefined) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE_URL}${u}`;
};

export const Home: React.FC = () => {
    const [filter, setFilter] = useState<string>('all');
    const [sortOpen, setSortOpen] = useState(false);
    const [sortBy, setSortBy] = useState('最新发布');
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentUser } = useAuth();
    
    // 语义搜索状态
    const [searchMode, setSearchMode] = useState<'normal' | 'semantic'>('normal');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Heatmap State
    const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());

    const { data: photos = [], isLoading } = useQuery({
        queryKey: ['photos'],
        queryFn: async () => {
            const res = await api.get<ApiPhoto[]>('/photos');
            return res.data;
        },
    });
    
    // 语义搜索结果
    const { data: searchResults, isLoading: isSearchLoading } = useQuery({
        queryKey: ['semantic-search', searchQuery],
        queryFn: async () => {
            if (!searchQuery.trim()) return null;
            const res = await api.get<{query: string; results: ApiPhoto[]; count: number}>(
                `/photos/semantic-search?query=${encodeURIComponent(searchQuery)}&limit=50`
            );
            return res.data;
        },
        enabled: searchMode === 'semantic' && !!searchQuery.trim(),
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });

    const { data: activitySummary } = useQuery<ActivitySummary>({
        queryKey: ['activity', 'summary'],
        queryFn: async () => {
            const res = await api.get<ActivitySummary>('/activity/summary');
            return res.data;
        },
        enabled: !!currentUser,
    });

    const { data: heatmapData } = useQuery<HeatmapData>({
        queryKey: ['activity', 'heatmap', heatmapYear],
        queryFn: async () => {
            const res = await api.get<HeatmapData>(`/activity/heatmap?year=${heatmapYear}`);
            return res.data;
        },
        placeholderData: keepPreviousData,
        enabled: !!currentUser,
    });
    
    const featuredPhoto = photos[0] || null;

    // Search Logic
    const urlSearchQuery = searchParams.get('q') || '';
    const searchModeParam = searchParams.get('mode') as 'normal' | 'semantic' || 'normal';
    
    const clearSearch = () => {
        searchParams.delete('q');
        searchParams.delete('mode');
        setSearchParams(searchParams);
        setSearchQuery('');
    };
    
    // 同步搜索状态
    React.useEffect(() => {
        setSearchQuery(urlSearchQuery);
        setSearchMode(searchModeParam);
    }, [urlSearchQuery, searchModeParam]);

    const filteredPhotos = useMemo(() => {
        return photos.filter(photo => {
            if (filter !== 'all' && photo.category !== filter) return false;

            if (urlSearchQuery && searchMode === 'normal') {
                const query = urlSearchQuery.toLowerCase();
                const matchesTitle = photo.title.toLowerCase().includes(query);
                const matchesDesc = photo.description.toLowerCase().includes(query);
                const tags = toTags(photo.tags);
                const exif = parseExif(photo.exif);
                const matchesTags = tags.some(tag => tag.toLowerCase().includes(query));
                const matchesLocation = String(exif.location || '').toLowerCase().includes(query);
                return matchesTitle || matchesDesc || matchesTags || matchesLocation;
            }

            return true;
        });
    }, [photos, filter, urlSearchQuery, searchMode]);
    
    // 合并普通搜索和语义搜索结果
    const displayPhotos = useMemo(() => {
        if (searchMode === 'semantic' && searchResults?.results) {
            return searchResults.results;
        }
        return filteredPhotos;
    }, [searchMode, searchResults, filteredPhotos]);

    const sortedPhotos = useMemo(() => {
        const copy = [...displayPhotos];
        if (sortBy === '最受欢迎') {
            copy.sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0));
        } else if (sortBy === '最早发布') {
            copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else {
            copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return copy;
    }, [displayPhotos, sortBy]);

    const sortOptions = ['最新发布', '最受欢迎', '最早发布'];

    return (
        <main className="flex-grow">
            {/* Hero Section - Only show if NO search query */}
            {!urlSearchQuery && featuredPhoto && (
                <section className="relative w-full h-[600px] lg:h-[700px] overflow-hidden group">
                    <div 
                        className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                        style={{ 
                            backgroundImage: `linear-gradient(to bottom, rgba(17,26,34,0.3) 0%, rgba(17,26,34,0.9) 100%), url('${toMediaUrl(featuredPhoto.mediumUrl || featuredPhoto.url)}')`
                        }}
                    />
                    <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-16 max-w-[1920px] mx-auto w-full">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="max-w-2xl space-y-4">
                                <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
                                    <Flame className="w-3 h-3" />
                                    今日精选
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-sm">
                                    {featuredPhoto.title}
                                </h2>
                                <p className="text-lg text-gray-200 font-light max-w-xl line-clamp-2 shadow-black drop-shadow-md">
                                    {featuredPhoto.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-300 pt-2">
                                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.date || toDateText(featuredPhoto.createdAt)); })()}</span>
                                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.location || ''); })()}</span>
                                    <span className="flex items-center gap-1"><Camera className="w-4 h-4"/> {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.camera || exif.Model || ''); })()}</span>
                                </div>
                            </div>
                            {/* Streak Widget */}
                            {activitySummary && (
                                <div className="bg-white/10 dark:bg-surface-dark/80 backdrop-blur-md border border-white/20 dark:border-surface-border p-5 rounded-2xl min-w-[200px] shadow-2xl transform transition hover:-translate-y-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-300 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">每日打卡</span>
                                        <Flame className="text-primary w-5 h-5" />
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold text-white">{activitySummary.currentStreak}</span>
                                        <span className="text-sm text-gray-300 dark:text-gray-400">天</span>
                                    </div>
                                    <div className="mt-2 w-full bg-white/20 dark:bg-surface-border rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min((activitySummary.currentStreak / (activitySummary.longestStreak || 1)) * 100, 100)}%` }}></div>
                                    </div>
                                    <p className="text-xs text-primary mt-2 font-medium">最长 {activitySummary.longestStreak} 天 · 共 {activitySummary.totalActiveDays} 天</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Search Result Banner */}
            {urlSearchQuery && (
                <section className="bg-gray-100 dark:bg-surface-dark border-b border-gray-200 dark:border-surface-border py-8">
                     <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {searchMode === 'semantic' ? '🤖 语义搜索' : '🔍 关键词搜索'}: "{urlSearchQuery}"
                                        </h2>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                                            找到 {isSearchLoading ? '...' : sortedPhotos.length} 张相关照片
                                            {searchMode === 'semantic' && searchResults && (
                                                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                    相似度排序
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1 bg-white dark:bg-surface-border rounded-lg p-1 shadow-sm">
                                    <button
                                        onClick={() => {
                                            searchParams.set('mode', 'normal');
                                            setSearchParams(searchParams);
                                        }}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            searchMode === 'normal'
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        关键词
                                    </button>
                                    <button
                                        onClick={() => {
                                            searchParams.set('mode', 'semantic');
                                            setSearchParams(searchParams);
                                        }}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                                            searchMode === 'semantic'
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        🤖 语义
                                    </button>
                                </div>
                                <button 
                                    onClick={clearSearch}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-surface-border transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    清除搜索
                                </button>
                            </div>
                        </div>
                     </div>
                </section>
            )}

            {/* Filter Bar */}
            <section className="border-b border-gray-200 dark:border-surface-border bg-white dark:bg-background-dark sticky top-16 z-40 shadow-sm transition-colors duration-300">
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
                            {[{ id: 'all', label: '全部主题', icon: <Grid className="w-4 h-4"/> }, ...categories
                                .filter(c => c.value !== 'uncategorized')
                                .map(c => ({
                                    id: c.value,
                                    label: c.label,
                                    icon:
                                        c.value === 'landscape' ? <ImageIcon className="w-4 h-4"/> :
                                        c.value === 'portrait' ? <User className="w-4 h-4"/> :
                                        c.value === 'travel' ? <Plane className="w-4 h-4"/> :
                                        <ImageIcon className="w-4 h-4"/>,
                                }))
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilter(cat.id)}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                                        filter === cat.id 
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                        : 'bg-gray-100 dark:bg-surface-border text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a4055]'
                                    }`}
                                >
                                    {cat.icon}
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Custom Dropdown */}
                        <div className="relative z-50">
                            <button 
                                onClick={() => setSortOpen(!sortOpen)}
                                className="flex items-center gap-3 px-4 py-2 rounded-full text-sm font-medium bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-all min-w-[160px] justify-between group"
                            >
                                <span className="text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-wider group-hover:text-gray-600 dark:group-hover:text-gray-400">排序</span>
                                <span className="flex-1 text-right text-gray-900 dark:text-white">{sortBy}</span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 group-hover:text-gray-600 dark:group-hover:text-white ${sortOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {sortOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)}></div>
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                        {sortOptions.map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setSortBy(option);
                                                    setSortOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-[#23303e] flex items-center justify-between ${
                                                    sortBy === option ? 'text-primary bg-primary/5 font-medium' : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                {option}
                                                {sortBy === option && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(19,127,236,0.5)]"></div>}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Heatmap Section */}
            {heatmapData && currentUser && !searchQuery && (
                <section className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <Heatmap
                        data={heatmapData.days}
                        year={heatmapYear}
                        onYearChange={setHeatmapYear}
                        startDate={heatmapData.startDate}
                        endDate={heatmapData.endDate}
                    />
                </section>
            )}

            {/* Gallery Grid */}
            <section className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <MasonryVirtual
                    items={sortedPhotos.map(photo => ({
                        id: photo.id,
                        data: photo,
                        imageUrl: toMediaUrl(photo.thumbUrl || photo.url),
                        imageAlt: photo.title,
                        to: `/photo/${photo.id}`,
                        renderOverlay: (p) => (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                    <div className="flex items-center justify-between text-white mb-2">
                                        <div className="flex items-center gap-1.5 text-xs font-medium bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                                            <Camera className="w-3 h-3" />
                                            {(() => { const exif = parseExif(p.exif); return String(exif.focalLength || exif.FocalLength || ''); })()}
                                        </div>
                                        <div className="flex gap-3">
                                            <span className="flex items-center gap-1 text-xs"><Heart className="w-3 h-3" /> {p.likesCount}</span>
                                            <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-3 h-3" /> {p.comments?.length ?? 0}</span>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight">{p.title}</h3>
                                    <p className="text-sm text-gray-300 line-clamp-1 mt-1">{p.description}</p>
                                </div>
                            </div>
                        ),
                    }))}
                />
                {!isLoading && sortedPhotos.length === 0 && (
                     <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-surface-dark mb-4">
                            <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">暂无照片</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {urlSearchQuery ? `未找到与 "${urlSearchQuery}" 相关的结果。` : '该分类下还没有上传照片。'}
                        </p>
                        {urlSearchQuery && (
                            <button onClick={clearSearch} className="mt-4 text-primary hover:underline text-sm">
                                返回查看全部
                            </button>
                        )}
                    </div>
                )}
                {isLoading && (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400">加载中...</div>
                )}
            </section>
        </main>
    );
};
