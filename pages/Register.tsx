import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Mail, Lock, ArrowLeft, RefreshCcw, Shield, AtSign, KeyRound } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';
import { useSiteSettings, toMediaUrl } from '../SiteSettingsContext';

export const Register: React.FC = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { siteLogo } = useSiteSettings();
    const [step, setStep] = useState<'send_code' | 'register'>('send_code');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [captchaPngBase64, setCaptchaPngBase64] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaAnswerForResend, setCaptchaAnswerForResend] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [sendCooldown, setSendCooldown] = useState(0);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const captchaImgSrc = useMemo(() => {
        if (!captchaPngBase64) return '';
        return `data:image/png;base64,${captchaPngBase64}`;
    }, [captchaPngBase64]);

    const refreshCaptcha = async () => {
        try {
            const res = await api.get('/auth/captcha?format=base64');
            setCaptchaToken(String(res.data.token || ''));
            setCaptchaPngBase64(String(res.data.pngBase64 || ''));
            setCaptchaInput('');
        } catch (err: any) {
            toast.error(String(err?.data?.message || err?.message || '获取验证码失败'));
        }
    };

    useEffect(() => {
        refreshCaptcha();
    }, []);

    useEffect(() => {
        if (!sendCooldown) return;
        const t = window.setInterval(() => {
            setSendCooldown((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => window.clearInterval(t);
    }, [sendCooldown]);

    const sendCode = async ({ allowUseStoredCaptcha }: { allowUseStoredCaptcha: boolean }) => {
        setError('');
        if (!email.trim()) {
            setError('请先填写邮箱');
            return;
        }

        const captcha = allowUseStoredCaptcha ? (captchaInput.trim() || captchaAnswerForResend) : captchaInput.trim();
        if (!captcha) {
            setStep('send_code');
            setError('请先填写图形验证码');
            return;
        }
        if (!captchaToken) {
            await refreshCaptcha();
            setStep('send_code');
            setError('请重新获取图形验证码');
            return;
        }

        setIsSendingCode(true);
        try {
            await api.post('/auth/register/send-code', {
                email: email.trim(),
                captcha,
                captchaToken,
            });
            toast.success('验证码已发送，请查收邮箱');
            setSendCooldown(60);
            setCaptchaAnswerForResend(captcha);
            setCaptchaInput('');
            setStep('register');
        } catch (err: any) {
            if (String(err?.data?.code || '') === 'EMAIL_EXISTS') {
                toast.error('该邮箱已注册，请直接登录');
                navigate(`/login?returnUrl=${encodeURIComponent('/')}`);
                return;
            }
            const msg = err?.data?.message || (typeof err?.data === 'string' ? err.data : '') || err?.message || '发送失败';
            setError(msg);
            await refreshCaptcha();
            setStep('send_code');
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleRegister = async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/register', { email, password, emailCode });
            toast.success(res.data.message || '注册成功，请等待管理员审核');
            navigate(`/login?returnUrl=${encodeURIComponent('/')}`);
        } catch (err: any) {
            console.error('Registration error:', err);
            const msg = err?.data?.message || (typeof err?.data === 'string' ? err.data : '') || err?.message || '注册失败';
            setError(msg);
            await refreshCaptcha();
            setStep('send_code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 'send_code') {
            await sendCode({ allowUseStoredCaptcha: false });
            return;
        }
        await handleRegister();
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
                        注册账号
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                        创建一个新账号以开始使用
                    </p>
                </div>

                <div className="glass-panel p-8 transition-colors duration-300">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Field */}
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
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setEmail(v);
                                        if (step !== 'send_code') {
                                            setStep('send_code');
                                            setEmailCode('');
                                            setPassword('');
                                            setCaptchaAnswerForResend('');
                                        }
                                    }}
                                    className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-300 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="your@email.com"
                                />
                            </div>
                        </div>

                        {step === 'send_code' ? (
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">图形验证码</label>
                                <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600 dark:text-gray-300 z-10">
                                        <Shield className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <input
                                            type="text"
                                            required
                                            value={captchaInput}
                                            onChange={(e) => setCaptchaInput(e.target.value)}
                                            className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-300 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="请输入图形验证码"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={refreshCaptcha}
                                            className="h-11 w-11 rounded-xl border border-gray-300 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-900/60 transition-colors flex items-center justify-center"
                                            aria-label="刷新验证码"
                                        >
                                            <RefreshCcw className="w-5 h-5 text-gray-600 dark:text-gray-300 stroke-[2.5]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={refreshCaptcha}
                                            className="h-11 w-[140px] overflow-hidden rounded-xl border border-gray-300 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-900/60 transition-colors flex items-center justify-center"
                                        >
                                            {captchaImgSrc ? (
                                                <img src={captchaImgSrc} alt="验证码" className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">加载中</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">邮箱验证码</label>
                                    <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600 dark:text-gray-300 z-10">
                                            <Mail className="w-5 h-5 stroke-[2.5]" />
                                        </div>
                                        <input
                                                type="text"
                                                required
                                                value={emailCode}
                                                onChange={(e) => setEmailCode(e.target.value)}
                                                className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-300 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                placeholder="6 位验证码"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => sendCode({ allowUseStoredCaptcha: true })}
                                            disabled={isSendingCode || sendCooldown > 0}
                                            className="h-11 px-4 rounded-xl bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {sendCooldown > 0 ? `${sendCooldown}s` : (isSendingCode ? '发送中...' : '重新发送')}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">密码</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600 dark:text-gray-300 z-10">
                                        <KeyRound className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-gray-50/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-300 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={step === 'send_code' ? (isSendingCode || sendCooldown > 0) : isLoading}
                            className="w-full btn-liquid py-3 px-4 text-gray-900 dark:text-white font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {step === 'send_code'
                                ? (sendCooldown > 0 ? `发送验证码（${sendCooldown}s）` : (isSendingCode ? '发送中...' : '发送验证码至邮箱'))
                                : (isLoading ? '提交中...' : '提交注册')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                            返回登录
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
