import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Search, Menu, X, Instagram, Twitter, Mail, LogIn, Sun, Moon, Monitor, Heart, Trophy, LayoutDashboard, LogOut, ChevronDown, Image as ImageIcon, MapPin, BookOpen, Info, Upload, User, ChevronRight, Settings, MessageSquare, Users, PieChart, FileText } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../api';
import { useTheme } from '../ThemeContext';
import { useSiteSettings } from '../SiteSettingsContext';
import { getAvatarUrl, getPhotoUrl, toMediaUrl } from '../utils/helpers';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user: currentUser, logout } = useAuth();
  const settings = useSiteSettings();
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuId = useId();
  
  const avatarUrl = getAvatarUrl(currentUser);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(`/?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  const toggleTheme = () => {
      if (theme === 'system') setTheme('light');
      else if (theme === 'light') setTheme('dark');
      else setTheme('system');
  };

  const ThemeIcon = () => {
      if (theme === 'light') return <Sun className="w-5 h-5" />;
      if (theme === 'dark') return <Moon className="w-5 h-5" />;
      return <Monitor className="w-5 h-5" />;
  };

  const userMenuItems = useMemo(() => {
    if (!currentUser) return [];
    const items = [
      { 
        key: 'gamification', 
        label: '我的成就', 
        to: '/gamification', 
        icon: Trophy,
        iconBg: 'bg-yellow-50 dark:bg-yellow-500/10',
        iconColor: 'text-yellow-600 dark:text-yellow-400'
      },
      { 
        key: 'my-photos', 
        label: '我的照片', 
        to: '/me/albums', 
        icon: ImageIcon,
        iconBg: 'bg-blue-50 dark:bg-blue-500/10',
        iconColor: 'text-blue-600 dark:text-blue-400'
      },
      { 
        key: 'profile', 
        label: '我的资料', 
        to: '/me/profile', 
        icon: User,
        iconBg: 'bg-purple-50 dark:bg-purple-500/10',
        iconColor: 'text-purple-600 dark:text-purple-400'
      }
    ];

    if (currentUser.role === 'admin') {
      items.push(
        { 
          key: 'admin-photos', 
          label: '全部照片管理', 
          to: '/admin/manage/photos', 
          icon: ImageIcon,
          iconBg: 'bg-cyan-50 dark:bg-cyan-500/10',
          iconColor: 'text-cyan-600 dark:text-cyan-400'
        },
        { 
          key: 'admin-analytics', 
          label: '全站数据统计', 
          to: '/admin/manage/analytics', 
          icon: PieChart,
          iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
          iconColor: 'text-emerald-600 dark:text-emerald-400'
        },
        { 
          key: 'admin-comments', 
          label: '评论管理', 
          to: '/admin/manage/comments', 
          icon: MessageSquare,
          iconBg: 'bg-orange-50 dark:bg-orange-500/10',
          iconColor: 'text-orange-600 dark:text-orange-400'
        },
        { 
          key: 'admin-users', 
          label: '用户管理', 
          to: '/admin/manage/users', 
          icon: Users,
          iconBg: 'bg-pink-50 dark:bg-pink-500/10',
          iconColor: 'text-pink-600 dark:text-pink-400'
        },
        { 
          key: 'admin-about', 
          label: '关于页面设置', 
          to: '/admin/manage/about', 
          icon: FileText,
          iconBg: 'bg-teal-50 dark:bg-teal-500/10',
          iconColor: 'text-teal-600 dark:text-teal-400'
        },
        { 
          key: 'admin-settings', 
          label: '系统设置', 
          to: '/admin/manage/settings', 
          icon: Settings,
          iconBg: 'bg-slate-50 dark:bg-slate-500/10',
          iconColor: 'text-slate-600 dark:text-slate-400'
        }
      );
    }

    return items;
  }, [currentUser]);

  const closeUserMenu = () => setIsUserMenuOpen(false);

  const focusUserMenuItem = (index: number) => {
    const root = userMenuRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll('a[role="menuitem"],button[role="menuitem"]')) as HTMLElement[];
    const el = items[index];
    el?.focus();
  };

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (userMenuRef.current?.contains(target)) return;
      if (userMenuButtonRef.current?.contains(target)) return;
      closeUserMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeUserMenu();
        userMenuButtonRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <header 
        className={`w-full z-[60] transition-colors duration-300 ${
            location.pathname === '/' 
                ? 'fixed top-0 border-none bg-transparent md:sticky md:bg-gradient-to-b md:from-white/95 md:via-white/70 md:to-transparent md:dark:from-[#111a22]/95 md:dark:via-[#111a22]/70 md:dark:to-transparent md:backdrop-blur-sm md:border-b md:border-gray-200 md:dark:border-surface-border' 
                : 'sticky top-0 border-b border-gray-200 dark:border-surface-border bg-gradient-to-b from-white/95 via-white/70 to-transparent dark:from-[#111a22]/95 dark:via-[#111a22]/70 dark:to-transparent backdrop-blur-sm'
        }`}
        onDoubleClick={() => {
            if (window.innerWidth < 768) { // Only on mobile
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }}
    >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          <div className="flex-1 flex items-center gap-2">
            <Link to="/" className={`flex items-center gap-2 transition-colors ${location.pathname === '/' ? 'text-white md:text-gray-900 md:dark:text-white drop-shadow-md md:drop-shadow-none' : 'text-gray-900 dark:text-white hover:text-primary'}`}>
              {settings.siteLogo ? (
                  <img src={toMediaUrl(settings.siteLogo)} alt="Logo" className={`w-8 h-8 object-contain ${location.pathname === '/' ? 'drop-shadow-md md:drop-shadow-none' : ''}`} />
              ) : (
                  <div className={`size-8 flex items-center justify-center rounded-lg ${location.pathname === '/' ? 'bg-white/20 backdrop-blur-md text-white md:bg-primary/10 md:text-primary md:backdrop-blur-none shadow-lg md:shadow-none' : 'text-primary bg-primary/10'}`}>
                    <Camera className="w-5 h-5" />
                  </div>
              )}
              <h1 className="text-lg font-bold tracking-tight">{settings.siteName || '光影视界'}</h1>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 justify-center">
            <Link to="/" className={`text-sm font-medium transition-colors ${isActive('/') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>画廊</Link>
            <Link to="/map" className={`text-sm font-medium transition-colors ${isActive('/map') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>地图</Link>
            <Link to="/stories" className={`text-sm font-medium transition-colors ${isActive('/stories') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>故事</Link>
            <Link to="/about" className={`text-sm font-medium transition-colors ${isActive('/about') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>关于</Link>
          </nav>

          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="hidden lg:flex relative w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="搜索照片 (按回车)..."
                className="w-full rounded-full border border-gray-200 dark:border-surface-border bg-gray-100 dark:bg-surface-dark py-1.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                type="button"
                aria-label="搜索"
                className={`md:hidden p-2 rounded-full transition-colors ${location.pathname === '/' ? 'text-white hover:bg-white/20 drop-shadow-md' : 'text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-dark'}`}
            >
                <Search className="w-5 h-5" />
            </button>
            
            {currentUser ? (
              <div className="hidden md:flex items-center gap-4 relative">
                <Link 
                    to="/upload"
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-full shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 group"
                >
                    <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>发布作品</span>
                </Link>

                {/* User Menu Button */}
                <div className="relative">
                  <button
                    ref={userMenuButtonRef}
                    type="button"
                    className="flex items-center gap-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                    aria-controls={userMenuId}
                    onClick={() => {
                      setIsUserMenuOpen((v) => !v);
                      setIsMenuOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsUserMenuOpen(true);
                        window.setTimeout(() => focusUserMenuItem(0), 0);
                      }
                    }}
                    title="个人菜单"
                  >
                    <img src={avatarUrl} alt="Profile" className="w-9 h-9 rounded-full border border-gray-200 dark:border-surface-border object-cover" />
                    <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-300 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUserMenuOpen && (
                    <div
                      ref={userMenuRef}
                      id={userMenuId}
                      role="menu"
                      aria-label="个人菜单"
                      className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right ring-1 ring-black/5"
                      onKeyDown={(e) => {
                        const items = Array.from(userMenuRef.current?.querySelectorAll('a[role="menuitem"],button[role="menuitem"]') || []) as HTMLElement[];
                        const active = document.activeElement as HTMLElement | null;
                        const idx = items.findIndex((x) => x === active);
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const next = idx < 0 ? 0 : Math.min(items.length - 1, idx + 1);
                          items[next]?.focus();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const next = idx < 0 ? items.length - 1 : Math.max(0, idx - 1);
                          items[next]?.focus();
                        } else if (e.key === 'Home') {
                          e.preventDefault();
                          items[0]?.focus();
                        } else if (e.key === 'End') {
                          e.preventDefault();
                          items[items.length - 1]?.focus();
                        } else if (e.key === 'Tab') {
                          closeUserMenu();
                        }
                      }}
                    >
                      <div className="p-4 border-b border-gray-100 dark:border-surface-border/60 bg-gray-50/50 dark:bg-white/5">
                         <div className="flex items-center gap-3">
                             <img src={avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full border border-gray-200 dark:border-surface-border" />
                             <div className="flex-1 min-w-0">
                                 <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</div>
                                 <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                     {currentUser.role === 'admin' ? (
                                         <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                                             管理员
                                         </span>
                                     ) : '家庭成员'}
                                 </div>
                             </div>
                         </div>
                      </div>

                      <div className="p-2 space-y-0.5">
                         {userMenuItems.map((it) => {
                          const active = isActive(it.to);
                          return (
          <React.Fragment key={it.key}>
            {it.key === 'admin-photos' && (
               <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-2" />
            )}
            <Link
              to={it.to}
              role="menuitem"
              tabIndex={0}
              onClick={() => closeUserMenu()}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-colors group ${
                active 
                ? 'bg-gray-50 dark:bg-white/10 text-gray-900 dark:text-white' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-transform group-hover:scale-110 ${
                active 
                ? `${it.iconBg} ${it.iconColor}` 
                : 'bg-gray-100 dark:bg-surface-border text-gray-500 dark:text-gray-400'
              }`}>
                 <it.icon className="w-4 h-4" />
              </div>
              <span className={active ? 'font-bold' : 'font-medium'}>{it.label}</span>
            </Link>
          </React.Fragment>
        )})}

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-2" />

        <div className="px-3 py-2">
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1.5">
                                <Sun className="w-3.5 h-3.5" /> 主题模式
                            </div>
                            <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-surface-border/50 p-1 rounded-lg">
                                {(['light', 'dark', 'system'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTheme(mode);
                                        }}
                                        className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${
                                            theme === mode 
                                            ? 'bg-white dark:bg-surface-light shadow-sm text-primary' 
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '系统'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-2" />

                        <button
                          type="button"
                          role="menuitem"
                          tabIndex={0}
                          onClick={() => {
                            closeUserMenu();
                            logout();
                            navigate('/');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors group"
                        >
                          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 group-hover:text-red-500 group-hover:bg-red-100 dark:group-hover:bg-red-900/20 transition-colors">
                              <LogOut className="w-4 h-4" />
                          </div>
                          退出登录
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link
                to={`/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                登录
              </Link>
            )}

            <button 
                type="button"
                aria-label={isMenuOpen ? '关闭菜单' : '打开菜单'}
                className={`md:hidden rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#111a22] ${location.pathname === '/' ? 'text-white drop-shadow-md hover:bg-white/20' : 'text-gray-600 dark:text-gray-300'}`}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {isSearchOpen && (
        <div className="md:hidden border-b border-gray-200 dark:border-surface-border bg-white dark:bg-background-dark p-4 animate-in slide-in-from-top-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    autoFocus
                    placeholder="搜索照片..."
                    className="w-full rounded-lg border border-gray-200 dark:border-surface-border bg-gray-100 dark:bg-surface-dark py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMenuOpen && createPortal(
        <div className="fixed inset-0 z-[9999] md:hidden">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" 
                onClick={() => setIsMenuOpen(false)} 
            />
            
            {/* Sidebar */}
            <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white/90 dark:bg-surface-dark/90 backdrop-blur-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Close Button */}
                <button 
                    onClick={() => setIsMenuOpen(false)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors z-10"
                >
                    <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>

                {currentUser ? (
                    // Logged In View
                    <>
                        {/* User Profile Header */}
                        <div className="pt-20 pb-8 px-8 flex flex-col items-center border-b border-gray-100/50 dark:border-white/5 bg-gradient-to-b from-primary/5 to-transparent">
                            <div className="relative mb-4">
                                <img 
                                    src={avatarUrl} 
                                    alt={currentUser.name}
                                    className="w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white dark:ring-white/10" 
                                />
                                {currentUser.role === 'admin' && (
                                    <div className="absolute bottom-0 right-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-md border-2 border-white dark:border-surface-dark">
                                        ADMIN
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{currentUser.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {currentUser.role === 'admin' ? '管理员' : '家庭成员'}
                            </p>
                        </div>

                        {/* Menu Items */}
                        <div className="flex-1 overflow-y-auto py-6 px-6 space-y-1">
                             {userMenuItems.map((it) => {
                                const active = isActive(it.to);
                                return (
                                <React.Fragment key={it.key}>
                                    {it.key === 'admin-photos' && (
                                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-2 mx-4" />
                                    )}
                                    <Link 
                                        to={it.to} 
                                        onClick={() => setIsMenuOpen(false)}
                                        className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors group ${
                                            active 
                                            ? 'bg-gray-50 dark:bg-white/10 text-gray-900 dark:text-white' 
                                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg transition-transform group-hover:scale-110 ${
                                            active 
                                            ? `${it.iconBg} ${it.iconColor}` 
                                            : 'bg-gray-100 dark:bg-surface-border text-gray-500 dark:text-gray-400'
                                        }`}>
                                            <it.icon className="w-5 h-5" />
                                        </div>
                                        <span className={`text-base ${active ? 'font-bold' : 'font-medium'}`}>{it.label}</span>
                                        <ChevronRight className={`w-4 h-4 ml-auto ${active ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`} />
                                    </Link>
                                </React.Fragment>
                             )})}

                             <div className="h-px bg-gray-200 dark:bg-gray-700 my-4 mx-4" />

                             {/* Theme Toggle Section */}
                             <div className="mb-2 px-4">
                                 <div className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                     <Sun className="w-4 h-4" /> 主题模式
                                 </div>
                                 <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-black/20 p-1 rounded-xl">
                                     {(['light', 'dark', 'system'] as const).map((mode) => (
                                         <button
                                             key={mode}
                                             onClick={() => setTheme(mode)}
                                             className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                                 theme === mode 
                                                 ? 'bg-white dark:bg-surface-light shadow-sm text-primary' 
                                                 : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                             }`}
                                         >
                                             {mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             <div className="h-px bg-gray-200 dark:bg-gray-700 my-2 mx-4" />

                             <button 
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    logout();
                                    navigate('/');
                                }}
                                className="w-full flex items-center gap-4 px-4 py-3.5 text-gray-500 hover:text-red-500 transition-colors mt-2"
                             >
                                 <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                                    <LogOut className="w-5 h-5" />
                                 </div>
                                 <span className="font-medium text-base">退出登录</span>
                             </button>
                        </div>

                        {/* Bottom Action */}
                        <div className="p-6 border-t border-gray-100/50 dark:border-white/5 bg-white/50 dark:bg-surface-dark/50">
                            <Link 
                                to="/upload" 
                                onClick={() => setIsMenuOpen(false)}
                                className="w-full py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 active:scale-95 transition-all duration-300 group"
                            >
                                <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                发布作品
                            </Link>
                        </div>
                    </>
                ) : (
                    // Guest View
                    <>
                        <div className="flex-1 flex flex-col justify-center px-8 relative">
                            <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
                            
                            <div className="text-center mb-12 relative z-10">
                                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                                    <Camera className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">欢迎来到光影视界</h3>
                                <p className="text-gray-500 dark:text-gray-400">记录美好，分享生活</p>
                            </div>

                             {/* Theme Toggle */}
                             <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/5 backdrop-blur-md border border-gray-100 dark:border-white/5">
                                 <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 text-center">主题设置</h3>
                                 <div className="grid grid-cols-3 gap-1 bg-gray-200 dark:bg-black/20 p-1 rounded-xl">
                                     {(['light', 'dark', 'system'] as const).map((mode) => (
                                         <button
                                             key={mode}
                                             onClick={() => setTheme(mode)}
                                             className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                                 theme === mode 
                                                 ? 'bg-white dark:bg-surface-light shadow-sm text-primary' 
                                                 : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                             }`}
                                         >
                                             {mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '系统'}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </div>
                        
                        <div className="p-8 border-t border-gray-100/50 dark:border-white/5 bg-white/50 dark:bg-surface-dark/50">
                             <Link 
                                to={`/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`} 
                                onClick={() => setIsMenuOpen(false)}
                                className="w-full py-4 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-transform"
                             >
                                <LogIn className="w-5 h-5" />
                                立即登录
                             </Link>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export const Footer: React.FC = () => {
    const settings = useSiteSettings();
    const location = useLocation();
    return (
        <footer className="bg-white dark:bg-[#111a22] border-t border-gray-200 dark:border-surface-border transition-colors duration-300 pb-28 md:pb-0">
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 md:py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-4 md:mb-8">
                    <div className="col-span-1 md:col-span-1 space-y-4 flex flex-col items-center md:items-start text-center md:text-left">
                        <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-primary transition-colors">
                            {settings.siteLogo ? (
                                <img src={toMediaUrl(settings.siteLogo)} alt="Logo" className="w-8 h-8 object-contain" />
                            ) : (
                                <div className="size-8 flex items-center justify-center text-primary bg-primary/10 rounded-lg">
                                    <Camera className="w-5 h-5" />
                                </div>
                            )}
                            <span className="text-lg font-bold tracking-tight">{settings.siteName || 'Phowson'}</span>
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed hidden md:block">
                            记录光影，讲述故事。<br/>
                            专注于高画质摄影作品展示与分享。
                        </p>
                    </div>
                    
                    {/* Desktop Links - Hidden on Mobile */}
                    <div className="hidden md:grid col-span-1 md:col-span-2 grid-cols-2 gap-8">
                        <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">探索</h3>
                            <ul className="space-y-3">
                                <li><Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">最新画廊</Link></li>
                                <li><Link to="/stories" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">光影故事</Link></li>
                            </ul>
                        </div>

                        <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">关于</h3>
                            <ul className="space-y-3">
                                <li><Link to="/about" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">关于摄影师</Link></li>
                                <li><a href="mailto:admin@idickies.com" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">联系合作</a></li>
                                <li><Link to={`/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">后台登录</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">关注</h3>
                        <div className="flex gap-4">
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Instagram className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Twitter className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Mail className="w-5 h-5" /></a>
                        </div>
                    </div>
                </div>
                
                {/* Mobile Content - Compact Version */}
                <div className="md:hidden flex flex-col items-center gap-4 mb-4">
                    {/* Social Icons */}
                    <div className="flex justify-center gap-4">
                        <a href="#" className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-full text-gray-400 hover:text-primary transition-colors"><Instagram className="w-5 h-5" /></a>
                        <a href="#" className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-full text-gray-400 hover:text-primary transition-colors"><Twitter className="w-5 h-5" /></a>
                        <a href="mailto:admin@idickies.com" className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-full text-gray-400 hover:text-primary transition-colors"><Mail className="w-5 h-5" /></a>
                    </div>
                    
                    {/* Simple Links */}
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <a href="mailto:admin@idickies.com" className="hover:text-primary transition-colors">联系合作</a>
                        <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <Link to="/login" className="hover:text-primary transition-colors">后台登录</Link>
                    </div>
                </div>

                <div className="pt-6 md:pt-8 border-t border-gray-200 dark:border-surface-border flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                        &copy; {new Date().getFullYear()} {settings.siteName || 'Phowson Photography'}. All rights reserved.
                    </p>
                    <div className="flex items-center gap-1 text-xs md:text-sm text-gray-400">
                        <span>Made with</span>
                        <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                        <span>by Dickies</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export const MobileBottomNav: React.FC = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    
    const navItems = [
        { label: '画廊', path: '/', icon: ImageIcon },
        { label: '地图', path: '/map', icon: MapPin },
        { label: '故事', path: '/stories', icon: BookOpen },
        { label: '关于', path: '/about', icon: Info },
    ];
    
    return (
        <div className="md:hidden fixed bottom-6 left-8 right-8 z-50">
            <div className="bg-white/80 dark:bg-[#111a22]/80 backdrop-blur-xl shadow-2xl rounded-full border border-white/40 dark:border-white/10 ring-1 ring-black/5">
                <div className="flex items-center justify-around h-16 px-2">
                    {navItems.map(item => {
                        const active = isActive(item.path);
                        return (
                            <Link 
                                key={item.path} 
                                to={item.path}
                                className={`relative flex flex-col items-center justify-center w-full h-full active:scale-95 transition-all duration-300 ${
                                    active
                                        ? 'text-primary' 
                                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                            >
                                <div className={`relative p-1 rounded-xl transition-all duration-300 ${active ? '-translate-y-1' : ''}`}>
                                    <item.icon className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
                                    {active && (
                                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium transition-all duration-300 ${active ? 'font-bold translate-y-0.5' : 'translate-y-0.5'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
