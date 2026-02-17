import React, { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Plus, Trash2, Camera, Upload, X, ImageIcon, Info } from 'lucide-react';
import api from '../../../api';
import { useSiteSettings } from '../../../SiteSettingsContext';
import { useToast } from '../../../components/Toast';
import { toMediaUrl, generateFallbackAvatar } from '../../../utils/helpers';
import * as LucideIcons from 'lucide-react';

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
    // @ts-ignore
    const Icon = LucideIcons[name];
    return Icon ? <Icon className={className} /> : <LucideIcons.Sparkles className={className} />;
};

const ICON_OPTIONS = [
    { value: 'Coffee', label: '咖啡' },
    { value: 'Heart', label: '爱心' },
    { value: 'Camera', label: '相机' },
    { value: 'MapPin', label: '定位' },
    { value: 'Music', label: '音乐' },
    { value: 'Book', label: '书籍' },
    { value: 'Code', label: '代码' },
    { value: 'Globe', label: '地球' },
    { value: 'Mail', label: '邮件' },
    { value: 'Star', label: '星星' },
    { value: 'Smile', label: '笑脸' },
    { value: 'Sun', label: '太阳' },
    { value: 'Moon', label: '月亮' },
    { value: 'Zap', label: '闪电' },
    { value: 'Award', label: '奖杯' },
    { value: 'ThumbsUp', label: '点赞' },
    { value: 'Feather', label: '羽毛' },
    { value: 'Aperture', label: '光圈' },
    { value: 'Image', label: '图片' },
    { value: 'Film', label: '胶卷' },
];

interface AboutSection {
    title: string;
    content: string;
    icon: string;
}

interface AboutSettingsForm {
    about: {
        avatar: string;
        title: string;
        subtitle: string;
        intro: string;
        profileTitle: string;
        profileSubtitle: string;
        profileBio: string;
        contactEmail: string;
        sections: AboutSection[];
    }
}

