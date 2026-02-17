import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Settings, Save, Download, Upload, X, Loader2, ImageIcon, Sun, Moon, Monitor, Tag, Trash2, Plus, Shield, Brain, Copy, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { RolesSettings } from './Roles';

type ApiCategory = {
    value: string;
    label: string;
    icon?: string;
    sortOrder: number;
    photoCount: number;
};

import api from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';
import { useModal, Modal } from '../../../components/Modal';
import { toMediaUrl } from '../../../utils/helpers';
import { downloadJson } from '../../../utils/exporters';

type AiConfig = {
    provider?: string;
    model?: string;
    gemini?: { apiKey?: string; baseUrl?: string; model?: string };
    openai?: { apiKey?: string; baseUrl?: string; model?: string };
    openai_compatible?: { apiKey?: string; baseUrl?: string; model?: string };
    anthropic?: { apiKey?: string; baseUrl?: string; model?: string };
    openrouter?: { apiKey?: string; baseUrl?: string; model?: string };
    kimi?: { apiKey?: string; baseUrl?: string; model?: string };
    minimax?: { apiKey?: string; baseUrl?: string; model?: string };
    glm?: { apiKey?: string; baseUrl?: string; model?: string };
    nvidia?: { apiKey?: string; baseUrl?: string; model?: string };
};

type SiteSettings = {
    siteName?: string;
    siteLogo?: string;
    documentTitle?: string;
    favicon?: string;
    defaultTheme?: 'light' | 'dark' | 'system';
    ai?: AiConfig;
};

const normalizeSiteSettings = (raw: any): SiteSettings => {
    if (!raw || typeof raw !== 'object') throw new Error('配置文件格式不正确');
    const payload: SiteSettings = {};
    if (raw.siteName != null) payload.siteName = String(raw.siteName);
    if (raw.siteLogo != null) payload.siteLogo = String(raw.siteLogo);
    if (raw.documentTitle != null) payload.documentTitle = String(raw.documentTitle);
    if (raw.favicon != null) payload.favicon = String(raw.favicon);
    if (raw.defaultTheme != null && ['light', 'dark', 'system'].includes(raw.defaultTheme)) {
        payload.defaultTheme = raw.defaultTheme;
    }
    if (raw.ai != null && typeof raw.ai === 'object') {
        payload.ai = raw.ai;
    }
    return payload;
};

