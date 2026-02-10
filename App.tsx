import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigationType, Navigate } from 'react-router-dom';
import { Header, Footer } from './components/Layout';
import { Home } from './pages/Home';
import { PhotoDetail } from './pages/PhotoDetail';
import { Admin } from './pages/Admin';
import { AdminLayout } from './layouts/AdminLayout';
import { ManagePhotos } from './pages/admin/manage/Photos';
import { Comments as ManageComments } from './pages/admin/manage/Comments';
import { UsersPage as ManageUsers } from './pages/admin/manage/Users';
import { SettingsPage as ManageSettings } from './pages/admin/manage/Settings';
import { AboutSettings as ManageAbout } from './pages/admin/manage/AboutSettings';
import { AnalyticsPage as ManageAnalytics } from './pages/admin/manage/Analytics';
import { Stories } from './pages/Stories';
import { About } from './pages/About';
import { Login } from './pages/Login';
import { Upload } from './pages/Upload';
import { MapPage } from './pages/Map';
import { Gamification } from './pages/Gamification';
import { ChallengesPage } from './pages/Challenges';
import { GamificationHistory } from './pages/GamificationHistory';
import { ThemeProvider } from './ThemeContext';
import { ModalProvider } from './components/Modal';
import { useModal } from './components/Modal';
import { SiteSettingsProvider, useSiteSettings, toMediaUrl } from './SiteSettingsContext';

import { ToastProvider } from './components/Toast';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigationType = useNavigationType();
    const { confirm } = useModal();
    const settings = useSiteSettings();
    
    // Hide header/footer for Admin routes, Login route AND Upload/Edit routes
    const isStandalonePage = location.pathname.startsWith('/admin') || location.pathname === '/login' || location.pathname.startsWith('/upload') || location.pathname.startsWith('/edit');

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
        <ToastProvider>
            <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-white font-sans selection:bg-primary selection:text-white transition-colors duration-300">
                {!isStandalonePage && <Header />}
                {children}
                {!isStandalonePage && <Footer />}
            </div>
        </ToastProvider>
    );
};

const ThemedApp = () => {
    const settings = useSiteSettings();
    return (
        <ThemeProvider defaultTheme={settings.defaultTheme || 'system'} storageKey="photologs-theme">
            <ModalProvider>
                <HashRouter>
                    <AppLayout>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/stories" element={<Stories />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/photo/:id" element={<PhotoDetail />} />
                            <Route path="/map" element={<MapPage />} />
                            <Route path="/login" element={<Login />} />
                            
                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<Navigate to="me/albums" replace />} />
                                <Route path="me/albums" element={<Admin hideLayout />} />
                                <Route path="me/analytics" element={<Admin hideLayout />} />
                                <Route path="me/uploads" element={<Admin hideLayout />} />
                                <Route path="me/profile" element={<Admin hideLayout />} />
                                <Route path="manage/photos" element={<ManagePhotos />} />
                                <Route path="manage/comments" element={<ManageComments />} />
                                <Route path="manage/users" element={<ManageUsers />} />
                                <Route path="manage/settings" element={<ManageSettings />} />
                                <Route path="manage/about" element={<ManageAbout />} />
                                <Route path="manage/analytics" element={<ManageAnalytics />} />
                            </Route>

                            <Route path="/upload" element={<Upload />} />
                            <Route path="/edit/:id" element={<Upload />} />
                            <Route path="/gamification" element={<Gamification />} />
                            <Route path="/challenges" element={<ChallengesPage />} />
                            <Route path="/gamification/history" element={<GamificationHistory />} />
                        </Routes>
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
