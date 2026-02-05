import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Plus, Image as ImageIcon, Settings, Users, BarChart3, 
    Edit2, Trash2, ArrowLeft, LogOut, TrendingUp, Activity, Smartphone, 
    Monitor, Save, Bell, Shield, Search, MoreHorizontal, Camera, Lock,
    Tag, X, AlertTriangle, Maximize2, Check, RefreshCw, Key, Download,
    PieChart, ThumbsUp, MessageSquare, User as UserIcon, Mail, Upload,
    Ban, Loader2, Sparkles
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../components/Modal';

type Tab = 'photos' | 'stats' | 'users' | 'settings' | 'categories';

type ApiUser = {
    id: string;
    name: string;
    role: 'admin' | 'family';
    avatar: string;
    email: string | null;
    createdAt: string;
};

type ApiCategory = {
    value: string;
    label: string;
    sortOrder: number;
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

const SiteSettingsPanel: React.FC = () => {
    const queryClient = useQueryClient();
    const { alert, confirm } = useModal();
    const { data: siteSettings } = useQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const res = await api.get('/site-settings');
            return res.data as any;
        },
    });
    const [siteName, setSiteName] = useState<string>(siteSettings?.siteName || '');
    const [logoUrl, setLogoUrl] = useState<string>(siteSettings?.logoUrl || '');
    const [seoTitle, setSeoTitle] = useState<string>(siteSettings?.seo?.title || '');
    const [seoDesc, setSeoDesc] = useState<string>(siteSettings?.seo?.description || '');
    const [seoKeywords, setSeoKeywords] = useState<string>(siteSettings?.seo?.keywords || '');
    const [themeMode, setThemeMode] = useState<string>(siteSettings?.theme?.mode || 'system');
    const [primaryColor, setPrimaryColor] = useState<string>(siteSettings?.theme?.colorPrimary || '#137fec');
    const presetColors = [
        { value: '#4f7cac', label: '蓝灰' },
        { value: '#6c8cbf', label: '浅蓝' },
        { value: '#8faadc', label: '淡蓝' },
        { value: '#12b886', label: '青绿' },
        { value: '#22b8cf', label: '青色' },
        { value: '#f59f00', label: '橙黄' },
    ];

    useEffect(() => {
        setSiteName(siteSettings?.siteName || '');
        setLogoUrl(siteSettings?.logoUrl || '');
        setSeoTitle(siteSettings?.seo?.title || '');
        setSeoDesc(siteSettings?.seo?.description || '');
        setSeoKeywords(siteSettings?.seo?.keywords || '');
        setThemeMode(siteSettings?.theme?.mode || 'system');
        setPrimaryColor(siteSettings?.theme?.colorPrimary || '#137fec');
        const color = siteSettings?.theme?.colorPrimary || '#137fec';
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--color-primary', color);
        }
    }, [siteSettings]);

    const saveMutation = useMutation({
        mutationFn: () =>
            api.post('/admin/site-settings', {
                siteName,
                logoUrl,
                seo: { title: seoTitle, description: seoDesc, keywords: seoKeywords },
                theme: { mode: themeMode, colorPrimary: primaryColor },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            alert({ title: '保存成功', content: '站点配置已更新并生效' });
            if (typeof document !== 'undefined') {
                document.documentElement.style.setProperty('--color-primary', primaryColor);
            }
        },
        onError: (err: any) => {
            alert({ title: '保存失败', content: String(err?.data?.message || err?.message || '保存失败') });
        },
    });

    const rollbackMutation = useMutation({
        mutationFn: () => api.post('/admin/site-settings/rollback', {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            alert({ title: '已回滚', content: '已回滚到上一版本配置' });
        },
        onError: (err: any) => {
            alert({ title: '回滚失败', content: String(err?.data?.message || err?.message || '回滚失败') });
        },
    });

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">网站标题</label>
                    <input
                        type="text"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">LOGO URL</label>
                    <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">SEO 标题</label>
                    <input
                        type="text"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">SEO 描述</label>
                    <input
                        type="text"
                        value={seoDesc}
                        onChange={(e) => setSeoDesc(e.target.value)}
                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">SEO 关键词</label>
                    <input
                        type="text"
                        value={seoKeywords}
                        onChange={(e) => setSeoKeywords(e.target.value)}
                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">主题模式</label>
                    <select
                        value={themeMode}
                        onChange={(e) => setThemeMode(e.target.value)}
                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm"
                    >
                        <option value="system">跟随系统</option>
                        <option value="light">浅色</option>
                        <option value="dark">深色</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">主题主色</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {presetColors.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setPrimaryColor(c.value)}
                                className={`w-10 h-10 rounded-lg border ${primaryColor === c.value ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 dark:border-surface-border'}`}
                                style={{ backgroundColor: c.value }}
                                title={c.label}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
                <button
                    onClick={() => saveMutation.mutate()}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text白 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <Save className="w-4 h-4" />
                    保存配置
                </button>
                <button
                    onClick={() =>
                        confirm({
                            title: '回滚确认',
                            content: '回滚到上一版本配置？此操作不可撤销。',
                            onConfirm: () => rollbackMutation.mutate(),
                        })
                    }
                    className="flex items-center gap-2 bg-gray-100 dark:bg-surface-border hover:bg-gray-200 dark:hover:bg-[#2a4055] text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    回滚配置
                </button>
                <button
                    onClick={() => {
                        const raw = localStorage.getItem('photologs:mock:photos');
                        const photos = raw ? JSON.parse(raw) : [];
                        if (!Array.isArray(photos) || photos.length === 0) {
                            alert({ title: '导入提示', content: '未找到可导入的本地数据' });
                            return;
                        }
                        api.post('/admin/migrate/localstorage', { photos })
                          .then(() => {
                              queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
                              queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
                              alert({ title: '成功', content: '导入完成' });
                          })
                          .catch(() => {
                              alert({ title: '失败', content: '导入失败' });
                          });
                    }}
                    className="flex items-center gap-2 bg-gray-100 dark:bg-surface-border hover:bg-gray-200 dark:hover:bg-[#2a4055] text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    导入本地数据
                </button>
            </div>
        </div>
    );
};

