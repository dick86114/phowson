import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { API_BASE_URL } from './api';

export type SiteSettings = {
    siteName?: string;
    siteLogo?: string;
    documentTitle?: string;
    favicon?: string;
    defaultTheme?: 'light' | 'dark' | 'system';
};

const SiteSettingsContext = createContext<SiteSettings>({});

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: settings = {} } = useQuery({
        queryKey: ['global-site-settings'],
        queryFn: async () => {
            const res = await api.get('/site-settings');
            return res.data as SiteSettings;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return (
        <SiteSettingsContext.Provider value={settings}>
            {children}
        </SiteSettingsContext.Provider>
    );
};

export const useSiteSettings = () => useContext(SiteSettingsContext);

export const toMediaUrl = (url: string | null | undefined) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE_URL}${u}`;
};
