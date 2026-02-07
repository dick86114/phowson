import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Plus, Image as ImageIcon, Settings, Users, BarChart3, 
    Edit2, Trash2, ArrowLeft, LogOut, TrendingUp, Activity, Smartphone, 
    Monitor, Save, Bell, Shield, Search, MoreHorizontal, Camera, Lock,
    Tag, X, AlertTriangle, Maximize2, Check, RefreshCw, Key, Download,
    PieChart, ThumbsUp, MessageSquare, User as UserIcon, Mail, Upload,
    Ban, Loader2, Sparkles, Menu, Languages, Sun, Moon, Target, ChevronDown, Calendar, Filter,
    Trophy, Zap, Flame, CalendarDays
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useModal, Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { resolveAdminRoute } from '../utils/adminRoutes';
import { DonutHourlyChart } from '../components/DonutHourlyChart';
import { Heatmap } from '../components/Heatmap';
import { downloadCsv, downloadJson, downloadPngFromElement } from '../utils/exporters';

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

type AdminComment = {
    id: string;
    photoId: string;
    photoTitle: string | null;
    content: string;
    createdAt: string;
    userId: string | null;
    guestId: string | null;
    guestNickname: string | null;
    guestEmail: string | null;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy: string | null;
    reviewedAt: string | null;
    reviewReason: string | null;
    clientIp: string | null;
    userAgent: string | null;
};

type SiteSettings = {
    siteName?: string;
    siteLogo?: string;
    documentTitle?: string;
    favicon?: string;
    defaultTheme?: 'light' | 'dark' | 'system';
};

