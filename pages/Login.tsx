import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Mail, Lock, ArrowRight, Github, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { setSession } = useAuth();
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
            navigate('/admin');
        } catch {
            setLoginError('账号或密码错误');
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
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4 hover:scale-105 transition-transform">
                        <Camera className="w-6 h-6" />
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {view === 'login' ? '欢迎回来' : '重置密码'}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                        {view === 'login' 
                            ? '请输入您的凭据以访问管理后台' 
                            : '输入您的注册邮箱，我们将发送重置链接'}
                    </p>
                </div>

                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl p-8 shadow-2xl backdrop-blur-sm transition-colors duration-300">
                    {view === 'login' ? (
                        /* Login Form */
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">电子邮箱</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
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
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
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
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? '登录中...' : '登录'}
                                {!isLoading && <ArrowRight className="w-4 h-4" />}
                            </button>

                            {loginError && (
                                <div className="text-sm text-red-500">{loginError}</div>
                            )}
                        </form>
                    ) : (
                        /* Forgot Password Form */
                        <div className="space-y-6">
                            {!resetSent ? (
                                <form onSubmit={handleResetPassword} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">电子邮箱</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg py-2.5 pl-10 pr-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                placeholder="输入您的注册邮箱"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? '发送中...' : '发送重置链接'}
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-4 animate-in fade-in zoom-in-95">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 mb-4">
                                        <CheckCircle className="w-8 h-8" />
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
                                <ArrowLeft className="w-4 h-4" />
                                返回登录
                            </button>
                        </div>
                    )}

                    {view === 'login' && (
                        <>
                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-surface-border"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-surface-dark text-gray-500">或通过以下方式登录</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-[#111a22] hover:bg-gray-100 dark:hover:bg-surface-border border border-gray-200 dark:border-surface-border text-gray-700 dark:text-white py-2.5 rounded-lg transition-colors text-sm font-medium">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Google
                                </button>
                                <button className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-[#111a22] hover:bg-gray-100 dark:hover:bg-surface-border border border-gray-200 dark:border-surface-border text-gray-700 dark:text-white py-2.5 rounded-lg transition-colors text-sm font-medium">
                                    <Github className="w-4 h-4" />
                                    GitHub
                                </button>
                            </div>
                        </>
                    )}
                </div>
                
                {view === 'login' && (
                    <p className="text-center mt-6 text-sm text-gray-500">
                        还不是会员？ <Link to="/" className="text-primary hover:text-gray-900 dark:hover:text-white transition-colors">联系管理员</Link> 申请访问权限。
                    </p>
                )}
            </div>
        </div>
    );
};
