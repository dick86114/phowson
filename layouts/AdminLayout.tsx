import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Plus, Image as ImageIcon, Settings, Users, BarChart3, 
    Activity, Camera, X, Menu, ArrowLeft, MessageSquare, LogOut, Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { getAvatarUrl } from '../utils/helpers';

export const AdminLayout: React.FC = () => {
    const { user: currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // 权限检查
    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
        }
    }, [currentUser, navigate]);

    // 路由改变时关闭移动端菜单
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    // 手势支持
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

        if (isLeftSwipe && isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (isRightSwipe && !isMobileMenuOpen && touchStart < 50) setIsMobileMenuOpen(true);
    };

    const isAdmin = currentUser?.role === 'admin';

    // 获取评论统计 (仅管理员)
    const { data: commentSummary } = useQuery({
        queryKey: ['admin-comments-summary'],
        enabled: isAdmin,
        queryFn: async () => {
            const res = await api.get('/admin/comments/summary');
            return res.data as { pending: number };
        }
    });

    const personalMenuItems = [
        { key: 'me_albums', label: '我的照片', icon: ImageIcon, to: '/admin/me/albums' },
        { key: 'me_analytics', label: '我的统计', icon: BarChart3, to: '/admin/me/analytics' },
        { key: 'me_uploads', label: '我的历史', icon: Activity, to: '/admin/me/uploads' },
        { key: 'me_profile', label: '我的资料', icon: Users, to: '/admin/me/profile' },
    ];

    const adminMenuItems = isAdmin ? [
        { key: 'manage_photos', label: '全站照片管理', icon: ImageIcon, to: '/admin/manage/photos' },
        { key: 'manage_analytics', label: '全站数据统计', icon: BarChart3, to: '/admin/manage/analytics' },
        { key: 'manage_comments', label: '评论管理', icon: MessageSquare, to: '/admin/manage/comments', badge: commentSummary?.pending || 0 },
        { key: 'manage_users', label: '用户管理', icon: Users, to: '/admin/manage/users' },
        { key: 'manage_about', label: '关于页面设置', icon: Info, to: '/admin/manage/about' },
        { key: 'manage_settings', label: '系统设置', icon: Settings, to: '/admin/manage/settings' },
    ] : [];

    if (!currentUser) return null;

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
                    {personalMenuItems.map(item => (
                        <NavLink
                            key={item.key}
                            to={item.to}
                            className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                                isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b1219]`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1 text-left">{item.label}</span>
                        </NavLink>
                    ))}

                    {isAdmin && (
                        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-surface-border">
                            <div className="px-2 pb-2 text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500">
                                管理员
                            </div>
                            {adminMenuItems.map(item => (
                                <NavLink
                                    key={item.key}
                                    to={item.to}
                                    className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                                        isActive
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark'
                                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b1219]`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {Number((item as any).badge || 0) > 0 && (
                                        <span className="min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                                            {(item as any).badge}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-200 dark:border-surface-border">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-100 dark:bg-surface-dark/50 rounded-xl">
                        <img 
                            src={getAvatarUrl(currentUser)} 
                            alt="User" 
                            className="w-8 h-8 rounded-full border border-gray-200 dark:border-surface-border object-cover" 
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">{currentUser.role}</p>
                        </div>
                        <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors" title="退出登录">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                    <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-surface-border hover:bg-gray-200 dark:hover:bg-[#2a4055] text-gray-800 dark:text-gray-100 text-sm transition-colors justify-center">
                        <ArrowLeft className="w-4 h-4" />
                        返回前台
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 min-h-screen flex flex-col w-full">
                {/* Mobile Header */}
                <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-[#0b1219]/80 backdrop-blur-md border-b border-gray-200 dark:border-surface-border">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        type="button"
                        aria-label="打开侧边栏菜单"
                        className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg active:scale-95 transition-transform"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <Camera className="w-5 h-5 text-primary" />
                        <span className="font-bold">管理中心</span>
                    </Link>
                    <div className="w-8" />
                </div>
                
                <div className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
