import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    type: ToastType;
    content: string;
    duration?: number;
}

interface ToastContextValue {
    addToast: (content: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
    success: (content: string, duration?: number) => void;
    error: (content: string, duration?: number) => void;
    info: (content: string, duration?: number) => void;
    warning: (content: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((content: string, type: ToastType = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const toast: Toast = { id, type, content, duration };
        setToasts((prev) => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const success = useCallback((content: string, duration?: number) => addToast(content, 'success', duration), [addToast]);
    const error = useCallback((content: string, duration?: number) => addToast(content, 'error', duration), [addToast]);
    const info = useCallback((content: string, duration?: number) => addToast(content, 'info', duration), [addToast]);
    const warning = useCallback((content: string, duration?: number) => addToast(content, 'warning', duration), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, info, warning }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-relevant="additions removals">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
                        className={`
                            pointer-events-auto min-w-[300px] max-w-md p-4 rounded-xl shadow-xl flex items-start gap-3 transform transition-all duration-300 animate-in slide-in-from-right-full backdrop-blur-xl border
                            ${toast.type === 'success' ? 'bg-white/80 dark:bg-slate-900/80 border-green-500/20 text-green-700 dark:text-green-300' : ''}
                            ${toast.type === 'error' ? 'bg-white/80 dark:bg-slate-900/80 border-red-500/20 text-red-700 dark:text-red-300' : ''}
                            ${toast.type === 'info' ? 'bg-white/80 dark:bg-slate-900/80 border-blue-500/20 text-blue-700 dark:text-blue-300' : ''}
                            ${toast.type === 'warning' ? 'bg-white/80 dark:bg-slate-900/80 border-yellow-500/20 text-yellow-700 dark:text-yellow-300' : ''}
                        `}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                        </div>
                        <div className="flex-1 text-sm font-medium break-words">{toast.content}</div>
                        <button
                            type="button"
                            onClick={() => removeToast(toast.id)}
                            aria-label="关闭提示"
                            className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-card"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
