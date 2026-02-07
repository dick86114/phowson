import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{ text?: string; className?: string }> = ({ text = '加载中...', className }) => {
    return (
        <div className={`flex items-center justify-center gap-2 py-10 text-gray-500 dark:text-gray-400 ${className || ''}`}>
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">{text}</span>
        </div>
    );
};

export const EmptyState: React.FC<{
    title?: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}> = ({ title = '暂无数据', description, action, className }) => {
    return (
        <div className={`bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-8 shadow-sm text-center ${className || ''}`}>
            <div className="text-base font-semibold text-gray-900 dark:text-white">{title}</div>
            {description ? <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</div> : null}
            {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
    );
};

export const ErrorState: React.FC<{
    title?: string;
    message?: string;
    onRetry?: () => void;
    className?: string;
}> = ({ title = '加载失败', message, onRetry, className }) => {
    return (
        <div className={`bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-8 shadow-sm text-center ${className || ''}`}>
            <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="mt-3 text-base font-semibold text-gray-900 dark:text-white">{title}</div>
            {message ? <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</div> : null}
            {onRetry ? (
                <div className="mt-4 flex justify-center">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
                    >
                        重试
                    </button>
                </div>
            ) : null}
        </div>
    );
};