export const Admin: React.FC = () => {
    const navigate = useNavigate();
    const { user: currentUser, logout, setSession } = useAuth();
    const { alert, confirm } = useModal();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('photos');

    useEffect(() => {
        if (!currentUser) navigate('/login');
    }, [currentUser, navigate]);

    if (!currentUser) return null;
    
    const isAdmin = currentUser?.role === 'admin';

    // Fetch photos
    const { data: photos = [], isLoading: photosLoading } = useQuery({
        queryKey: ['admin-photos'],
        queryFn: async () => {
            const res = await api.get('/photos');
            return res.data;
        }
    });

    // Fetch stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['admin-stats'],
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
            alert({
                title: '操作失败',
                content: String(err?.data?.message || err?.message || '删除失败'),
            });
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
            alert({
                title: 'AI 点评失败',
                content: String(err?.data?.message || err?.message || 'AI 点评失败'),
            });
        },
        onSettled: () => {
            setCritiquePhotoId(null);
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setUserToDelete(null);
        }
    });

    const createUserMutation = useMutation({
        mutationFn: (body: { name: string; email: string; role: 'admin' | 'family'; password: string }) => api.post('/users', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setIsUserModalOpen(false);
            setEditingUser(null);
        },
        onError: (err: any) => {
            setUserModalError(String(err?.data?.message || err?.message || '保存失败'));
        }
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
            alert({
                title: '添加分类失败',
                content: String(err?.data?.message || err?.message || '添加分类失败'),
            });
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
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState(toMediaUrl(currentUser?.avatar || `/media/avatars/${currentUser?.id || 'me'}`));
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [profileName, setProfileName] = useState<string>(currentUser?.name || '');

    const effectiveUser = {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || '管理员',
        avatar: avatarUrl,
    };
    const simulatedRole = isAdmin ? 'admin' : 'family';

    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ['admin-users'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get<ApiUser[]>('/users');
            return res.data;
        },
    });

    const { data: categories = [], isLoading: categoriesLoading } = useQuery({
        queryKey: ['categories'],
        enabled: true,
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });

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

    // Sync avatar
    useEffect(() => {
        setAvatarUrl(toMediaUrl(currentUser?.avatar || `/media/avatars/${currentUser?.id || 'me'}`));
    }, [currentUser]);

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
                // In a real app, update auth context user as well
            } catch (err) {
                console.error('Avatar upload failed:', err);
            }
        }
    };

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            const name = profileName.trim();
            if (!name) throw new Error('显示名称不能为空');
            await api.patch(`/users/${currentUser.id}`, { name });
        },
        onSuccess: () => {
            const token = localStorage.getItem('photologs:auth:token') || '';
            setSession({ ...currentUser, name: profileName }, token);
            alert({ title: '成功', content: '个人资料已更新' });
        },
        onError: (err: any) => {
            alert({ title: '更新失败', content: String(err?.data?.message || err?.message || '更新失败') });
        },
    });
    const handleImportLocalStorage = async () => {
        try {
            const raw = localStorage.getItem('photologs:mock:photos');
            const photos = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(photos) || photos.length === 0) {
                alert({ title: '导入提示', content: '未找到可导入的本地数据' });
                return;
            }
            await api.post('/admin/migrate/localstorage', { photos });
            queryClient.invalidateQueries({ queryKey: ['admin-photos'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            alert({ title: '成功', content: '导入完成' });
        } catch (e) {
            console.error(e);
            alert({ title: '失败', content: '导入失败' });
        }
    };

    // Sidebar Menu Items
    const menuItems = [
        { id: 'photos', label: '照片管理', icon: ImageIcon },
        { id: 'stats', label: '数据统计', icon: BarChart3 },
        ...(isAdmin ? [
            { id: 'categories', label: '分类管理', icon: Tag },
            { id: 'users', label: '用户管理', icon: Users },
        ] : []),
        { id: 'settings', label: '设置', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-[#0b1219] border-r border-gray-200 dark:border-surface-border flex flex-col fixed inset-y-0 z-50 transition-colors duration-300">
                <div className="p-6">
                    <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-primary transition-colors">
                        <div className="size-8 flex items-center justify-center text-primary bg-primary/10 rounded-lg">
                            <Camera className="w-5 h-5" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">管理中心</h1>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as Tab)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                                activeTab === item.id 
                                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark'
                            }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    ))}
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
            <main className="flex-1 ml-64 p-8 max-w-[1600px] mx-auto w-full">
                
                {/* --- PHOTOS TAB --- */}
                {activeTab === 'photos' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">照片库</h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                    {isAdmin ? '管理所有摄影作品' : '管理您上传的摄影作品'}
                                </p>
                            </div>
                            <Link to="/upload" className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-primary/20">
                                <Plus className="w-4 h-4" />
                                上传照片
                            </Link>
                        </div>

                        {/* Photo List */}
                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden shadow-sm transition-colors">
                            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200 dark:border-surface-border text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#111a22]">
                                <div className="col-span-5">照片信息</div>
                                <div className="col-span-2">参数</div>
                                <div className="col-span-3">数据表现</div>
                                <div className="col-span-2 text-right">操作</div>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-surface-border">
                                {photosLoading ? (
                                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                                ) : photos.map((photo: any) => {
                                    const exif = JSON.parse(photo.exif || '{}');
                                    return (
                                        <div key={photo.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors group">
                                            <div className="col-span-5 flex items-center gap-4">
                                                <div 
                                                    className="w-16 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer relative"
                                                    onClick={() => setPreviewPhotoUrl(toMediaUrl(photo.mediumUrl || photo.url))}
                                                >
                                                    <img src={toMediaUrl(photo.thumbUrl || photo.url)} alt={photo.title} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <Maximize2 className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1">{photo.title}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-border text-gray-600 dark:text-gray-300">{categoryLabelByValue.get(String(photo.category || '')) || photo.category}</span>
                                                        <span className="text-xs text-gray-500">{new Date(photo.createdAt).toLocaleDateString()}</span>
                                                        {photo.aiCritique ? (
                                                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <Sparkles className="w-3 h-3" />
                                                                AI
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                <div className="flex items-center gap-1"><Camera className="w-3 h-3" /> {exif.Model || '未知相机'}</div>
                                                <div className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {photo.imageWidth && photo.imageHeight ? `${photo.imageWidth}×${photo.imageHeight}` : '未知分辨率'}</div>
                                                <div className="flex items-center gap-1"><Upload className="w-3 h-3" /> {photo.imageSizeBytes ? formatBytes(photo.imageSizeBytes) : '未知大小'}</div>
                                                <div className="flex items-center gap-1"><Tag className="w-3 h-3" /> {photo.tags?.split(',').length || 0} 个标签</div>
                                            </div>
                                            <div className="col-span-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                                <span className="flex items-center gap-1" title="浏览"><Activity className="w-4 h-4 text-blue-500" /> {photo.viewsCount}</span>
                                                <span className="flex items-center gap-1" title="点赞"><ThumbsUp className="w-4 h-4 text-red-500" /> {photo.likesCount}</span>
                                                <span className="flex items-center gap-1" title="评论"><MessageSquare className="w-4 h-4 text-green-500" /> {photo.comments?.length || 0}</span>
                                            </div>
                                            <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isAdmin ? (
                                                    <button
                                                        onClick={() => {
                                                            setCritiquePhotoId(photo.id);
                                                            critiquePhotoMutation.mutate(photo.id);
                                                        }}
                                                        disabled={critiquePhotoId === photo.id}
                                                        className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={photo.aiCritique ? '更新 AI 点评' : '生成 AI 点评'}
                                                    >
                                                        {critiquePhotoId === photo.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                ) : null}
                                                <Link to={`/edit/${photo.id}`} className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </Link>
                                                <button 
                                                    onClick={() => setPhotoToDelete(photo.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {!photosLoading && photos.length === 0 && (
                                    <div className="p-8 text-center text-gray-500">
                                        暂无照片，点击右上角上传。
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STATS TAB --- */}
                {activeTab === 'stats' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">数据仪表盘</h2>
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
                                        <div className="h-64 flex items-end justify-between gap-4 px-2">
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

                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden shadow-sm transition-colors">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-[#111a22] text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-surface-border">
                                        <th className="px-6 py-4">用户</th>
                                        <th className="px-6 py-4">角色</th>
                                        <th className="px-6 py-4">状态</th>
                                        <th className="px-6 py-4 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-surface-border">
                                    {usersLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                                <Loader2 className="inline-block w-5 h-5 animate-spin" />
                                            </td>
                                        </tr>
                                    ) : users.map(user => {
                                        const isSelf = user.id === effectiveUser.id;
                                        return (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-surface-border/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <img src={toMediaUrl(user.avatar)} alt={user.name} className="w-10 h-10 rounded-full border border-gray-200 dark:border-surface-border object-cover" />
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                                {user.name}
                                                                {isSelf && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">我</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-500">{user.email || `ID: ${user.id}`}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                                        user.role === 'admin' 
                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-500' 
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-500'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        正常
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
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
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
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
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {isAdmin ? '系统设置' : '个人资料'}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">
                                {isAdmin ? '管理网站全局配置和个人偏好' : '管理您的个人信息'}
                            </p>
                        </div>

                        {/* Profile Settings */}
                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-primary" />
                                个人资料
                            </h3>
                            <div className="flex items-start gap-6">
                                <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
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
                                
                                <div className="space-y-4 flex-1 max-w-md">
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">显示名称</label>
                                        <input 
                                            type="text" 
                                            value={profileName} 
                                            onChange={(e) => setProfileName(e.target.value)} 
                                            className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white text-sm" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">当前角色</label>
                                        <input type="text" value={simulatedRole} disabled className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-500 text-sm capitalize" />
                                    </div>
                                    <button 
                                        onClick={() => updateProfileMutation.mutate()} 
                                        className="bg-gray-100 dark:bg-white text-gray-900 dark:text-black hover:bg-gray-200 dark:hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        更新资料
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Site Settings (Admin Only) */}
                        {isAdmin && (
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Monitor className="w-5 h-5 text-primary" />
                                    站点配置
                                </h3>
                                <SiteSettingsPanel />
                            </div>
                        )}

                        {/* Account Security */}
                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 shadow-sm">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                账号安全
                            </h3>
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <p>退出登录将清除会话并返回首页</p>
                                </div>
                                <button
                                    onClick={() =>
                                        confirm({
                                            title: '确认退出登录',
                                            content: '是否退出当前账号？',
                                            onConfirm: () => {
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
                    <button className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/70">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            )}

            {(photoToDelete || userToDelete || categoryToDelete) && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">确认删除?</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">此操作无法撤销，数据将被永久移除。</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => { setPhotoToDelete(null); setUserToDelete(null); setCategoryToDelete(null); }} 
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-border transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={() => { if(photoToDelete) confirmDeletePhoto(); if(userToDelete) confirmDeleteUser(); if(categoryToDelete) confirmDeleteCategory(); }}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={deletePhotoMutation.isPending || deleteUserMutation.isPending || deleteCategoryMutation.isPending}
                            >
                                {deletePhotoMutation.isPending || deleteUserMutation.isPending || deleteCategoryMutation.isPending ? '正在删除...' : '确认删除'}
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
                            <button onClick={() => setIsUserModalOpen(false)}><X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-white" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400">用户名</label>
                                <input 
                                    type="text" 
                                    value={userFormData.name}
                                    onChange={(e) => setUserFormData({...userFormData, name: e.target.value})}
                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400">邮箱</label>
                                <input 
                                    type="email" 
                                    value={userFormData.email}
                                    onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400">角色权限</label>
                                <select 
                                    value={userFormData.role}
                                    onChange={(e) => setUserFormData({...userFormData, role: e.target.value as any})}
                                    className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
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
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
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
                            <button onClick={() => setPasswordModalUser(null)}><X className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:hover:text-white" /></button>
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
                                        className="w-full mt-1 bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
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
        </div>
    );
};
