import React from 'react';
import { Camera, Heart, Coffee, Mail, Instagram, Twitter, MapPin } from 'lucide-react';
import { CURRENT_USER } from '../constants';
import { Link } from 'react-router-dom';

export const About: React.FC = () => {
    return (
        <main className="flex-grow bg-background-light dark:bg-background-dark transition-colors duration-300">
            {/* Hero Section */}
            <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-6">
                        关于 <span className="text-primary">Phowson</span>
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl mx-auto">
                        "浮生六记，光影一瞬。"
                    </p>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">
                        在这里，我们不追求算法推荐的流量，只在乎每一张照片背后的真实温度。
                    </p>
                </div>
            </section>

            {/* Profile Section */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-2xl p-8 md:p-12 shadow-sm flex flex-col md:flex-row gap-12 items-center">
                    <div className="shrink-0 relative">
                        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white dark:border-surface-border shadow-xl">
                            <img 
                                src={CURRENT_USER.avatar} 
                                alt={CURRENT_USER.name} 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="absolute bottom-2 right-2 bg-primary text-white p-2 rounded-full shadow-lg">
                            <Camera className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">你好，我是 {CURRENT_USER.name}</h2>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 dark:text-gray-400">
                                <MapPin className="w-4 h-4" />
                                <span>现居旧金山湾区，独立摄影师</span>
                            </div>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            我是一名热爱自然风光与街头人文的摄影师。对我而言，摄影不仅仅是按下快门的动作，更是一种观察世界、与自我对话的方式。
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            建立 Phowson (Photo + Person) 的初衷，是希望在这个快节奏的时代，保留一片属于纯粹摄影的净土。这里没有短视频的喧嚣，只有高画质的静态影像和详细的拍摄参数（EXIF），供同好交流学习。
                        </p>
                        <div className="flex items-center justify-center md:justify-start gap-4 pt-4">
                            <a href="#" className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-full transition-colors">
                                <Instagram className="w-6 h-6" />
                            </a>
                            <a href="#" className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-full transition-colors">
                                <Twitter className="w-6 h-6" />
                            </a>
                            <a href="mailto:contact@photologs.com" className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-surface-border rounded-full transition-colors">
                                <Mail className="w-6 h-6" />
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Philosophy Grid */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mb-12">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-gray-50 dark:bg-[#1a2632]/50 p-6 rounded-xl border border-gray-200 dark:border-surface-border/50 hover:border-primary/30 transition-colors">
                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                            <Camera className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">真实记录</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                            坚持“直出”或适度后期的原则，还原肉眼所见的感动，拒绝过度修饰和AI生成的虚假影像。
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a2632]/50 p-6 rounded-xl border border-gray-200 dark:border-surface-border/50 hover:border-primary/30 transition-colors">
                        <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center mb-4">
                            <Heart className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">情感连接</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                            每一张照片都是一段记忆的载体。通过“故事”板块，分享拍摄背后的心路历程。
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a2632]/50 p-6 rounded-xl border border-gray-200 dark:border-surface-border/50 hover:border-primary/30 transition-colors">
                        <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center mb-4">
                            <Coffee className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">坚持热爱</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                            通过“每日打卡”机制，抵抗惰性。无论晴雨，保持对生活的热爱和对快门的渴望。
                        </p>
                    </div>
                </div>
            </section>
            
            <section className="text-center py-12 border-t border-gray-200 dark:border-surface-border bg-white dark:bg-surface-dark">
                <div className="max-w-2xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">想了解我的拍摄装备？</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">工欲善其事，必先利其器。查看我目前使用的机身、镜头及后期工作流。</p>
                    <Link to="/gear" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                        查看装备库
                    </Link>
                </div>
            </section>
        </main>
    );
};