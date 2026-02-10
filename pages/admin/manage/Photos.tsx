import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Search, Calendar, Download, Sparkles, Tag, Trash2, 
    Edit2, Maximize2, Activity, ThumbsUp, MessageSquare, 
    Upload, Image as ImageIcon, Camera, Lock, User as UserIcon,
    Loader2, X, Check
} from 'lucide-react';

const StyledCheckbox = ({ checked, onChange, label, className }: { checked: boolean, onChange: () => void, label?: string, className?: string }) => (
    <div 
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        className={`flex items-center gap-3 cursor-pointer group/checkbox ${className}`}
    >
        <div className={`
            w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-200 shrink-0
            ${checked 
                ? 'bg-primary border-primary text-white shadow-sm scale-100' 
                : 'bg-white dark:bg-transparent border-gray-300 dark:border-gray-600 group-hover/checkbox:border-primary dark:group-hover/checkbox:border-primary scale-95 group-hover/checkbox:scale-100'
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
            navigate('/admin/me/albums');
        }
    }, [currentUser, isAdmin, navigate]);

    // States
    const [month, setMonth] = useState<'all' | number>('all');
    const [category, setCategory] = useState<'all' | string>('all');
    const [ownerId, setOwnerId] = useState<'all' | string>('all');
    const [camera, setCamera] = useState<'all' | string>('all');
    const [tags, setTags] = useState<string[]>([]);
    const [keyword, setKeyword] = useState('');
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
    }, [month, category, ownerId, camera, pageSize, tags.join('|'), keyword]);

    const [critiquePhotoId, setCritiquePhotoId] = useState<string | null>(null);

    // Queries
    const { data: filters } = useQuery<{
        tags: string[];
        cameras: string[];
    }>({
        queryKey: ['admin-photos', 'filters'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get('/admin/photos/filters');
            return res.data;
        },
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        enabled: true,
        queryFn: async () => {
            const res = await api.get<{ value: string; label: string }[]>('/categories');
            return res.data;
        },
    });

    const { data: usersAll = [] } = useQuery({
        queryKey: ['admin-users-all'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get<{ id: string; name: string }[]>('/users');
            return res.data;
        },
    });

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
            month,
            category,
            ownerId,
            camera,
            tags,
            keyword,
        ],
        enabled: isAdmin,
        queryFn: async () => {
            const params: Record<string, any> = {
                limit: pageSize,
                offset: (Math.max(1, page) - 1) * pageSize,
            };
            if (month !== 'all') params.month = month;
            if (category !== 'all') params.category = category;
            if (ownerId !== 'all') params.ownerId = ownerId;
            if (camera !== 'all') params.camera = camera;
            if (tags.length > 0) params.tags = tags.join(',');
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

    const batchCritiqueMutation = useMutation({
        mutationFn: async (ids: string[]) => {
             // In a real scenario, this would be a batch API. 
             // For now we can iterate or assume a batch endpoint exists if backend supports it.
             // Based on legacy Admin.tsx, it might not have been implemented as a true batch endpoint.
             // But let's assume we want to call critique for each or a batch endpoint.
             // Let's use a hypothetical batch endpoint to keep it clean, or just loop.
             // Given the context, let's assume we need to implement a loop if no batch endpoint exists.
             // However, checking Admin.tsx line 1612, it was just a button.
             // Let's implement a loop for now to be safe, or a batch endpoint if we are sure.
             // I will use a loop for safety as I don't see a batch-critique endpoint in my memory.
             await Promise.all(ids.map(id => api.post(`/photos/${id}/ai-critique`)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            setSelectedIds([]);
            showSuccess('批量 AI 点评请求已发送');
        },
        onError: (err: any) => {
            showError('部分点评请求失败');
        }
    });

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
            };
            if (month !== 'all') params.month = month;
            if (category !== 'all') params.category = category;
            if (ownerId !== 'all') params.ownerId = ownerId;
            if (camera !== 'all') params.camera = camera;
            if (tags.length > 0) params.tags = tags.join(',');
            const q = keyword.trim();
            if (q) params.q = q;

            const res = await api.get('/admin/photos/page', params);
            const items = res.data.items || [];

            if (items.length === 0) {
                showError('暂无数据可导出');
                return;
            }

            // Generate CSV
            const headers = ['ID', '标题', '分类', '上传者', '上传时间', '规格', '大小', '浏览', '点赞', '评论数', '相机', '标签', '私有'];
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
                        `${item.imageWidth}x${item.imageHeight}`,
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
            onConfirm: () => batchCritiqueMutation.mutate(selectedIds),
        });
    };

    const handleBatchCategory = () => {
        if (selectedIds.length === 0) return;
        // Simple prompt for category for now, ideally a modal
        // Since we don't have a complex modal ready for selection, let's use a simple prompt or just pick the first category for demo?
        // No, that's bad UX. Let's look at categories available.
        // We can use the confirm modal with a custom content if supported, but our confirm is simple.
        // Let's use a standard window.prompt for now as a quick fix, or better, just show a toast that "Select category feature coming soon" if we can't do it well.
        // But the user asked to finish tasks.
        // Let's implementation a custom modal logic using existing Modal component if possible, or just use window.prompt for category value.
        // Given existing patterns, I'll use window.prompt for the category VALUE (from the list) as a temporary robust solution, 
        // or better: let's not use window.prompt.
        // Let's assume the user wants to select a category. 
        // I will add a small state for "batchCategoryModalOpen" and render a small modal.
        setBatchCategoryModalOpen(true);
    };

    const handleResetFilters = () => {
        setMonth('all');
        setCategory('all');
        setOwnerId('all');
        setCamera('all');
        setTags([]);
        setKeyword('');
        setPageSize(50);
        setPage(1);
        setSelectedIds([]);
    };

    if (!isAdmin) return null;

    const categoryLabelByValue = new Map(categories.map(c => [c.value, c.label]));

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
                    className={`flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? '导出中...' : '导出数据'}
                </button>
            </div>

            {/* Filter Card */}
            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="搜索照片标题、UID 或 上传者..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <DropdownFilter
                            label="分类"
                            value={category}
                            onChange={setCategory}
                            options={[
                                { label: '所有分类', value: 'all' },
                                ...categories.map(c => ({ label: c.label, value: c.value }))
                            ]}
                            icon={Tag}
                        />
                        <DropdownFilter
                            label="月份"
                            value={month}
                            onChange={(val) => setMonth(val === 'all' ? 'all' : Number(val))}
                            options={[
                                { label: '所有日期', value: 'all' },
                                ...Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: i + 1 }))
                            ]}
                            icon={Calendar}
                        />
                        <DropdownFilter
                            label="上传者"
                            value={ownerId}
                            onChange={setOwnerId}
                            options={[
                                { label: '所有用户', value: 'all' },
                                ...usersAll.map(u => ({ label: u.name, value: u.id }))
                            ]}
                            icon={UserIcon}
                        />
                        <DropdownFilter
                            label="相机"
                            value={camera}
                            onChange={setCamera}
                            options={[
                                { label: '所有相机', value: 'all' },
                                ...(filters?.cameras || []).map(c => ({ label: c, value: c }))
                            ]}
                            icon={Camera}
                        />
                        <DropdownFilter
                            label="标签"
                            value={tags[0] || 'all'}
                            onChange={(val) => setTags(val === 'all' ? [] : [val])}
                            options={[
                                { label: '所有标签', value: 'all' },
                                ...(filters?.tags || []).map(t => ({ label: t, value: t }))
                            ]}
                            icon={Tag}
                        />
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors whitespace-nowrap"
                        >
                            重置筛选
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-surface-border">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            已选择 <span className="text-primary font-bold">{selectedIds.length}</span> 项
                        </span>
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <button 
                                    onClick={handleBatchCritique}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                                >
                                    <Sparkles className="w-3.5 h-3.5" /> 批量AI点评
                                </button>
                                <button 
                                    onClick={handleBatchCategory}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-surface-border text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Tag className="w-3.5 h-3.5" /> 批量分类
                                </button>
                                <button 
                                    onClick={handleBatchDelete}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> 批量删除
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                        共 {photosPage?.total ?? 0} 张照片
                    </div>
                </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-4">
                <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-200 dark:border-surface-border flex items-center justify-between">
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
                    <div className="bg-white dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-200 dark:border-surface-border flex justify-center">
                        <LoadingState />
                    </div>
                ) : (photosPage?.items || []).length === 0 ? (
                    <div className="bg-white dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-200 dark:border-surface-border text-center text-gray-500">
                        暂无照片
                    </div>
                ) : (
                    (photosPage?.items || []).map((photo: any) => {
                        const isSelected = selectedIds.includes(photo.id);
                        return (
                            <div 
                                key={photo.id} 
                                className={`bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border transition-all ${
                                    isSelected 
                                        ? 'border-primary ring-1 ring-primary bg-primary/5 dark:bg-primary/10' 
                                        : 'border-gray-200 dark:border-surface-border'
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
                                        className="w-20 h-20 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer"
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
                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-surface-border text-gray-600 dark:text-gray-300">
                                                    {categoryLabelByValue.get(String(photo.category || '')) || photo.category}
                                                </span>
                                                {photo.isPrivate && (
                                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
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

                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-surface-border/50">
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
                                                    className="p-1.5 text-gray-400 hover:text-purple-600 bg-gray-50 dark:bg-surface-border/50 rounded-lg"
                                                >
                                                    {critiquePhotoId === photo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                </button>
                                                <Link 
                                                    to={`/edit/${photo.id}`}
                                                    className="p-1.5 text-gray-400 hover:text-primary bg-gray-50 dark:bg-surface-border/50 rounded-lg"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Link>
                                                <button 
                                                    onClick={() => handleDelete(photo.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-surface-border/50 rounded-lg"
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
                <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-200 dark:border-surface-border">
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
            <div className="hidden md:flex bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl shadow-sm overflow-hidden flex-col min-h-[600px]">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-[#111a22] border-b border-gray-200 dark:border-surface-border">
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
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">照片信息</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">分类</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">上传日期</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">规格</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">互动</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-surface-border">
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
                                                    : 'hover:bg-gray-50 dark:hover:bg-surface-border/30'
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
                                                        className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer relative group/thumb"
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
                                                                <span className="flex items-center gap-0.5 text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 rounded">
                                                                    <Lock className="w-2.5 h-2.5" /> 私有
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-surface-border text-gray-600 dark:text-gray-300">
                                                    {categoryLabelByValue.get(String(photo.category || '')) || photo.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(photo.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                    <div className="flex items-center gap-1"><Camera className="w-3 h-3" /> {JSON.parse(photo.exif || '{}').Model || '-'}</div>
                                                    <div className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {photo.imageWidth}×{photo.imageHeight}</div>
                                                    <div className="flex items-center gap-1"><Upload className="w-3 h-3" /> {formatBytes(photo.imageSizeBytes)}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                                    <span className="flex items-center gap-1" title="浏览"><Activity className="w-3.5 h-3.5" /> {photo.viewsCount}</span>
                                                    <span className="flex items-center gap-1" title="点赞"><ThumbsUp className="w-3.5 h-3.5" /> {photo.likesCount}</span>
                                                    <span className="flex items-center gap-1" title="评论"><MessageSquare className="w-3.5 h-3.5" /> {photo.comments?.length || 0}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
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
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            photo.aiCritique 
                                                                ? 'text-primary bg-primary/5 hover:bg-primary/10' 
                                                                : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                                        }`}
                                                        title={photo.aiCritique ? '查看AI点评' : '生成AI点评'}
                                                    >
                                                        {critiquePhotoId === photo.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <Link 
                                                        to={`/edit/${photo.id}`}
                                                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Link>
                                                    <button 
                                                        onClick={() => handleDelete(photo.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                <div className="border-t border-gray-200 dark:border-surface-border p-4 bg-gray-50/50 dark:bg-[#111a22]/50">
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

            {/* Preview Modal */}
            {previewUrl && createPortal(
                <div 
                    className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewUrl(null)}
                >
                    <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
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
                    className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setBatchCategoryModalOpen(false)}
                >
                    <div 
                        className="bg-white dark:bg-surface-dark rounded-xl p-6 w-full max-w-sm shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">批量修改分类</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            将选中的 {selectedIds.length} 张照片移动到：
                        </p>
                        <select
                            value={selectedBatchCategory}
                            onChange={(e) => setSelectedBatchCategory(e.target.value)}
                            className="w-full appearance-none bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary cursor-pointer hover:bg-gray-100 dark:hover:bg-surface-border/50 transition-colors mb-6"
                        >
                            <option value="">请选择分类...</option>
                            {categories.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setBatchCategoryModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors"
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
                                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setCritiquePreviewId(null)}
                >
                    <div 
                        className="bg-white dark:bg-surface-dark rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                AI 摄影点评
                            </h3>
                            <button 
                                onClick={() => setCritiquePreviewId(null)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors text-gray-500"
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
