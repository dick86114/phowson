
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { 
    Users, Plus, Search, Filter, MoreHorizontal, Edit2, 
    Trash2, Ban, Check, Key, Shield, User as UserIcon, Mail,
    Activity, Clock, FileText, Upload, RefreshCw, X, ChevronRight, ChevronDown, Camera,
    Download, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import api from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { Modal, useModal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';
import { Pagination } from '../../../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';
import { DropdownFilter } from '../../../components/admin/DropdownFilter';
import { FormSelect } from '../../../components/admin/FormSelect';
import { Switch } from '../../../components/Switch';

// Types
interface ApiUser {
    id: string;
    name: string;
    email: string;
    role: string;
    status?: 'active' | 'pending' | 'disabled';
    disabled?: boolean;
    disabledAt?: string;
    createdAt?: string;
    lastLoginAt?: string;
    avatar?: string;
}

interface Role {
    id: string;
    name: string;
}

interface PlatformStats {
    totalUsers: number;
    activeToday: number;
    systemLoad: number;
}

interface OperationLog {
    id: number;
    action: string;
    details: any;
    createdAt: string;
    operatorName: string;
}

// Components

const UserAvatar = ({ url, name, className = "w-10 h-10" }: { url?: string; name: string; className?: string }) => {
    const [error, setError] = useState(false);

    if (url && !error) {
        return (
            <img 
                src={url} 
                alt={name}
                className={`${className} rounded-full object-cover ring-2 ring-white shadow-sm`}
                onError={() => setError(true)}
            />
        );
    }
    return (
        <div className={`${className} rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 flex items-center justify-center font-bold ring-2 ring-white shadow-sm select-none`}>
            {(name || '?').charAt(0).toUpperCase()}
        </div>
    );
};

const PlatformOverview: React.FC = () => {
    const { data: stats, isLoading } = useQuery<PlatformStats>({
        queryKey: ['platform-stats'],
        queryFn: async () => {
            const res = await api.get('/stats/platform');
            return res.data;
        }
    });

    if (isLoading) return <div className="animate-pulse h-40 bg-gray-100 dark:bg-surface-border rounded-2xl"></div>;
    if (!stats) return null;

    return (
        <div className="glass-panel p-6 space-y-6">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                平台概览
            </h3>
            
            <div className="space-y-6">
                <div className="p-4 glass-card flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">总用户数</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                        <Users className="w-5 h-5" />
                    </div>
                </div>
                
                <div className="p-4 glass-card flex items-center justify-between group hover:border-green-200 dark:hover:border-green-800 transition-colors">
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">今日活跃</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeToday}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 glass-card flex items-center justify-between group hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                    <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">系统负载</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.systemLoad}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const OperationLogsDrawer: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
    const { data: logs, isLoading } = useQuery<OperationLog[]>({
        queryKey: ['user-logs', userId],
        queryFn: async () => {
            const res = await api.get(`/users/${userId}/logs`);
            return res.data;
        }
    });

    // Helper for Logs
    const getLogConfig = (action: string, details: any) => {
        if (action.includes('create') || action === 'account_created') {
            return {
                icon: UserIcon,
                color: 'text-blue-500',
                bg: 'bg-blue-50',
                title: '账号创建',
                desc: '用户账号被创建'
            };
        }
        if (action.includes('role')) {
            return {
                icon: Shield,
                color: 'text-green-500',
                bg: 'bg-green-50',
                title: `角色变更: ${details?.old_role === 'admin' ? '管理员' : '家庭成员'} → ${details?.new_role === 'admin' ? '管理员' : '家庭成员'}`,
                desc: ''
            };
        }
        if (action.includes('update') || action === 'profile_updated') {
            const changes = Object.keys(details || {}).filter(k => k !== 'updated_at').join(', ');
            return {
                icon: Edit2,
                color: 'text-orange-500',
                bg: 'bg-orange-50',
                title: '修改了用户信息',
                desc: changes ? `修改了: ${changes}` : '更新了个人资料'
            };
        }
        if (action === 'enable_user' || action === 'disable_user') {
            const isEnable = action === 'enable_user';
            return {
                icon: isEnable ? Check : Ban,
                color: isEnable ? 'text-green-500' : 'text-red-500',
                bg: isEnable ? 'bg-green-50' : 'bg-red-50',
                title: isEnable ? '启用账号' : '禁用账号',
                desc: isEnable ? '解除了账号禁用状态' : '禁用了该账号，用户将无法登录'
            };
        }
        if (action === 'reset_password') {
            return {
                icon: Key,
                color: 'text-purple-500',
                bg: 'bg-purple-50',
                title: '重置密码',
                desc: '管理员重置了该用户的密码'
            };
        }
        if (action === 'update_user_avatar') {
            return {
                icon: Camera,
                color: 'text-pink-500',
                bg: 'bg-pink-50',
                title: '更新头像',
                desc: '更新了用户头像'
            };
        }
        return {
            icon: FileText,
            color: 'text-gray-500',
            bg: 'bg-gray-50',
            title: action,
            desc: Object.keys(details || {}).length > 0 ? JSON.stringify(details) : '无详细信息'
        };
    };

    return createPortal(
        <>
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998] transition-opacity"
                onClick={onClose}
            />
            <div className="fixed inset-y-0 right-0 w-96 bg-white/90 dark:bg-black/80 backdrop-blur-xl border-l border-white/20 shadow-2xl transform transition-transform duration-300 ease-in-out z-[9999] flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-transparent">
                <div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-green-600" />
                        操作日志
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">该用户的历史修改记录</p>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 relative">
                {/* Timeline Line */}
                <div className="absolute left-9 top-6 bottom-6 w-0.5 bg-gray-200/50 dark:bg-white/10"></div>

                {isLoading ? (
                    <div className="space-y-6 pl-10">
                        {[1,2,3].map(i => <div key={i} className="h-16 bg-white/10 animate-pulse rounded-2xl"></div>)}
                    </div>
                ) : logs?.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-10 pl-4">暂无操作日志</div>
                ) : (
                    <div className="space-y-6">
                        {logs?.map((log, index) => {
                            const config = getLogConfig(log.action, log.details);
                            const LogIcon = config.icon;
                            
                            return (
                                <div key={log.id} className="relative pl-10">
                                    {/* Timeline Dot */}
                                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white/20 shadow-sm ${config.bg} ${config.color} flex items-center justify-center z-10`}>
                                        <div className="w-2 h-2 rounded-full bg-current"></div>
                                    </div>
                                    
                                    <div className="group">
                                        <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">{config.title}</div>
                                        <div className="text-xs text-gray-400 mb-2 font-mono">
                                            {new Date(log.createdAt).toLocaleString('zh-CN', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                        {config.desc && (
                                            <div className="text-sm text-gray-600 dark:text-gray-300 glass-card p-3 border border-white/10 group-hover:border-white/20 transition-colors">
                                                {config.desc}
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-400 mt-1 pl-1">
                                            操作人: {log.operatorName || 'System'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* High Activity Card (Mock based on screenshot) */}
            <div className="p-6 border-t border-white/10 bg-white/5 dark:bg-black/20">
                <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100/50 dark:border-orange-900/30 rounded-2xl p-4 flex items-center gap-4 backdrop-blur-sm">
                    <div className="w-10 h-10 bg-orange-100/50 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Activity className="w-6 h-6 text-orange-600 dark:text-orange-500" />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-white text-sm">高频活跃用户</div>
                        <div className="text-orange-600 dark:text-orange-500 text-xs mt-0.5">已连续打卡 {Math.floor(Math.random() * 100) + 50} 天</div>
                    </div>
                </div>
            </div>
            </div>
        </>,
        document.body
    );
};

export const UsersPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { confirm } = useModal();
    const { success, error } = useToast();

    if (user?.role !== 'admin') return <Navigate to="/me/albums" replace />;

    // Filters & Pagination
    const [keyword, setKeyword] = useState('');
    const [role, setRole] = useState<string>('all');
    const [status, setStatus] = useState<'all' | 'active' | 'pending' | 'disabled'>('all');
    const [sort, setSort] = useState<'newest' | 'oldest' | 'active'>('newest');
    const [offset, setOffset] = useState(0);
    const [limit, setLimit] = useState(20);
    const [page, setPage] = useState(1);

    // Fetch Roles
    const { data: rolesList } = useQuery<Role[]>({
        queryKey: ['roles'],
        queryFn: async () => {
            const res = await api.get('/roles');
            return res.data;
        }
    });

    // Sync page with offset
    useEffect(() => {
        setOffset((page - 1) * limit);
    }, [page, limit]);

    useEffect(() => {
        setPage(1);
    }, [keyword, role, status, sort, limit]);

    // Query Users
    const { data: usersPage, isLoading, isError, refetch } = useQuery<{
        items: ApiUser[];
        total: number;
        limit: number;
        offset: number;
    }>({
        queryKey: ['admin-users-page', keyword, role, status, sort, limit, offset],
        queryFn: async () => {
            const params = new URLSearchParams();
            const q = keyword.trim();
            if (q) params.set('q', q);
            params.set('role', role);
            params.set('status', status);
            params.set('sort', sort);
            params.set('limit', String(limit));
            params.set('offset', String(offset));
            const res = await api.get(`/users/page?${params.toString()}`);
            return res.data;
        },
    });

    // Mutations
    const createUserMutation = useMutation({
        mutationFn: (body: any) => api.post('/users', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
            setIsUserModalOpen(false);
            setEditingUser(null);
            success('用户已创建');
        },
        onError: (err: any) => {
            setUserModalError(String(err?.data?.message || err?.message || '创建失败'));
        }
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/users/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            setIsUserModalOpen(false);
            setEditingUser(null);
            success('用户已更新');
        },
        onError: (err: any) => {
            setUserModalError(String(err?.data?.message || err?.message || '更新失败'));
        }
    });

    const uploadAvatarMutation = useMutation({
        mutationFn: ({ id, file }: { id: string; file: File }) => {
            const formData = new FormData();
            formData.append('avatar', file);
            return api.post(`/users/${id}/avatar`, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
        },
        onError: (err: any) => {
            console.error('Failed to upload avatar', err);
            // Non-critical, just log or maybe toast
            error('头像上传失败: ' + String(err?.data?.message || err?.message));
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
            success('用户已删除');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '删除失败'));
        }
    });

    const setUserStatusMutation = useMutation({
        mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) => api.patch(`/users/${id}/status`, { disabled }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
            success('用户状态已更新');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '操作失败'));
        },
    });

    const approveUserMutation = useMutation({
        mutationFn: (id: string) => api.post(`/users/${id}/approve`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
            success('用户已批准');
        },
        onError: (err: any) => error(String(err?.data?.message || err?.message || '操作失败'))
    });

    const rejectUserMutation = useMutation({
        mutationFn: (id: string) => api.post(`/users/${id}/reject`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
            queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
            success('用户已拒绝');
        },
        onError: (err: any) => error(String(err?.data?.message || err?.message || '操作失败'))
    });

    const resetPasswordMutation = useMutation({
        mutationFn: ({ id, password }: { id: string; password: string }) => api.post(`/users/${id}/password`, { password }),
    });

    // Modals State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
    const [userFormData, setUserFormData] = useState<{ name: string; email: string; role: string; password: string }>({
        name: '',
        email: '',
        role: 'family',
        password: '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [userModalError, setUserModalError] = useState('');
    const [showLogsUserId, setShowLogsUserId] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Handlers
    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const params = new URLSearchParams();
            const q = keyword.trim();
            if (q) params.set('q', q);
            params.set('role', role);
            params.set('status', status);
            params.set('sort', sort);
            params.set('limit', '10000');
            params.set('offset', '0');
            
            const res = await api.get(`/users/page?${params.toString()}`);
            const items = res.data.items || [];

            if (items.length === 0) {
                error('暂无数据可导出');
                return;
            }

            const headers = ['ID', '昵称', '邮箱', '角色', '状态', '注册时间', '最后登录', '活跃天数'];
            const csvContent = [
                headers.join(','),
                ...items.map((item: ApiUser) => {
                    const row = [
                        item.id,
                        `"${(item.name || '').replace(/"/g, '""')}"`,
                        `"${(item.email || '').replace(/"/g, '""')}"`,
                        (Array.isArray(rolesList) ? rolesList.find(r => r.id === item.role)?.name : item.role) || item.role,
                        item.status === 'pending' ? '待审核' : (item.disabledAt || item.status === 'disabled' ? '已禁用' : '正常'),
                        item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
                        item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : '',
                        calculateActiveDays(item.createdAt)
                    ];
                    return row.join(',');
                })
            ].join('\n');

            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            success(`成功导出 ${items.length} 条数据`);
        } catch (err) {
            console.error('Export failed:', err);
            error('导出失败，请重试');
        } finally {
            setIsExporting(false);
        }
    };

    const handleOpenUserModal = (user?: ApiUser) => {
        setUserModalError('');
        setAvatarFile(null);
        setAvatarPreview(null);
        if (user) {
            setEditingUser(user);
            setUserFormData({ name: user.name, email: user.email || '', role: user.role, password: '' });
        } else {
            setEditingUser(null);
            setUserFormData({ name: '', email: '', role: 'family', password: '' });
        }
        setIsUserModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSaveUser = async () => {
        const name = userFormData.name.trim();
        const email = userFormData.email.trim();
        const role = userFormData.role;
        const password = userFormData.password;

        if (!name) {
            setUserModalError('昵称不能为空');
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
        if (editingUser && password && password.length < 6) {
            setUserModalError('密码至少 6 位');
            return;
        }

        try {
            let userId = editingUser?.id;

            if (editingUser) {
                await updateUserMutation.mutateAsync({ id: editingUser.id, body: { name, email, role } });
                if (password) {
                    await resetPasswordMutation.mutateAsync({ id: editingUser.id, password });
                }
            } else {
                const res = await createUserMutation.mutateAsync({ name, email, role, password });
                // @ts-ignore
                userId = res.data.id; 
            }

            if (userId && avatarFile) {
                await uploadAvatarMutation.mutateAsync({ id: userId, file: avatarFile });
            }
        } catch (e) {
            // Errors handled in mutations
        }
    };

    const generateRandomPassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let pass = '';
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setUserFormData(prev => ({ ...prev, password: pass }));
    };

    const calculateActiveDays = (createdAt?: string) => {
        if (!createdAt) return 0;
        const start = new Date(createdAt).getTime();
        const now = Date.now();
        const diff = now - start;
        return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        用户管理
                    </h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/20 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            <span>导出 CSV</span>
                        </button>
                        <button
                            onClick={() => handleOpenUserModal()}
                            className="px-4 py-2 bg-green-600 text-white rounded-2xl hover:bg-green-700 flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>新增用户</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 glass-panel p-4 relative z-20">
                    <div className="flex-1 flex gap-3">
                        <div className="relative flex-1 group">
                            <input
                                type="text"
                                placeholder="搜索用户..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 backdrop-blur-sm rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none group-focus-within:text-primary transition-colors" />
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="sm:hidden flex items-center justify-center w-[46px] shrink-0 bg-white dark:bg-white/10 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-2xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:flex gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <DropdownFilter
                                label="排序"
                                value={sort}
                                onChange={(val) => setSort(val)}
                                defaultValue="newest"
                                options={[
                                    { label: '最近加入', value: 'newest' },
                                    { label: '最早加入', value: 'oldest' },
                                    { label: '最近活跃', value: 'active' }
                                ]}
                            />
                        </div>

                        <DropdownFilter
                            label="所有角色"
                            value={role}
                            onChange={(val) => setRole(val)}
                            options={[
                                { label: '所有角色', value: 'all' },
                                ...(Array.isArray(rolesList) ? rolesList.map(r => ({ label: r.name, value: r.id })) : [])
                            ]}
                        />

                        <DropdownFilter
                            label="所有状态"
                            value={status}
                            onChange={(val) => setStatus(val)}
                            options={[
                                { label: '所有状态', value: 'all' },
                                { label: '正常', value: 'active' },
                                { label: '待审核', value: 'pending' },
                                { label: '已禁用', value: 'disabled' }
                            ]}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="glass-panel overflow-hidden">
                    {isLoading ? (
                        <LoadingState message="加载用户列表..." />
                    ) : isError ? (
                        <ErrorState message="加载失败，请重试" onRetry={() => refetch()} />
                    ) : usersPage?.items.length === 0 ? (
                        <EmptyState 
                            icon={Users}
                            title="暂无用户"
                            description="没有找到匹配的用户信息"
                        />
                    ) : (
                        <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/10 dark:bg-black/20 border-b border-white/10 dark:border-white/5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        <th className="px-6 py-3">用户信息</th>
                                        <th className="px-6 py-3">角色</th>
                                        <th className="px-6 py-3">账号状态</th>
                                        <th className="px-6 py-3">活跃天数</th>
                                        <th className="px-6 py-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100/50 dark:divide-white/5">
                                        {usersPage?.items.map((u) => (
                                            <tr key={u.id} className="hover:bg-white/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar url={u.avatar} name={u.name} />
                                                    <div>
                                                        <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`
                                                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                                    ${u.role === 'admin' 
                                                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }
                                                `}>
                                                    {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                                    {(Array.isArray(rolesList) ? rolesList.find(r => r.id === u.role)?.name : u.role) || u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    {u.status === 'pending' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-900/50">
                                                            待审核
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Switch 
                                                                checked={!u.disabledAt} 
                                                                onChange={(checked) => setUserStatusMutation.mutate({ id: u.id, disabled: !checked })}
                                                                disabled={u.id === user?.id}
                                                            />
                                                            <span className={`text-sm ${u.disabledAt ? 'text-gray-400' : 'text-green-600'}`}>
                                                                {u.disabledAt ? '已禁用' : '正常'}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">{calculateActiveDays(u.createdAt)} 天</span>
                                                    <span className="text-xs text-gray-400">
                                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'} 注册
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {u.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => approveUserMutation.mutate(u.id)}
                                                                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                                                                title="通过审核"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => confirm({
                                                                    title: '拒绝注册申请',
                                                                    content: '确定要拒绝该用户的注册申请吗？该操作将删除此账号。',
                                                                    confirmText: '拒绝并删除',
                                                                    confirmVariant: 'danger',
                                                                    onConfirm: () => rejectUserMutation.mutate(u.id)
                                                                })}
                                                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                                title="拒绝申请"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                            <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1"></div>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => setShowLogsUserId(u.id)}
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                                                        title="查看日志"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleOpenUserModal(u)}
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                                                        title="编辑用户"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {u.id !== user?.id && (
                                                        <button 
                                                            onClick={() => confirm({
                                                                title: '危险操作警告：删除用户',
                                                                content: (
                                                                    <div className="space-y-2">
                                                                        <p>您正在尝试删除用户 <span className="font-bold text-gray-900 dark:text-white">{u.name}</span>。</p>
                                                                        <p className="text-red-600 font-bold">此操作是不可逆的，一旦执行无法撤销！</p>
                                                                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                                                            <li>该用户的登录账号将被永久注销</li>
                                                                            <li>该用户的所有个人数据（相册、评论、设置等）将被清除</li>
                                                                            <li>与其关联的操作日志将被保留但标记为已删除用户</li>
                                                                        </ul>
                                                                        <p className="text-sm text-gray-500 mt-2">请在下方确认您已知晓上述风险。</p>
                                                                    </div>
                                                                ),
                                                                confirmText: '确认删除',
                                                                confirmVariant: 'danger',
                                                                onConfirm: () => deleteUserMutation.mutate(u.id),
                                                            })}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                            title="删除用户"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4 p-4">
                            {usersPage?.items.map((u) => (
                                <div key={u.id} className="glass-card p-5 hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar url={u.avatar} name={u.name} className="w-12 h-12 text-lg" />
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white text-base">{u.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                                                    <Mail className="w-3 h-3" />
                                                    {u.email}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`
                                            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
                                            ${u.role === 'admin' 
                                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/30' 
                                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                                            }
                                        `}>
                                            {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                            {(Array.isArray(rolesList) ? rolesList.find(r => r.id === u.role)?.name : u.role) || u.role}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                             <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">账号状态</div>
                                             <div className="flex items-center gap-2">
                                                <Switch 
                                                    checked={!u.disabledAt} 
                                                    onChange={(checked) => setUserStatusMutation.mutate({ id: u.id, disabled: !checked })}
                                                    disabled={u.id === user?.id}
                                                />
                                                <span className={`text-sm font-medium ${u.disabledAt ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {u.disabledAt ? '已禁用' : '正常'}
                                                </span>
                                             </div>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                             <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">活跃天数</div>
                                             <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                                <Activity className="w-3.5 h-3.5 text-primary" />
                                                {calculateActiveDays(u.createdAt)} 天
                                             </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
                                        <button 
                                            onClick={() => setShowLogsUserId(u.id)}
                                            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 font-medium"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            日志
                                        </button>
                                        <button 
                                            onClick={() => handleOpenUserModal(u)}
                                            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1.5 font-medium"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            编辑
                                        </button>
                                        {u.id !== user?.id && (
                                            <button 
                                                onClick={() => confirm({
                                                    title: '危险操作警告：删除用户',
                                                    content: (
                                                        <div className="space-y-2">
                                                            <p>您正在尝试删除用户 <span className="font-bold text-gray-900 dark:text-white">{u.name}</span>。</p>
                                                            <p className="text-red-600 font-bold">此操作是不可逆的，一旦执行无法撤销！</p>
                                                            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                                                <li>该用户的登录账号将被永久注销</li>
                                                                <li>该用户的所有个人数据（相册、评论、设置等）将被清除</li>
                                                                <li>与其关联的操作日志将被保留但标记为已删除用户</li>
                                                            </ul>
                                                            <p className="text-sm text-gray-500 mt-2">请在下方确认您已知晓上述风险。</p>
                                                        </div>
                                                    ),
                                                    confirmText: '确认删除',
                                                    confirmVariant: 'danger',
                                                    onConfirm: () => deleteUserMutation.mutate(u.id),
                                                })}
                                                className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5 font-medium"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                删除
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        </>
                    )}
                    
                    {usersPage && usersPage.total > limit && (
                        <div className="p-4 border-t border-gray-100 dark:border-surface-border">
                            <Pagination 
                                page={page}
                                total={usersPage.total}
                                pageSize={limit}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar - Platform Overview */}
            <div className="lg:col-span-1">
                <PlatformOverview />
            </div>

            {/* Logs Drawer */}
            {showLogsUserId && (
                <OperationLogsDrawer 
                    userId={showLogsUserId} 
                    onClose={() => setShowLogsUserId(null)} 
                />
            )}

            {/* User Modal */}
            <Modal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                title={editingUser ? '编辑用户' : '新增用户'}
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSaveUser}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            保存
                        </button>
                    </div>
                }
            >
                <div className="space-y-6">
                    {userModalError && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                            {userModalError}
                        </div>
                    )}

                    <div className="flex justify-center mb-6">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 ring-4 ring-white shadow-md">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <UserAvatar 
                                        url={editingUser?.avatar} 
                                        name={editingUser?.name || userFormData.name || '?'} 
                                        className="w-full h-full text-3xl"
                                    />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 shadow-sm transition-colors">
                                <Camera className="w-4 h-4" />
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
                        <input
                            type="text"
                            value={userFormData.name}
                            onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                            className="w-full mt-1 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm"
                            placeholder="请输入昵称"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">邮箱</label>
                        <input
                            type="email"
                            value={userFormData.email}
                            onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                            className="w-full mt-1 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm"
                            placeholder="请输入邮箱"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">角色</label>
                        <FormSelect
                            value={userFormData.role}
                            onChange={(val) => setUserFormData({ ...userFormData, role: val })}
                            options={Array.isArray(rolesList) ? rolesList.map(r => ({ label: r.name, value: r.id })) : []}
                            placeholder="请选择角色"
                        />
                    </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {editingUser ? '重置密码' : '初始密码'}
                                </label>
                                <button
                                    type="button"
                                    onClick={generateRandomPassword}
                                    className="text-primary hover:text-primary/80 text-xs flex items-center gap-1 transition-colors font-medium"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    随机生成
                                </button>
                            </div>
                            <input
                                type="text"
                                value={userFormData.password}
                                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                                className="w-full mt-1 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm font-mono"
                                placeholder={editingUser ? "不修改请留空，至少 6 位" : "至少 6 位"}
                            />
                            {editingUser && (
                                <p className="text-xs text-gray-400 mt-1">若无需修改密码，请保持为空</p>
                            )}
                        </div>
                </div>
            </Modal>

        </div>
    );
};
