import React, { useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigationType, Navigate, useNavigate } from 'react-router-dom';
import { Header, Footer, MobileBottomNav } from './components/Layout';
import { ThemeProvider } from './ThemeContext';
import { HeaderThemeProvider } from './HeaderThemeContext';
import { ModalProvider } from './components/Modal';
import { useModal } from './components/Modal';
import { SiteSettingsProvider, useSiteSettings, toMediaUrl } from './SiteSettingsContext';

import { ToastProvider } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { InstallPrompt } from './components/InstallPrompt';
import { getPrivateRoutes } from '@private/web';

// Lazy load pages for better performance
const Home = React.lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const PhotoDetail = React.lazy(() => import('./pages/PhotoDetail').then(module => ({ default: module.PhotoDetail })));
const Admin = React.lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const AdminLayout = React.lazy(() => import('./layouts/AdminLayout').then(module => ({ default: module.AdminLayout })));
const ManagePhotos = React.lazy(() => import('./pages/admin/manage/Photos').then(module => ({ default: module.ManagePhotos })));
const ManageComments = React.lazy(() => import('./pages/admin/manage/Comments').then(module => ({ default: module.Comments })));
const ManageUsers = React.lazy(() => import('./pages/admin/manage/Users').then(module => ({ default: module.UsersPage })));
const ManageSettings = React.lazy(() => import('./pages/admin/manage/Settings').then(module => ({ default: module.SettingsPage })));
const ManageAbout = React.lazy(() => import('./pages/admin/manage/AboutSettings').then(module => ({ default: module.AboutSettings })));
const ManageAnalytics = React.lazy(() => import('./pages/admin/manage/Analytics').then(module => ({ default: module.AnalyticsPage })));
const Stories = React.lazy(() => import('./pages/Stories').then(module => ({ default: module.Stories })));
const About = React.lazy(() => import('./pages/About').then(module => ({ default: module.About })));
const Login = React.lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = React.lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Upload = React.lazy(() => import('./pages/Upload').then(module => ({ default: module.Upload })));
const MapPage = React.lazy(() => import('./pages/Map').then(module => ({ default: module.MapPage })));
const Gamification = React.lazy(() => import('./pages/Gamification').then(module => ({ default: module.Gamification })));
const ChallengesPage = React.lazy(() => import('./pages/Challenges').then(module => ({ default: module.ChallengesPage })));
const GamificationHistory = React.lazy(() => import('./pages/GamificationHistory').then(module => ({ default: module.GamificationHistory })));

const Loading = () => (
    <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigationType = useNavigationType();
    const { confirm } = useModal();
    const settings = useSiteSettings();
    
    // Hide header/footer for Admin routes (except manage pages), Login route AND Upload/Edit routes
    const isStandalonePage = (location.pathname.startsWith('/admin') && !location.pathname.startsWith('/admin/manage')) || location.pathname === '/login' || location.pathname === '/register' || location.pathname.startsWith('/upload') || location.pathname.startsWith('/edit');

    useEffect(() => {
        if (navigationType !== 'PUSH') return;
        window.scrollTo(0, 0);
    }, [location.pathname, location.search, navigationType]);

    useEffect(() => {
        const handler = () => {
            confirm({
                title: '检测到更新',
                content: '新内容可用，是否刷新？',
                onConfirm: () => window.location.reload(),
            });
        };
        window.addEventListener('phowson:pwa:update', handler);
        return () => window.removeEventListener('phowson:pwa:update', handler);
    }, [confirm]);

    // Apply Site Settings (Title & Favicon)
    useEffect(() => {
        if (settings.documentTitle) {
            document.title = settings.documentTitle;
        } else if (settings.siteName) {
            document.title = settings.siteName;
        }

        if (settings.favicon) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = toMediaUrl(settings.favicon);
        }
    }, [settings]);

    return (
        <HeaderThemeProvider>
            <ToastProvider>
                <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-white font-sans selection:bg-primary selection:text-white transition-colors duration-300">
                    {!isStandalonePage && <Header />}
                    {children}
                    {!isStandalonePage && <Footer />}
                    {!isStandalonePage && <MobileBottomNav />}
                    <InstallPrompt />
                </div>
            </ToastProvider>
        </HeaderThemeProvider>
    );
};

const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate(`/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`);
        }
    }, [user, navigate, location]);

    if (!user || user.role !== 'admin') return null;

    return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-h-screen">
            {children}
        </div>
    );
};

const ThemedApp = () => {
    const settings = useSiteSettings();
    const privateWebDisabled =
      String((import.meta as any)?.env?.VITE_PRIVATE_WEB_DISABLED ?? '').trim().toLowerCase() === 'true' ||
      String((import.meta as any)?.env?.VITE_PRIVATE_WEB_DISABLED ?? '').trim() === '1';
    return (
        <ThemeProvider defaultTheme={settings.defaultTheme || 'system'} storageKey="photologs-theme">
            <ModalProvider>
                <HashRouter>
                    <AppLayout>
                        <Suspense fallback={<Loading />}>
                            <Routes>
                                <Route path="/" element={<Home />} />
                            <Route path="/stories" element={<Stories />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/photo/:id" element={<PhotoDetail />} />
                            <Route path="/map" element={<MapPage />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            
                            <Route path="/me/albums" element={<Admin hideLayout />} />
                            <Route path="/me/analytics" element={<Admin hideLayout />} />
                            <Route path="/me/uploads" element={<Admin hideLayout />} />
                            <Route path="/me/profile" element={<Admin hideLayout />} />
                            
                            {/* Admin Manage Routes - Direct Loading */}
                            <Route path="/admin/manage/photos" element={<AdminGuard><ManagePhotos /></AdminGuard>} />
                            <Route path="/admin/manage/comments" element={<AdminGuard><ManageComments /></AdminGuard>} />
                            <Route path="/admin/manage/users" element={<AdminGuard><ManageUsers /></AdminGuard>} />
                            <Route path="/admin/manage/settings" element={<AdminGuard><ManageSettings /></AdminGuard>} />
                            <Route path="/admin/manage/about" element={<AdminGuard><ManageAbout /></AdminGuard>} />
                            <Route path="/admin/manage/analytics" element={<AdminGuard><ManageAnalytics /></AdminGuard>} />

                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<Navigate to="me/albums" replace />} />
                                <Route path="me/albums" element={<Admin hideLayout />} />
                                <Route path="me/analytics" element={<Admin hideLayout />} />
                                <Route path="me/uploads" element={<Admin hideLayout />} />
                                <Route path="me/profile" element={<Admin hideLayout />} />
                            </Route>

                            <Route path="/upload" element={<Upload />} />
                            <Route path="/edit/:id" element={<Upload />} />
                            <Route path="/gamification" element={<Gamification />} />
                            <Route path="/challenges" element={<ChallengesPage />} />
                            <Route path="/gamification/history" element={<GamificationHistory />} />
                            {privateWebDisabled ? null : getPrivateRoutes()}
                        </Routes>
                        </Suspense>
                    </AppLayout>
                </HashRouter>
            </ModalProvider>
        </ThemeProvider>
    );
};

export default function App() {
  useEffect(() => {
    document.documentElement.style.removeProperty('--color-primary');
  }, []);

  return (
    <SiteSettingsProvider>
        <ThemedApp />
    </SiteSettingsProvider>
  );
}