const AiSettings: React.FC<{
    siteSettingsForm: SiteSettings;
    setSiteSettingsForm: React.Dispatch<React.SetStateAction<SiteSettings>>;
    updateSiteSettingsMutation: any;
}> = ({ siteSettingsForm, setSiteSettingsForm, updateSiteSettingsMutation }) => {
    const { success, error } = useToast();
    const provider = siteSettingsForm.ai?.provider || 'gemini';
    const config = (siteSettingsForm.ai as any)?.[provider] || {};

    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getBaseUrlPlaceholder = (p: string) => {
        if (p === 'openai') return 'https://api.openai.com/v1';
        if (p === 'anthropic') return 'https://api.anthropic.com/v1';
        if (p === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta';
        if (p === 'kimi') return 'https://api.moonshot.cn/v1';
        if (p === 'minimax') return 'https://api.minimax.chat/v1';
        if (p === 'glm') return 'https://open.bigmodel.cn/api/paas/v4';
        if (p === 'nvidia') return 'https://integrate.api.nvidia.com/v1';
        if (p === 'openrouter') return 'https://openrouter.ai/api/v1';
        return 'https://api.openai.com/v1';
    };

    const getModelPlaceholder = (p: string) => {
        if (p === 'openai') return 'gpt-4o';
        if (p === 'anthropic') return 'claude-3-5-sonnet-20240620';
        if (p === 'gemini') return 'gemini-1.5-flash';
        if (p === 'kimi') return 'moonshot-v1-8k';
        if (p === 'minimax') return 'abab6.5s-chat';
        if (p === 'glm') return 'glm-4-flash';
        if (p === 'nvidia') return 'meta/llama-3.1-405b-instruct';
        if (p === 'openrouter') return 'google/gemini-2.0-flash-exp:free';
        return 'gpt-4o';
    };

    const updateProviderConfig = (key: string, val: string) => {
        setSiteSettingsForm(prev => ({
            ...prev,
            ai: {
                ...prev.ai,
                [provider]: {
                    ...((prev.ai as any)?.[provider] || {}),
                    [key]: val
                }
            }
        }));
    };

    const handleFetchModels = async () => {
        if (!config.apiKey) {
            error('请先填写 API Key');
            return;
        }
        setIsFetchingModels(true);
        try {
            const res = await api.post<{ models: string[] }>('/ai/models', {
                provider,
                apiKey: config.apiKey,
                baseUrl: config.baseUrl
            });
            if (res.data.models && res.data.models.length > 0) {
                setFetchedModels(res.data.models);
                setShowModelDropdown(true);
                success(`成功获取 ${res.data.models.length} 个模型`);
            } else {
                setFetchedModels([]);
                error('未获取到模型列表');
            }
        } catch (err: any) {
            error(String(err?.data?.message || err?.message || '获取模型列表失败'));
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        success('已复制到剪贴板');
    };

    return (
        <div className="glass-panel p-6 !bg-slate-50/90 dark:!bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI 大模型配置
            </h3>
            <div className="space-y-6">
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">AI 提供商 (Provider)</label>
                    <select
                        value={siteSettingsForm.ai?.provider || 'gemini'}
                        onChange={(e) => setSiteSettingsForm({
                            ...siteSettingsForm,
                            ai: { ...siteSettingsForm.ai, provider: e.target.value }
                        })}
                        className="w-full mt-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm"
                    >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="kimi">Kimi (Moonshot)</option>
                        <option value="minimax">MiniMax (海螺)</option>
                        <option value="glm">Zhipu GLM (智谱)</option>
                        <option value="nvidia">NVIDIA NIM</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="openai_compatible">OpenAI Compatible (自定义)</option>
                    </select>
                </div>

                <div className="space-y-4 p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/5">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 capitalize">{provider} 配置</h4>
                    
                    <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">API Key</label>
                        <input
                            type="password"
                            value={config.apiKey || ''}
                            onChange={(e) => updateProviderConfig('apiKey', e.target.value)}
                            placeholder={`请输入 ${provider} API Key`}
                            className="w-full mt-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Base URL (可选)</label>
                        <input
                            type="text"
                            value={config.baseUrl || ''}
                            onChange={(e) => updateProviderConfig('baseUrl', e.target.value)}
                            placeholder={`例如: ${getBaseUrlPlaceholder(provider)}`}
                            className="w-full mt-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>默认: </span>
                            <code className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300 font-mono">
                                {getBaseUrlPlaceholder(provider)}
                            </code>
                            <button 
                                onClick={() => handleCopy(getBaseUrlPlaceholder(provider))}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
                                title="复制默认 URL"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    <div className="relative" ref={modelDropdownRef}>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">模型名称 (Model)</label>
                        <div className="flex gap-2 mt-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={config.model || ''}
                                    onChange={(e) => updateProviderConfig('model', e.target.value)}
                                    placeholder={`例如: ${getModelPlaceholder(provider)}`}
                                    className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                />
                                {fetchedModels.length > 0 && (
                                    <button
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                    >
                                        <ChevronDown className={`w-4 h-4 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleFetchModels}
                                disabled={isFetchingModels || !config.apiKey}
                                className="px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                title="从 API 获取可用模型列表"
                            >
                                {isFetchingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                <span className="hidden sm:inline">获取列表</span>
                            </button>
                        </div>

                        {/* Models Dropdown */}
                        {showModelDropdown && fetchedModels.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                                {fetchedModels.map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => {
                                            updateProviderConfig('model', model);
                                            setShowModelDropdown(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between ${
                                            config.model === model ? 'text-primary font-medium bg-primary/5' : 'text-gray-700 dark:text-gray-200'
                                        }`}
                                    >
                                        {model}
                                        {config.model === model && <Check className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                            <Monitor className="w-3 h-3" />
                            注意：必须使用支持图片识别 (Vision) 的模型，否则无法自动填写照片信息。
                        </p>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex flex-col sm:flex-row justify-end">
                    <button
                        onClick={() => updateSiteSettingsMutation.mutate(siteSettingsForm)}
                        disabled={updateSiteSettingsMutation.isPending}
                        className="w-full sm:w-auto justify-center btn-liquid text-gray-900 dark:text-white px-8 py-2.5 font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {updateSiteSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        保存 AI 配置
                    </button>
                </div>
            </div>
        </div>
    );
};

export const SettingsPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const { confirm } = useModal();
    const siteSettingsImportInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'roles' | 'ai'>('general');

    if (user?.role !== 'admin') return <Navigate to="/me/albums" replace />;

    const [siteSettingsForm, setSiteSettingsForm] = useState<SiteSettings>({
        siteName: '',
        siteLogo: '',
        documentTitle: '',
        favicon: '',
        defaultTheme: 'system',
        ai: { provider: 'gemini' },
    });

    const { data: siteSettingsData } = useQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const res = await api.get('/admin/site-settings');
            return res.data;
        },
    });

    useEffect(() => {
        if (siteSettingsData) {
            setSiteSettingsForm({
                siteName: siteSettingsData.siteName || '',
                siteLogo: siteSettingsData.siteLogo || '',
                documentTitle: siteSettingsData.documentTitle || '',
                favicon: siteSettingsData.favicon || '',
                defaultTheme: siteSettingsData.defaultTheme || 'system',
                ai: siteSettingsData.ai || { provider: 'gemini' },
            });
        }
    }, [siteSettingsData]);

    const updateSiteSettingsMutation = useMutation({
        mutationFn: (data: SiteSettings) => api.post('/admin/site-settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            queryClient.invalidateQueries({ queryKey: ['global-site-settings'] });
            success('网站设置已保存');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '保存失败'));
        },
    });

    const uploadFileMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/admin/upload', formData);
            return res.data.url;
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '上传失败'));
        },
    });

    const todayIso = new Date().toISOString().split('T')[0];

    // Category Management Logic
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
    const [categoryForm, setCategoryForm] = useState({ value: '', label: '', icon: '', sortOrder: 0 });

    useEffect(() => {
        if (editingCategory) {
            setCategoryForm({
                value: editingCategory.value,
                label: editingCategory.label,
                icon: editingCategory.icon || '',
                sortOrder: editingCategory.sortOrder
            });
        } else {
            setCategoryForm({ value: '', label: '', icon: '', sortOrder: 0 });
        }
    }, [editingCategory, isCategoryModalOpen]);

    const { data: categories = [], isLoading: categoriesLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });

    const createCategoryMutation = useMutation({
        mutationFn: (body: { value: string; label: string; icon: string; sortOrder: number }) => api.post('/categories', body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setIsCategoryModalOpen(false);
            success('分类已添加');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '添加分类失败'));
        }
    });

    const updateCategoryMutation = useMutation({
        mutationFn: (data: { value: string; label: string; icon: string; sortOrder: number }) => 
            api.patch(`/categories/${data.value}`, { label: data.label, icon: data.icon, sortOrder: data.sortOrder }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setIsCategoryModalOpen(false);
            success('分类已更新');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '更新分类失败'));
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: (value: string) => api.delete(`/categories/${value}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            success('分类已删除');
        },
        onError: (err: any) => {
            error(String(err?.data?.message || err?.message || '删除分类失败'));
        }
    });

    const handleSubmitCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryForm.value || !categoryForm.label) return;
        
        if (editingCategory) {
            updateCategoryMutation.mutate(categoryForm);
        } else {
            createCategoryMutation.mutate(categoryForm);
        }
    };

    const handleDeleteCategory = (value: string) => {
        confirm({
            title: '确认删除分类',
            content: `确定要删除分类 "${value}" 吗？此操作不可恢复。`,
            onConfirm: () => deleteCategoryMutation.mutate(value)
        });
    };

    const openCreateModal = () => {
        setEditingCategory(null);
        setIsCategoryModalOpen(true);
    };

    const openEditModal = (cat: ApiCategory) => {
        setEditingCategory(cat);
        setIsCategoryModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                    <Settings className="w-8 h-8 text-primary" /> 系统设置
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                    管理网站全局配置、分类体系与用户角色权限
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'general'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <Settings className="w-4 h-4" />
                    基本设置
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'categories'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <Tag className="w-4 h-4" />
                    分类管理
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'roles'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <Shield className="w-4 h-4" />
                    角色权限
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'ai'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                    <Brain className="w-4 h-4" />
                    AI 配置
                </button>
            </div>

            {/* Site Settings */}
            {activeTab === 'general' && (
            <div className="glass-panel p-6 !bg-slate-50/90 dark:!bg-gray-900/50">
                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    网站设置
                </h3>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">网站名称</label>
                            <input 
                                type="text" 
                                value={siteSettingsForm.siteName || ''}
                                onChange={(e) => setSiteSettingsForm({...siteSettingsForm, siteName: e.target.value})}
                                placeholder="显示在Header和Footer的名称"
                                className="w-full mt-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">浏览器标题</label>
                            <input 
                                type="text" 
                                value={siteSettingsForm.documentTitle || ''}
                                onChange={(e) => setSiteSettingsForm({...siteSettingsForm, documentTitle: e.target.value})}
                                placeholder="浏览器标签页标题"
                                className="w-full mt-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Logo Upload */}
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-2 block">网站 Logo</label>
                            <div className="flex items-center gap-4">
                                {siteSettingsForm.siteLogo ? (
                                    <div className="relative w-16 h-16 bg-white/5 dark:bg-white/5 rounded-2xl border border-white/20 flex items-center justify-center overflow-hidden glass-card">
                                        <img src={toMediaUrl(siteSettingsForm.siteLogo)} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        <button 
                                            type="button"
                                            aria-label="移除网站 Logo"
                                            onClick={() => setSiteSettingsForm({...siteSettingsForm, siteLogo: ''})}
                                            className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl shadow-sm hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-white/5 dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center text-gray-400 glass-card">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <label className="cursor-pointer bg-white/50 dark:bg-white/5 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-2xl text-sm border border-white/20 hover:bg-white/80 dark:hover:bg-white/10 transition-colors inline-flex items-center gap-2 backdrop-blur-sm">
                                        <Upload className="w-3 h-3" />
                                        上传图片
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={async (e) => {
                                                if (e.target.files?.[0]) {
                                                    try {
                                                        const url = await uploadFileMutation.mutateAsync(e.target.files[0]);
                                                        setSiteSettingsForm(prev => ({ ...prev, siteLogo: url }));
                                                    } catch {}
                                                }
                                            }}
                                        />
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">建议尺寸 64x64 或更高</p>
                                </div>
                            </div>
                        </div>

                        {/* Favicon Upload */}
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-2 block">网站 Favicon</label>
                            <div className="flex items-center gap-4">
                                {siteSettingsForm.favicon ? (
                                    <div className="relative w-16 h-16 bg-white/5 dark:bg-white/5 rounded-2xl border border-white/20 flex items-center justify-center overflow-hidden glass-card">
                                        <img src={toMediaUrl(siteSettingsForm.favicon)} alt="Favicon" className="w-8 h-8 object-contain" />
                                        <button 
                                            type="button"
                                            aria-label="移除网站 Favicon"
                                            onClick={() => setSiteSettingsForm({...siteSettingsForm, favicon: ''})}
                                            className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl shadow-sm hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-white/5 dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center text-gray-400 glass-card">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <label className="cursor-pointer bg-white/50 dark:bg-white/5 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-2xl text-sm border border-white/20 hover:bg-white/80 dark:hover:bg-white/10 transition-colors inline-flex items-center gap-2 backdrop-blur-sm">
                                        <Upload className="w-3 h-3" />
                                        上传图片
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg"
                                            onChange={async (e) => {
                                                if (e.target.files?.[0]) {
                                                    try {
                                                        const url = await uploadFileMutation.mutateAsync(e.target.files[0]);
                                                        setSiteSettingsForm(prev => ({ ...prev, favicon: url }));
                                                    } catch {}
                                                }
                                            }}
                                        />
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">建议 .ico 或 .png 格式</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">默认主题模式</label>
                        <div className="flex items-center p-1 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 w-max mt-2">
                            {[
                                { val: 'light', label: '浅色', icon: Sun },
                                { val: 'dark', label: '深色', icon: Moon },
                                { val: 'system', label: '跟随系统', icon: Monitor },
                            ].map((opt) => (
                                <button
                                    key={opt.val}
                                    onClick={() => setSiteSettingsForm({...siteSettingsForm, defaultTheme: opt.val as any})}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-medium transition-all ${
                                        siteSettingsForm.defaultTheme === opt.val
                                        ? 'bg-white dark:bg-white/10 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <opt.icon className="w-4 h-4" />
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex flex-col sm:flex-row justify-end">
                        <button
                            onClick={() => updateSiteSettingsMutation.mutate(siteSettingsForm)}
                            disabled={updateSiteSettingsMutation.isPending}
                            className="w-full sm:w-auto justify-center btn-liquid text-gray-900 dark:text-white px-8 py-2.5 font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {updateSiteSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            保存全局设置
                        </button>
                    </div>
                </div>
            </div>
            )}

            {/* Category Management */}
            {activeTab === 'categories' && (<>
            <div className="glass-panel p-6 !bg-slate-50/90 dark:!bg-white/5">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Tag className="w-5 h-5 text-primary" />
                            分类管理
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">定义照片的分类体系</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-6 py-2.5 btn-liquid text-gray-900 dark:text-white font-medium hover:text-primary dark:hover:text-primary transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        添加分类
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {categoriesLoading ? (
                        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                            <Loader2 className="inline-block w-5 h-5 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <table className="hidden md:table w-full text-left text-sm">
                                <thead className="bg-white/10 dark:bg-black/20 text-gray-500 dark:text-gray-400 font-medium backdrop-blur-sm">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-xl">显示名称 (Label)</th>
                                        <th className="px-4 py-3">系统值 (Value)</th>
                                        <th className="px-4 py-3">图标 (Icon)</th>
                                        <th className="px-4 py-3">排序 (Sort)</th>
                                        <th className="px-4 py-3">照片数</th>
                                        <th className="px-4 py-3 text-right rounded-tr-xl">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10 dark:divide-white/5">
                                    {categories.map((cat) => {
                                        const IconComponent = cat.icon && (LucideIcons as any)[cat.icon] ? (LucideIcons as any)[cat.icon] : LucideIcons.HelpCircle;
                                        return (
                                        <tr key={cat.value} className="group hover:bg-white/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                {cat.label}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                                {cat.value}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                                                        <IconComponent className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-xs font-mono text-gray-400">{cat.icon || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {cat.sortOrder}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                    {cat.photoCount || 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openEditModal(cat)}
                                                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCategory(cat.value)}
                                                        disabled={cat.value === 'uncategorized'}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            cat.value === 'uncategorized'
                                                            ? 'text-gray-300 cursor-not-allowed'
                                                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                                        }`}
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-6">
                                {categories.map((cat) => {
                                    const IconComponent = cat.icon && (LucideIcons as any)[cat.icon] ? (LucideIcons as any)[cat.icon] : LucideIcons.HelpCircle;
                                    return (
                                    <div key={cat.value} className="glass-card p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 shrink-0">
                                                    <IconComponent className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{cat.label}</h4>
                                                    <div className="text-xs font-mono text-gray-500 mt-1">{cat.value}</div>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                {cat.photoCount || 0} 张
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-3 border-t border-white/10 dark:border-white/5">
                                            <div className="text-xs text-gray-500">
                                                排序权重: {cat.sortOrder}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(cat)}
                                                    className="p-2 text-gray-500 hover:text-primary bg-white/50 dark:bg-white/5 rounded-xl transition-colors"
                                                    title="编辑"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(cat.value)}
                                                    disabled={cat.value === 'uncategorized'}
                                                    className={`p-2 rounded-2xl transition-colors ${
                                                        cat.value === 'uncategorized'
                                                        ? 'text-gray-300 bg-gray-50 dark:bg-surface-border/50 cursor-not-allowed'
                                                        : 'text-gray-500 hover:text-red-500 bg-gray-50 dark:bg-surface-border/50 hover:bg-red-50 dark:hover:bg-red-500/10'
                                                    }`}
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    )})}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                title={editingCategory ? '编辑分类' : '添加分类'}
            >
                <form onSubmit={handleSubmitCategory} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            显示名称 (Label)
                        </label>
                        <input
                            type="text"
                            value={categoryForm.label}
                            onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                            className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm"
                            placeholder="例如：黑白摄影"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            系统值 (Value)
                        </label>
                        <input
                            type="text"
                            value={categoryForm.value}
                            onChange={(e) => setCategoryForm({ ...categoryForm, value: e.target.value })}
                            disabled={!!editingCategory}
                            className={`w-full px-3 py-2 border border-white/20 dark:border-white/10 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono backdrop-blur-sm ${
                                editingCategory 
                                ? 'opacity-50 cursor-not-allowed bg-gray-100/50 dark:bg-white/5' 
                                : 'bg-white/50 dark:bg-black/20'
                            }`}
                            placeholder="例如：bnw (仅支持小写字母、数字、短横线)"
                            pattern="[a-z0-9][a-z0-9_-]*"
                            required
                        />
                        {editingCategory && <p className="text-xs text-gray-500 mt-1">系统值创建后不可修改</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            图标 (Icon Name)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={categoryForm.icon}
                                onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                                onBlur={() => {
                                    // Auto-correct casing on blur
                                    if (categoryForm.icon) {
                                        const lower = categoryForm.icon.toLowerCase();
                                        const match = Object.keys(LucideIcons).find(k => k.toLowerCase() === lower);
                                        if (match && match !== categoryForm.icon) {
                                            setCategoryForm({ ...categoryForm, icon: match });
                                        }
                                    }
                                }}
                                className="w-full pl-10 pr-3 py-2 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm"
                                placeholder="例如：Camera, Mountain, User"
                            />
                            <div className="absolute left-3 top-2.5 text-gray-400">
                                {(() => {
                                    // Case-insensitive lookup for preview
                                    const iconName = categoryForm.icon;
                                    let RenderIcon = null;
                                    
                                    if (iconName) {
                                        // 1. Try exact match
                                        if ((LucideIcons as any)[iconName]) {
                                            RenderIcon = (LucideIcons as any)[iconName];
                                        } 
                                        // 2. Try case-insensitive match
                                        else {
                                            const lower = iconName.toLowerCase();
                                            const match = Object.keys(LucideIcons).find(k => k.toLowerCase() === lower);
                                            if (match) {
                                                RenderIcon = (LucideIcons as any)[match];
                                            }
                                        }
                                    }

                                    return RenderIcon ? (
                                        <RenderIcon className="w-5 h-5 text-primary" />
                                    ) : (
                                        <LucideIcons.HelpCircle className="w-5 h-5" />
                                    );
                                })()}
                            </div>
                        </div>
                        
                        <div className="mt-3">
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">常用图标</label>
                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                {[
                                    'Camera', 'Image', 'Aperture', 'Film', 'Video',
                                    'Mountain', 'Cloud', 'Sun', 'Moon', 'Wind',
                                    'User', 'Users', 'Smile', 'Heart', 'Star',
                                    'Map', 'Globe', 'Plane', 'Car', 'Bike',
                                    'Home', 'Building', 'Factory', 'Tent',
                                    'Coffee', 'Book', 'Music', 'Gift', 'Trophy',
                                    'Tag', 'Filter', 'Layers', 'Grid', 'Hash',
                                    'Smartphone', 'Monitor', 'Watch', 'Headphones',
                                    'Briefcase', 'Umbrella', 'Scissors', 'Anchor'
                                ].map(iconName => {
                                    const IconComponent = (LucideIcons as any)[iconName];
                                    if (!IconComponent) return null;
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            onClick={() => setCategoryForm({ ...categoryForm, icon: iconName })}
                                            className={`p-2 rounded-2xl flex items-center justify-center transition-all ${
                                                categoryForm.icon === iconName
                                                ? 'bg-primary text-white shadow-md scale-105'
                                                : 'bg-white/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-white/10 hover:scale-105'
                                            }`}
                                            title={iconName}
                                        >
                                            <IconComponent className="w-5 h-5" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                            使用 <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Lucide Icons</a> 图标名称 (PascalCase)
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            排序权重 (Sort Order)
                        </label>
                        <input
                            type="number"
                            value={categoryForm.sortOrder}
                            onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all backdrop-blur-sm"
                            placeholder="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">数字越小越靠前</p>
                    </div>
                    
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCategoryModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                            className="px-4 py-2 text-sm font-medium btn-liquid text-gray-900 dark:text-white rounded-xl transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
                        >
                            {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            {editingCategory ? '保存修改' : '立即创建'}
                        </button>
                    </div>
                </form>
            </Modal>
            </>)}

            {/* Config Backup/Restore */}
            {activeTab === 'general' && (
            <div className="glass-panel p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    配置备份与恢复
                </h3>
                <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        导出为 JSON 备份；导入将覆盖当前全局配置。
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => downloadJson(siteSettingsForm, `站点配置-${todayIso}.json`)}
                            className="px-3 py-2 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-white/10 border border-transparent hover:border-white/20 transition-all flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            导出 JSON
                        </button>
                        <button
                            type="button"
                            onClick={() => siteSettingsImportInputRef.current?.click()}
                            className="px-3 py-2 rounded-2xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                        >
                            <Upload className="w-4 h-4" />
                            导入并应用
                        </button>
                        <input
                            ref={siteSettingsImportInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                try {
                                    const text = await file.text();
                                    const raw = JSON.parse(text);
                                    const payload = normalizeSiteSettings(raw);
                                    confirm({
                                        title: '确认导入配置',
                                        content: '导入后将覆盖当前网站全局配置，是否继续？',
                                        onConfirm: () => updateSiteSettingsMutation.mutate({ ...siteSettingsForm, ...payload }),
                                    });
                                } catch (err: any) {
                                    error(String(err?.message || '配置导入失败'));
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
            )}

            {/* AI Settings */}
            {activeTab === 'ai' && (
                <AiSettings 
                    siteSettingsForm={siteSettingsForm} 
                    setSiteSettingsForm={setSiteSettingsForm} 
                    updateSiteSettingsMutation={updateSiteSettingsMutation}
                />
            )}

            {/* Roles Management */}
            {activeTab === 'roles' && <RolesSettings />}
        </div>
    );
};
