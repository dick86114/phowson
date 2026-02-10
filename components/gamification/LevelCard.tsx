import React from 'react';
import { Sparkles } from 'lucide-react';
import { LevelInfo } from '../../utils/gamificationUtils';

interface LevelCardProps {
    levelInfo: LevelInfo;
}

export const LevelCard: React.FC<LevelCardProps> = ({ levelInfo }) => {
    return (
        <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-surface-border relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Level Circle */}
                <div className="relative shrink-0">
                    <div className="w-32 h-32 rounded-full border-4 border-primary flex items-center justify-center bg-white dark:bg-surface-dark shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                        <Sparkles className="w-12 h-12 text-primary fill-primary/20" />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-white text-sm font-bold px-3 py-1 rounded-full shadow-md border-2 border-white dark:border-surface-dark">
                        LV {levelInfo.level}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 w-full text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-baseline gap-2 justify-center md:justify-start">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{levelInfo.title}</h2>
                        <span className="text-sm font-medium text-primary/80">{levelInfo.titleEn}</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">{levelInfo.description}</p>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-gray-700 dark:text-gray-300">等级进度 {levelInfo.progressPercent}%</span>
                            <span className="text-gray-500 dark:text-gray-400">{levelInfo.currentLevelXp} / {levelInfo.nextLevelThreshold} EXP</span>
                        </div>
                        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${levelInfo.progressPercent}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            距离升至 Lv.{levelInfo.level + 1} 还需 {levelInfo.nextLevelThreshold - levelInfo.currentLevelXp} 经验值
                        </p>
                    </div>
                </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        </div>
    );
};
