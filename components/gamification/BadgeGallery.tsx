import React, { useState } from 'react';
import { Trophy, Mountain, User, Compass, Heart, Calendar, Sun, Moon, Star, Image as ImageIcon, Map, Users, Award, Lock } from 'lucide-react';

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked: boolean;
    earnedAt?: string;
    category?: string; // Optional, for filtering if needed
}

interface BadgeGalleryProps {
    badges: Badge[];
}

export const BadgeGallery: React.FC<BadgeGalleryProps> = ({ badges }) => {
    const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

    const filteredBadges = badges.filter(b => {
        if (filter === 'unlocked') return b.unlocked;
        if (filter === 'locked') return !b.unlocked;
        return true;
    });

    const getIcon = (iconName: string) => {
        const props = { className: "w-8 h-8" };
        switch (iconName) {
            case 'mountain': return <Mountain {...props} />;
            case 'user': return <User {...props} />;
            case 'compass': return <Compass {...props} />;
            case 'heart': return <Heart {...props} />;
            case 'calendar': return <Calendar {...props} />;
            case 'sun': return <Sun {...props} />;
            case 'moon': return <Moon {...props} />;
            case 'star': return <Star {...props} />;
            case 'image': return <ImageIcon {...props} />;
            case 'map': return <Map {...props} />;
            case 'users': return <Users {...props} />;
            case 'award': return <Award {...props} />;
            default: return <Trophy {...props} />;
        }
    };

    return (
        <div className="glass-panel rounded-2xl p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-orange-100/50 dark:bg-orange-500/10 text-orange-500 backdrop-blur-sm">
                        <Trophy className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">徽章馆</h2>
                </div>
                
                <div className="flex bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-2xl w-fit backdrop-blur-sm border border-white/10">
                    {(['all', 'unlocked', 'locked'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                filter === tab 
                                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' 
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            {tab === 'all' && '全部'}
                            {tab === 'unlocked' && '已解锁'}
                            {tab === 'locked' && '进行中'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
                {filteredBadges.map((badge) => (
                    <div key={badge.id} className="flex flex-col items-center text-center group">
                        {/* Hexagon Shape */}
                        <div className={`relative w-24 h-24 mb-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-lg`}>
                            {/* Hexagon SVG Background */}
                            <svg viewBox="0 0 100 100" className={`w-full h-full ${badge.unlocked ? 'text-orange-50/80 dark:text-orange-500/10' : 'text-gray-100/50 dark:text-gray-800/50'}`}>
                                <path 
                                    d="M50 0 L93.3 25 V75 L50 100 L6.7 75 V25 Z" 
                                    fill="currentColor"
                                    className="backdrop-blur-sm"
                                />
                            </svg>
                            
                            {/* Icon Center */}
                            <div className={`absolute inset-0 flex items-center justify-center ${
                                badge.unlocked ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'
                            }`}>
                                {badge.unlocked ? getIcon(badge.icon) : <Lock className="w-8 h-8" />}
                            </div>

                            {/* Unlocked Glow */}
                            {badge.unlocked && (
                                <div className="absolute inset-0 bg-orange-400/20 blur-xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </div>

                        <h3 className={`font-bold text-sm mb-1 ${badge.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                            {badge.name}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[120px] line-clamp-2">
                            {badge.unlocked ? badge.description : '???'}
                        </p>
                    </div>
                ))}
            </div>
            
            {filteredBadges.length === 0 && (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    没有找到符合条件的徽章
                </div>
            )}
        </div>
    );
};
