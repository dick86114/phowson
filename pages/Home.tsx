import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Camera, Grid, Image as ImageIcon, User, Plane, Flame, Heart, MessageCircle, ChevronDown, X, Search, Clock, Eye, History, ArrowUp, Check, RefreshCw } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { getPhotoUrl } from '../utils/helpers';
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
    
    // Mobile Modal States
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [showMobileSort, setShowMobileSort] = useState(false);
    const [showMobileHeatmap, setShowMobileHeatmap] = useState(false);

    // Heatmap State
    const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());

    // Lock body scroll when mobile modals are open
    useEffect(() => {
        if (showMobileFilter || showMobileSort || showMobileHeatmap) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showMobileFilter, showMobileSort, showMobileHeatmap]);

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
                <section className="relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden group">
                    <div 
                        className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                        style={{ 
                            backgroundImage: `linear-gradient(to bottom, rgba(17,26,34,0.3) 0%, rgba(17,26,34,0.9) 100%), url('${getPhotoUrl(featuredPhoto, 'medium')}')`
                        }}
                    />
                    <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-16 max-w-[1920px] mx-auto w-full">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="max-w-2xl space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider shrink-0">
                                        <Flame className="w-3 h-3" />
                                        今日精选
                                    </div>
                                    
                                    {/* Streak Widget - Mobile Only */}
                                    {activitySummary && (
                                        <div className="md:hidden inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 text-xs font-medium text-white shrink-0">
                                            <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                                            <span className="text-orange-400 font-bold">{activitySummary.currentStreak}</span>
                                            <span>天</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-sm">
                                    {featuredPhoto.title}
                                </h2>
                                <div className="hidden md:block">
                                    <p className="text-lg text-gray-200 font-light max-w-xl line-clamp-2 shadow-black drop-shadow-md">
                                        {featuredPhoto.description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-300 pt-2">
                                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.date || toDateText(featuredPhoto.createdAt)); })()}</span>
                                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.location || ''); })()}</span>
                                    <span className="flex items-center gap-1"><Camera className="w-4 h-4"/> {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.camera || exif.Model || ''); })()}</span>
                                </div>
                            </div>

                            {/* Desktop Streak Card - Right Side */}
                            {activitySummary && (
                                <div className="hidden md:block">
                                    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl min-w-[320px] transform transition-transform hover:scale-105 duration-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
                                                <Flame className="w-5 h-5 fill-orange-500" />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-200 tracking-wide">每日打卡</span>
                                        </div>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-extrabold text-white tracking-tight">{activitySummary.currentStreak}</span>
                                            <span className="text-sm font-medium text-gray-400">天连续</span>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                                            <span className="text-gray-400">最高纪录</span>
                                            <span className="text-white font-bold">{activitySummary.longestStreak} 天</span>
                                        </div>
                                    </div>
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

            {/* Mobile Toolbar (Filter, Sort, Heatmap) - Mobile Only */}
            <section className="md:hidden border-b border-gray-100 dark:border-surface-border bg-white dark:bg-background-dark transition-colors duration-300 py-3">
                <div className="flex items-center justify-around px-4">
                    <button 
                        onClick={() => setShowMobileFilter(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-surface-border/50 text-sm font-medium text-gray-700 dark:text-gray-300 active:scale-95 transition-all shadow-sm"
                    >
                        <Grid className="w-4 h-4" />
                        <span>分类</span>
                    </button>
                    <div className="w-[1px] h-6 bg-gray-200 dark:bg-surface-border"></div>
                    <button 
                        onClick={() => setShowMobileSort(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-surface-border/50 text-sm font-medium text-gray-700 dark:text-gray-300 active:scale-95 transition-all shadow-sm"
                    >
                        <div className="flex flex-col gap-0.5 items-center justify-center">
                            <div className="w-3.5 h-[1.5px] bg-current"></div>
                            <div className="w-2.5 h-[1.5px] bg-current"></div>
                            <div className="w-1.5 h-[1.5px] bg-current"></div>
                        </div>
                        <span>排序</span>
                    </button>
                    {currentUser && (
                        <>
                            <div className="w-[1px] h-6 bg-gray-200 dark:bg-surface-border"></div>
                            <button 
                                onClick={() => setShowMobileHeatmap(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-surface-border/50 text-sm font-medium text-gray-700 dark:text-gray-300 active:scale-95 transition-all shadow-sm"
                            >
                                <Flame className="w-4 h-4" />
                                <span>热力</span>
                            </button>
                        </>
                    )}
                </div>
            </section>

            {/* Mobile Modals */}
            {/* 1. Filter Modal */}
            {showMobileFilter && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end justify-center md:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={() => setShowMobileFilter(false)} />
                    <div className="relative bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl w-full rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 ring-1 ring-black/5 dark:ring-white/10 max-h-[80vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
                        
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择分类</h3>
                            <button 
                                onClick={() => setFilter('all')} 
                                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                                重置
                            </button>
                        </div>

                        <div className="w-full h-px bg-gray-100 dark:bg-gray-800 mb-6" />

                        <div className="grid grid-cols-2 gap-3 mb-8">
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
                                    onClick={() => {
                                        setFilter(cat.id);
                                        setTimeout(() => setShowMobileFilter(false), 150);
                                    }}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                                        filter === cat.id 
                                        ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${
                                        filter === cat.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {cat.icon}
                                    </div>
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={() => setShowMobileFilter(false)}
                            className="w-full py-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            取消
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* 2. Sort Modal */}
            {showMobileSort && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end justify-center md:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={() => setShowMobileSort(false)} />
                    <div className="relative bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl w-full rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 ring-1 ring-black/5 dark:ring-white/10 max-h-[80vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
                        
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">排序方式</h3>
                            <button 
                                onClick={() => setSortBy('最新发布')} 
                                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                                重置
                            </button>
                        </div>
                        
                        <div className="w-full h-px bg-gray-100 dark:bg-gray-800 mb-6" />

                        <div className="flex flex-col gap-3 mb-8">
                            {sortOptions.map((option) => {
                                let icon;
                                switch(option) {
                                    case '最新发布': 
                                        icon = <Clock className="w-5 h-5" />; 
                                        break;
                                    case '最受欢迎': 
                                        icon = <Eye className="w-5 h-5" />; 
                                        break;
                                    case '最早发布': 
                                        icon = <History className="w-5 h-5" />; 
                                        break;
                                    default: 
                                        icon = <Clock className="w-5 h-5" />;
                                }

                                return (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            setSortBy(option);
                                            // 稍微延迟关闭以展示点击反馈
                                            setTimeout(() => setShowMobileSort(false), 150);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                                            sortBy === option 
                                            ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                            : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg ${
                                            sortBy === option ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                        }`}>
                                            {icon}
                                        </div>
                                        <span className="text-base">{option}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            onClick={() => setShowMobileSort(false)}
                            className="w-full py-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            取消
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* 3. Heatmap Modal */}
            {showMobileHeatmap && heatmapData && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center md:hidden p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileHeatmap(false)} />
                    <div className="relative bg-white dark:bg-surface-dark w-full max-h-[85vh] rounded-2xl p-4 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <Flame className="w-5 h-5 text-primary" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">上传热力图</h3>
                            </div>
                            <button onClick={() => setShowMobileHeatmap(false)} className="p-2 bg-gray-100 dark:bg-surface-border rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-surface-border/80">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                             <Heatmap
                                data={heatmapData.days}
                                year={heatmapYear}
                                onYearChange={setHeatmapYear}
                                startDate={heatmapData.startDate}
                                endDate={heatmapData.endDate}
                                variant="compact" // Use compact variant for one-page view on mobile
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Filter Bar - Desktop Only */}
            <section className="hidden md:block border-b border-gray-200 dark:border-surface-border bg-white dark:bg-background-dark transition-colors duration-300">
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

            {/* Heatmap Section - Desktop Only */}
            {heatmapData && currentUser && !searchQuery && (
                <section className="hidden md:block max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            <section className="max-w-[1920px] mx-auto px-[10px] sm:px-6 lg:px-8 py-2 md:py-8">
                <MasonryVirtual
                    items={sortedPhotos.map(photo => ({
                        id: photo.id,
                        data: photo,
                        imageUrl: getPhotoUrl(photo, 'thumb'),
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
