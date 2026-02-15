import React from 'react';
import { Calendar, Compass, Star, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Challenge {
    id: string;
    title: string;
    description: string;
    progress: number;
    target: number;
    reward: number;
    type: string; // 'upload' | 'like' | 'streak' | etc.
    completed: boolean;
}

interface WeeklyChallengesProps {
    challenges: Challenge[];
    hideHeader?: boolean;
}

export const WeeklyChallenges: React.FC<WeeklyChallengesProps> = ({ challenges, hideHeader = false }) => {
    const getIcon = (title: string) => {
        if (title.includes('街头') || title.includes('Explorer')) return <Compass className="w-6 h-6 text-primary" />;
        if (title.includes('社区') || title.includes('Star')) return <Star className="w-6 h-6 text-primary" />;
        if (title.includes('每日') || title.includes('Ritual')) return <Zap className="w-6 h-6 text-primary" />;
        return <Calendar className="w-6 h-6 text-primary" />;
    };

    return (
        <div className="space-y-6">
            {!hideHeader && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">每周挑战</h2>
                    </div>
                    <Link to="/challenges" className="text-sm font-medium text-gray-500 hover:text-primary flex items-center gap-1">
                        查看全部
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {challenges.map((challenge) => {
                    const percent = Math.min(100, Math.floor((challenge.progress / challenge.target) * 100));
                    
                    return (
                        <div key={challenge.id} className="glass-card rounded-2xl p-6 flex flex-col h-full group hover:-translate-y-1 transition-transform duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-white/5 backdrop-blur-md flex items-center justify-center mb-4 shadow-inner">
                                {getIcon(challenge.title)}
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{challenge.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex-1">{challenge.description}</p>
                            
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-sm font-medium mb-2">
                                        <span className="text-gray-700 dark:text-gray-300">进度 {challenge.progress}/{challenge.target}</span>
                                        <span className="text-primary">{percent}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100/50 dark:bg-gray-700/50 rounded-full overflow-hidden border border-white/10">
                                        <div 
                                            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                                
                                <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl w-fit backdrop-blur-sm ${
                                    challenge.completed 
                                        ? 'text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-500/10' 
                                        : 'text-primary bg-blue-100/50 dark:bg-blue-500/10'
                                }`}>
                                    {challenge.completed ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>已完成</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-3.5 h-3.5" />
                                            <span>奖励: {challenge.reward} EXP</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {challenges.length === 0 && (
                    <div className="col-span-full text-center py-12 glass-card rounded-2xl border-dashed">
                        <p className="text-gray-500 dark:text-gray-400">本周暂无挑战，敬请期待！</p>
                    </div>
                )}
            </div>
        </div>
    );
};
