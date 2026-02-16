import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Mail, Lock, ArrowRight, Github, ArrowLeft, CheckCircle, AtSign, KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSiteSettings, toMediaUrl } from '../SiteSettingsContext';
import api from '../api';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { setSession } = useAuth();
    const { siteLogo } = useSiteSettings();
    const [view, setView] = useState<'login' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [loginError, setLoginError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setLoginError('');
        try {
            const res = await api.post('/auth/login', { email, password });
            const payload = res.data as any;
            if (!payload?.token || !payload?.user) throw new Error('invalid auth payload');
            setSession(payload.user, payload.token);
            
            const searchParams = new URLSearchParams(window.location.search);
            const returnUrl = searchParams.get('returnUrl');
            navigate(returnUrl || '/');
        } catch (err: any) {
            console.error('Login error:', err);
            setLoginError(err?.data?.message || (typeof err?.data === 'string' ? err.data : '') || err?.message || '登录失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // 模拟发送邮件
        setTimeout(() => {
            setIsLoading(false);
            setResetSent(true);
        }, 1500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-[#0b1219] px-4 relative overflow-hidden transition-colors duration-300">
            {/* Background Decoration */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none animate-float" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDelay: '-3s' }} />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <Link to="/" className="inline-flex items-center justify-center mb-6 hover:scale-105 transition-transform">
                        {siteLogo ? (
                            <img src={toMediaUrl(siteLogo)} alt="Logo" className="h-16 w-auto object-contain drop-shadow-md" />
                        ) : (
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                <Camera className="w-6 h-6 stroke-[2.5]" />
                            </div>
                        )}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {view === 'login' ? '欢迎回来' : '重置密码'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                        {view === 'login' 
                            ? '请输入您的账号以继续' 
                            : '输入您的注册邮箱，我们将发送重置链接'}
                    </p>
                </div>

                <div className="glass-panel p-8 transition-colors duration-300">
                    {view === 'login' ? (
                        /* Login Form */
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">电子邮箱</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600 dark:text-gray-300 z-10">
                                        <AtSign className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-200 dark:border-surface-border rounded-xl py-2.5 pl-10 pr-4 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        placeholder="admin@photologs.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">密码</label>
                                    <button 
                                        type="button"
                                        onClick={() => setView('forgot')} 
                                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                                    >
                                        忘记密码？
                                    </button>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600 dark:text-gray-300 z-10">
                                        <KeyRound className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-200 dark:border-surface-border rounded-xl py-2.5 pl-10 pr-4 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#111a22] text-primary focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-primary"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-500 dark:text-gray-400">
                                    30天内自动登录
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? '登录中...' : '登录'}
                                {!isLoading && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                            </button>

                            {loginError && (
                                <div className="text-sm text-red-500">{loginError}</div>
                            )}

                            <div className="mt-6 text-center">
                                <span className="text-gray-500 dark:text-gray-400 text-sm">还没有账号？</span>
                                <Link to="/register" className="ml-2 text-primary hover:text-primary/80 text-sm font-medium transition-colors">
                                    立即注册
                                </Link>
                            </div>
                        </form>
                    ) : (
                        /* Forgot Password Form */
                        <div className="space-y-6">
                            {!resetSent ? (
                                <form onSubmit={handleResetPassword} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">电子邮箱</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600 dark:text-gray-300 z-10">
                                        <AtSign className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-200 dark:border-surface-border rounded-xl py-2.5 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                placeholder="输入您的注册邮箱"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? '发送中...' : '发送重置链接'}
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-4 animate-in fade-in zoom-in-95">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 mb-4">
                                        <CheckCircle className="w-8 h-8 stroke-[2.5]" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">邮件已发送</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                        如果该邮箱已注册，您将收到重置密码的说明。请查收您的收件箱。
                                    </p>
                                </div>
                            )}

                            <button 
                                onClick={() => {
                                    setView('login');
                                    setResetSent(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
                            >
                                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                                返回登录
                            </button>
                        </div>
                    )}

                    {view === 'login' && (
                        <>
                            {/* OAuth buttons removed */}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
