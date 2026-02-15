import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSiteSettings, toMediaUrl } from '../SiteSettingsContext';
import { X, Download, Share } from 'lucide-react';

// Define the BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
};
const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
};

export const InstallPrompt: React.FC = () => {
  const settings = useSiteSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  const logo = useMemo(() => (settings.siteLogo ? toMediaUrl(settings.siteLogo) : ''), [settings]);

  useEffect(() => {
    // If already installed, don't show
    if (isStandalone()) return;

    const dismissed = localStorage.getItem('phowson:pwa:prompt:dismissed');
    // If dismissed less than 7 days ago, don't show
    if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the prompt if on mobile
      if (isMobile()) {
          setVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    // Check for iOS
    if (isIOS() && isMobile()) {
        setShowIOS(true);
        setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('phowson:pwa:prompt:dismissed', Date.now().toString());
  };

  const content = (
    <div className="fixed inset-x-4 bottom-6 z-[9999] md:hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="App Icon" className="w-12 h-12 rounded-2xl border border-white/20 object-cover shadow-sm" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Download className="w-6 h-6" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate mb-0.5">
            安装 {settings.siteName || 'Phowson'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
            {showIOS ? (
                <span className="flex items-center gap-1">
                    点击 <Share className="w-3 h-3" /> 然后选择 "添加到主屏幕"
                </span>
            ) : '安装到主屏幕，获得原生应用体验'}
          </div>
        </div>

        <div className="flex items-center gap-2">
            {!showIOS && (
              <button
                type="button"
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                安装
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
