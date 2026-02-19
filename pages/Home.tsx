import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Camera, Grid, Image as ImageIcon, User, Plane, Flame, Heart, MessageCircle, ChevronDown, X, Search, Clock, Eye, History, ArrowUp, Check, RefreshCw, HelpCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { getPhotoUrl } from '../utils/helpers';
import { MasonryVirtual } from '../components/MasonryVirtual';
import { Heatmap } from '../components/Heatmap';
import { MiniHeatmap } from '../components/MiniHeatmap';
import { HeatmapModal } from '../components/HeatmapModal';
import { DropdownFilter } from '../components/admin/DropdownFilter';
import { useAuth } from '../hooks/useAuth';
import { useHeaderTheme } from '../HeaderThemeContext';
import { getImageBrightness } from '../utils/color';

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
    icon?: string;
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
    const [sortBy, setSortBy] = useState('最新发布');
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentUser } = useAuth();
    const { setHeaderColorMode } = useHeaderTheme();
    
    // Search State
    const urlSearchQuery = searchParams.get('q') || '';
    const [localSearchInput, setLocalSearchInput] = useState(urlSearchQuery);
    
    // Mobile Modal States
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [showMobileSort, setShowMobileSort] = useState(false);
    const [showMobileHeatmap, setShowMobileHeatmap] = useState(false);
    const [showHeatmapModal, setShowHeatmapModal] = useState(false); // Desktop modal
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
    
    const featuredPhoto = useMemo(() => {
        if (!photos || photos.length === 0) return null;
        return photos[Math.floor(Math.random() * photos.length)];
    }, [photos]);

    useEffect(() => {
        // If we are in search mode, use dark text (for light background)
        if (urlSearchQuery) {
            setHeaderColorMode('dark-text');
            return;
        }

        if (featuredPhoto) {
            const url = getPhotoUrl(featuredPhoto, 'medium');
            getImageBrightness(url).then(brightness => {
                // Because we have a dark gradient overlay (rgba(17,26,34,0.3)), 
                // we only switch to dark text if the underlying image is very bright.
                // Threshold 160 allows more images to keep white text.
                setHeaderColorMode(brightness > 160 ? 'dark-text' : 'light-text');
            });
        } else {
             // No hero image -> likely white background -> dark text
             setHeaderColorMode('dark-text');
        }
        
        return () => setHeaderColorMode('light-text');
    }, [featuredPhoto?.id, setHeaderColorMode, urlSearchQuery]);

    // Sync local input when URL changes
    useEffect(() => {
        setLocalSearchInput(urlSearchQuery);
    }, [urlSearchQuery]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localSearchInput.trim()) {
            searchParams.set('q', localSearchInput.trim());
            setSearchParams(searchParams);
        } else {
            searchParams.delete('q');
            setSearchParams(searchParams);
        }
    };
    
    const clearSearch = () => {
        searchParams.delete('q');
        setSearchParams(searchParams);
        setLocalSearchInput('');
    };

    const filteredPhotos = useMemo(() => {
        return photos.filter(photo => {
            if (filter !== 'all' && photo.category !== filter) return false;

            if (urlSearchQuery) {
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
    }, [photos, filter, urlSearchQuery]);

    const sortedPhotos = useMemo(() => {
        const copy = [...filteredPhotos];
        if (sortBy === '最受欢迎') {
            copy.sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0));
        } else if (sortBy === '最早发布') {
            copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else {
            copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return copy;
    }, [filteredPhotos, sortBy]);

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
                            <div className="max-w-2xl space-y-2 md:space-y-6">
                                <div className="flex items-center gap-2">
                                    {/* Streak Widget - Mobile Only */}
                                    {activitySummary && (
                                        <div className="md:hidden inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 text-xs font-medium text-white shrink-0">
                                            <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                                            <span className="text-orange-400 font-bold">{activitySummary.currentStreak}</span>
                                            <span>天</span>
                                        </div>
                                    )}
                                </div>
                                <Link to={`/photo/${featuredPhoto.id}`} className="block">
                                    <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-md hover:opacity-80 transition-opacity cursor-pointer leading-tight">
                                        {featuredPhoto.title}
                                    </h2>
                                </Link>
                                <div className="hidden md:block">
                                    <p className="text-lg text-gray-200 font-light max-w-xl line-clamp-2 shadow-black drop-shadow-md">
                                        {featuredPhoto.description}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm text-gray-200 font-medium">
                                    <span className="flex items-center gap-1.5 whitespace-nowrap bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                                        <Calendar className="w-3.5 h-3.5 text-white/80"/> 
                                        {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.date || toDateText(featuredPhoto.createdAt)); })()}
                                    </span>
                                    {(() => {
                                        const exif = parseExif(featuredPhoto.exif);
                                        const loc = String(exif.location || '');
                                        return loc ? (
                                            <span className="flex items-center gap-1.5 whitespace-nowrap bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                                                <MapPin className="w-3.5 h-3.5 text-white/80"/> 
                                                {loc}
                                            </span>
                                        ) : null;
                                    })()}
                                    <span className="flex items-center gap-1.5 whitespace-nowrap bg-black/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                                        <Camera className="w-3.5 h-3.5 text-white/80"/> 
                                        {(() => { const exif = parseExif(featuredPhoto.exif); return String(exif.camera || exif.Model || '未知设备'); })()}
                                    </span>
                                </div>
                            </div>

                            {/* Desktop Streak Card - Right Side */}
                            {activitySummary && (
                                <div className="hidden md:block">
                                    <div 
                                        onClick={() => setShowHeatmapModal(true)}
                                        className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl min-w-[340px] transform transition-transform hover:scale-105 duration-300 cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 rounded-xl bg-orange-500/20 text-orange-400 group-hover:bg-orange-500/30 transition-colors">
                                                        <Flame className="w-5 h-5 fill-orange-500" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-200 tracking-wide">每日打卡</span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-4xl font-extrabold text-white tracking-tight">{activitySummary.currentStreak}</span>
                                                    <span className="text-sm font-medium text-gray-400">天连续</span>
                                                </div>
                                            </div>
                                            
                                            {heatmapData && heatmapData.days && (
                                                <div className="bg-white/5 rounded-xl p-2 border border-white/5 backdrop-blur-sm group-hover:bg-white/10 transition-colors">
                                                    <MiniHeatmap data={heatmapData.days} />
                                                </div>
                                            )}
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
                <section className="relative overflow-hidden py-12 md:py-16 bg-gradient-to-b from-gray-50/50 to-white/50 dark:from-surface-dark/50 dark:to-background-dark/50 backdrop-blur-sm border-b border-gray-100 dark:border-white/5">
                     <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-8 relative z-10">
                        
                        <div className="space-y-6">
                            <motion.div 
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="w-full max-w-2xl mx-auto"
                            >
                                <form onSubmit={handleSearchSubmit} className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={localSearchInput}
                                        onChange={(e) => setLocalSearchInput(e.target.value)}
                                        placeholder="搜索照片..."
                                        className="w-full pl-12 pr-12 py-4 bg-white/80 dark:bg-black/20 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg text-gray-900 dark:text-white placeholder-gray-400 transition-all"
                                    />
                                    {localSearchInput && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLocalSearchInput('');
                                                // If we want to clear the search immediately:
                                                // searchParams.delete('q');
                                                // setSearchParams(searchParams);
                                            }}
                                            className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </form>
                            </motion.div>
                            
                            <motion.p 
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-lg text-gray-500 dark:text-gray-400"
                            >
                                找到 <span className="font-bold text-gray-900 dark:text-white mx-1">{sortedPhotos.length}</span> 张
                                关键词匹配的照片
                            </motion.p>
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
            {createPortal(
                <AnimatePresence>
                    {showMobileFilter && (
                        <>
                            <motion.div
                                key="mobile-filter-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9998] md:hidden"
                                onClick={() => setShowMobileFilter(false)}
                            />
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none md:hidden">
                                <motion.div
                                    key="mobile-filter-panel"
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 max-h-[80vh] overflow-y-auto flex flex-col pointer-events-auto"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择分类</h3>
                                        <button 
                                            onClick={() => setFilter('all')} 
                                            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                        >
                                            重置
                                        </button>
                                    </div>

                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200/50 dark:via-gray-700/50 to-transparent mb-6 backdrop-blur-sm" />

                                    <div className="grid grid-cols-2 gap-3 mb-8">
                                        {[{ id: 'all', label: '全部主题', icon: <Grid className="w-4 h-4"/> }, ...categories
                                            .filter(c => c.value !== 'uncategorized')
                                            .map(c => {
                                                let IconNode: React.ReactNode = <ImageIcon className="w-4 h-4" />;
                                                if (c.icon && (LucideIcons as any)[c.icon]) {
                                                    const IconComponent = (LucideIcons as any)[c.icon];
                                                    IconNode = <IconComponent className="w-4 h-4" />;
                                                } else {
                                                    // Fallback mappings
                                                    if (c.value === 'landscape') IconNode = <ImageIcon className="w-4 h-4"/>;
                                                    else if (c.value === 'portrait') IconNode = <User className="w-4 h-4"/>;
                                                    else if (c.value === 'travel') IconNode = <Plane className="w-4 h-4"/>;
                                                }
                                                return {
                                                    id: c.value,
                                                    label: c.label,
                                                    icon: IconNode,
                                                };
                                            })
                                        ].map(cat => (
                                            <motion.button
                                                key={cat.id}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => {
                                                    setFilter(cat.id);
                                                    setTimeout(() => setShowMobileFilter(false), 150);
                                                }}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${
                                                    filter === cat.id 
                                                    ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                                    : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-xl ${
                                                    filter === cat.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    {cat.icon}
                                                </div>
                                                <span>{cat.label}</span>
                                            </motion.button>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={() => setShowMobileFilter(false)}
                                        className="w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        取消
                                    </button>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* 2. Sort Modal */}
            {createPortal(
                <AnimatePresence>
                    {showMobileSort && (
                        <>
                            <motion.div
                                key="mobile-sort-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9998] md:hidden"
                                onClick={() => setShowMobileSort(false)}
                            />
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none md:hidden">
                                <motion.div
                                    key="mobile-sort-panel"
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 max-h-[80vh] overflow-y-auto flex flex-col pointer-events-auto"
                                >
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
                                                <motion.button
                                                    key={option}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => {
                                                        setSortBy(option);
                                                        // 稍微延迟关闭以展示点击反馈
                                                        setTimeout(() => setShowMobileSort(false), 150);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${
                                                        sortBy === option 
                                                        ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-xl ${
                                                        sortBy === option ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                        {icon}
                                                    </div>
                                                    <span className="text-base">{option}</span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>

                                    <button 
                                        onClick={() => setShowMobileSort(false)}
                                        className="w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        取消
                                    </button>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* 3. Heatmap Modal */}
            {createPortal(
                <AnimatePresence>
                    {showMobileHeatmap && heatmapData && (
                        <>
                            <motion.div
                                key="mobile-heatmap-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9998] md:hidden"
                                onClick={() => setShowMobileHeatmap(false)}
                            />
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none md:hidden">
                                <motion.div
                                    key="mobile-heatmap-panel"
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full max-w-sm glass-panel rounded-2xl p-4 shadow-2xl ring-1 ring-white/10 max-h-[85vh] overflow-y-auto flex flex-col pointer-events-auto"
                                >
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
                                            variant="compact"
                                        />
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Desktop Heatmap Modal */}
            {heatmapData && (
                <HeatmapModal 
                    isOpen={showHeatmapModal}
                    onClose={() => setShowHeatmapModal(false)}
                    data={heatmapData.days}
                    year={heatmapYear}
                    onYearChange={setHeatmapYear}
                />
            )}

            {/* Filter Bar - Desktop Only */}
            <section className={`hidden md:block glass-nav transition-colors duration-300 relative z-40 ${!featuredPhoto && !urlSearchQuery ? 'mt-16' : ''}`}>
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
                            {[{ id: 'all', label: '全部主题', icon: <Grid className="w-4 h-4"/> }, ...categories
                                .filter(c => c.value !== 'uncategorized')
                                .map(c => {
                                    let IconNode: React.ReactNode = <ImageIcon className="w-4 h-4" />;
                                    if (c.icon && (LucideIcons as any)[c.icon]) {
                                        const IconComponent = (LucideIcons as any)[c.icon];
                                        IconNode = <IconComponent className="w-4 h-4" />;
                                    } else {
                                        // Fallback mappings
                                        if (c.value === 'landscape') IconNode = <ImageIcon className="w-4 h-4"/>;
                                        else if (c.value === 'portrait') IconNode = <User className="w-4 h-4"/>;
                                        else if (c.value === 'travel') IconNode = <Plane className="w-4 h-4"/>;
                                    }
                                    return {
                                        id: c.value,
                                        label: c.label,
                                        icon: IconNode,
                                    };
                                })
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilter(cat.id)}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                                        filter === cat.id 
                                        ? 'bg-primary text-white' 
                                        : 'bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                                    }`}
                                >
                                    {cat.icon}
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Custom Dropdown - Replaced with DropdownFilter */}
                        <div className="w-[180px] z-50">
                            <DropdownFilter
                                label="排序"
                                value={sortBy}
                                onChange={setSortBy}
                                options={sortOptions.map(o => ({ label: o, value: o }))}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Page Header - Removed per user request */}


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
                     <div className="flex flex-col items-center justify-center min-h-[50vh] py-12">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-surface-dark mb-6 p-4">
                            <ImageIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">暂无照片</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
                            {urlSearchQuery ? `未找到与 "${urlSearchQuery}" 相关的结果。` : '该分类下还没有上传照片。'}
                        </p>
                        {urlSearchQuery && (
                            <button onClick={clearSearch} className="px-4 py-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors">
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
