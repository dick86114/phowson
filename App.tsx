import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { Header, Footer } from './components/Layout';
import { Home } from './pages/Home';
import { PhotoDetail } from './pages/PhotoDetail';
import { Admin } from './pages/Admin';
import { Stories } from './pages/Stories';
import { Gear } from './pages/Gear';
import { About } from './pages/About';
import { Login } from './pages/Login';
import { Upload } from './pages/Upload';
import { MapPage } from './pages/Map';
import { Gamification } from './pages/Gamification';
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
                            <Route path="/gear" element={<Gear />} />
                            <Route path="/about" element={<About />} />
                            <Route path="/photo/:id" element={<PhotoDetail />} />
                            <Route path="/map" element={<MapPage />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/admin/*" element={<Admin />} />
                            <Route path="/upload" element={<Upload />} />
                            <Route path="/edit/:id" element={<Upload />} />
                            <Route path="/gamification" element={<Gamification />} />
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
