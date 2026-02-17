import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Search, Calendar, Download, Sparkles, Tag, Trash2, 
    Edit2, Maximize2, Activity, ThumbsUp, MessageSquare, 
    Upload, Image as ImageIcon, Camera, Lock, User as UserIcon,
    Loader2, X, Check, ArrowUp, ArrowDown, Plane, HelpCircle,
    Mountain, FileText, Building, Film, Eye, RefreshCw, Square, CheckCircle2, AlertCircle
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const StyledCheckbox = ({ checked, onChange, label, className }: { checked: boolean, onChange: () => void, label?: string, className?: string }) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        className={`flex items-center gap-3 cursor-pointer group/checkbox ${className}`}
    >
        <div className={`
            w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-200 shrink-0
            ${checked 
                ? 'bg-primary border-primary text-white shadow-sm scale-100' 
                : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 group-hover/checkbox:border-primary dark:group-hover/checkbox:border-primary scale-95 group-hover/checkbox:scale-100'
            }
        `}>
            <Check className={`w-3.5 h-3.5 stroke-[3] transition-transform duration-200 ${checked ? 'scale-100' : 'scale-0'}`} />
        </div>
        {label && <span className="select-none">{label}</span>}
    </div>
);
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { useModal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';
import { Pagination } from '../../../components/Pagination';
import { LoadingState, ErrorState } from '../../../components/States';
import { DropdownFilter } from '../../../components/admin/DropdownFilter';
import DateRangePicker from '../../../components/DateRangePicker';
import { getPhotoUrl, getAvatarUrl, formatBytes } from '../../../utils/helpers';

export const ManagePhotos: React.FC = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const { confirm } = useModal();
    const { success: showSuccess, error: showError } = useToast();
    const queryClient = useQueryClient();

    const isAdmin = currentUser?.role === 'admin';

    // Redirect if not admin
    useEffect(() => {
        if (currentUser && !isAdmin) {
            navigate('/me/albums');
        }
    }, [currentUser, isAdmin, navigate]);

    // States
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [category, setCategory] = useState<'all' | string>('all');
    const [keyword, setKeyword] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [pageSize, setPageSize] = useState(50);
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [batchCategoryModalOpen, setBatchCategoryModalOpen] = useState(false);
    const [selectedBatchCategory, setSelectedBatchCategory] = useState('');
    const [critiquePreviewId, setCritiquePreviewId] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [fromDate, toDate, category, pageSize, keyword, sortBy, sortOrder]);

    const [critiquePhotoId, setCritiquePhotoId] = useState<string | null>(null);
    const [batchProgress, setBatchProgress] = useState<{ current: number, total: number, success: number, fail: number } | null>(null);
    const stopBatchRef = React.useRef(false);

    // Queries
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        enabled: true,
        queryFn: async () => {
            const res = await api.get<{ value: string; label: string; icon?: string }[]>('/categories');
            return res.data;
        },
    });

    // Constants & Icon Mapping
    const CATEGORY_ICONS: Record<string, React.ReactNode> = {
        'landscape': <Mountain className="w-4 h-4" />,
        'portrait': <UserIcon className="w-4 h-4" />,
        'street': <Camera className="w-4 h-4" />,
        'documentary': <FileText className="w-4 h-4" />,
        'architecture': <Building className="w-4 h-4" />,
        'travel': <Plane className="w-4 h-4" />,
        'movie': <Film className="w-4 h-4" />,
    };

    const {
        data: photosPage,
        isLoading,
        isError,
        refetch,
    } = useQuery<{
        items: any[];
        total: number;
        limit: number;
        offset: number;
    }>({
        queryKey: [
            'admin-photos',
            'page',
            page,
            pageSize,
            fromDate,
            toDate,
            category,
            keyword,
            sortBy,
            sortOrder,
        ],
        enabled: isAdmin,
        queryFn: async () => {
            const params: Record<string, any> = {
                limit: pageSize,
                offset: (Math.max(1, page) - 1) * pageSize,
                sortBy,
                order: sortOrder,
            };
            if (fromDate) params.from = fromDate;
            if (toDate) params.to = toDate;
            if (category !== 'all') params.category = category;
            const q = keyword.trim();
            if (q) params.q = q;
            const res = await api.get('/admin/photos/page', params);
            return res.data;
        },
    });

    const { data: critiqueDetail, isLoading: isCritiqueLoading } = useQuery({
        queryKey: ['photo-detail', critiquePreviewId],
        enabled: !!critiquePreviewId,
        queryFn: async () => {
            const res = await api.get(`/photos/${critiquePreviewId}`);
            return res.data;
        }
    });

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/photos/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            showSuccess('照片已删除');
        },
        onError: (err: any) => {
            showError(String(err?.data?.message || err?.message || '删除失败'));
        }
    });

    const batchDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await api.post('/admin/photos/batch-delete', { ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            setSelectedIds([]);
            showSuccess('批量删除成功');
        },
        onError: (err: any) => {
            showError(String(err?.data?.message || err?.message || '批量删除失败'));
        }
    });

    const critiquePhotoMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.post(`/photos/${id}/ai-critique`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            showSuccess('AI 点评请求已发送');
        },
        onError: (err: any) => {
            showError(String(err?.data?.message || err?.message || '点评请求失败'));
        },
        onSettled: () => {
            setCritiquePhotoId(null);
        }
    });

    const processBatchCritique = async (ids: string[]) => {
        setBatchProgress({ current: 0, total: ids.length, success: 0, fail: 0 });
        stopBatchRef.current = false;
        
        for (let i = 0; i < ids.length; i++) {
            if (stopBatchRef.current) {
                break;
            }
            
            const id = ids[i];
            try {
                await api.post(`/photos/${id}/ai-critique`);
                setBatchProgress(prev => prev ? ({ ...prev, current: prev.current + 1, success: prev.success + 1 }) : null);
            } catch (error) {
                setBatchProgress(prev => prev ? ({ ...prev, current: prev.current + 1, fail: prev.fail + 1 }) : null);
            }
            // Small delay to prevent rate limiting issues and allow UI updates
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Finalize
        queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
        if (!stopBatchRef.current) {
             showSuccess('批量 AI 点评完成');
             setSelectedIds([]);
        } else {
             showSuccess('批量操作已停止');
        }
        setTimeout(() => setBatchProgress(null), 2000); // Hide after delay
    };

    const batchCategoryMutation = useMutation({
        mutationFn: async ({ ids, category }: { ids: string[], category: string }) => {
            await api.post('/admin/photos/batch-category', { ids, category });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            setSelectedIds([]);
            showSuccess('批量分类修改成功');
        },
        onError: (err: any) => {
            showError('批量分类修改失败');
        }
    });

    // Handlers
    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            // Fetch all data matching current filters
            const params: Record<string, any> = {
                limit: 10000, // Large limit to get all
                offset: 0,
                sortBy,
                order: sortOrder,
            };
            if (fromDate) params.from = fromDate;
            if (toDate) params.to = toDate;
            if (category !== 'all') params.category = category;
            const q = keyword.trim();
            if (q) params.q = q;

            const res = await api.get('/admin/photos/page', params);
            const items = res.data.items || [];

            if (items.length === 0) {
                showError('暂无数据可导出');
                return;
            }

            // Generate CSV
            const headers = ['ID', '标题', '分类', '上传者', '上传时间', '宽度', '高度', '大小', '浏览', '点赞', '评论数', '相机', '标签', '私有'];
            const csvContent = [
                headers.join(','),
                ...items.map((item: any) => {
                    const exif = item.exif ? JSON.parse(item.exif) : {};
                    const row = [
                        item.id,
                        `"${(item.title || '').replace(/"/g, '""')}"`,
                        item.category,
                        item.user?.name || '',
                        new Date(item.createdAt).toLocaleString(),
                        item.imageWidth,
                        item.imageHeight,
                        item.imageSizeBytes,
                        item.viewsCount,
                        item.likesCount,
                        item.comments?.length || 0,
                        `"${(exif.Model || '').replace(/"/g, '""')}"`,
                        `"${String(item.tags || '').replace(/,/g, '|')}"`,
                        item.isPrivate ? '是' : '否'
                    ];
                    return row.join(',');
                })
            ].join('\n');

            // Download
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `photos_export_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showSuccess(`成功导出 ${items.length} 条数据`);
        } catch (error) {
            console.error('Export failed:', error);
            showError('导出失败，请重试');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDelete = (id: string) => {
        confirm({
            title: '确认删除',
            content: '此操作不可恢复，确定要删除这张照片吗？',
            onConfirm: () => deleteMutation.mutate(id),
        });
    };

    const handleBatchDelete = () => {
        if (selectedIds.length === 0) return;
        confirm({
            title: '确认批量删除',
            content: `即将删除 ${selectedIds.length} 张照片，此操作不可恢复。确定要继续吗？`,
            onConfirm: () => batchDeleteMutation.mutate(selectedIds),
        });
    };

    const handleBatchCritique = () => {
        if (selectedIds.length === 0) return;
        confirm({
            title: '批量 AI 点评',
            content: `即将对 ${selectedIds.length} 张照片进行 AI 点评。确定要继续吗？`,
            onConfirm: () => processBatchCritique(selectedIds),
        });
    };

    const handleBatchCategory = () => {
        if (selectedIds.length === 0) return;
        setBatchCategoryModalOpen(true);
    };

    const handleResetFilters = () => {
        setFromDate('');
        setToDate('');
        setCategory('all');
        setKeyword('');
        setSortBy('createdAt');
        setSortOrder('desc');
        setPageSize(50);
        setPage(1);
        setSelectedIds([]);
    };

    if (!isAdmin) return null;

    const categoryLabelByValue = new Map(categories.map(c => [c.value, c.label]));

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const renderSortHeader = (label: string, field: string, className = "text-left") => (
        <th 
            className={`px-6 py-4 ${className} text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none group/header`}
            onClick={() => handleSort(field)}
        >
            <div className={`flex items-center gap-1 ${className === 'text-right' ? 'justify-end' : ''}`}>
                {label}
                <div className="flex flex-col">
                    {sortBy === field ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                        <ArrowDown className="w-3 h-3 opacity-0 group-hover/header:opacity-30" />
                    )}
                </div>
            </div>
        </th>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <ImageIcon className="w-8 h-8 text-primary" />
                        全站照片管理
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        合并冗余列，优化操作空间，提升大尺寸屏幕显示效率
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className={`hidden md:flex items-center gap-2 px-6 py-2.5 btn-liquid text-gray-900 dark:text-white font-medium hover:text-primary dark:hover:text-primary transition-colors ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? '导出中...' : '导出数据'}
                </button>
            </div>

            {/* Filter Card */}
            <div className="glass-panel p-5 relative z-20">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 flex gap-3">
                        <div className="flex-1 relative group">
                            <input
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="搜索照片标题、UID..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all backdrop-blur-sm"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none group-focus-within:text-primary transition-colors" />
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className={`md:hidden flex items-center justify-center w-[46px] shrink-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl transition-colors shadow-sm ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        </button>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-3 md:flex md:items-center">
                        <div className="min-w-0 md:shrink-0">
                            <DropdownFilter
                                label="分类"
                                value={category}
                                onChange={setCategory}
                                options={[
                                    { label: '所有分类', value: 'all', icon: <Tag className="w-4 h-4"/> },
                                    ...categories.map(c => {
                                        let Icon = <HelpCircle className="w-4 h-4" />;
                                        if (c.icon && (LucideIcons as any)[c.icon]) {
                                            const IconComponent = (LucideIcons as any)[c.icon];
                                            Icon = <IconComponent className="w-4 h-4" />;
                                        } else if (CATEGORY_ICONS[c.value]) {
                                            Icon = CATEGORY_ICONS[c.value];
                                        }
                                        return { label: c.label, value: c.value, icon: Icon };
                                    })
                                ]}
                                icon={Tag}
                                mobileGrid={true}
                            />
                        </div>
                        
                        <div className="col-span-2 order-3 md:order-none md:col-span-1 md:w-auto">
                            <DateRangePicker 
                                startDate={fromDate}
                                endDate={toDate}
                                onChange={(start, end) => {
                                    setFromDate(start);
                                    setToDate(end);
                                }}
                                className="w-full md:w-[240px]"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="order-2 md:order-none px-4 py-2.5 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                        >
                            重置筛选
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between pt-4 gap-4 border-t border-white/10 dark:border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                已选择 <span className="text-primary font-bold">{selectedIds.length}</span> 项
                            </span>
                            <div className="md:hidden text-sm text-gray-500 dark:text-gray-400 font-mono">
                                共 {photosPage?.total ?? 0} 张
                            </div>
                        </div>
                        
                        {selectedIds.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center animate-in fade-in slide-in-from-left-2 duration-200">
                                <button 
                                    onClick={handleBatchCritique}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-medium hover:bg-primary/20 transition-colors whitespace-nowrap"
                                >
                                    <Sparkles className="w-3.5 h-3.5 shrink-0" /> 
                                    <span>批量AI点评</span>
                                </button>
                                <button 
                                    onClick={handleBatchCategory}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 dark:bg-white/5 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-medium hover:bg-white/20 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                                >
                                    <Tag className="w-3.5 h-3.5 shrink-0" /> 
                                    <span>批量分类</span>
                                </button>
                                <button 
                                    onClick={handleBatchDelete}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium hover:bg-red-500/20 transition-colors whitespace-nowrap"
                                >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" /> 
                                    <span>批量删除</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400 font-mono">
                        共 {photosPage?.total ?? 0} 张照片
                    </div>
                </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-6">
                <div className="glass-card p-4 flex items-center justify-between">
                    <StyledCheckbox 
                        checked={(photosPage?.items || []).length > 0 && selectedIds.length === (photosPage?.items || []).length}
                        onChange={() => {
                            const allIds = (photosPage?.items || []).map((p: any) => p.id);
                            if (selectedIds.length === allIds.length) {
                                setSelectedIds([]);
                            } else {
                                setSelectedIds(allIds);
                            }
                        }}
                        label={`全选本页 (${selectedIds.length})`}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    />
                </div>

                {isLoading ? (
                    <div className="glass-card p-8 flex justify-center">
                        <LoadingState />
                    </div>
                ) : (photosPage?.items || []).length === 0 ? (
                    <div className="glass-card p-8 text-center text-gray-500">
                        暂无照片
                    </div>
                ) : (
                    (photosPage?.items || []).map((photo: any) => {
                        const isSelected = selectedIds.includes(photo.id);
                        return (
                            <div 
                                key={photo.id} 
                                className={`glass-card p-4 transition-all ${
                                    isSelected 
                                        ? 'border-primary ring-1 ring-primary bg-primary/5 dark:bg-primary/10' 
                                        : ''
                                }`}
                            >
                                <div className="flex gap-4">
                                    <div className="flex flex-col justify-center shrink-0">
                                        <StyledCheckbox
                                            checked={isSelected}
                                            onChange={() => {
                                                if (isSelected) {
                                                    setSelectedIds(selectedIds.filter(id => id !== photo.id));
                                                } else {
                                                    setSelectedIds([...selectedIds, photo.id]);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div
                                        className="w-20 h-20 shrink-0 rounded-2xl bg-white/5 dark:bg-white/5 overflow-hidden cursor-pointer"
                                        onClick={() => setPreviewUrl(getPhotoUrl(photo, 'medium'))}
                                    >
                                                <img 
                                                    src={getPhotoUrl(photo, 'thumb')} 
                                                    alt={photo.title} 
                                                    className="w-full h-full object-cover" 
                                                />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div>
                                            <h4 className="font-medium text-gray-900 dark:text-white line-clamp-1">{photo.title}</h4>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-white/10 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                                    {categoryLabelByValue.get(String(photo.category || '')) || photo.category}
                                                </span>
                                                {photo.isPrivate && (
                                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                        私有
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {photo.viewsCount}</span>
                                            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {photo.likesCount}</span>
                                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {photo.comments?.length || 0}</span>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-white/10 dark:border-white/5">
                                            <span className="text-xs text-gray-400">{new Date(photo.createdAt).toLocaleDateString()}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (photo.aiCritique) {
                                                            setCritiquePreviewId(photo.id);
                                                        } else {
                                                            setCritiquePhotoId(photo.id);
                                                            critiquePhotoMutation.mutate(photo.id);
                                                        }
                                                    }}
                                                    disabled={critiquePhotoId === photo.id}
                                                    className="p-1.5 text-gray-400 hover:text-purple-600 bg-white/5 dark:bg-white/5 rounded-2xl"
                                                >
                                                    {critiquePhotoId === photo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                </button>
                                                <Link 
                                                    to={`/edit/${photo.id}`}
                                                    className="p-1.5 text-gray-400 hover:text-primary bg-white/5 dark:bg-white/5 rounded-2xl"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Link>
                                                <button 
                                                    onClick={() => handleDelete(photo.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 bg-white/5 dark:bg-white/5 rounded-2xl"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                
                {/* Mobile Pagination */}
                <div className="glass-card p-4">
                    <Pagination
                        total={photosPage?.total || 0}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => {
                            setPageSize(s);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:flex glass-panel flex-col min-h-[600px] overflow-hidden">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-white/10 dark:bg-black/20 border-b border-white/10 dark:border-white/5 backdrop-blur-sm">
                                <th className="px-6 py-4 w-12 text-center">
                                    <div className="flex justify-center">
                                        <StyledCheckbox
                                            checked={(photosPage?.items || []).length > 0 && selectedIds.length === (photosPage?.items || []).length}
                                            onChange={() => {
                                                const allIds = (photosPage?.items || []).map((p: any) => p.id);
                                                if (selectedIds.length === allIds.length) {
                                                    setSelectedIds([]);
                                                } else {
                                                    setSelectedIds(allIds);
                                                }
                                            }}
                                        />
                                    </div>
                                </th>
                                {renderSortHeader('照片信息', 'title')}
                                {renderSortHeader('分类', 'category')}
                                {renderSortHeader('上传日期', 'createdAt')}
                                {renderSortHeader('宽度', 'imageWidth')}
                                {renderSortHeader('高度', 'imageHeight')}
                                {renderSortHeader('大小', 'imageSizeBytes')}
                                {renderSortHeader('浏览', 'viewsCount')}
                                {renderSortHeader('点赞', 'likesCount')}
                                {renderSortHeader('评论', 'commentsCount')}
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <LoadingState />
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <ErrorState onRetry={() => refetch()} />
                                    </td>
                                </tr>
                            ) : (photosPage?.items || []).length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-gray-500">
                                        暂无照片
                                    </td>
                                </tr>
                            ) : (
                                (photosPage?.items || []).map((photo: any) => {
                                    const isSelected = selectedIds.includes(photo.id);
                                    const userName = String(photo?.user?.name || '');
                                    const userId = String(photo?.user?.id || '');
                                    
                                    return (
                                        <tr 
                                            key={photo.id} 
                                            className={`group transition-colors ${
                                                isSelected 
                                                    ? 'bg-primary/5 dark:bg-primary/10' 
                                                    : 'hover:bg-white/5 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center">
                                                    <StyledCheckbox
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (isSelected) {
                                                                setSelectedIds(selectedIds.filter(id => id !== photo.id));
                                                            } else {
                                                                setSelectedIds([...selectedIds, photo.id]);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-12 h-12 shrink-0 rounded-2xl bg-white/5 dark:bg-white/5 overflow-hidden cursor-pointer relative group/thumb"
                                                        onClick={() => setPreviewUrl(getPhotoUrl(photo, 'medium'))}
                                            >
                                                <img 
                                                    src={getPhotoUrl(photo, 'thumb')} 
                                                    alt={photo.title} 
                                                    className="w-full h-full object-cover" 
                                                />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                                            <Maximize2 className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-gray-900 dark:text-white line-clamp-1" title={photo.title}>
                                                            {photo.title}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            <div className="flex items-center gap-1" title={`用户ID: ${userId}`}>
                                                                <Activity className="w-3 h-3" />
                                                                <span>{userName}</span>
                                                            </div>
                                                            {photo.isPrivate && (
                                                                <span className="flex items-center gap-0.5 text-amber-500 bg-amber-500/10 px-1.5 rounded">
                                                                    <Lock className="w-2.5 h-2.5" /> 私有
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2 py-1 rounded-full text-xs bg-white/10 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                                    {categoryLabelByValue.get(String(photo.category || '')) || photo.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(photo.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {photo.imageWidth} px
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {photo.imageHeight} px
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {formatBytes(photo.imageSizeBytes)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                <div className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-gray-400" /> {photo.viewsCount}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                <div className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5 text-gray-400" /> {photo.likesCount}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                <div className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-gray-400" /> {photo.comments?.length || 0}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {photo.aiCritique ? (
                                                        <>
                                                            <button
                                                                onClick={() => setCritiquePreviewId(photo.id)}
                                                                className="p-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors"
                                                                title="查看AI点评"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setCritiquePhotoId(photo.id);
                                                                    critiquePhotoMutation.mutate(photo.id);
                                                                }}
                                                                disabled={critiquePhotoId === photo.id}
                                                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-500/10 dark:hover:bg-purple-900/20 rounded-xl transition-colors"
                                                                title="重新生成AI点评"
                                                            >
                                                                {critiquePhotoId === photo.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <RefreshCw className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setCritiquePhotoId(photo.id);
                                                                critiquePhotoMutation.mutate(photo.id);
                                                            }}
                                                            disabled={critiquePhotoId === photo.id}
                                                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-500/10 dark:hover:bg-purple-900/20 rounded-xl transition-colors"
                                                            title="生成AI点评"
                                                        >
                                                            {critiquePhotoId === photo.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <Link 
                                                        to={`/edit/${photo.id}`}
                                                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-white/10 dark:hover:bg-white/10 rounded-xl transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Link>
                                                    <button 
                                                        onClick={() => handleDelete(photo.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                <div className="border-t border-white/10 dark:border-white/5 p-4">
                    <Pagination
                        total={photosPage?.total || 0}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(s) => {
                            setPageSize(s);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Batch Progress Overlay */}
            {batchProgress && createPortal(
                <div className="fixed bottom-6 right-6 z-[1100] animate-in slide-in-from-bottom-4 duration-300">
                    <div className="glass-panel p-4 shadow-2xl min-w-[320px] border-l-4 border-primary">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                批量 AI 点评中...
                            </h3>
                            <div className="text-xs font-mono text-gray-500">
                                {batchProgress.current} / {batchProgress.total}
                            </div>
                        </div>
                        
                        <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden mb-3">
                            <div 
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                            />
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-3">
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <CheckCircle2 className="w-3 h-3" /> {batchProgress.success}
                                </span>
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-3 h-3" /> {batchProgress.fail}
                                </span>
                            </div>
                            
                            <button
                                onClick={() => stopBatchRef.current = true}
                                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                                <Square className="w-3 h-3 fill-current" />
                                停止
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Preview Modal */}
            {previewUrl && createPortal(
                <div 
                    className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewUrl(null)}
                >
                    <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button 
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        onClick={() => setPreviewUrl(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>,
                document.body
            )}
            {/* Batch Category Modal */}
            {batchCategoryModalOpen && createPortal(
                <div 
                    className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setBatchCategoryModalOpen(false)}
                >
                    <div 
                        className="glass-panel p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">批量修改分类</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            将选中的 {selectedIds.length} 张照片移动到：
                        </p>
                        <div className="relative group mb-6">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <select
                                value={selectedBatchCategory}
                                onChange={(e) => setSelectedBatchCategory(e.target.value)}
                                className="w-full appearance-none bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer hover:bg-white/60 dark:hover:bg-white/5 transition-colors text-gray-900 dark:text-white"
                            >
                                <option value="">请选择分类...</option>
                                {categories.map((c) => (
                                    <option key={c.value} value={c.value} className="bg-white dark:bg-gray-900">
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setBatchCategoryModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/10 rounded-xl transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedBatchCategory) return;
                                    batchCategoryMutation.mutate({ ids: selectedIds, category: selectedBatchCategory });
                                    setBatchCategoryModalOpen(false);
                                    setSelectedBatchCategory('');
                                }}
                                disabled={!selectedBatchCategory}
                                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                            >
                                确认修改
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Critique Preview Modal */}
            {critiquePreviewId && createPortal(
                <div 
                    className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setCritiquePreviewId(null)}
                >
                    <div 
                        className="glass-panel p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto scale-100 animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                AI 摄影点评
                            </h3>
                            <button 
                                onClick={() => setCritiquePreviewId(null)}
                                className="p-1 hover:bg-white/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {isCritiqueLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : critiqueDetail?.aiCritique ? (
                             <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                {typeof critiqueDetail.aiCritique === 'string' 
                                    ? critiqueDetail.aiCritique 
                                    : JSON.stringify(critiqueDetail.aiCritique, null, 2)}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                暂无点评内容
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
