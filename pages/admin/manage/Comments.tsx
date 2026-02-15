import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { 
    Search, Check, X, Trash2, AlertCircle, Languages, RotateCcw,
    MoreHorizontal, ShieldCheck, Zap, Settings,
    FileText, Calendar, User as UserIcon, Mail,
    CheckCircle2, AlertOctagon, ImageIcon, Ban, MessageSquare
} from 'lucide-react';
import { API_BASE_URL } from '../../../api';
import api from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { getPhotoUrl } from '../../../utils/helpers';
import { useToast } from '../../../components/Toast';
import { useModal } from '../../../components/Modal';
import { LoadingState, EmptyState } from '../../../components/States';

// --- Types ---

type AdminComment = {
    id: string;
    photoId: string;
    photoTitle: string | null;
    photoUrl: string | null;
    photoVariants: { thumb?: string; medium?: string } | null;
    photoCreatedAt?: string;
    photoOwnerName?: string;
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

type AdminCommentsResponse = {
    items: AdminComment[];
    total: number;
    limit: number;
    offset: number;
};

type CommentsSummary = {
    total: number;
    today: number;
    pending: number;
    spam: number;
    suspected: number;
    approved: number;
};

type ApiUser = {
    id: string;
    name: string;
    email: string | null;
    role: 'admin' | 'family';
};

// --- Components ---

export const Comments = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const { confirm } = useModal();

    if (user?.role !== 'admin') return <Navigate to="/me/albums" replace />;

    // --- State ---
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspected'>('pending');
    const [keyword, setKeyword] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;
    
    const [translatingId, setTranslatingId] = useState<string | null>(null);
    const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});

    // --- Queries ---
    const { data: usersAll } = useQuery({
        queryKey: ['admin-users-all'],
        queryFn: async () => {
            const res = await api.get<ApiUser[]>('/users?all=1');
            return res.data;
        }
    });

    const { data: summary } = useQuery({
        queryKey: ['admin-comments-summary'],
        queryFn: async () => {
            const res = await api.get<CommentsSummary>('/admin/comments/summary');
            return res.data;
        }
    });

    const { data, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['admin-comments', activeTab, keyword, page, pageSize],
        queryFn: async () => {
            const params = new URLSearchParams();
            // Always send status, even if 'all' (backend handles 'all')
            params.set('status', activeTab);
            
            if (keyword.trim()) params.set('q', keyword.trim());
            params.set('limit', String(pageSize));
            params.set('offset', String((page - 1) * pageSize));
            
            try {
                const res = await api.get<AdminCommentsResponse>(`/admin/comments?${params.toString()}`);
                return res.data;
            } catch (err) {
                console.error('[Comments] Error:', err);
                throw err;
            }
        }
    });

    if (isError) {
        return (
            <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                    <AlertOctagon className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">加载失败</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">{(queryError as any)?.message || '无法加载评论列表'}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="px-4 py-2 bg-primary text-white rounded-2xl hover:bg-primary-dark transition-colors"
                >
                    刷新页面
                </button>
            </div>
        );
    }

    // --- Mutations ---
    const singleMutation = useMutation({
        mutationFn: (payload: { id: string; status: 'pending' | 'approved' | 'rejected'; reason?: string }) => {
            return api.patch(`/admin/comments/${payload.id}`, { status: payload.status, reason: payload.reason || '' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
            success('操作完成');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '操作失败'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/admin/comments/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
            success('删除成功');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '删除失败'));
        },
    });

    const approveAllPendingMutation = useMutation({
        mutationFn: () => api.post('/admin/comments/actions/approve-all-pending'),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
            success(`已批量批准 ${res.data.updated} 条评论`);
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '操作失败'));
        }
    });

    const clearSpamMutation = useMutation({
        mutationFn: () => api.post('/admin/comments/actions/clear-spam'),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
            queryClient.invalidateQueries({ queryKey: ['admin-comments-summary'] });
            success(`已清空 ${res.data.deleted} 条垃圾评论`);
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '操作失败'));
        }
    });

    const translateMutation = useMutation({
        mutationFn: async (id: string) => {
            const comment = data?.items.find(c => c.id === id);
            if (!comment?.content) return;
            const res = await api.post('/admin/comments/translate', { text: comment.content });
            return { id, text: res.data.translated };
        },
        onSuccess: (res) => {
            if (res) {
                setTranslatedTexts(prev => ({ ...prev, [res.id]: res.text }));
            }
        },
        onError: (err: any) => {
             error(String(err?.data?.message || err?.message || '翻译失败'));
        }
    });

    // --- Helpers ---
    const handleTranslate = (id: string) => {
        setTranslatingId(id);
        translateMutation.mutate(id, {
            onSettled: () => setTranslatingId(null)
        });
    };

    const getUserName = (c: AdminComment) => {
        if (c.userId) {
            const u = usersAll?.find(x => x.id === c.userId);
            return u ? u.name : 'Unknown User';
        }
        return c.guestNickname || 'Anonymous Guest';
    };

    const getUserEmail = (c: AdminComment) => {
        if (c.userId) {
            const u = usersAll?.find(x => x.id === c.userId);
            return u ? u.email : '-';
        }
        return c.guestEmail || '-';
    };

    const getProgress = () => {
        if (!summary || summary.total === 0) return 0;
        const processed = summary.approved + summary.spam; // Assuming spam = rejected
        return Math.round((processed / summary.total) * 100);
    };

    // --- Render ---
    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-300">
            {/* Main Content (Left) */}
            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                            <MessageSquare className="w-8 h-8 text-primary" />
                            评论管理
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                            处理来自全球创作者社区的反馈与交流
                        </p>
                    </div>
                    {summary?.pending > 0 && (
                        <div className="bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 px-4 py-2 rounded-2xl font-medium flex items-center gap-2 text-sm border border-yellow-100 dark:border-yellow-500/20 shadow-sm">
                            <FileText className="w-4 h-4" />
                            {summary.pending} 条待审核
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                    <div className="relative w-full sm:w-80 group">
                        <input 
                            type="text"
                            placeholder="搜索评论或用户..."
                            value={keyword}
                            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 backdrop-blur-sm rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-gray-900 dark:text-white placeholder-gray-400"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none group-focus-within:text-primary transition-colors" />
                    </div>
                    
                    <div className="flex items-center p-1 bg-gray-100/50 dark:bg-white/5 backdrop-blur-sm rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar border border-white/10 dark:border-white/5">
                        <div className="flex gap-1 min-w-max">
                        {[
                            { id: 'all', label: '全部状态' },
                            { id: 'pending', label: '待审核', dot: true },
                            { id: 'suspected', label: '疑似垃圾', dot: true },
                            { id: 'approved', label: '已批准' },
                            { id: 'rejected', label: '垃圾评论' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
                                className={`
                                    relative px-4 py-2.5 sm:py-1.5 text-sm font-medium rounded-xl whitespace-nowrap transition-all active:scale-95
                                    ${activeTab === tab.id 
                                        ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-lg shadow-black/5 backdrop-blur-md' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/30 dark:hover:bg-white/5'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    {tab.dot && tab.id === 'pending' && summary?.pending > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    )}
                                    {tab.dot && tab.id === 'suspected' && summary?.suspected > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    )}
                                    {tab.label}
                                </div>
                            </button>
                        ))}
                        </div>
                    </div>
                </div>

                {/* Table Header Row */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-white/30 dark:bg-white/5 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="col-span-6">评论内容</div>
                    <div className="col-span-3">用户信息</div>
                    <div className="col-span-1 text-center">关联图片</div>
                    <div className="col-span-2 text-right">操作</div>
                </div>

                {/* List */}
                <div className="space-y-6">
                    {isLoading ? (
                        <div className="glass-panel p-8 shadow-sm">
                            <LoadingState />
                        </div>
                    ) : (data?.items || []).length === 0 ? (
                        <div className="glass-panel p-8 shadow-sm min-h-[400px] flex items-center justify-center">
                            <EmptyState message="暂无评论数据" />
                        </div>
                    ) : (
                        (data?.items || []).map((comment) => (
                            <div 
                                key={comment.id}
                                className="group glass-card p-5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300"
                            >
                                <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-6 items-start">
                                    {/* Content Column (col-span-6) */}
                                    <div className="col-span-2 md:col-span-6 space-y-6 order-2 md:order-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {comment.status === 'pending' && (
                                                <span className="px-2 py-0.5 rounded-xl text-xs font-medium bg-yellow-100/50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-500/20 backdrop-blur-sm">
                                                    待审核
                                                </span>
                                            )}
                                            {comment.status === 'rejected' && (
                                                <span className={`px-2 py-0.5 rounded-xl text-xs font-medium border backdrop-blur-sm ${
                                                    comment.reviewReason?.includes('System auto-flagged')
                                                        ? 'bg-orange-100/50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20'
                                                        : 'bg-red-100/50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200/50 dark:border-red-500/20'
                                                }`}>
                                                    {comment.reviewReason?.includes('System auto-flagged') ? '疑似垃圾' : '垃圾评论'}
                                                </span>
                                            )}
                                            
                                            <button 
                                                onClick={() => handleTranslate(comment.id)}
                                                disabled={translatingId === comment.id}
                                                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                                            >
                                                <Languages className="w-3 h-3" />
                                                {translatingId === comment.id ? '翻译中...' : '翻译'}
                                            </button>
                                        </div>
                                        
                                        <div className="text-gray-900 dark:text-white text-sm leading-relaxed break-words">
                                            {comment.content}
                                        </div>
                                        
                                        {translatedTexts[comment.id] && (
                                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl text-sm text-gray-700 dark:text-gray-300 border border-blue-100 dark:border-blue-900/20 backdrop-blur-sm">
                                                <div className="text-xs text-blue-500 font-medium mb-1">翻译结果：</div>
                                                {translatedTexts[comment.id]}
                                            </div>
                                        )}
                                    </div>

                                    {/* User Info Column (col-span-3) */}
                                    <div className="col-span-2 md:col-span-3 flex flex-col gap-1.5 md:border-l md:border-gray-100/50 md:dark:border-white/5 md:pl-6 order-1 md:order-2">
                                        <div className="font-semibold text-gray-900 dark:text-white text-sm truncate flex items-center gap-2" title={getUserName(comment)}>
                                            {getUserName(comment)}
                                            {!comment.userId && (
                                                <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-medium bg-gray-100/50 text-gray-600 dark:bg-white/5 dark:text-gray-400 border border-gray-200/50 dark:border-white/10 backdrop-blur-sm">
                                                    游客
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5" title={getUserEmail(comment)}>
                                            <Mail className="w-3 h-3" />
                                            {getUserEmail(comment)}
                                        </div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(comment.createdAt).toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Photo Column (col-span-1) */}
                                    <div className="col-span-1 md:col-span-1 flex items-center justify-start md:justify-center order-3">
                                        <Link 
                                            to={`/photo/${comment.photoId}`} 
                                            className="block relative group/img" 
                                            title={`标题: ${comment.photoTitle || '无标题'}\n发布人: ${comment.photoOwnerName || '未知'}\n发布时间: ${comment.photoCreatedAt ? new Date(comment.photoCreatedAt).toLocaleString() : '未知'}`}
                                        >
                                            <img 
                                                src={getPhotoUrl({ id: comment.photoId, thumbUrl: comment.photoVariants?.thumb }, 'thumb')}
                                                alt="Photo" 
                                                className="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-gray-800 border border-white/20 dark:border-white/10"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21 15 16 10 5 21"/%3E%3C/svg%3E' }}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors rounded-xl" />
                                        </Link>
                                    </div>

                                    {/* Actions Column (col-span-2) */}
                                    <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2 order-4">
                                        {comment.status === 'pending' && (
                                            <>
                                                <button 
                                                    onClick={() => singleMutation.mutate({ id: comment.id, status: 'approved' })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:scale-105 transition-all dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                                                    title="批准"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const reason = window.prompt('请输入拒绝原因（可选）：');
                                                        if (reason !== null) {
                                                            singleMutation.mutate({ id: comment.id, status: 'rejected', reason });
                                                        }
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                                    title="标记为垃圾评论"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {/* Suspected Actions: Approve or Confirm Spam */}
                                        {comment.status === 'rejected' && comment.reviewReason?.includes('System auto-flagged') && activeTab === 'suspected' && (
                                            <>
                                                <button 
                                                    onClick={() => singleMutation.mutate({ id: comment.id, status: 'approved' })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:scale-105 transition-all dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                                                    title="批准"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => singleMutation.mutate({ id: comment.id, status: 'rejected', reason: 'Manual confirmed spam' })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                                    title="标记为垃圾评论"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {comment.status === 'approved' && (
                                            <>
                                                <button 
                                                    onClick={() => singleMutation.mutate({ id: comment.id, status: 'pending' })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 hover:scale-105 transition-all dark:bg-yellow-500/10 dark:text-yellow-400 dark:hover:bg-yellow-500/20"
                                                    title="转为待审核"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const reason = window.prompt('请输入拒绝原因（可选）：');
                                                        if (reason !== null) {
                                                            singleMutation.mutate({ id: comment.id, status: 'rejected', reason });
                                                        }
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                                    title="标记为垃圾评论"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {comment.status === 'rejected' && (!comment.reviewReason?.includes('System auto-flagged') || activeTab !== 'suspected') && (
                                            <>
                                                <button 
                                                    onClick={() => singleMutation.mutate({ id: comment.id, status: 'pending' })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 hover:scale-105 transition-all dark:bg-yellow-500/10 dark:text-yellow-400 dark:hover:bg-yellow-500/20"
                                                    title="恢复为待审核"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => singleMutation.mutate({ id: comment.id, status: 'approved' })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:scale-105 transition-all dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                                                    title="通过审核"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            onClick={() => confirm({
                                                title: '删除评论',
                                                content: '确定要永久删除这条评论吗？此操作不可撤销。',
                                                onConfirm: () => deleteMutation.mutate(comment.id)
                                            })}
                                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 hover:scale-105 transition-all dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                            title="删除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {/* Pagination */}
                    {data && data.total > 0 && (
                        <div className="flex items-center justify-between pt-4">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                显示 {data.offset + 1} 到 {Math.min(data.offset + data.limit, data.total)} 条，共 {data.total} 条评论
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 border border-white/20 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    上一页
                                </button>
                                <div className="px-3 py-1.5 bg-white/50 dark:bg-white/10 border border-white/20 dark:border-white/10 rounded-xl text-sm font-medium text-primary backdrop-blur-sm shadow-sm">
                                    {page}
                                </div>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * pageSize >= data.total}
                                    className="px-3 py-1.5 border border-white/20 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar (Right) */}
            <div className="w-full xl:w-80 space-y-6 flex-shrink-0">
                {/* Audit Overview */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        审核概况
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">今日全站互动统计</p>

                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600 dark:text-gray-300 font-medium">处理进度</span>
                            <span className="text-green-600 dark:text-green-400 font-bold">{getProgress()}%</span>
                        </div>
                        <div className="w-full bg-gray-100/50 dark:bg-white/10 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                            <div 
                                className="bg-green-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                style={{ width: `${getProgress()}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="glass-card p-3 rounded-xl">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">总评论</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{summary?.total?.toLocaleString() || 0}</div>
                        </div>
                        <div className="glass-card p-3 rounded-xl">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">今日新增</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{summary?.today?.toLocaleString() || 0}</div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">快捷操作</h4>
                    
                    <button 
                        onClick={() => confirm({
                            title: '一键批准全部',
                            content: `确定要批准所有 ${summary?.pending || 0} 条待审核评论吗？`,
                            onConfirm: () => approveAllPendingMutation.mutate()
                        })}
                        disabled={!summary?.pending}
                        className="w-full glass-card p-4 rounded-xl flex items-center justify-between group hover:border-green-500/50 hover:shadow-md hover:shadow-green-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-50/50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 backdrop-blur-sm">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">一键批准全部</span>
                        </div>
                        <Check className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                    </button>

                    <button 
                        onClick={() => confirm({
                            title: '清空垃圾评论',
                            content: `确定要永久删除所有 ${summary?.spam || 0} 条确认的垃圾评论吗？`,
                            onConfirm: () => clearSpamMutation.mutate()
                        })}
                        disabled={!summary?.spam}
                        className="w-full glass-card p-4 flex items-center justify-between group hover:border-red-500/50 hover:shadow-md hover:shadow-red-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-50/50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 backdrop-blur-sm">
                                <Trash2 className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">清空垃圾评论</span>
                        </div>
                        <Check className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                    </button>
                </div>

                {/* Tips */}
                <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100/50 dark:border-green-900/20 p-4 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2 text-green-700 dark:text-green-400 font-semibold text-sm">
                        <Zap className="w-4 h-4" />
                        审核贴士
                    </div>
                    <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                        包含站外链接或诱导关注关键词的评论已被系统自动标记为<span className="font-bold text-red-600 dark:text-red-400">垃圾评论</span>。建议定期清理。
                    </p>
                </div>

                {/* Config Button */}
                <button className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg shadow-gray-900/20">
                    <Settings className="w-4 h-4" />
                    配置审核策略
                </button>
            </div>
        </div>
    );
};