export const AboutSettings: React.FC = () => {
    const settings = useSiteSettings();
    const queryClient = useQueryClient();
    const { success, error } = useToast();

    const { register, control, handleSubmit, reset, setValue, watch, formState: { isDirty } } = useForm<AboutSettingsForm>({
        defaultValues: {
            about: {
                avatar: settings.about?.avatar || '',
                title: settings.about?.title || '关于 Phowson',
                subtitle: settings.about?.subtitle || '浮生六记，光影一瞬。',
                intro: settings.about?.intro || '在这里，我们不追求算法推荐的流量，只在乎每一张照片背后的真实温度。',
                profileTitle: settings.about?.profileTitle || '你好，我是 摄影师',
                profileSubtitle: settings.about?.profileSubtitle || '现居旧金山湾区，独立摄影师',
                profileBio: settings.about?.profileBio || '我是一名热爱自然风光与街头人文的摄影师。对我而言，摄影不仅仅是按下快门的动作，更是一种观察世界、与自我对话的方式。',
                contactEmail: settings.about?.contactEmail || 'contact@photologs.com',
                sections: settings.about?.sections || [
                    { title: '坚持热爱', content: '通过“每日打卡”机制，抵抗惰性。无论晴雨，保持对生活的热爱和对快门的渴望。', icon: 'Coffee' }
                ]
            }
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "about.sections"
    });

    // Watch avatar for preview
    const avatarUrl = watch('about.avatar');

    // Reset form when settings load
    useEffect(() => {
        if (settings.about) {
            reset({ about: { ...settings.about, avatar: settings.about.avatar || '' } as any });
        }
    }, [settings, reset]);

    const updateSettingsMutation = useMutation({
        mutationFn: async (data: AboutSettingsForm) => {
            await api.post('/admin/site-settings', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['global-site-settings'] });
            success('关于页面设置已保存');
        },
        onError: () => {
            error('保存失败');
        }
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

    const onSubmit = (data: AboutSettingsForm) => {
        updateSettingsMutation.mutate(data);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                    <Info className="w-8 h-8 text-primary" />
                    关于页面设置
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">管理关于页面的显示内容</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Hero Section */}
                <div className="glass-panel p-6 space-y-6">
                    <h3 className="font-bold text-gray-900 dark:text-white border-b border-white/10 dark:border-white/5 pb-2">Hero 区域</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">主标题</label>
                            <input {...register('about.title')} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">副标题</label>
                            <input {...register('about.subtitle')} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">介绍文本</label>
                            <textarea {...register('about.intro')} rows={3} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                    </div>
                </div>

                {/* Profile Section */}
                <div className="glass-panel p-6 space-y-6">
                    <h3 className="font-bold text-gray-900 dark:text-white border-b border-white/10 dark:border-white/5 pb-2">个人资料区域</h3>
                    
                    {/* Avatar Upload */}
                    <div className="mb-6">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">个人头像</label>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 dark:border-white/10 shadow-sm glass-card flex items-center justify-center shrink-0">
                                {avatarUrl ? (
                                    <img 
                                        src={toMediaUrl(avatarUrl) || generateFallbackAvatar('User')} 
                                        alt="Avatar" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                            e.currentTarget.src = generateFallbackAvatar('User');
                                        }}
                                    />
                                ) : (
                                    <Camera className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                                )}
                            </div>
                            <div className="space-y-2 flex flex-col items-center sm:items-start w-full text-center sm:text-left">
                                <label className="cursor-pointer bg-white/50 dark:bg-white/5 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-2xl text-sm border border-white/20 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 transition-colors inline-flex items-center gap-2 shadow-sm backdrop-blur-sm">
                                    <Upload className="w-4 h-4" />
                                    上传新头像
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={async (e) => {
                                            if (e.target.files?.[0]) {
                                                try {
                                                    const url = await uploadFileMutation.mutateAsync(e.target.files[0]);
                                                    setValue('about.avatar', url, { shouldDirty: true });
                                                } catch {}
                                            }
                                        }}
                                    />
                                </label>
                                {avatarUrl && (
                                    <button 
                                        type="button"
                                        onClick={() => setValue('about.avatar', '', { shouldDirty: true })}
                                        className="mt-2 sm:mt-0 sm:ml-3 text-red-500 hover:text-red-600 text-sm font-medium inline-flex items-center gap-1"
                                    >
                                        <X className="w-4 h-4" /> 移除
                                    </button>
                                )}
                                <p className="text-xs text-gray-500 w-full">建议上传正方形图片，支持 JPG/PNG/WebP</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">问候标题</label>
                            <input {...register('about.profileTitle')} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">位置/身份</label>
                            <input {...register('about.profileSubtitle')} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">个人简介</label>
                            <textarea {...register('about.profileBio')} rows={4} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                         <div className="col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">联系邮箱</label>
                            <input {...register('about.contactEmail')} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                        </div>
                    </div>
                </div>

                {/* Dynamic Sections */}
                <div className="glass-panel p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 dark:border-white/5 pb-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">附加内容板块</h3>
                        <button type="button" onClick={() => append({ title: '', content: '', icon: 'Coffee' })} className="text-sm text-primary flex items-center gap-1 hover:underline">
                            <Plus className="w-4 h-4" /> 添加板块
                        </button>
                    </div>
                    
                    <div className="space-y-6">
                        {fields.map((field, index) => (
                            <div key={field.id} className="relative glass-card p-4 border border-white/20 dark:border-white/10">
                                <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">标题</label>
                                        <input {...register(`about.sections.${index}.title`)} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">图标</label>
                                        <Controller
                                            control={control}
                                            name={`about.sections.${index}.icon`}
                                            render={({ field: { onChange, value } }) => (
                                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 bg-white/50 dark:bg-black/20 p-2 rounded-2xl border border-white/20 dark:border-white/10 backdrop-blur-sm">
                                                    {ICON_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => onChange(opt.value)}
                                                            className={`
                                                                flex items-center justify-center p-2 rounded-md transition-colors aspect-square
                                                                ${value === opt.value 
                                                                    ? 'bg-primary text-white shadow-sm' 
                                                                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/10'
                                                                }
                                                            `}
                                                            title={opt.label}
                                                        >
                                                            <DynamicIcon name={opt.value} className="w-5 h-5" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">内容</label>
                                        <textarea {...register(`about.sections.${index}.content`)} rows={2} className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm transition-all" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end pt-4">
                    <button
                        type="submit"
                        disabled={updateSettingsMutation.isPending || !isDirty}
                        className="w-full sm:w-auto justify-center btn-liquid text-gray-900 dark:text-white px-8 py-2.5 font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {updateSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        保存设置
                    </button>
                </div>
            </form>
        </div>
    );
};
