import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Image as ImageIcon, BarChart3, 
    Edit2, Trash2, Activity,
    Calendar, Filter, Camera, X, Sparkles, Upload,
    Loader2, Download, ThumbsUp, MessageSquare, User as UserIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { resolveAdminRoute } from '../utils/adminRoutes';
import { DonutHourlyChart } from '../components/DonutHourlyChart';
import { Heatmap } from '../components/Heatmap';
import { downloadCsv, downloadJson } from '../utils/exporters';
import { getPhotoUrl, getAvatarUrl } from '../utils/helpers';

// --- Components ---
const DropdownFilter = ({ 
    label, 
    value, 
    onChange, 
    options, 
    icon: Icon 
}: { 
    label: string; 
    value: string | number; 
    onChange: (val: any) => void; 
    options: { label: string; value: string | number }[];
    icon?: any;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || label;
    const isActive = value !== 'all';

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                    isActive 
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                        : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow'
                }`}
            >
                {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />}
                <span>{isActive ? selectedLabel : label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${isActive ? 'text-primary' : 'text-gray-400'}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1.5 space-y-0.5">
                        <button
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                value === 'all' 
                                    ? 'bg-primary/5 text-primary font-semibold' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border'
                            }`}
                            onClick={() => {
                                onChange('all');
                                setIsOpen(false);
                            }}
                        >
                            <span>{label}</span>
                            {value === 'all' && <Check className="w-4 h-4" />}
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-surface-border my-1" />
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                    value === opt.value 
                                        ? 'bg-primary/5 text-primary font-semibold' 
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border'
                                }`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="truncate">{opt.label}</span>
                                {value === opt.value && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple icons for DropdownFilter internal use if not imported
import { ChevronDown, Check } from 'lucide-react';

type Tab = 'photos' | 'stats' | 'users' | 'settings' | 'categories' | 'comments' | 'me_uploads';

type PageResponse<T> = {
    items: T[];
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number;
};

type ApiUser = {
    id: string;
    name: string;
    role: 'admin' | 'family';
    avatar: string;
    email: string | null;
    disabledAt?: string | null;
    createdAt: string;
};

type ApiCategory = {
    value: string;
    label: string;
    sortOrder: number;
};

type UploadTimelineItem = {
    day: string;
    count: number;
    photos: Array<{ id: string; title: string; thumbUrl: string | null; createdAt: string }>;
};

type UploadTimelineResponse = {
    from: string;
    to: string;
    keyword: string;
    limitDays: number;
    offsetDays: number;
    totalDays: number;
    items: UploadTimelineItem[];
};

type ActivitySummary = {
    today: string;
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActiveDay: string | null;
};

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const v = bytes / Math.pow(1024, i);
    const fixed = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
};

export const Admin: React.FC<{ hideLayout?: boolean }> = ({ hideLayout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser, updateUser } = useAuth();
    const { success, error } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('photos');
    
    // Check auth
    useEffect(() => {
        if (!currentUser) navigate('/login');
    }, [currentUser, navigate]);

    // Resolve route to tab
    useEffect(() => {
        if (!currentUser) return;
        const r = resolveAdminRoute(location.pathname, currentUser.role === 'admin');
        if (r.redirectTo) {
            navigate(r.redirectTo, { replace: true });
            return;
        }
        if (r.tab) setActiveTab(r.tab);
    }, [location.pathname, navigate, currentUser]);
    
    if (!currentUser) return null;

    const isMeAlbumsRoute = location.pathname.startsWith('/admin/me/albums');
    const isMeAnalyticsRoute = location.pathname.startsWith('/admin/me/analytics');
    const isMeUploadsRoute = location.pathname.startsWith('/admin/me/uploads');
    const isMeProfileRoute = location.pathname.startsWith('/admin/me/profile');

    // --- State & Queries for "Me" Photos ---
    const [albumMonth, setAlbumMonth] = useState<'all' | string>('all');
    const [albumCategory, setAlbumCategory] = useState<'all' | string>('all');
    const [albumCamera, setAlbumCamera] = useState<'all' | string>('all');
    const [albumPageSize, setAlbumPageSize] = useState(24);
    const [albumPage, setAlbumPage] = useState(1);

    useEffect(() => {
        setAlbumPage(1);
    }, [albumMonth, albumCamera, albumPageSize, albumCategory]);

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        enabled: isMeAlbumsRoute,
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });

    const { data: mePhotoFilters, isLoading: mePhotoFiltersLoading } = useQuery({
        queryKey: ['me-photos', 'filters'],
        enabled: isMeAlbumsRoute,
        queryFn: async () => {
            const res = await api.get<{ tags: string[]; cameras: string[]; months: { label: string; value: string }[] }>('/me/photos/filters');
            return res.data;
        },
    });

    const {
        data: mePhotosPage,
        isLoading: mePhotosLoading,
        isError: mePhotosError,
        refetch: refetchMePhotos,
    } = useQuery<PageResponse<any>>({
        queryKey: ['me-photos', 'page', albumPage, albumPageSize, albumMonth, albumCategory, albumCamera],
        enabled: isMeAlbumsRoute,
        queryFn: async () => {
            const params: Record<string, any> = {
                limit: albumPageSize,
                offset: (Math.max(1, albumPage) - 1) * albumPageSize,
            };
            if (albumMonth !== 'all') {
                const [y, m] = String(albumMonth).split('-');
                if (y && m) {
                    params.year = y;
                    params.month = m;
                }
            }
            if (albumCategory !== 'all') params.category = albumCategory;
            if (albumCamera !== 'all') params.camera = albumCamera;
            
            const res = await api.get<PageResponse<any>>('/me/photos/page', params);
            return res.data;
        },
    });

    const onThisDayLabel = useMemo(() => {
        const d = new Date();
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }, []);

    const {
        data: meOnThisDayPage,
        isLoading: meOnThisDayLoading,
        isError: meOnThisDayError,
        refetch: refetchMeOnThisDay,
    } = useQuery<PageResponse<any>>({
        queryKey: ['me-photos', 'on-this-day', onThisDayLabel],
        enabled: isMeAlbumsRoute,
        queryFn: async () => {
            const res = await api.get<PageResponse<any>>('/me/photos/page', {
                limit: 12,
                offset: 0,
                onThisDay: 1,
            });
            return res.data;
        },
    });

    // --- State & Queries for "Me" Analytics ---
    const [dailyGoalInput, setDailyGoalInput] = useState('');
    const statsRef = useRef<HTMLDivElement>(null);

    const handleExportPdf = async () => {
        if (!statsRef.current) return;
        try {
            const canvas = await html2canvas(statsRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#0b1219' : '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('my-statistics.pdf');
            success('PDF 导出成功');
        } catch (err) {
            console.error(err);
            error('PDF 导出失败');
        }
    };

    const {
        data: meHourlyAnalytics,
    } = useQuery<{ month: string; year: number; monthNumber: number; hours: number[]; total: number }>({
        queryKey: ['me-analytics', 'hourly'],
        enabled: isMeAnalyticsRoute,
        queryFn: async () => {
            const res = await api.get('/me/analytics/hourly');
            return res.data;
        },
    });

    const {
        data: meDailyGoal,
    } = useQuery<{ day: string; uploads: number; goal: number | null }>({
        queryKey: ['me-analytics', 'daily-goal'],
        enabled: isMeAnalyticsRoute || isMeProfileRoute,
        queryFn: async () => {
            const res = await api.get('/me/analytics/daily-goal');
            return res.data;
        },
    });

    const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());

    const { data: heatmapData } = useQuery<{
        startDate: string;
        endDate: string;
        days: Record<string, number>;
    }>({
        queryKey: ['activity', 'heatmap', heatmapYear],
        queryFn: async () => {
            const res = await api.get(`/activity/heatmap?year=${heatmapYear}`);
            return res.data;
        },
        enabled: isMeAnalyticsRoute,
    });

    const highestUploadDay = useMemo(() => {
        if (!heatmapData?.days) return null;
        let max = 0;
        let date = '';
        let total = 0;
        let activeDays = 0;
        
        Object.entries(heatmapData.days).forEach(([d, count]) => {
            if (count > 0) {
                total += count;
                activeDays++;
            }
            if (count > max) {
                max = count;
                date = d;
            }
        });
        
        if (!date) return null;
        
        const dayDate = new Date(date);
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        
        return {
            date,
            count: max,
            weekday: weekdays[dayDate.getDay()],
            avg: activeDays > 0 ? (total / activeDays).toFixed(1) : 0
        };
    }, [heatmapData]);

    const timeOfDayStats = useMemo(() => {
        if (!meHourlyAnalytics?.hours) return null;
        const h = meHourlyAnalytics.hours;
        // Morning: 6-11, Afternoon: 12-17, Evening: 18-23, Night: 0-5
        const morning = h.slice(6, 12).reduce((a, b) => a + b, 0);
        const afternoon = h.slice(12, 18).reduce((a, b) => a + b, 0);
        const evening = h.slice(18, 24).reduce((a, b) => a + b, 0);
        const night = h.slice(0, 6).reduce((a, b) => a + b, 0);
        
        const max = Math.max(morning, afternoon, evening, night);
        
        return { morning, afternoon, evening, night, max };
    }, [meHourlyAnalytics]);

    useEffect(() => {
        if (!isMeAnalyticsRoute && !isMeProfileRoute) return;
        if (!meDailyGoal) return;
        setDailyGoalInput(meDailyGoal.goal ? String(meDailyGoal.goal) : '');
    }, [isMeAnalyticsRoute, isMeProfileRoute, meDailyGoal]);

    const saveDailyGoalMutation = useMutation({
        mutationFn: async (goal: number) => {
            const res = await api.post('/me/analytics/daily-goal', { goal });
            return res.data as { goal: number | null };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['me-analytics', 'daily-goal'] });
            success('每日目标已保存');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '保存失败'));
        },
    });

    // --- State & Queries for "Me" Uploads ---
    const todayIso = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }, []);

    const defaultUploadsFrom = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }, []);

    const [uploadsFrom, setUploadsFrom] = useState(defaultUploadsFrom);
    const [uploadsTo, setUploadsTo] = useState(todayIso);
    const [uploadsKeyword, setUploadsKeyword] = useState('');
    const [uploadsOffsetDays, setUploadsOffsetDays] = useState(0);
    const [uploadsLimitDays, setUploadsLimitDays] = useState(14);

    useEffect(() => {
        setUploadsOffsetDays(0);
    }, [uploadsFrom, uploadsTo, uploadsKeyword, uploadsLimitDays]);

    const {
        data: uploadsTimeline,
        isLoading: uploadsLoading,
        isError: uploadsError,
    } = useQuery<UploadTimelineResponse>({
        queryKey: ['me-uploads', 'timeline', uploadsFrom, uploadsTo, uploadsKeyword, uploadsLimitDays, uploadsOffsetDays],
        enabled: isMeUploadsRoute,
        queryFn: async () => {
            const res = await api.get<UploadTimelineResponse>('/me/uploads/timeline', {
                from: uploadsFrom,
                to: uploadsTo,
                keyword: uploadsKeyword || undefined,
                limitDays: uploadsLimitDays,
                offsetDays: uploadsOffsetDays,
            });
            return res.data;
        },
    });

    const { data: activitySummary } = useQuery<ActivitySummary>({
        queryKey: ['activity-summary'],
        enabled: isMeUploadsRoute,
        queryFn: async () => {
            const res = await api.get('/activity/summary');
            return res.data;
        }
    });

    // --- State & Queries for "Me" Profile ---
    const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(currentUser));
    const [profileName, setProfileName] = useState<string>(currentUser?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPasswordSelf, setNewPasswordSelf] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

    useEffect(() => {
        setAvatarUrl(getAvatarUrl(currentUser));
    }, [currentUser]);

    useEffect(() => {
        setProfileName(currentUser?.name || '');
    }, [currentUser?.name]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('avatar', file);
            try {
                const res = await api.post('/users/avatar', formData);
                // 使用 getAvatarUrl 确保获取的是代理后的 URL
                const updatedUser = { ...currentUser, avatar: res.data.avatar };
                setAvatarUrl(getAvatarUrl(updatedUser));
                updateUser(updatedUser);
                success('头像已更新');
            } catch (err: any) {
                error(String(err?.data?.message || err?.message || '头像上传失败'));
            }
        }
    };

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            const name = profileName.trim();
            if (!name) throw new Error('显示名称不能为空');
            const res = await api.patch('/me/profile', { name });
            return res.data as any;
        },
        onSuccess: () => {
            updateUser({ ...currentUser, name: profileName });
            success('个人资料已更新');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '更新失败'));
        },
    });

    const changeMyPasswordMutation = useMutation({
        mutationFn: async () => {
            const next = newPasswordSelf;
            if (next !== newPasswordConfirm) throw new Error('两次输入的新密码不一致');
            const res = await api.post('/me/profile/password', { currentPassword, newPassword: next });
            return res.data as { ok: true };
        },
        onSuccess: () => {
            setCurrentPassword('');
            setNewPasswordSelf('');
            setNewPasswordConfirm('');
            success('密码已更新');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '修改密码失败'));
        },
    });

    // Render Logic
    return (
        <div className="w-full">
            {/* --- PHOTOS TAB (ME) --- */}
            {activeTab === 'photos' && isMeAlbumsRoute && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3"><ImageIcon className="w-8 h-8 text-primary" />我的照片</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                                记录您的每一次视觉捕捉与成长习惯。
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <DropdownFilter
                                label="所有月份"
                                value={albumMonth}
                                onChange={setAlbumMonth}
                                options={(mePhotoFilters?.months || []).map(m => ({ label: m.label, value: m.value }))}
                                icon={Calendar}
                            />
                            
                            <DropdownFilter
                                label="全部分类"
                                value={albumCategory}
                                onChange={setAlbumCategory}
                                options={categories.map(c => ({ label: c.label, value: c.value }))}
                                icon={Filter}
                            />
                            
                            <DropdownFilter
                                label="拍摄器材"
                                value={albumCamera}
                                onChange={setAlbumCamera}
                                options={(mePhotoFilters?.cameras || []).map(c => ({ label: c, value: c }))}
                                icon={Camera}
                            />
                            
                            {(albumMonth !== 'all' || albumCategory !== 'all' || albumCamera !== 'all') && (
                                <button
                                    onClick={() => {
                                        setAlbumMonth('all');
                                        setAlbumCategory('all');
                                        setAlbumCamera('all');
                                        setAlbumPageSize(24);
                                        setAlbumPage(1);
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="重置筛选"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6 mb-10">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-red-500" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">那年今日</h3>
                            <span className="text-gray-400 dark:text-gray-500 text-sm font-medium ml-2">在那一年的今天...</span>
                        </div>
                        
                        {meOnThisDayLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="aspect-video bg-gray-100 dark:bg-surface-border rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : meOnThisDayError ? (
                            <ErrorState onRetry={() => refetchMeOnThisDay()} />
                        ) : (meOnThisDayPage?.items || []).length === 0 ? (
                            <div className="bg-gray-50 dark:bg-surface-dark/50 border border-dashed border-gray-200 dark:border-surface-border rounded-2xl p-8 text-center">
                                <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-surface-border rounded-full flex items-center justify-center mb-3">
                                    <Calendar className="w-6 h-6 text-gray-400" />
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">今天暂无旧照</h3>
                                <p className="text-xs text-gray-500 mt-1">上传更多照片，记录每一个今天。</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(meOnThisDayPage?.items || []).slice(0, 3).map((p: any) => {
                                    const date = new Date(p.createdAt);
                                    const today = new Date();
                                    const yearsAgo = today.getFullYear() - date.getFullYear();
                                    
                                    return (
                                        <Link
                                            key={p.id}
                                            to={`/photo/${p.id}`}
                                            className="group relative aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ring-1 ring-black/5"
                                        >
                                            <img
                                                src={getPhotoUrl(p, 'medium')}
                                                alt={p.title}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                                            
                                            <div className="absolute bottom-0 left-0 p-6 text-white">
                                                <div className="text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/60"></span>
                                                    {yearsAgo > 0 ? `${yearsAgo}年前的今天` : '那一年的今天'}
                                                </div>
                                                <div className="text-xl font-bold tracking-tight">
                                                    {date.getFullYear()}年{date.getMonth() + 1}月{date.getDate()}日
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">全部照片</h3>
                        </div>

                        {mePhotoFiltersLoading || mePhotosLoading ? (
                            <LoadingState />
                        ) : mePhotosError ? (
                            <ErrorState onRetry={() => refetchMePhotos()} />
                        ) : (mePhotosPage?.items || []).length === 0 ? (
                            <EmptyState title="暂无照片" description="尝试调整筛选条件，或先去上传一张新照片。" />
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {(mePhotosPage?.items || []).map((p: any) => (
                                        <Link
                                            key={p.id}
                                            to={`/photo/${p.id}`}
                                            className="group relative bg-gray-100 dark:bg-surface-dark rounded-xl overflow-hidden aspect-square hover:ring-4 hover:ring-primary/10 transition-all"
                                        >
                                            <img
                                                src={getPhotoUrl(p, 'thumb')}
                                                alt={p.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                                            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/60 to-transparent">
                                                <p className="text-white text-xs font-medium truncate">{p.title}</p>
                                                <p className="text-white/70 text-[10px]">{new Date(p.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>

                                <div className="pt-4">
                                    <Pagination
                                        total={mePhotosPage?.total || 0}
                                        page={albumPage}
                                        pageSize={albumPageSize}
                                        onPageChange={(p) => setAlbumPage(p)}
                                        onPageSizeChange={(s) => {
                                            setAlbumPageSize(s);
                                            setAlbumPage(1);
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* --- STATS TAB (ME) --- */}
            {activeTab === 'stats' && isMeAnalyticsRoute && (
                <div className="space-y-8 animate-in fade-in duration-300" ref={statsRef}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                <BarChart3 className="w-8 h-8 text-primary" />
                                我的统计
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                                数据可视化您的创作习惯。
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportPdf}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                导出报告
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Activity & Goals */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Activity Ring & Hours */}
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-primary" />
                                    活跃时段分布
                                </h3>
                                <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
                                    <div className="relative">
                                        <DonutHourlyChart 
                                            hours={meHourlyAnalytics?.hours || []} 
                                            total={meHourlyAnalytics?.total || 0} 
                                        />
                                    </div>
                                    <div className="flex-1 w-full grid grid-cols-2 gap-4">
                                        {[
                                            { label: '清晨 (6-11)', value: timeOfDayStats?.morning, color: 'text-orange-400' },
                                            { label: '午后 (12-17)', value: timeOfDayStats?.afternoon, color: 'text-yellow-500' },
                                            { label: '傍晚 (18-23)', value: timeOfDayStats?.evening, color: 'text-blue-500' },
                                            { label: '深夜 (0-5)', value: timeOfDayStats?.night, color: 'text-purple-500' },
                                        ].map((item) => (
                                            <div key={item.label} className="bg-gray-50 dark:bg-surface-border/50 rounded-xl p-4">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{item.label}</div>
                                                <div className={`text-xl font-bold ${item.color}`}>
                                                    {item.value || 0} <span className="text-xs text-gray-400">张</span>
                                                </div>
                                                <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${item.color.replace('text-', 'bg-')}`} 
                                                        style={{ width: `${Math.min(100, ((item.value || 0) / (timeOfDayStats?.max || 1)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Heatmap */}
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        创作热力图
                                    </h3>
                                    <select
                                        value={heatmapYear}
                                        onChange={(e) => setHeatmapYear(Number(e.target.value))}
                                        className="bg-gray-50 dark:bg-surface-border border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-primary/20"
                                    >
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                            <option key={y} value={y}>{y}年</option>
                                        ))}
                                    </select>
                                </div>
                                <Heatmap data={heatmapData?.days || {}} year={heatmapYear} />
                            </div>
                        </div>

                        {/* Right Column: Insights & Goals */}
                        <div className="space-y-6">
                             {/* Daily Goal Card */}
                            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">每日目标</h3>
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-primary/30 text-2xl font-bold text-primary mb-2">
                                        {Math.round(((meDailyGoal?.uploads || 0) / (meDailyGoal?.goal || 1)) * 100)}%
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        今日已上传 {meDailyGoal?.uploads || 0} / {meDailyGoal?.goal || 0}
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={dailyGoalInput}
                                            onChange={(e) => setDailyGoalInput(e.target.value)}
                                            placeholder="设置目标..."
                                            className="flex-1 bg-white dark:bg-surface-dark border border-primary/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                        <button
                                            onClick={() => {
                                                const g = parseInt(dailyGoalInput);
                                                if (g > 0) saveDailyGoalMutation.mutate(g);
                                            }}
                                            disabled={!dailyGoalInput || saveDailyGoalMutation.isPending}
                                            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            保存
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        设定每日上传目标，保持创作动力。
                                    </p>
                                </div>
                            </div>

                            {/* Best Day Card */}
                            {highestUploadDay && (
                                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">最佳创作日</h3>
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{highestUploadDay.count}</span>
                                        <span className="text-sm text-gray-500">张</span>
                                    </div>
                                    <div className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                                        {highestUploadDay.date} ({highestUploadDay.weekday})
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        这是您今年创作最丰富的一天。
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- UPLOADS TAB (ME) --- */}
            {activeTab === 'me_uploads' && isMeUploadsRoute && (
                <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                <Activity className="w-8 h-8 text-primary" />
                                历史上传
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                                回顾您的上传历程与点滴。
                            </p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: '连续创作', value: activitySummary?.currentStreak || 0, unit: '天', icon: Sparkles },
                            { label: '最长连续', value: activitySummary?.longestStreak || 0, unit: '天', icon: Award => <Sparkles className="w-4 h-4" /> }, // Hacky icon
                            { label: '活跃天数', value: activitySummary?.totalActiveDays || 0, unit: '天', icon: Calendar },
                            { label: '最后活跃', value: activitySummary?.lastActiveDay || '-', unit: '', icon: Activity },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                                    <stat.icon className="w-4 h-4" />
                                    <span className="text-xs font-medium">{stat.label}</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                                    {stat.value} <span className="text-xs font-normal text-gray-500">{stat.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Timeline Controls */}
                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">日期范围:</span>
                            <input
                                type="date"
                                value={uploadsFrom}
                                onChange={(e) => setUploadsFrom(e.target.value)}
                                className="bg-gray-50 dark:bg-surface-border border-none rounded-lg text-sm px-3 py-1.5"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={uploadsTo}
                                onChange={(e) => setUploadsTo(e.target.value)}
                                className="bg-gray-50 dark:bg-surface-border border-none rounded-lg text-sm px-3 py-1.5"
                            />
                        </div>
                        <div className="flex-1">
                             <input
                                type="text"
                                placeholder="搜索照片标题..."
                                value={uploadsKeyword}
                                onChange={(e) => setUploadsKeyword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-surface-border border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Timeline List */}
                    {uploadsLoading ? (
                        <LoadingState />
                    ) : uploadsError ? (
                        <ErrorState />
                    ) : (uploadsTimeline?.items || []).length === 0 ? (
                        <EmptyState title="该时段无上传记录" />
                    ) : (
                        <div className="space-y-8 relative before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-gray-200 dark:before:bg-surface-border">
                            {uploadsTimeline?.items.map((dayItem) => (
                                <div key={dayItem.day} className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-10 h-10 flex items-center justify-center bg-white dark:bg-background-dark border-4 border-white dark:border-background-dark z-10">
                                        <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20"></div>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {dayItem.day}
                                            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-border text-xs font-medium text-gray-600 dark:text-gray-300">
                                                {dayItem.count} 张
                                            </span>
                                        </h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {dayItem.photos.map((p) => (
                                            <Link 
                                                key={p.id}
                                                to={`/photo/${p.id}`}
                                                className="group relative aspect-square bg-gray-100 dark:bg-surface-border rounded-lg overflow-hidden"
                                            >
                                                <img 
                                                    src={getPhotoUrl(p, 'thumb')} 
                                                    alt={p.title}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- SETTINGS TAB (ME PROFILE) --- */}
            {activeTab === 'settings' && isMeProfileRoute && (
                <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
                     <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                            <UserIcon className="w-8 h-8 text-primary" />
                            个人资料
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                            管理您的个人信息与安全设置。
                        </p>
                    </div>

                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-surface-border">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">基本信息</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="relative group">
                                    <img 
                                        src={avatarUrl} 
                                        alt={currentUser?.name} 
                                        className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-surface-border shadow-md"
                                    />
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Camera className="w-6 h-6" />
                                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                    </label>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">当前头像</div>
                                    <p className="text-xs text-gray-400">支持 JPG, PNG. 最大 2MB.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        显示名称
                                    </label>
                                    <input
                                        type="text"
                                        value={profileName}
                                        onChange={(e) => setProfileName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-surface-border border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        邮箱地址
                                    </label>
                                    <input
                                        type="email"
                                        value={currentUser?.email || ''}
                                        disabled
                                        className="w-full bg-gray-100 dark:bg-surface-border/50 border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                                
                                <div className="pt-2">
                                    <button
                                        onClick={() => updateProfileMutation.mutate()}
                                        disabled={updateProfileMutation.isPending}
                                        className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-70 flex items-center gap-2"
                                    >
                                        {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                        保存更改
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-surface-border">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">修改密码</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    当前密码
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-surface-border border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    新密码
                                </label>
                                <input
                                    type="password"
                                    value={newPasswordSelf}
                                    onChange={(e) => setNewPasswordSelf(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-surface-border border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    确认新密码
                                </label>
                                <input
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-surface-border border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => changeMyPasswordMutation.mutate()}
                                    disabled={changeMyPasswordMutation.isPending || !currentPassword || !newPasswordSelf}
                                    className="px-6 py-2.5 bg-white dark:bg-surface-border border border-gray-200 dark:border-surface-border text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-surface-border/80 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {changeMyPasswordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    更新密码
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