type AdminCommentsResponse = {
    items: AdminComment[];
    total: number;
    limit: number;
    offset: number;
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

const toMediaUrl = (url: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE_URL}${url}`;
};

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const v = bytes / Math.pow(1024, i);
    const fixed = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
};

export const Admin: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser, logout, setSession, updateUser } = useAuth();
    const { alert, confirm } = useModal();
    const { success, error } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('photos');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectCommentIds, setRejectCommentIds] = useState<string[]>([]);

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

    // Gesture support
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe && isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
        }
        if (isRightSwipe && !isMobileMenuOpen && touchStart < 50) {
             setIsMobileMenuOpen(true);
        }
    };

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!currentUser) navigate('/login');
    }, [currentUser, navigate]);

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

    const isAdmin = currentUser?.role === 'admin';
    const isMeAlbumsRoute = location.pathname.startsWith('/admin/me/albums');
    const isManagePhotosRoute = location.pathname.startsWith('/admin/manage/photos');
    const isMeAnalyticsRoute = location.pathname.startsWith('/admin/me/analytics');
    const isManageAnalyticsRoute = location.pathname.startsWith('/admin/manage/analytics');
    const isMeUploadsRoute = location.pathname.startsWith('/admin/me/uploads');
    const isMeProfileRoute = location.pathname.startsWith('/admin/me/profile');
    const isManageSettingsRoute = location.pathname.startsWith('/admin/manage/settings');

    const { data: commentSummary } = useQuery({
        queryKey: ['admin-comments-summary'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get('/admin/comments/summary');
            return res.data as { pendingGuestCount: number };
        }
    });

    // Fetch photos
    const { data: photos = [], isLoading: photosLoading } = useQuery({
        queryKey: ['admin-photos'],
        enabled: activeTab === 'photos' && !isMeAlbumsRoute && !isManagePhotosRoute,
        queryFn: async () => {
            const res = await api.get('/photos');
            return res.data;
        }
    });

    const [albumMonth, setAlbumMonth] = useState<'all' | string>('all');
    const [albumCategory, setAlbumCategory] = useState<'all' | string>('all');
    const [albumCamera, setAlbumCamera] = useState<'all' | string>('all');
    const [albumPageSize, setAlbumPageSize] = useState(24);
    const [albumPage, setAlbumPage] = useState(1);

    useEffect(() => {
        setAlbumPage(1);
    }, [albumMonth, albumCamera, albumPageSize, albumCategory]);

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

    const [managePhotoMonth, setManagePhotoMonth] = useState<'all' | number>('all');
    const [managePhotoCategory, setManagePhotoCategory] = useState<'all' | string>('all');
    const [managePhotoOwnerId, setManagePhotoOwnerId] = useState<'all' | string>('all');
    const [managePhotoCamera, setManagePhotoCamera] = useState<'all' | string>('all');
    const [managePhotoTags, setManagePhotoTags] = useState<string[]>([]);
    const [managePhotoKeyword, setManagePhotoKeyword] = useState('');
    const [managePhotoPageSize, setManagePhotoPageSize] = useState(50);
    const [managePhotoPage, setManagePhotoPage] = useState(1);

    useEffect(() => {
        setManagePhotoPage(1);
    }, [
        managePhotoMonth,
        managePhotoCategory,
        managePhotoOwnerId,
        managePhotoCamera,
        managePhotoPageSize,
        managePhotoTags.join('|'),
        managePhotoKeyword,
    ]);

    const { data: adminPhotoFilters, isLoading: adminPhotoFiltersLoading } = useQuery<{
        tags: string[];
        cameras: string[];
    }>({
        queryKey: ['admin-photos', 'filters'],
        enabled: isManagePhotosRoute && isAdmin,
        queryFn: async () => {
            const res = await api.get('/admin/photos/filters');
            return res.data;
        },
    });

    const {
        data: adminPhotosPage,
        isLoading: adminPhotosLoading,
        isError: adminPhotosError,
        refetch: refetchAdminPhotos,
    } = useQuery<{
        items: any[];
        total: number;
        limit: number;
        offset: number;
    }>({
        queryKey: [
            'admin-photos',
            'page',
            managePhotoPage,
            managePhotoPageSize,
            managePhotoMonth,
            managePhotoCategory,
            managePhotoOwnerId,
            managePhotoCamera,
            managePhotoTags,
            managePhotoKeyword,
        ],
        enabled: isManagePhotosRoute && isAdmin,
        queryFn: async () => {
            const params: Record<string, any> = {
                limit: managePhotoPageSize,
                offset: (Math.max(1, managePhotoPage) - 1) * managePhotoPageSize,
            };
            if (managePhotoMonth !== 'all') params.month = managePhotoMonth;
            if (managePhotoCategory !== 'all') params.category = managePhotoCategory;
            if (managePhotoOwnerId !== 'all') params.ownerId = managePhotoOwnerId;
            if (managePhotoCamera !== 'all') params.camera = managePhotoCamera;
            if (managePhotoTags.length > 0) params.tags = managePhotoTags.join(',');
            const q = managePhotoKeyword.trim();
            if (q) params.q = q;
            const res = await api.get('/admin/photos/page', params);
            return res.data;
        },
    });

    const [dailyGoalInput, setDailyGoalInput] = useState('');
    const analyticsCardRef = useRef<HTMLDivElement | null>(null);

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
        refetch: refetchUploads,
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

    const {
        data: meHourlyAnalytics,
        isLoading: meHourlyLoading,
        isError: meHourlyError,
        refetch: refetchMeHourly,
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
        isLoading: meDailyGoalLoading,
        isError: meDailyGoalError,
        refetch: refetchMeDailyGoal,
    } = useQuery<{ day: string; uploads: number; goal: number | null }>({
        queryKey: ['me-analytics', 'daily-goal'],
        enabled: isMeAnalyticsRoute || isMeProfileRoute,
        queryFn: async () => {
            const res = await api.get('/me/analytics/daily-goal');
            return res.data;
        },
    });

    const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
    const [statsDateRange, setStatsDateRange] = useState('this_month');

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

    const { data: recentUploads } = useQuery<any[]>({
        queryKey: ['me-photos', 'recent'],
        queryFn: async () => {
            const res = await api.get('/me/photos/page', { limit: 5 });
            return res.data.items;
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
        
        // Find peak
        const max = Math.max(morning, afternoon, evening, night);
        const getTrend = (val: number) => {
             // Mock trend logic or just static for now as we don't have prev month hourly data
             return val > 0 ? 'up' : 'neutral'; 
        };
        
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

    // Fetch stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['admin-stats'],
        enabled: activeTab === 'stats' && !isMeAnalyticsRoute,
        queryFn: async () => {
            const res = await api.get('/stats/summary');
            return res.data;
        }
    });

    // Photo actions
    const deletePhotoMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/photos/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            setPhotoToDelete(null);
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '删除失败'));
            setPhotoToDelete(null);
        },
    });

    const [critiquePhotoId, setCritiquePhotoId] = useState<string | null>(null);
    const critiquePhotoMutation = useMutation({
        mutationFn: (id: string) => api.post(`/photos/${id}/ai-critique`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || 'AI 点评失败'));
        },
        onSettled: () => {
            setCritiquePhotoId(null);
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-all'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            setUserToDelete(null);
        }
    });

    const createUserMutation = useMutation({
        mutationFn: (body: { name: string; email: string; role: 'admin' | 'family'; password: string }) => api.post('/users', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-all'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            setIsUserModalOpen(false);
            setEditingUser(null);
        },
        onError: (err: any) => {
            setUserModalError(String(err?.data?.message || err?.message || '保存失败'));
        }
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, body }: { id: string; body: { name?: string; email?: string; role?: 'admin' | 'family' } }) => api.patch(`/users/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-all'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            setIsUserModalOpen(false);
            setEditingUser(null);
        },
        onError: (err: any) => {
            setUserModalError(String(err?.data?.message || err?.message || '保存失败'));
        }
    });

    const setUserStatusMutation = useMutation({
        mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) => api.patch(`/users/${id}/status`, { disabled }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-all'] });
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            success('用户状态已更新');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '操作失败'));
        },
    });

    const resetPasswordMutation = useMutation({
        mutationFn: ({ id, password }: { id: string; password: string }) => api.post(`/users/${id}/password`, { password }),
        onSuccess: () => {
            setResetPasswordSuccess(true);
        }
    });

    const createCategoryMutation = useMutation({
        mutationFn: (body: { value: string; label: string }) => api.post('/categories', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setNewCatLabel('');
            setNewCatValue('');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '添加分类失败'));
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: (value: string) => api.delete(`/categories/${value}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setCategoryToDelete(null);
        }
    });

    // Local states
    const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
    const [commentToDelete, setCommentToDelete] = useState<AdminComment | null>(null);
    const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState(toMediaUrl(currentUser?.avatar || `/media/avatars/${currentUser?.id || 'me'}`));
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const siteSettingsImportInputRef = useRef<HTMLInputElement>(null);
    const [profileName, setProfileName] = useState<string>(currentUser?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPasswordSelf, setNewPasswordSelf] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

    // Site Settings State
    const [siteSettingsForm, setSiteSettingsForm] = useState<SiteSettings>({
        siteName: '',
        siteLogo: '',
        documentTitle: '',
        favicon: '',
        defaultTheme: 'system',
    });

    const [commentStatus, setCommentStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [commentOnlyGuest, setCommentOnlyGuest] = useState(true);
    const [commentKeyword, setCommentKeyword] = useState('');
    const [commentFrom, setCommentFrom] = useState('');
    const [commentTo, setCommentTo] = useState('');
    const [commentUserId, setCommentUserId] = useState<'all' | 'guest' | string>('all');
    const [commentOffset, setCommentOffset] = useState(0);
    const [commentLimit, setCommentLimit] = useState(50);
    const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);

    useEffect(() => {
        setCommentOffset(0);
        setSelectedCommentIds([]);
    }, [commentStatus, commentOnlyGuest, commentKeyword, commentFrom, commentTo, commentUserId, commentLimit]);

    const effectiveUser = {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || '管理员',
        avatar: avatarUrl,
    };
    const simulatedRole = isAdmin ? 'admin' : 'family';

    const { data: usersAll = [], isLoading: usersAllLoading } = useQuery({
        queryKey: ['admin-users-all'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get<ApiUser[]>('/users');
            return res.data;
        },
    });

    const [userKeyword, setUserKeyword] = useState('');
    const [userRole, setUserRole] = useState<'all' | 'admin' | 'family'>('all');
    const [userStatus, setUserStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [userOffset, setUserOffset] = useState(0);
    const [userLimit, setUserLimit] = useState(50);

    useEffect(() => {
        setUserOffset(0);
    }, [userKeyword, userRole, userStatus, userLimit]);

    const { data: usersPage, isLoading: usersPageLoading } = useQuery<{
        items: ApiUser[];
        total: number;
        limit: number;
        offset: number;
    }>({
        queryKey: ['admin-users-page', userKeyword, userRole, userStatus, userLimit, userOffset],
        enabled: isAdmin && activeTab === 'users',
        queryFn: async () => {
            const params = new URLSearchParams();
            const q = userKeyword.trim();
            if (q) params.set('q', q);
            params.set('role', userRole);
            params.set('status', userStatus);
            params.set('limit', String(userLimit));
            params.set('offset', String(userOffset));
            const res = await api.get(`/users/page?${params.toString()}`);
            return res.data;
        },
    });

    const { data: siteSettingsData } = useQuery({
        queryKey: ['site-settings'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get('/admin/site-settings');
            return res.data;
        },
    });

    useEffect(() => {
        if (siteSettingsData) {
            setSiteSettingsForm({
                siteName: siteSettingsData.siteName || '',
                siteLogo: siteSettingsData.siteLogo || '',
                documentTitle: siteSettingsData.documentTitle || '',
                favicon: siteSettingsData.favicon || '',
                defaultTheme: siteSettingsData.defaultTheme || 'system',
            });
        }
    }, [siteSettingsData]);

    const { data: categories = [], isLoading: categoriesLoading } = useQuery({
        queryKey: ['categories'],
        enabled: true,
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });

    const { data: commentsData, isLoading: commentsLoading } = useQuery({
        queryKey: ['admin-comments', commentStatus, commentOnlyGuest, commentKeyword, commentFrom, commentTo, commentUserId, commentLimit, commentOffset],
        enabled: isAdmin && activeTab === 'comments',
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('status', commentStatus);
            params.set('onlyGuest', String(commentOnlyGuest && commentUserId === 'all'));
            const q = commentKeyword.trim();
            if (q) params.set('q', q);
            if (commentFrom) params.set('from', commentFrom);
            if (commentTo) params.set('to', commentTo);
            if (commentUserId !== 'all') params.set('userId', commentUserId);
            params.set('limit', String(commentLimit));
            params.set('offset', String(commentOffset));
            const res = await api.get<AdminCommentsResponse>(`/admin/comments?${params.toString()}`);
            return res.data;
        },
    });

    const moderateCommentMutation = useMutation({
        mutationFn: (payload: { id: string; status: 'approved' | 'rejected' | 'pending'; reason?: string | null }) => {
            return api.patch(`/admin/comments/${payload.id}`, { status: payload.status, reason: payload.reason || '' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '操作失败'));
        },
    });

    const deleteCommentMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/admin/comments/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
            setCommentToDelete(null);
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '删除失败'));
        },
    });

    const batchCommentMutation = useMutation({
        mutationFn: (payload: { action: 'approve' | 'reject' | 'delete'; ids: string[]; reason?: string }) => {
            return api.post('/admin/comments/batch', { action: payload.action, ids: payload.ids, reason: payload.reason || '' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
            setSelectedCommentIds([]);
            success('批量操作已完成');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '批量操作失败'));
        },
    });

    const visibleCommentIds = useMemo(() => {
        return (commentsData?.items || []).map((c: any) => String(c.id));
    }, [commentsData]);

    const isAllVisibleSelected = useMemo(() => {
        return visibleCommentIds.length > 0 && visibleCommentIds.every((id) => selectedCommentIds.includes(id));
    }, [visibleCommentIds, selectedCommentIds]);

    const categoryLabelByValue = useMemo(() => {
        const m = new Map<string, string>();
        for (const c of categories) {
            if (c?.value) m.set(String(c.value), String(c.label || c.value));
        }
        return m;
    }, [categories]);

    const [newCatLabel, setNewCatLabel] = useState('');
    const [newCatValue, setNewCatValue] = useState('');

    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
    const [userFormData, setUserFormData] = useState<{ name: string; email: string; role: 'family' | 'admin'; password: string }>({
        name: '',
        email: '',
        role: 'family',
        password: '',
    });
    const [userModalError, setUserModalError] = useState('');

    const [passwordModalUser, setPasswordModalUser] = useState<ApiUser | null>(null);
    const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [translatedComments, setTranslatedComments] = useState<Record<string, string>>({});

    // Sync avatar
    useEffect(() => {
        setAvatarUrl(toMediaUrl(currentUser?.avatar || `/media/avatars/${currentUser?.id || 'me'}`));
    }, [currentUser]);

    useEffect(() => {
        setProfileName(currentUser?.name || '');
    }, [currentUser?.name]);

    // Statistics Logic
    const summaryStats = useMemo(() => {
        const totalViews = photos.reduce((sum: number, p: any) => sum + (p.viewsCount || 0), 0);
        const totalLikes = photos.reduce((sum: number, p: any) => sum + (p.likesCount || 0), 0);
        const totalComments = photos.reduce((sum: number, p: any) => sum + (p.comments?.length || 0), 0);
        
        return { totalViews, totalLikes, totalComments };
    }, [photos]);


    // Handlers
    const confirmDeletePhoto = () => {
        if (photoToDelete) {
            deletePhotoMutation.mutate(photoToDelete);
        }
    };

    const confirmDeleteUser = () => {
        if (!userToDelete) return;
        deleteUserMutation.mutate(userToDelete);
    };

    const confirmDeleteCategory = () => {
        if (!categoryToDelete) return;
        deleteCategoryMutation.mutate(categoryToDelete);
    };

    const confirmDeleteComment = () => {
        if (!commentToDelete) return;
        deleteCommentMutation.mutate(commentToDelete.id);
    };

    const handleTranslate = async (comment: AdminComment) => {
        if (!comment.content) return;
        setTranslatingCommentId(comment.id);
        try {
            const res = await api.post('/admin/comments/translate', { text: comment.content });
            setTranslatedComments(prev => ({ ...prev, [comment.id]: res.data.translated }));
        } catch (e: any) {
            console.error('Translation failed', e);
            error(String(e?.response?.data?.message || e?.message || '请求失败'));
        } finally {
            setTranslatingCommentId(null);
        }
    };

    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault();
        const label = newCatLabel.trim();
        const value = newCatValue.trim();
        if (!label || !value) return;
        createCategoryMutation.mutate({ label, value });
    };

    const handleOpenUserModal = (user?: ApiUser) => {
        setUserModalError('');
        if (user) {
            setEditingUser(user);
            setUserFormData({ name: user.name, email: user.email || '', role: user.role, password: '' });
        } else {
            setEditingUser(null);
            setUserFormData({ name: '', email: '', role: 'family', password: '' });
        }
        setIsUserModalOpen(true);
    };

    const handleSaveUser = () => {
        const name = userFormData.name.trim();
        const email = userFormData.email.trim();
        const role = userFormData.role;
        const password = userFormData.password;

        if (!name) {
            setUserModalError('用户名不能为空');
            return;
        }
        if (!email) {
            setUserModalError('邮箱不能为空');
            return;
        }
        if (!editingUser && password.length < 6) {
            setUserModalError('新用户密码至少 6 位');
            return;
        }

        if (editingUser) {
            updateUserMutation.mutate({ id: editingUser.id, body: { name, email, role } });
        } else {
            createUserMutation.mutate({ name, email, role, password });
        }
    };

    const handleOpenPasswordModal = (user: ApiUser) => {
        setPasswordModalUser(user);
        setResetPasswordSuccess(false);
        setNewPassword('');
    };

    const handleResetPassword = () => {
        if (!passwordModalUser) return;
        if (!newPassword || newPassword.length < 6) return;
        resetPasswordMutation.mutate({ id: passwordModalUser.id, password: newPassword });
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('avatar', file);
            try {
                const res = await api.post('/users/avatar', formData);
                setAvatarUrl(toMediaUrl(res.data.avatar));
                updateUser({ ...currentUser, avatar: res.data.avatar });
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

    const updateSiteSettingsMutation = useMutation({
        mutationFn: (data: SiteSettings) => api.post('/admin/site-settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            // Refresh global settings cache if any
            queryClient.invalidateQueries({ queryKey: ['global-site-settings'] });
            success('网站设置已保存');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '保存失败'));
        },
    });

    const uploadFileMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/admin/upload', formData);
            return res.data.url;
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '上传失败'));
        },
    });

    const handleSiteSettingFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'siteLogo' | 'favicon') => {
        if (e.target.files && e.target.files[0]) {
            try {
                const url = await uploadFileMutation.mutateAsync(e.target.files[0]);
                setSiteSettingsForm(prev => ({ ...prev, [field]: url }));
            } catch (error) {
                // Error handled in mutation
            }
        }
    };

    const normalizeSiteSettings = (raw: any): SiteSettings => {
        if (!raw || typeof raw !== 'object') throw new Error('配置文件格式不正确');
        const payload: SiteSettings = {};
        if (raw.siteName != null) payload.siteName = String(raw.siteName);
        if (raw.siteLogo != null) payload.siteLogo = String(raw.siteLogo);
        if (raw.documentTitle != null) payload.documentTitle = String(raw.documentTitle);
        if (raw.favicon != null) payload.favicon = String(raw.favicon);
        if (raw.defaultTheme != null) {
            const v = String(raw.defaultTheme);
            if (v !== 'light' && v !== 'dark' && v !== 'system') throw new Error('defaultTheme 不合法');
            payload.defaultTheme = v as any;
        }
        return payload;
    };

    const personalMenuItems = [
        { key: 'me_albums', label: '我的照片', icon: ImageIcon, to: '/admin/me/albums' },
        { key: 'me_analytics', label: '我的统计', icon: BarChart3, to: '/admin/me/analytics' },
        { key: 'me_uploads', label: '我的历史', icon: Activity, to: '/admin/me/uploads' },
        { key: 'me_profile', label: '我的资料', icon: UserIcon, to: '/admin/me/profile' },
    ];

    const adminMenuItems = isAdmin ? [
        { key: 'manage_photos', label: '全部照片管理', icon: ImageIcon, to: '/admin/manage/photos' },
        { key: 'manage_analytics', label: '全部数据统计分析', icon: BarChart3, to: '/admin/manage/analytics' },
        { key: 'manage_comments', label: '评论管理', icon: MessageSquare, to: '/admin/manage/comments', badge: commentSummary?.pendingGuestCount || 0 },
        { key: 'manage_users', label: '用户管理', icon: Users, to: '/admin/manage/users' },
        { key: 'manage_categories', label: '分类管理', icon: Tag, to: '/admin/manage/categories' },
        { key: 'manage_settings', label: '系统设置', icon: Settings, to: '/admin/manage/settings' },
    ] : [];

    return (
        <div 
            className="min-h-screen bg-background-light dark:bg-background-dark flex transition-colors duration-300 touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`w-64 bg-white dark:bg-[#0b1219] border-r border-gray-200 dark:border-surface-border flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:translate-x-0 ${
                isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="p-6 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-primary transition-colors">
                        <div className="size-8 flex items-center justify-center text-primary bg-primary/10 rounded-lg">
                            <Camera className="w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">管理中心</h1>
                    </Link>
                    <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-4 pb-4">
                    <Link
                        to="/upload"
                        className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-3 rounded-lg font-medium transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        上传新照片
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                    <div className="px-2 pb-2 text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500">
                        个人
                    </div>
                    {personalMenuItems.map(item => {
                        const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                        return (
                            <button
                                key={item.key}
                                onClick={() => navigate(item.to)}
                                        aria-current={isActive ? 'page' : undefined}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                                    isActive
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark'
                                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b1219]`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="flex-1 text-left">{item.label}</span>
                            </button>
                        );
                    })}

                    {isAdmin ? (
                        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-surface-border">
                            <div className="px-2 pb-2 text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500">
                                管理员
                            </div>
                            {adminMenuItems.map(item => {
                                const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => navigate(item.to)}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                                            isActive
                                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark'
                                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b1219]`}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        <span className="flex-1 text-left">{item.label}</span>
                                        {Number((item as any).badge || 0) > 0 ? (
                                            <span className={`min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold ${
                                                isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                                            }`}>
                                                {(item as any).badge}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </nav>

                <div className="p-4 border-t border-gray-200 dark:border-surface-border">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-100 dark:bg-surface-dark/50 rounded-xl">
                        <img src={avatarUrl} alt="User" className="w-8 h-8 rounded-full border border-gray-200 dark:border-surface-border object-cover" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentUser?.name}</p>
                            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">{currentUser?.role}</p>
                        </div>
                    </div>
                    <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-surface-border hover:bg-gray-200 dark:hover:bg-[#2a4055] text-gray-800 dark:text-gray-100 text-sm transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        返回前台
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 p-4 lg:p-8 max-w-[1600px] mx-auto w-full overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden flex items-center justify-between mb-6">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        type="button"
                        aria-label="打开侧边栏菜单"
                        className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <Camera className="w-5 h-5 text-primary" />
                        <span className="font-bold">管理中心</span>
                    </Link>
                    <div className="w-8" /> {/* Spacer for centering */}
                </div>
                
                {/* --- PHOTOS TAB --- */}
                {activeTab === 'photos' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {isMeAlbumsRoute ? (
                            <>
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
                                                            src={toMediaUrl(p.url)}
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
                                                            src={toMediaUrl(p.thumbUrl || p.url)}
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
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {isManagePhotosRoute ? '全部照片管理' : '照片库'}
                                        </h2>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                                            {isAdmin ? '管理所有摄影作品' : '管理您上传的摄影作品'}
                                        </p>
                                    </div>
                                </div>

                                {isManagePhotosRoute ? (
                                    <>
                                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 shadow-sm">
                                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">月份</label>
                                                    <select
                                                        value={managePhotoMonth === 'all' ? 'all' : String(managePhotoMonth)}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setManagePhotoMonth(v === 'all' ? 'all' : Number(v));
                                                        }}
                                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                                    >
                                                        <option value="all">全部</option>
                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                            <option key={m} value={m}>
                                                                {m}月
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">分类</label>
                                                    <select
                                                        value={managePhotoCategory}
                                                        onChange={(e) => setManagePhotoCategory(e.target.value as any)}
                                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                                    >
                                                        <option value="all">全部</option>
                                                        {categories.map((c) => (
                                                            <option key={c.value} value={c.value}>
                                                                {c.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">上传者</label>
                                                    <select
                                                        value={managePhotoOwnerId}
                                                        onChange={(e) => setManagePhotoOwnerId(e.target.value as any)}
                                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                                    >
                                                        <option value="all">全部</option>
                                                        {usersAll.map((u) => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.name}（{u.id}）
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">相机型号</label>
                                                    <select
                                                        value={managePhotoCamera}
                                                        onChange={(e) => setManagePhotoCamera(e.target.value as any)}
                                                        disabled={adminPhotoFiltersLoading}
                                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary disabled:opacity-70"
                                                    >
                                                        <option value="all">全部</option>
                                                        {(adminPhotoFilters?.cameras || []).map((c) => (
                                                            <option key={c} value={c}>
                                                                {c}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">标签</label>
                                                    <select
                                                        multiple
                                                        value={managePhotoTags}
                                                        onChange={(e) => {
                                                            const next = Array.from(e.currentTarget.selectedOptions as unknown as HTMLOptionElement[]).map((o) => o.value);
                                                            next.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
                                                            setManagePhotoTags(next);
                                                        }}
                                                        disabled={adminPhotoFiltersLoading}
                                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary min-h-[44px] disabled:opacity-70"
                                                    >
                                                        {(adminPhotoFilters?.tags || []).map((t) => (
                                                            <option key={t} value={t}>
                                                                {t}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                        可多选（按住 Ctrl/⌘）
                                                    </div>
                                                </div>
                                                <div className="md:col-span-6">
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">关键词</label>
                                                    <div className="mt-1 flex items-center gap-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3">
                                                        <Search className="w-4 h-4 text-gray-400" />
                                                        <input
                                                            value={managePhotoKeyword}
                                                            onChange={(e) => setManagePhotoKeyword(e.target.value)}
                                                            placeholder="ID / 标题 / 描述 / 标签"
                                                            className="w-full bg-transparent py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between gap-3">
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    共 {adminPhotosPage?.total ?? 0} 张
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setManagePhotoMonth('all');
                                                        setManagePhotoCategory('all');
                                                        setManagePhotoOwnerId('all');
                                                        setManagePhotoCamera('all');
                                                        setManagePhotoTags([]);
                                                        setManagePhotoKeyword('');
                                                        setManagePhotoPageSize(50);
                                                        setManagePhotoPage(1);
                                                    }}
                                                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors"
                                                >
                                                    重置筛选
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden shadow-sm transition-colors">
                                            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-gray-200 dark:border-surface-border text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#111a22]">
                                                <div className="col-span-5">照片信息</div>
                                                <div className="col-span-2">参数</div>
                                                <div className="col-span-3">数据表现</div>
                                                <div className="col-span-2 text-right">操作</div>
                                            </div>
                                            <div className="divide-y divide-gray-200 dark:divide-surface-border">
                                                {adminPhotosLoading ? (
                                                    <LoadingState className="p-8" />
                                                ) : adminPhotosError ? (
                                                    <ErrorState onRetry={() => refetchAdminPhotos()} />
                                                ) : (adminPhotosPage?.items || []).map((photo: any) => {
                                                    let exif: any = {};
                                                    try {
                                                        exif = JSON.parse(photo.exif || '{}');
                                                    } catch {
                                                        exif = {};
                                                    }
                                                    const userName = String(photo?.user?.name || '');
                                                    const userId = String(photo?.user?.id || '');
                                                    return (
                                                        <div key={photo.id} className="flex flex-col md:grid md:grid-cols-12 gap-4 p-4 items-start md:items-center hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors group relative">
                                                            <div className="w-full md:col-span-5 flex items-center gap-4">
                                                                <div
                                                                    className="w-16 h-12 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    aria-label="预览照片"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                                            e.preventDefault();
                                                                            setPreviewPhotoUrl(toMediaUrl(photo.mediumUrl || photo.url));
                                                                        }
                                                                    }}
                                                                    onClick={() => setPreviewPhotoUrl(toMediaUrl(photo.mediumUrl || photo.url))}
                                                                >
                                                                    <img src={toMediaUrl(photo.thumbUrl || photo.url)} alt={photo.title} className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                        <Maximize2 className="w-4 h-4 text-white" />
                                                                    </div>
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1">{photo.title}</h3>
                                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-border text-gray-600 dark:text-gray-300">
                                                                            {categoryLabelByValue.get(String(photo.category || '')) || photo.category}
                                                                        </span>
                                                                        <span className="text-xs text-gray-500">{new Date(photo.createdAt).toLocaleDateString()}</span>
                                                                        {userId ? (
                                                                            <span className="text-xs text-gray-500">
                                                                                {userName || userId}
                                                                            </span>
                                                                        ) : null}
                                                                        {photo.aiCritique ? (
                                                                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                                <Sparkles className="w-3 h-3" />
                                                                                AI
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="w-full md:col-span-2 text-xs text-gray-500 dark:text-gray-400 grid grid-cols-2 md:block gap-1 md:space-y-1">
                                                                <div className="flex items-center gap-1"><Camera className="w-3 h-3" /> {exif.Model || '未知相机'}</div>
                                                                <div className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {photo.imageWidth && photo.imageHeight ? `${photo.imageWidth}×${photo.imageHeight}` : '未知分辨率'}</div>
                                                                <div className="flex items-center gap-1"><Upload className="w-3 h-3" /> {photo.imageSizeBytes ? formatBytes(photo.imageSizeBytes) : '未知大小'}</div>
                                                                <div className="flex items-center gap-1"><Tag className="w-3 h-3" /> {photo.tags?.split(',').length || 0} 个标签</div>
                                                            </div>
                                                            <div className="w-full md:col-span-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 border-t md:border-t-0 border-gray-100 dark:border-surface-border pt-2 md:pt-0">
                                                                <span className="flex items-center gap-1" title="浏览"><Activity className="w-4 h-4 text-blue-500" /> {photo.viewsCount}</span>
                                                                <span className="flex items-center gap-1" title="点赞"><ThumbsUp className="w-4 h-4 text-red-500" /> {photo.likesCount}</span>
                                                                <span className="flex items-center gap-1" title="评论"><MessageSquare className="w-4 h-4 text-green-500" /> {photo.comments?.length || 0}</span>
                                                            </div>
                                                            <div className="absolute top-4 right-4 md:static w-auto md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        setCritiquePhotoId(photo.id);
                                                                        critiquePhotoMutation.mutate(photo.id);
                                                                    }}
                                                                    disabled={critiquePhotoId === photo.id}
                                                                    aria-label={photo.aiCritique ? '更新 AI 点评' : '生成 AI 点评'}
                                                                    className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                                    title={photo.aiCritique ? '更新 AI 点评' : '生成 AI 点评'}
                                                                >
                                                                    {critiquePhotoId === photo.id ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Sparkles className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <Link to={`/edit/${photo.id}`} aria-label="编辑" className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark">
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Link>
                                                                <button
                                                                    onClick={() => setPhotoToDelete(photo.id)}
                                                                    aria-label="删除"
                                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {!adminPhotosLoading && !adminPhotosError && (adminPhotosPage?.items || []).length === 0 && (
                                                    <div className="p-8 text-center text-gray-500">暂无照片。</div>
                                                )}
                                            </div>
                                        </div>

                                        <Pagination
                                            total={adminPhotosPage?.total || 0}
                                            page={managePhotoPage}
                                            pageSize={managePhotoPageSize}
                                            onPageChange={(p) => setManagePhotoPage(p)}
                                            onPageSizeChange={(s) => {
                                                setManagePhotoPageSize(s);
                                                setManagePhotoPage(1);
                                            }}
                                        />
                                    </>
                                ) : (
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden shadow-sm transition-colors">
                                        <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-gray-200 dark:border-surface-border text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#111a22]">
                                            <div className="col-span-5">照片信息</div>
                                            <div className="col-span-2">参数</div>
                                            <div className="col-span-3">数据表现</div>
                                            <div className="col-span-2 text-right">操作</div>
                                        </div>
                                        <div className="divide-y divide-gray-200 dark:divide-surface-border">
                                            {photosLoading ? (
                                                <LoadingState className="p-8" />
                                            ) : photos.map((photo: any) => {
                                                let exif: any = {};
                                                try {
                                                    exif = JSON.parse(photo.exif || '{}');
                                                } catch {
                                                    exif = {};
                                                }
                                                return (
                                                    <div key={photo.id} className="flex flex-col md:grid md:grid-cols-12 gap-4 p-4 items-start md:items-center hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors group relative">
                                                        <div className="w-full md:col-span-5 flex items-center gap-4">
                                                            <div 
                                                                className="w-16 h-12 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-label="预览照片"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        setPreviewPhotoUrl(toMediaUrl(photo.mediumUrl || photo.url));
                                                                    }
                                                                }}
                                                                onClick={() => setPreviewPhotoUrl(toMediaUrl(photo.mediumUrl || photo.url))}
                                                            >
                                                                <img src={toMediaUrl(photo.thumbUrl || photo.url)} alt={photo.title} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                    <Maximize2 className="w-4 h-4 text-white" />
                                                                </div>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1">{photo.title}</h3>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-border text-gray-600 dark:text-gray-300">{categoryLabelByValue.get(String(photo.category || '')) || photo.category}</span>
                                                                    <span className="text-xs text-gray-500">{new Date(photo.createdAt).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="w-full md:col-span-2 text-xs text-gray-500 dark:text-gray-400 grid grid-cols-2 md:block gap-1 md:space-y-1">
                                                            <div className="flex items-center gap-1"><Camera className="w-3 h-3" /> {exif.Model || '未知相机'}</div>
                                                            <div className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {photo.imageWidth && photo.imageHeight ? `${photo.imageWidth}×${photo.imageHeight}` : '未知分辨率'}</div>
                                                            <div className="flex items-center gap-1"><Upload className="w-3 h-3" /> {photo.imageSizeBytes ? formatBytes(photo.imageSizeBytes) : '未知大小'}</div>
                                                            <div className="flex items-center gap-1"><Tag className="w-3 h-3" /> {photo.tags?.split(',').length || 0} 个标签</div>
                                                        </div>
                                                        <div className="w-full md:col-span-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 border-t md:border-t-0 border-gray-100 dark:border-surface-border pt-2 md:pt-0">
                                                            <span className="flex items-center gap-1" title="浏览"><Activity className="w-4 h-4 text-blue-500" /> {photo.viewsCount}</span>
                                                            <span className="flex items-center gap-1" title="点赞"><ThumbsUp className="w-4 h-4 text-red-500" /> {photo.likesCount}</span>
                                                            <span className="flex items-center gap-1" title="评论"><MessageSquare className="w-4 h-4 text-green-500" /> {photo.comments?.length || 0}</span>
                                                        </div>
                                                        <div className="absolute top-4 right-4 md:static w-auto md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <Link to={`/edit/${photo.id}`} aria-label="编辑" className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark">
                                                                <Edit2 className="w-4 h-4" />
                                                            </Link>
                                                            <button 
                                                                onClick={() => setPhotoToDelete(photo.id)}
                                                            aria-label="删除"
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {!photosLoading && photos.length === 0 && (
                                                <div className="p-8 text-center text-gray-500">暂无照片。</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* --- STATS TAB --- */}
                {activeTab === 'stats' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {isMeAnalyticsRoute ? (
                            <div ref={statsRef} className="flex flex-col xl:flex-row gap-6">
                                {/* Left Main Content */}
                                <div className="flex-1 space-y-6 min-w-0">
                                    {/* Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3"><BarChart3 className="w-8 h-8 text-primary" />我的统计</h2>
                                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">回顾您的创作历程与成就</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <DropdownFilter
                                                label="时间范围"
                                                value={statsDateRange}
                                                onChange={(val) => {
                                                     setStatsDateRange(val);
                                                     toast.success('时间筛选已更新 (演示)');
                                                }}
                                                options={[
                                                    { label: '最近30天', value: '30days' },
                                                    { label: '本月', value: 'this_month' },
                                                    { label: '今年', value: 'this_year' },
                                                ]}
                                                icon={Calendar}
                                            />
                                            <button 
                                                onClick={handleExportPdf}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span>导出 PDF</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Top Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Activity Ring */}
                                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm flex flex-col items-center justify-center relative min-h-[400px]">
                                            <h3 className="absolute top-6 left-6 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Activity className="w-5 h-5 text-primary" />
                                                活跃时段
                                            </h3>
                                            
                                            {meHourlyLoading ? (
                                                <LoadingState />
                                            ) : (
                                                <div className="w-full flex flex-col items-center">
                                                    <DonutHourlyChart 
                                                        hours={meHourlyAnalytics?.hours || []} 
                                                        size={280} 
                                                        strokeWidth={25}
                                                        ariaLabel="本月活跃度"
                                                    />
                                                    
                                                    {/* Redesigned Active Periods - Bar Chart Style */}
                                                    <div className="w-full mt-8 px-4">
                                                        <div className="flex items-end justify-between h-24 gap-4">
                                                            {[
                                                                { label: '凌晨', range: [0, 6] },
                                                                { label: '上午', range: [6, 12] },
                                                                { label: '下午', range: [12, 18] },
                                                                { label: '晚上', range: [18, 24] }
                                                            ].map((period, idx) => {
                                                                const count = meHourlyAnalytics?.hours?.slice(period.range[0], period.range[1]).reduce((a:number,b:number)=>a+b,0) || 0;
                                                                const total = meHourlyAnalytics?.total || 1;
                                                                const height = Math.max(15, Math.min(100, (count / (total * 0.5)) * 100)); // Scale relative to 50% of total for visibility
                                                                
                                                                return (
                                                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                                                                        <div className="text-xs font-bold text-gray-900 dark:text-white mb-1">{count}</div>
                                                                        <div className="w-full bg-gray-100 dark:bg-surface-border rounded-t-lg relative overflow-hidden" style={{ height: '80px' }}>
                                                                            <div 
                                                                                className="absolute bottom-0 left-0 right-0 bg-primary group-hover:brightness-110 transition-all rounded-t-lg"
                                                                                style={{ height: `${height}%` }}
                                                                            />
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">{period.label}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column of Top Grid */}
                                        <div className="grid grid-rows-2 gap-6 h-full">
                                            {/* Daily Goal - Read Only */}
                                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                                <div className="flex items-start justify-between">
                                                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                        <Target className="w-5 h-5 text-primary" />
                                                        每日目标
                                                    </h3>
                                                    <Link to="/admin/me/profile" className="text-xs text-primary hover:underline">
                                                        去设置
                                                    </Link>
                                                </div>
                                                <div className="mt-4 flex items-center gap-6 h-full">
                                                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                                            <path className="text-gray-100 dark:text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                                            <path className="text-primary transition-all duration-1000 ease-out" strokeDasharray={`${Math.min(100, ((meDailyGoal?.uploads || 0) / Math.max(1, meDailyGoal?.goal || 1)) * 100)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                                        </svg>
                                                        <div className="absolute flex flex-col items-center">
                                                            <span className="text-xl font-bold text-gray-900 dark:text-white">{meDailyGoal?.uploads || 0}</span>
                                                            <span className="text-[10px] text-gray-500">/{meDailyGoal?.goal || '-'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                                            {meDailyGoal?.goal && (meDailyGoal?.uploads || 0) >= meDailyGoal.goal 
                                                                ? '恭喜！今日目标已达成 🎉' 
                                                                : '继续加油，保持创作热情！'}
                                                        </p>
                                                        <div className="text-xs text-gray-500">
                                                            当前设置：{meDailyGoal?.goal ? `每天 ${meDailyGoal.goal} 张` : '未设置目标'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Top Upload Day */}
                                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                                    <Trophy className="w-5 h-5 text-yellow-500" />
                                                    最佳创作日
                                                </h3>
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-full">
                                                        <CalendarDays className="w-8 h-8 text-yellow-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                            {heatmapData?.days ? Object.entries(heatmapData.days).sort((a,b) => b[1]-a[1])[0]?.[0] || '暂无数据' : '暂无数据'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            单日上传 {heatmapData?.days ? Object.entries(heatmapData.days).sort((a,b) => b[1]-a[1])[0]?.[1] || 0 : 0} 张
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Heatmap Section */}
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Flame className="w-5 h-5 text-orange-500" />
                                                创作热力图
                                            </h3>
                                        </div>
                                        <div className="overflow-hidden">
                                            <Heatmap 
                                                data={heatmapData?.days || {}} 
                                                year={heatmapYear}
                                                onYearChange={setHeatmapYear}
                                                startDate={new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString().split('T')[0]} 
                                                endDate={new Date().toISOString().split('T')[0]}
                                                variant="grid"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Sidebar - Recent Uploads */}
                                <div className="w-full xl:w-80 shrink-0">
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl shadow-sm sticky top-6">
                                        <div className="p-4 border-b border-gray-100 dark:border-surface-border flex items-center justify-between">
                                            <h3 className="font-bold text-gray-900 dark:text-white">最近上传</h3>
                                            <Link to="/admin/me/uploads" className="text-xs text-primary hover:underline">查看全部</Link>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-surface-border max-h-[600px] overflow-y-auto custom-scrollbar">
                                            {recentUploads?.map((photo: any) => (
                                                <div key={photo.id} className="p-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors group">
                                                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-surface-border overflow-hidden shrink-0">
                                                        <img 
                                                            src={toMediaUrl(photo.thumbUrl || photo.url)} 
                                                            alt={photo.title}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">{photo.title || '无标题'}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                {new Date(photo.createdAt).toLocaleDateString()}
                                                            </span>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-surface-border rounded text-gray-600 dark:text-gray-300">
                                                                {photo.width}x{photo.height}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!recentUploads || recentUploads.length === 0) && (
                                                <div className="p-8 text-center text-gray-500 text-sm">暂无最近上传</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {isManageAnalyticsRoute ? '全部数据统计分析' : '数据仪表盘'}
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1">网站流量、内容表现与用户互动分析</p>
                                </div>

                                {statsLoading ? (
                                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>
                                ) : (
                                    <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg"><Activity className="w-6 h-6" /></div>
                                            <span className="text-xs font-medium text-green-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {Math.max(0, (statsData?.uploadTrend?.slice(-7).reduce((a: number, b: any) => a + (b?.count || 0), 0) || 0))}</span>
                                        </div>
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{summaryStats.totalViews}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">总浏览量</p>
                                    </div>
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="p-3 bg-red-500/10 text-red-500 rounded-lg"><ThumbsUp className="w-6 h-6" /></div>
                                            <span className="text-xs font-medium text-green-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {summaryStats.totalLikes}</span>
                                        </div>
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{summaryStats.totalLikes}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">总点赞数</p>
                                    </div>
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-lg"><Download className="w-6 h-6" /></div>
                                            <span className="text-xs font-medium text-gray-500">总量</span>
                                        </div>
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{statsData?.summary?.total_photos ?? photos.length}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">照片总数</p>
                                    </div>
                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="p-3 bg-green-500/10 text-green-500 rounded-lg"><MessageSquare className="w-6 h-6" /></div>
                                            <span className="text-xs font-medium text-green-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {(photos.reduce((sum: number, p: any) => sum + (p.comments?.length || 0), 0))}</span>
                                        </div>
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{summaryStats.totalComments}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">互动评论</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-6">上传趋势 (近7天)</h3>
                                        <div className="h-64 flex items-end justify-between gap-2 md:gap-4 px-2 overflow-x-auto">
                                            {(statsData?.uploadTrend || []).slice(-7).map((t: any, i: number, arr: any[]) => {
                                                const max = Math.max(1, ...arr.map((x: any) => x.count || 0));
                                                const val = t.count || 0;
                                                const pct = Math.round((val / max) * 100);
                                                return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                    <div 
                                                        className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-lg transition-all relative group-hover:shadow-[0_0_20px_rgba(19,127,236,0.3)]"
                                                        style={{ height: `${pct}%` }}
                                                    >
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-surface-border text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {val}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-gray-500">{String(t.date || '').slice(5)}</span>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                            <PieChart className="w-4 h-4 text-primary" />
                                            内容分类占比
                                        </h3>
                                        <div className="space-y-5">
                                            {statsData?.categoryDistribution?.map((cat: any, idx: number) => {
                                                const total = statsData.categoryDistribution.reduce((sum: number, c: any) => sum + c.count, 0);
                                                const percentage = total > 0 ? Math.round((cat.count / total) * 100) : 0;
                                                const label = categoryLabelByValue.get(String(cat.category || '')) || cat.category;
                                                return (
                                                    <div key={idx}>
                                                        <div className="flex justify-between text-sm mb-2">
                                                            <span className="text-gray-600 dark:text-gray-300">{label}</span>
                                                            <span className="text-gray-900 dark:text-white font-medium">{cat.count} 张 ({percentage}%)</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-gray-100 dark:bg-surface-border rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(!statsData?.categoryDistribution || statsData.categoryDistribution.length === 0) && <p className="text-sm text-gray-500 text-center py-4">暂无数据</p>}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'me_uploads' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-6">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                        <Activity className="w-8 h-8 text-primary" />
                                        我的历史
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">回顾每一次快门瞬间与足迹</p>
                                </div>

                                {/* Filters */}
                                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400">开始日期</label>
                                            <input
                                                type="date"
                                                value={uploadsFrom}
                                                onChange={(e) => setUploadsFrom(e.target.value)}
                                                className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400">结束日期</label>
                                            <input
                                                type="date"
                                                value={uploadsTo}
                                                onChange={(e) => setUploadsTo(e.target.value)}
                                                className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-500 dark:text-gray-400">关键词</label>
                                            <div className="mt-1 flex items-center gap-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3">
                                                <Search className="w-4 h-4 text-gray-400" />
                                                <input
                                                    value={uploadsKeyword}
                                                    onChange={(e) => setUploadsKeyword(e.target.value)}
                                                    placeholder="标题 / 描述 / 标签"
                                                    className="flex-1 bg-transparent py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-surface-border pt-3">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            筛选结果：共 {uploadsTimeline?.totalDays ?? 0} 天有记录
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUploadsFrom(defaultUploadsFrom);
                                                setUploadsTo(todayIso);
                                                setUploadsKeyword('');
                                                setUploadsLimitDays(14);
                                                setUploadsOffsetDays(0);
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            重置筛选
                                        </button>
                                    </div>
                                </div>

                                {/* Timeline */}
                                {uploadsLoading ? (
                                    <LoadingState />
                                ) : uploadsError ? (
                                    <ErrorState onRetry={() => refetchUploads()} />
                                ) : (uploadsTimeline?.items || []).length === 0 ? (
                                    <EmptyState title="暂无记录" description="尝试调整日期范围或关键词。" />
                                ) : (
                                    <div className="space-y-8 relative pl-4">
                                        {/* Vertical Line */}
                                        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-surface-border" />

                                        {(uploadsTimeline?.items || []).map((d) => {
                                            const count = d.count;
                                            let badgeColor = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                                            let badgeText = "日常记录";
                                            let badgeIcon = CalendarDays;

                                            if (count >= 20) {
                                                badgeColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                                                badgeText = "创作爆发";
                                                badgeIcon = Flame;
                                            } else if (count >= 10) {
                                                badgeColor = "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
                                                badgeText = "灵感涌现";
                                                badgeIcon = Zap;
                                            } else if (count >= 5) {
                                                badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                                                badgeText = "持续产出";
                                                badgeIcon = TrendingUp;
                                            }

                                            const BadgeIcon = badgeIcon;

                                            return (
                                                <div key={d.day} className="relative pl-8">
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-full border-4 border-background-light dark:border-background-dark flex items-center justify-center z-10 ${badgeColor}`}>
                                                        <BadgeIcon className="w-3.5 h-3.5" />
                                                    </div>

                                                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{d.day}</h3>
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeColor}`}>
                                                                        {badgeText}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                                    <span>共上传 <span className="font-bold text-gray-900 dark:text-white">{d.count}</span> 张照片</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                            {(d.photos || []).map((p) => (
                                                                <Link
                                                                    key={p.id}
                                                                    to={`/photo/${p.id}`}
                                                                    className="group relative aspect-square bg-gray-100 dark:bg-[#111a22] rounded-lg overflow-hidden border border-gray-100 dark:border-surface-border"
                                                                >
                                                                    <img
                                                                        src={toMediaUrl(p.thumbUrl || `/media/photos/${p.id}`)}
                                                                        alt={p.title}
                                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                                        loading="lazy"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                                </Link>
                                                            ))}
                                                            {d.count > (d.photos?.length || 0) && (
                                                                <div className="flex items-center justify-center aspect-square rounded-lg bg-gray-50 dark:bg-surface-border/50 text-xs text-gray-500 dark:text-gray-400 font-medium border border-dashed border-gray-200 dark:border-surface-border">
                                                                    +{d.count - (d.photos?.length || 0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <div className="pl-8 pt-4">
                                            <Pagination
                                                total={uploadsTimeline?.totalDays || 0}
                                                pageSize={uploadsLimitDays}
                                                page={Math.floor(uploadsOffsetDays / Math.max(1, uploadsLimitDays)) + 1}
                                                onPageChange={(p) => setUploadsOffsetDays((Math.max(1, p) - 1) * uploadsLimitDays)}
                                                onPageSizeChange={(s) => {
                                                    setUploadsLimitDays(s);
                                                    setUploadsOffsetDays(0);
                                                }}
                                                pageSizeOptions={[7, 14, 30, 60]}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Sidebar - Stats */}
                            <div className="w-full md:w-80 space-y-6">
                                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-5 shadow-sm sticky top-6">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        <h3 className="font-bold text-gray-900 dark:text-white">成就概览</h3>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">总活跃天数</div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-black text-gray-900 dark:text-white">{activitySummary?.totalActiveDays || 0}</span>
                                                <span className="text-xs text-gray-400">天</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-border rounded-full mt-2 overflow-hidden">
                                                <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-gray-50 dark:bg-surface-border/30 rounded-lg p-3">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                    <Flame className="w-3 h-3 text-orange-500" />
                                                    当前连续
                                                </div>
                                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                                    {activitySummary?.currentStreak || 0} <span className="text-xs font-normal text-gray-400">天</span>
                                                </div>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-surface-border/30 rounded-lg p-3">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                                    <Trophy className="w-3 h-3 text-yellow-500" />
                                                    最长连续
                                                </div>
                                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                                    {activitySummary?.longestStreak || 0} <span className="text-xs font-normal text-gray-400">天</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-gray-100 dark:border-surface-border">
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-3">活跃度等级说明</h4>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                                        <span className="text-gray-600 dark:text-gray-300">创作爆发</span>
                                                    </div>
                                                    <span className="text-gray-400">≥ 20 张/天</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                        <span className="text-gray-600 dark:text-gray-300">灵感涌现</span>
                                                    </div>
                                                    <span className="text-gray-400">10-19 张/天</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                        <span className="text-gray-600 dark:text-gray-300">持续产出</span>
                                                    </div>
                                                    <span className="text-gray-400">5-9 张/天</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                                        <span className="text-gray-600 dark:text-gray-300">日常记录</span>
                                                    </div>
                                                    <span className="text-gray-400">1-4 张/天</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- COMMENTS TAB (Admin Only) --- */}
                {activeTab === 'comments' && isAdmin && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">评论审核</h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                    默认仅展示游客待审核评论
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                                    待审核：{commentSummary?.pendingGuestCount || 0}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">状态</label>
                                    <select
                                        value={commentStatus}
                                        onChange={(e) => setCommentStatus(e.target.value as any)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="pending">待审核</option>
                                        <option value="approved">已通过</option>
                                        <option value="rejected">已拒绝</option>
                                        <option value="all">全部</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">来源</label>
                                    <select
                                        value={commentOnlyGuest ? 'guest' : 'all'}
                                        onChange={(e) => setCommentOnlyGuest(e.target.value === 'guest')}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="guest">仅游客</option>
                                        <option value="all">全部</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">作者</label>
                                    <select
                                        value={commentUserId}
                                        onChange={(e) => {
                                            const v = e.target.value as any;
                                            setCommentUserId(v);
                                            if (v !== 'all') setCommentOnlyGuest(false);
                                        }}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="all">全部</option>
                                        <option value="guest">游客</option>
                                        {(usersAll || []).map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}（{u.id}）
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">开始日期</label>
                                    <input
                                        type="date"
                                        value={commentFrom}
                                        onChange={(e) => setCommentFrom(e.target.value)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">结束日期</label>
                                    <input
                                        type="date"
                                        value={commentTo}
                                        onChange={(e) => setCommentTo(e.target.value)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-gray-500 dark:text-gray-400">关键词</label>
                                    <div className="mt-1 flex items-center gap-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3">
                                        <Search className="w-4 h-4 text-gray-400" />
                                        <input
                                            value={commentKeyword}
                                            onChange={(e) => setCommentKeyword(e.target.value)}
                                            placeholder="内容 / 昵称 / 邮箱"
                                            className="w-full bg-transparent py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 shadow-sm flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
                            <div className="text-sm text-gray-700 dark:text-gray-200">
                                已选 <span className="font-bold">{selectedCommentIds.length}</span> 条
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <button
                                    type="button"
                                    disabled={visibleCommentIds.length === 0}
                                    onClick={() => {
                                        setSelectedCommentIds((prev) => {
                                            const s = new Set(prev);
                                            if (isAllVisibleSelected) {
                                                visibleCommentIds.forEach((id) => s.delete(id));
                                            } else {
                                                visibleCommentIds.forEach((id) => s.add(id));
                                            }
                                            return Array.from(s);
                                        });
                                    }}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isAllVisibleSelected ? '取消全选本页' : '全选本页'}
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedCommentIds.length === 0 || batchCommentMutation.isPending}
                                    onClick={() => batchCommentMutation.mutate({ action: 'approve', ids: selectedCommentIds })}
                                    className="px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    批量通过
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedCommentIds.length === 0 || batchCommentMutation.isPending}
                                    onClick={() => {
                                        setRejectCommentIds(selectedCommentIds);
                                        setRejectReason('');
                                        setRejectModalOpen(true);
                                    }}
                                    className="px-3 py-2 rounded-lg text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    批量拒绝
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedCommentIds.length === 0 || batchCommentMutation.isPending}
                                    onClick={() =>
                                        confirm({
                                            title: '确认批量删除',
                                            content: `将删除所选 ${selectedCommentIds.length} 条评论，且无法恢复。是否继续？`,
                                            onConfirm: () => batchCommentMutation.mutate({ action: 'delete', ids: selectedCommentIds }),
                                        })
                                    }
                                    className="px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    批量删除
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedCommentIds.length === 0}
                                    onClick={() => setSelectedCommentIds([])}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    清空选择
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden shadow-sm">
                            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-gray-200 dark:border-surface-border text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#111a22]">
                                <div className="col-span-1">选择</div>
                                <div className="col-span-3">照片</div>
                                <div className="col-span-4">评论内容</div>
                                <div className="col-span-2">游客信息</div>
                                <div className="col-span-1">状态</div>
                                <div className="col-span-1 text-right">操作</div>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-surface-border">
                                {commentsLoading ? (
                                    <LoadingState className="p-8" />
                                ) : (commentsData?.items || []).map((c) => {
                                    const statusLabel = c.status === 'pending' ? '待审核' : c.status === 'approved' ? '通过' : '拒绝';
                                    const statusCls = c.status === 'pending'
                                        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                                        : c.status === 'approved'
                                            ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                                            : 'bg-red-500/10 text-red-700 dark:text-red-300';
                                    return (
                                        <div key={c.id} className="flex flex-col md:grid md:grid-cols-12 gap-4 p-4 hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors md:items-center">
                                            <div className="md:col-span-1 flex items-start md:items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCommentIds.includes(c.id)}
                                                    onChange={() => {
                                                        setSelectedCommentIds((prev) =>
                                                            prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                                                        );
                                                    }}
                                                    className="mt-1 md:mt-0 w-4 h-4 accent-primary"
                                                />
                                            </div>
                                            <div className="md:col-span-3 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                                                    {c.photoTitle || c.photoId}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                                                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                                                    <Link to={`/photo/${c.photoId}`} className="text-primary hover:underline">查看</Link>
                                                </div>
                                            </div>
                                            <div className="md:col-span-4 min-w-0">
                                                <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                                                    {c.content}
                                                </div>
                                                {translatedComments[c.id] && (
                                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-gray-700 dark:text-gray-300 border border-blue-100 dark:border-blue-800/30">
                                                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">
                                                            <Languages className="w-3 h-3" />
                                                            <span>翻译结果</span>
                                                        </div>
                                                        {translatedComments[c.id]}
                                                    </div>
                                                )}
                                                {c.reviewReason ? (
                                                    <div className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                                                        拒绝原因：{c.reviewReason}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="md:col-span-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                                <div className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {c.guestNickname || '游客'}</div>
                                                <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.guestEmail || '-'}</div>
                                            </div>
                                            <div className="md:col-span-1">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusCls}`}>{statusLabel}</span>
                                            </div>
                                            <div className="md:col-span-1 flex md:justify-end gap-2">
                                                <button
                                                    onClick={() => handleTranslate(c)}
                                                    disabled={!!translatingCommentId}
                                                    aria-label="翻译"
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                                                    title="翻译"
                                                >
                                                    {translatingCommentId === c.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Languages className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => moderateCommentMutation.mutate({ id: c.id, status: 'approved' })}
                                                    disabled={moderateCommentMutation.isPending}
                                                    aria-label="通过"
                                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                                                    title="通过"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setRejectCommentIds([c.id]);
                                                        setRejectReason('');
                                                        setRejectModalOpen(true);
                                                    }}
                                                    disabled={moderateCommentMutation.isPending}
                                                    aria-label="拒绝"
                                                    className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                                                    title="拒绝"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setCommentToDelete(c)}
                                                    aria-label="删除"
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {!commentsLoading && (commentsData?.items || []).length === 0 && (
                                    <div className="p-8 text-center text-gray-500">暂无符合条件的评论</div>
                                )}
                            </div>
                        </div>

                        <Pagination
                            total={commentsData?.total || 0}
                            pageSize={commentLimit}
                            page={Math.floor(commentOffset / Math.max(1, commentLimit)) + 1}
                            onPageChange={(p) => setCommentOffset((Math.max(1, p) - 1) * commentLimit)}
                            onPageSizeChange={(s) => {
                                setCommentLimit(s);
                                setCommentOffset(0);
                            }}
                        />
                    </div>
                )}

                {/* --- USERS TAB (Admin Only) --- */}
                {activeTab === 'users' && isAdmin && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">用户管理</h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">管理后台访问权限与角色</p>
                            </div>
                            <button 
                                onClick={() => handleOpenUserModal()}
                                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-primary/20"
                            >
                                <Plus className="w-4 h-4" />
                                新增用户
                            </button>
                        </div>

                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-4 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                                <div className="md:col-span-3">
                                    <label className="text-xs text-gray-500 dark:text-gray-400">关键词</label>
                                    <div className="mt-1 flex items-center gap-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3">
                                        <Search className="w-4 h-4 text-gray-400" />
                                        <input
                                            value={userKeyword}
                                            onChange={(e) => setUserKeyword(e.target.value)}
                                            placeholder="ID / 名称 / 邮箱"
                                            className="w-full bg-transparent py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">角色</label>
                                    <select
                                        value={userRole}
                                        onChange={(e) => setUserRole(e.target.value as any)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="all">全部</option>
                                        <option value="admin">管理员</option>
                                        <option value="family">家庭成员</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">状态</label>
                                    <select
                                        value={userStatus}
                                        onChange={(e) => setUserStatus(e.target.value as any)}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="all">全部</option>
                                        <option value="enabled">正常</option>
                                        <option value="disabled">已禁用</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1 flex items-end justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserKeyword('');
                                            setUserRole('all');
                                            setUserStatus('all');
                                            setUserLimit(50);
                                            setUserOffset(0);
                                        }}
                                        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors"
                                    >
                                        重置
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden shadow-sm transition-colors">
                            {/* Table Header - Hidden on mobile */}
                            <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 dark:bg-[#111a22] text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-surface-border">
                                <div className="col-span-5">用户</div>
                                <div className="col-span-2">角色</div>
                                <div className="col-span-3">状态</div>
                                <div className="col-span-2 text-right">操作</div>
                            </div>
                            
                            <div className="divide-y divide-gray-200 dark:divide-surface-border">
                                {usersPageLoading ? (
                                    <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                                        <Loader2 className="inline-block w-5 h-5 animate-spin" />
                                    </div>
                                ) : (usersPage?.items || []).map(user => {
                                    const isSelf = user.id === effectiveUser.id;
                                    const isDisabled = Boolean(user.disabledAt);
                                    return (
                                        <div key={user.id} className="flex flex-col md:grid md:grid-cols-12 gap-4 p-4 items-start md:items-center hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors">
                                            {/* User Info */}
                                            <div className="w-full md:col-span-5 flex items-center gap-3">
                                                <img src={toMediaUrl(user.avatar)} alt={user.name} className="w-10 h-10 rounded-full border border-gray-200 dark:border-surface-border object-cover" />
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                        {user.name}
                                                        {isSelf && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">我</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{user.email || `ID: ${user.id}`}</div>
                                                </div>
                                            </div>

                                            {/* Role & Status Row on Mobile */}
                                            <div className="w-full flex items-center justify-between md:contents">
                                                <div className="md:col-span-2">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                                        user.role === 'admin' 
                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-500' 
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-500'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                                <div className="md:col-span-3">
                                                    {isDisabled ? (
                                                        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-500">
                                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                            已禁用
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
                                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                            正常
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="w-full md:col-span-2 flex items-center justify-end gap-2 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-surface-border">
                                                <button
                                                    type="button"
                                                    disabled={isSelf || setUserStatusMutation.isPending}
                                                    onClick={() =>
                                                        confirm({
                                                            title: isDisabled ? '确认启用用户' : '确认禁用用户',
                                                            content: isDisabled
                                                                ? '启用后，该用户将恢复登录与访问权限。'
                                                                : '禁用后，该用户将无法登录与访问任何受保护页面。',
                                                            onConfirm: () => setUserStatusMutation.mutate({ id: user.id, disabled: !isDisabled }),
                                                        })
                                                    }
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        isSelf
                                                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                            : isDisabled
                                                              ? 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10'
                                                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                                    }`}
                                                    title={isDisabled ? '启用' : '禁用'}
                                                >
                                                    {isDisabled ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenPasswordModal(user)}
                                                    className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors"
                                                    title="重置密码"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenUserModal(user)}
                                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    title="编辑"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setUserToDelete(user.id)}
                                                    disabled={isSelf}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        isSelf 
                                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                                    }`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Pagination
                            total={usersPage?.total || 0}
                            pageSize={userLimit}
                            page={Math.floor(userOffset / Math.max(1, userLimit)) + 1}
                            onPageChange={(p) => setUserOffset((Math.max(1, p) - 1) * userLimit)}
                            onPageSizeChange={(s) => {
                                setUserLimit(s);
                                setUserOffset(0);
                            }}
                        />
                    </div>
                )}

                {/* --- CATEGORIES TAB (Admin Only) --- */}
                {activeTab === 'categories' && isAdmin && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">分类管理</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">定义照片的分类体系</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                {categoriesLoading ? (
                                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                                        <Loader2 className="inline-block w-5 h-5 animate-spin" />
                                    </div>
                                ) : categories.map((cat) => (
                                    <div key={cat.value} className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl group hover:border-primary/50 transition-colors shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-gray-100 dark:bg-[#111a22] rounded-lg text-gray-500 dark:text-gray-400">
                                                <Tag className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-gray-900 dark:text-white font-medium">{cat.label}</h3>
                                                <p className="text-xs text-gray-500">Value: {cat.value}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setCategoryToDelete(cat.value)}
                                            disabled={cat.value === 'uncategorized'}
                                            className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                                cat.value === 'uncategorized'
                                                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                            }`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 h-fit shadow-sm">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4">添加新分类</h3>
                                <form onSubmit={handleAddCategory} className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">显示名称 (Label)</label>
                                        <input 
                                            type="text" 
                                            value={newCatLabel}
                                            onChange={(e) => setNewCatLabel(e.target.value)}
                                            className="w-full mt-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                                            placeholder="例如：黑白摄影"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">系统值 (Value)</label>
                                        <input 
                                            type="text" 
                                            value={newCatValue}
                                            onChange={(e) => setNewCatValue(e.target.value)}
                                            className="w-full mt-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                                            placeholder="例如：bnw"
                                            required
                                        />
                                    </div>
                                    <button 
                                        type="submit"
                                        className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg font-medium transition-colors mt-2"
                                    >
                                        添加分类
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SETTINGS TAB --- */}
                {activeTab === 'settings' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                {isManageSettingsRoute ? <Settings className="w-8 h-8 text-primary" /> : <UserIcon className="w-8 h-8 text-primary" />} {isManageSettingsRoute ? '系统设置' : isMeProfileRoute ? '我的资料' : isAdmin ? '系统设置' : '我的资料'}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                                {isManageSettingsRoute
                                    ? '管理网站全局配置与备份恢复'
                                    : isMeProfileRoute
                                      ? '管理您的个人信息与账号安全'
                                      : isAdmin
                                        ? '管理网站全局配置和个人偏好'
                                        : '管理您的个人信息'}
                            </p>
                        </div>

                        {/* Site Settings (Admin Only) */}
                        {isAdmin && !isMeProfileRoute && (
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-primary" />
                                    网站设置
                                </h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">网站名称</label>
                                            <input 
                                                type="text" 
                                                value={siteSettingsForm.siteName || ''}
                                                onChange={(e) => setSiteSettingsForm({...siteSettingsForm, siteName: e.target.value})}
                                                placeholder="显示在Header和Footer的名称"
                                                className="w-full mt-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">浏览器标题</label>
                                            <input 
                                                type="text" 
                                                value={siteSettingsForm.documentTitle || ''}
                                                onChange={(e) => setSiteSettingsForm({...siteSettingsForm, documentTitle: e.target.value})}
                                                placeholder="浏览器标签页标题"
                                                className="w-full mt-2 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Logo Upload */}
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-2 block">网站 Logo</label>
                                            <div className="flex items-center gap-4">
                                                {siteSettingsForm.siteLogo ? (
                                                    <div className="relative w-16 h-16 bg-gray-100 dark:bg-[#111a22] rounded-lg border border-gray-200 dark:border-surface-border flex items-center justify-center overflow-hidden">
                                                        <img src={toMediaUrl(siteSettingsForm.siteLogo)} alt="Logo" className="max-w-full max-h-full object-contain" />
                                                        <button 
                                                            type="button"
                                                            aria-label="移除网站 Logo"
                                                            onClick={() => setSiteSettingsForm({...siteSettingsForm, siteLogo: ''})}
                                                            className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl shadow-sm hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-red-500"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-16 h-16 bg-gray-50 dark:bg-[#111a22] rounded-lg border border-dashed border-gray-300 dark:border-surface-border flex items-center justify-center text-gray-400">
                                                        <ImageIcon className="w-6 h-6" />
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="cursor-pointer bg-white dark:bg-surface-border text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-surface-border hover:bg-gray-50 dark:hover:bg-[#2a4055] transition-colors inline-flex items-center gap-2">
                                                        <Upload className="w-3 h-3" />
                                                        上传图片
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="image/*"
                                                            onChange={async (e) => {
                                                                if (e.target.files?.[0]) {
                                                                    try {
                                                                        const url = await uploadFileMutation.mutateAsync(e.target.files[0]);
                                                                        setSiteSettingsForm(prev => ({ ...prev, siteLogo: url }));
                                                                    } catch {}
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                    <p className="text-xs text-gray-500 mt-1">建议尺寸 64x64 或更高</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Favicon Upload */}
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-2 block">网站 Favicon</label>
                                            <div className="flex items-center gap-4">
                                                {siteSettingsForm.favicon ? (
                                                    <div className="relative w-16 h-16 bg-gray-100 dark:bg-[#111a22] rounded-lg border border-gray-200 dark:border-surface-border flex items-center justify-center overflow-hidden">
                                                        <img src={toMediaUrl(siteSettingsForm.favicon)} alt="Favicon" className="w-8 h-8 object-contain" />
                                                        <button 
                                                            type="button"
                                                            aria-label="移除网站 Favicon"
                                                            onClick={() => setSiteSettingsForm({...siteSettingsForm, favicon: ''})}
                                                            className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl shadow-sm hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-red-500"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-16 h-16 bg-gray-50 dark:bg-[#111a22] rounded-lg border border-dashed border-gray-300 dark:border-surface-border flex items-center justify-center text-gray-400">
                                                        <Settings className="w-6 h-6" />
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="cursor-pointer bg-white dark:bg-surface-border text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-surface-border hover:bg-gray-50 dark:hover:bg-[#2a4055] transition-colors inline-flex items-center gap-2">
                                                        <Upload className="w-3 h-3" />
                                                        上传图片
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg"
                                                            onChange={async (e) => {
                                                                if (e.target.files?.[0]) {
                                                                    try {
                                                                        const url = await uploadFileMutation.mutateAsync(e.target.files[0]);
                                                                        setSiteSettingsForm(prev => ({ ...prev, favicon: url }));
                                                                    } catch {}
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                    <p className="text-xs text-gray-500 mt-1">建议 .ico 或 .png 格式</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">默认主题模式</label>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {[
                                                { val: 'light', label: '浅色模式', icon: Sun },
                                                { val: 'dark', label: '深色模式', icon: Moon },
                                                { val: 'system', label: '跟随系统', icon: Monitor },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.val}
                                                    onClick={() => setSiteSettingsForm({...siteSettingsForm, defaultTheme: opt.val as any})}
                                                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border transition-all ${
                                                        siteSettingsForm.defaultTheme === opt.val
                                                        ? 'bg-primary/5 border-primary text-primary ring-1 ring-primary'
                                                        : 'bg-gray-50 dark:bg-[#111a22] border-gray-200 dark:border-surface-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-border'
                                                    }`}
                                                >
                                                    <opt.icon className="w-4 h-4" />
                                                    <span className="text-xs font-medium">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100 dark:border-surface-border flex justify-end">
                                        <button
                                            onClick={() => updateSiteSettingsMutation.mutate(siteSettingsForm)}
                                            disabled={updateSiteSettingsMutation.isPending}
                                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-70"
                                        >
                                            {updateSiteSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            保存全局设置
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isManageSettingsRoute && isAdmin && (
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Download className="w-5 h-5 text-primary" />
                                    配置备份与恢复
                                </h3>
                                <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                        导出为 JSON 备份；导入将覆盖当前全局配置。
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => downloadJson(siteSettingsForm, `站点配置-${todayIso}.json`)}
                                            className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            导出 JSON
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => siteSettingsImportInputRef.current?.click()}
                                            className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
                                        >
                                            <Upload className="w-4 h-4" />
                                            导入并应用
                                        </button>
                                        <input
                                            ref={siteSettingsImportInputRef}
                                            type="file"
                                            accept="application/json,.json"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                e.target.value = '';
                                                if (!file) return;
                                                try {
                                                    const text = await file.text();
                                                    const raw = JSON.parse(text);
                                                    const payload = normalizeSiteSettings(raw);
                                                    confirm({
                                                        title: '确认导入配置',
                                                        content: '导入后将覆盖当前网站全局配置，是否继续？',
                                                        onConfirm: () => updateSiteSettingsMutation.mutate({ ...siteSettingsForm, ...payload }),
                                                    });
                                                } catch (err: any) {
                                                    error(String(err?.message || '配置导入失败'));
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Profile Settings */}
                        {!isManageSettingsRoute && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Profile Card */}
                                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm h-full">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                        <UserIcon className="w-5 h-5 text-primary" />
                                        基本信息
                                    </h3>
                                    <div className="flex items-start gap-6">
                                        <div className="relative group cursor-pointer flex-shrink-0" onClick={() => avatarInputRef.current?.click()}>
                                            <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-gray-200 dark:border-surface-border object-cover transition-opacity group-hover:opacity-75" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="w-6 h-6 text-white drop-shadow-md" />
                                            </div>
                                            <input 
                                                type="file" 
                                                ref={avatarInputRef}
                                                onChange={handleAvatarUpload}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                        </div>
                                        
                                        <div className="space-y-4 flex-1">
                                            <div>
                                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">显示名称</label>
                                                <input 
                                                    type="text" 
                                                    value={profileName} 
                                                    onChange={(e) => setProfileName(e.target.value)} 
                                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white text-sm" 
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">当前角色</label>
                                                <input type="text" value={simulatedRole} disabled className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-500 text-sm capitalize" />
                                            </div>
                                            <div className="pt-2">
                                                <button 
                                                    onClick={() => updateProfileMutation.mutate()} 
                                                    className="bg-gray-100 dark:bg-white text-gray-900 dark:text-black hover:bg-gray-200 dark:hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full md:w-auto"
                                                >
                                                    更新资料
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Daily Goal Card */}
                                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm h-full">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-primary" />
                                        每日目标
                                    </h3>
                                    {meDailyGoalLoading ? (
                                        <LoadingState />
                                    ) : meDailyGoalError ? (
                                        <ErrorState onRetry={() => refetchMeDailyGoal()} />
                                    ) : (
                                        <div className="flex flex-col gap-6">
                                            <div>
                                                <div className="text-sm text-gray-700 dark:text-gray-200">
                                                    今日已上传 <span className="font-bold">{meDailyGoal?.uploads ?? 0}</span> 张
                                                    {meDailyGoal?.goal ? (
                                                        <>
                                                            ，目标 <span className="font-bold">{meDailyGoal.goal}</span> 张
                                                        </>
                                                    ) : (
                                                        <>，未设置目标</>
                                                    )}
                                                </div>

                                                {meDailyGoal?.goal ? (
                                                    <div className="mt-3">
                                                        <div className="h-2 w-full bg-gray-100 dark:bg-surface-border rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary rounded-full"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        100,
                                                                        Math.round(((meDailyGoal.uploads || 0) / Math.max(1, meDailyGoal.goal)) * 100)
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                            完成度：{Math.min(
                                                                100,
                                                                Math.round(((meDailyGoal.uploads || 0) / Math.max(1, meDailyGoal.goal)) * 100)
                                                            )}%
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 dark:text-gray-400">每日上传目标（填 0 可关闭）</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={dailyGoalInput}
                                                        onChange={(e) => setDailyGoalInput(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                                                        onKeyDown={(e) => {
                                                            if (e.key !== 'Enter') return;
                                                            const n = Number.parseInt(dailyGoalInput || '0', 10) || 0;
                                                            saveDailyGoalMutation.mutate(n);
                                                        }}
                                                        inputMode="numeric"
                                                        className="flex-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                                        placeholder="例如：3"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={saveDailyGoalMutation.isPending}
                                                        onClick={() => {
                                                            const n = Number.parseInt(dailyGoalInput || '0', 10) || 0;
                                                            saveDailyGoalMutation.mutate(n);
                                                        }}
                                                        className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        保存
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Account Security */}
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-primary" />
                                    账号安全
                                </h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">当前密码</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                                placeholder="已有密码时必填"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">新密码</label>
                                            <input
                                                type="password"
                                                value={newPasswordSelf}
                                                onChange={(e) => setNewPasswordSelf(e.target.value)}
                                                className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                                placeholder="至少 8 位，含字母与数字"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">确认新密码</label>
                                            <input
                                                type="password"
                                                value={newPasswordConfirm}
                                                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                                className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                                placeholder="再次输入"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 flex-col md:flex-row">
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            <p>退出登录将清除会话并返回首页</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={changeMyPasswordMutation.isPending}
                                                onClick={() => changeMyPasswordMutation.mutate()}
                                                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <Key className="w-4 h-4" />
                                                修改密码
                                            </button>
                                            <button
                                                onClick={() =>
                                                    confirm({
                                                        title: '确认退出登录',
                                                        content: '是否退出当前账号？',
                                                        onConfirm: async () => {
                                                            try {
                                                                await api.post('/auth/logout', {});
                                                            } catch {}
                                                            logout();
                                                            navigate('/');
                                                        },
                                                    })
                                                }
                                                className="flex items-center gap-2 bg-gray-100 dark:bg-surface-border hover:bg-gray-200 dark:hover:bg-[#2a4055] text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                退出登录
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                )}
            </main>

            {/* --- MODALS --- */}
            {/* Same logic for modals, just update styles to support light mode */}
            {previewPhotoUrl && (
                <div 
                    className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setPreviewPhotoUrl(null)}
                >
                    <img src={previewPhotoUrl} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button
                        type="button"
                        aria-label="关闭预览"
                        className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            )}

            {(photoToDelete || userToDelete || categoryToDelete || commentToDelete) && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">确认删除?</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">此操作无法撤销，数据将被永久移除。</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => { setPhotoToDelete(null); setUserToDelete(null); setCategoryToDelete(null); setCommentToDelete(null); }} 
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={() => { if(photoToDelete) confirmDeletePhoto(); if(userToDelete) confirmDeleteUser(); if(categoryToDelete) confirmDeleteCategory(); if(commentToDelete) confirmDeleteComment(); }}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={deletePhotoMutation.isPending || deleteUserMutation.isPending || deleteCategoryMutation.isPending || deleteCommentMutation.isPending}
                            >
                                {deletePhotoMutation.isPending || deleteUserMutation.isPending || deleteCategoryMutation.isPending || deleteCommentMutation.isPending ? '正在删除...' : '确认删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isUserModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingUser ? '编辑用户' : '新增用户'}
                            </h3>
                            <button
                                type="button"
                                aria-label="关闭"
                                onClick={() => setIsUserModalOpen(false)}
                                className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                            >
                                <X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-white" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400">用户名</label>
                                <input 
                                    type="text" 
                                    value={userFormData.name}
                                    onChange={(e) => setUserFormData({...userFormData, name: e.target.value})}
                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400">邮箱</label>
                                <input 
                                    type="email" 
                                    value={userFormData.email}
                                    onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400">角色权限</label>
                                <select 
                                    value={userFormData.role}
                                    onChange={(e) => setUserFormData({...userFormData, role: e.target.value as any})}
                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                >
                                    <option value="family">Family (家庭成员)</option>
                                    <option value="admin">Admin (管理员)</option>
                                </select>
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="text-sm text-gray-500 dark:text-gray-400">初始密码</label>
                                    <input 
                                        type="password" 
                                        value={userFormData.password}
                                        onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            )}

                            {userModalError && (
                                <div className="text-sm text-red-500">{userModalError}</div>
                            )}
                            <button onClick={handleSaveUser} className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg font-medium transition-colors mt-2">
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {passwordModalUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" />
                                重置密码
                            </h3>
                            <button
                                type="button"
                                aria-label="关闭"
                                onClick={() => setPasswordModalUser(null)}
                                className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-dark"
                            >
                                <X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-white" />
                            </button>
                        </div>
                        
                        {!resetPasswordSuccess ? (
                            <div className="space-y-4">
                                <div className="bg-gray-50 dark:bg-[#111a22] p-3 rounded-lg flex items-center gap-3">
                                    <img src={toMediaUrl(passwordModalUser.avatar)} className="w-8 h-8 rounded-full" alt="" />
                                    <div>
                                        <p className="text-sm text-gray-900 dark:text-white font-medium">{passwordModalUser.name}</p>
                                        <p className="text-xs text-gray-500">正在为该用户设置新密码</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">新密码</label>
                                    <input 
                                        type="password" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="输入新密码"
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                        autoFocus
                                    />
                                </div>
                                <button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending} className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition-colors">
                                    确认重置
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-500 mb-3">
                                    <Check className="w-6 h-6" />
                                </div>
                                <h4 className="text-gray-900 dark:text-white font-medium">密码重置成功</h4>
                                <p className="text-xs text-gray-500 mt-1">该用户现在可以使用新密码登录</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Modal
                isOpen={rejectModalOpen}
                onClose={() => {
                    setRejectModalOpen(false);
                    setRejectCommentIds([]);
                }}
                title="拒绝评论"
                footer={
                    <>
                        <button
                            onClick={() => {
                                setRejectModalOpen(false);
                                setRejectCommentIds([]);
                            }}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={() => {
                                const ids = rejectCommentIds.filter(Boolean);
                                if (ids.length === 0) return;
                                if (ids.length === 1) {
                                    moderateCommentMutation.mutate({ id: ids[0], status: 'rejected', reason: rejectReason });
                                } else {
                                    batchCommentMutation.mutate({ action: 'reject', ids, reason: rejectReason });
                                }
                                setRejectModalOpen(false);
                                setRejectCommentIds([]);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            确认拒绝
                        </button>
                    </>
                }
            >
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        拒绝原因（可选）
                    </label>
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-surface-dark text-gray-900 dark:text-white"
                        rows={4}
                        placeholder="请输入拒绝原因..."
                        autoFocus
                    />
                </div>
            </Modal>
        </div>
    );
};
