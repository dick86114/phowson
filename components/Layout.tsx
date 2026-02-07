import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, Search, Menu, X, Instagram, Twitter, Mail, LogIn, Sun, Moon, Monitor, Heart, Trophy, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../api';
import { useTheme } from '../ThemeContext';
import { useSiteSettings, toMediaUrl as toSiteMediaUrl } from '../SiteSettingsContext';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user: currentUser, logout } = useAuth();
  const settings = useSiteSettings();
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuId = useId();
  
  const toMediaUrl = (url: string | null | undefined) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE_URL}${u}`;
  };
  
  const avatarUrl = currentUser?.avatar ? toMediaUrl(currentUser.avatar) : '/default-avatar.png';

  const isActive = (path: string) => location.pathname === path;

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(`/?q=${encodeURIComponent(searchQuery)}`);
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
    return [
      { key: 'gamification', label: '成就', to: '/gamification', icon: Trophy },
      { key: 'admin', label: '管理后台', to: '/admin', icon: LayoutDashboard },
    ];
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
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-surface-border bg-white/90 dark:bg-[#111a22]/90 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-primary transition-colors">
              {settings.siteLogo ? (
                  <img src={toSiteMediaUrl(settings.siteLogo)} alt="Logo" className="w-8 h-8 object-contain" />
              ) : (
                  <div className="size-8 flex items-center justify-center text-primary bg-primary/10 rounded-lg">
                    <Camera className="w-5 h-5" />
                  </div>
              )}
              <h1 className="text-lg font-bold tracking-tight">{settings.siteName || '光影视界'}</h1>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className={`text-sm font-medium transition-colors ${isActive('/') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>画廊</Link>
            <Link to="/map" className={`text-sm font-medium transition-colors ${isActive('/map') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>地图</Link>
            <Link to="/stories" className={`text-sm font-medium transition-colors ${isActive('/stories') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>故事</Link>
            <Link to="/gear" className={`text-sm font-medium transition-colors ${isActive('/gear') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>器材</Link>
            <Link to="/about" className={`text-sm font-medium transition-colors ${isActive('/about') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}`}>关于</Link>
          </nav>

          <div className="flex items-center gap-4">
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
                onClick={toggleTheme}
                type="button"
                aria-label="切换主题"
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-dark rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#111a22]"
                title={`当前模式：${theme === 'system' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}`}
            >
                <ThemeIcon />
            </button>
            
            {currentUser ? (
              <div className="hidden md:flex relative">
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
                    className="absolute right-0 mt-2 w-52 bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
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
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-surface-border/60">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentUser.name || '用户'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">已登录</div>
                    </div>

                    <div className="py-1">
                      {userMenuItems.map((it) => (
                        <Link
                          key={it.key}
                          to={it.to}
                          role="menuitem"
                          tabIndex={0}
                          onClick={() => closeUserMenu()}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111a22] transition-colors"
                        >
                          <it.icon className="w-4 h-4 text-gray-500" />
                          {it.label}
                        </Link>
                      ))}

                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => {
                          closeUserMenu();
                          logout();
                          navigate('/');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111a22] transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-gray-500" />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                登录
              </Link>
            )}

            <button 
                type="button"
                aria-label={isMenuOpen ? '关闭菜单' : '打开菜单'}
                className="md:hidden text-gray-600 dark:text-gray-300 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#111a22]"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-surface-border bg-white dark:bg-background-dark">
          <div className="space-y-1 px-4 pb-3 pt-2">
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="搜索照片..."
                className="w-full rounded-lg border border-gray-200 dark:border-surface-border bg-gray-100 dark:bg-surface-dark py-2 px-4 text-sm text-gray-900 dark:text-white placeholder-gray-500 mb-3 focus:border-primary focus:outline-none"
            />
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-900 dark:text-white">画廊</Link>
            <Link to="/map" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">地图</Link>
            <Link to="/stories" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">故事</Link>
            <Link to="/gear" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">器材</Link>
            <Link to="/about" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">关于</Link>
            {currentUser ? (
              <>
                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-surface-border" />
                <Link to="/gamification" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">成就</Link>
                <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">管理后台</Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                    navigate('/');
                  }}
                  className="w-full text-left block py-2 text-base font-medium text-gray-600 dark:text-gray-300"
                >
                  退出登录
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block py-2 text-base font-medium text-gray-600 dark:text-gray-300">登录</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export const Footer: React.FC = () => {
    const settings = useSiteSettings();
    return (
        <footer className="bg-white dark:bg-[#111a22] border-t border-gray-200 dark:border-surface-border transition-colors duration-300">
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="col-span-1 md:col-span-1 space-y-4">
                        <Link to="/" className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-primary transition-colors">
                            {settings.siteLogo ? (
                                <img src={toSiteMediaUrl(settings.siteLogo)} alt="Logo" className="w-8 h-8 object-contain" />
                            ) : (
                                <div className="size-8 flex items-center justify-center text-primary bg-primary/10 rounded-lg">
                                    <Camera className="w-5 h-5" />
                                </div>
                            )}
                            <span className="text-lg font-bold tracking-tight">{settings.siteName || 'Phowson'}</span>
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            记录光影，讲述故事。<br/>
                            专注于高画质摄影作品展示与分享。
                        </p>
                    </div>
                    
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">探索</h3>
                        <ul className="space-y-3">
                            <li><Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">最新画廊</Link></li>
                            <li><Link to="/stories" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">光影故事</Link></li>
                            <li><Link to="/gear" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">摄影器材</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">关于</h3>
                        <ul className="space-y-3">
                            <li><Link to="/about" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">关于摄影师</Link></li>
                            <li><a href="mailto:contact@photologs.com" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">联系合作</a></li>
                            <li><Link to="/login" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">后台登录</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">关注</h3>
                        <div className="flex gap-4">
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Instagram className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Twitter className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-primary transition-colors"><Mail className="w-5 h-5" /></a>
                        </div>
                    </div>
                </div>
                
                <div className="pt-8 border-t border-gray-200 dark:border-surface-border flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        &copy; {new Date().getFullYear()} {settings.siteName || 'Phowson Photography'}. All rights reserved.
                    </p>
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                        <span>Made with</span>
                        <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                        <span>by Dickies</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
