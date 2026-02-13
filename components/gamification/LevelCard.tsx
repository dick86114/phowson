import React from 'react';
import { Sparkles } from 'lucide-react';
import { LevelInfo } from '../../utils/gamificationUtils';

interface LevelCardProps {
    levelInfo: LevelInfo;
}

export const LevelCard: React.FC<LevelCardProps> = ({ levelInfo }) => {
    return (
        <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:scale-[1.01] transition-all duration-500">
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Level Circle */}
                <div className="relative shrink-0">
                    <div className="w-32 h-32 rounded-full border-4 border-white/20 dark:border-white/10 flex items-center justify-center glass-card shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-float">
                        <Sparkles className="w-12 h-12 text-primary fill-primary/20" />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary backdrop-blur-md text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg border border-white/20">
                        LV {levelInfo.level}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 w-full text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-baseline gap-2 justify-center md:justify-start">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{levelInfo.title}</h2>
                        <span className="text-sm font-medium text-primary/80">{levelInfo.titleEn}</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-2 mb-6 text-lg">{levelInfo.description}</p>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm font-semibold">
                            <span className="text-gray-700 dark:text-gray-200">等级进度 {levelInfo.progressPercent}%</span>
                            <span className="text-gray-500 dark:text-gray-400">{levelInfo.currentLevelXp} / {levelInfo.nextLevelThreshold} EXP</span>
                        </div>
                        <div className="h-4 bg-gray-100/50 dark:bg-gray-800/50 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                style={{ width: `${levelInfo.progressPercent}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex justify-end">
                            距离下一级还需 {levelInfo.nextLevelThreshold - levelInfo.currentLevelXp} EXP
                        </p>
                    </div>
                </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />
        </div>
    );
};
