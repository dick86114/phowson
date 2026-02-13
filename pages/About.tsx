import React from 'react';
import { Mail, MapPin, Sparkles } from 'lucide-react';
import { CURRENT_USER } from '../constants';
import { useSiteSettings } from '../SiteSettingsContext';
import { toMediaUrl, generateFallbackAvatar } from '../utils/helpers';
import * as LucideIcons from 'lucide-react';

const DynamicIcon = ({ name }: { name: string }) => {
    // @ts-ignore
    const Icon = LucideIcons[name];
    return Icon ? <Icon className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />;
};

export const About: React.FC = () => {
    const settings = useSiteSettings();
    const about = settings.about || {};

    const title = about.title || '关于 Phowson';
    const subtitle = about.subtitle || '"浮生六记，光影一瞬。"';
    const intro = about.intro || '在这里，我们不追求算法推荐的流量，只在乎每一张照片背后的真实温度。';
    
    const profileTitle = about.profileTitle || `你好，我是 ${CURRENT_USER.name}`;
    const profileSubtitle = about.profileSubtitle || '现居旧金山湾区，独立摄影师';
    const profileBio = about.profileBio || '我是一名热爱自然风光与街头人文的摄影师。对我而言，摄影不仅仅是按下快门的动作，更是一种观察世界、与自我对话的方式。';
    const contactEmail = about.contactEmail || 'contact@photologs.com';
    
    const sections = about.sections || [
        { title: '坚持热爱', content: '通过“每日打卡”机制，抵抗惰性。无论晴雨，保持对生活的热爱和对快门的渴望。', icon: 'Coffee' }
    ];

    return (
        <main className="flex-grow bg-background-light dark:bg-background-dark transition-colors duration-300">
            {/* Hero Section */}
            <section className="relative py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none animate-float" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-6">
                        {title}
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl mx-auto">
                        {subtitle}
                    </p>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">
                        {intro}
                    </p>
                </div>
            </section>

            {/* Profile Section */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="glass-panel rounded-2xl p-6 md:p-10 flex flex-col md:flex-row gap-8 items-center">
                    <div className="shrink-0 relative">
                        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
                            <img 
                                src={toMediaUrl(about.avatar) || generateFallbackAvatar(profileTitle)} 
                                alt={profileTitle} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = generateFallbackAvatar(profileTitle);
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{profileTitle}</h2>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 dark:text-gray-400">
                                <MapPin className="w-4 h-4" />
                                <span>{profileSubtitle}</span>
                            </div>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {profileBio}
                        </p>
                        
                        <div className="flex items-center justify-center md:justify-start gap-4 pt-4">
                            <a href={`mailto:${contactEmail}`} className="text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
                                <Mail className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Dynamic Content Sections */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {sections.map((section, idx) => (
                    <div key={idx} className="glass-card p-6 rounded-xl">
                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                            <DynamicIcon name={section.icon} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{section.title}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                            {section.content}
                        </p>
                    </div>
                ))}
            </section>
        </main>
    );
};
