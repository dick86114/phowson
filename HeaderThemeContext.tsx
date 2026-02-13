import React, { createContext, useContext, useState, ReactNode } from 'react';

type HeaderColorMode = 'light-text' | 'dark-text';

interface HeaderThemeContextType {
    headerColorMode: HeaderColorMode;
    setHeaderColorMode: (mode: HeaderColorMode) => void;
}

const HeaderThemeContext = createContext<HeaderThemeContextType | undefined>(undefined);

export const HeaderThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [headerColorMode, setHeaderColorMode] = useState<HeaderColorMode>('light-text');

    return (
        <HeaderThemeContext.Provider value={{ headerColorMode, setHeaderColorMode }}>
            {children}
        </HeaderThemeContext.Provider>
    );
};

export const useHeaderTheme = () => {
    const context = useContext(HeaderThemeContext);
    if (context === undefined) {
        throw new Error('useHeaderTheme must be used within a HeaderThemeProvider');
    }
    return context;
};
