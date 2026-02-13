import React from 'react';
import { Clock, CheckCircle2, Zap, Trophy, Moon, Building2, Users, Camera, Image as ImageIcon } from 'lucide-react';
import { Challenge } from './WeeklyChallenges';

interface ChallengeListCardProps {
    challenge: Challenge;
    endDate?: string;
}

export const ChallengeListCard: React.FC<ChallengeListCardProps> = ({ challenge, endDate }) => {
    const percent = Math.min(100, Math.floor((challenge.progress / challenge.target) * 100));
    
    // Calculate remaining time
    const getRemainingTime = () => {
        if (challenge.completed) return '已完成';
        if (!endDate) return '';
        
        const end = new Date(endDate).getTime();
        const now = new Date().getTime();
        const diff = end - now;
        
        if (diff <= 0) return '已结束';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days}天 ${hours}小时 剩余`;
        return `${hours}小时 ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}分钟 剩余`;
    };

    const remainingText = getRemainingTime();
    const isUrgent = remainingText.includes('小时') && !remainingText.includes('天');
    const isOverdue = remainingText === '已结束';

    // Get Icon based on title
    const getIconConfig = (title: string) => {
        if (title.includes('光影') || title.includes('记录')) return { color: 'bg-blue-100 text-blue-600', Icon: Moon };
        if (title.includes('城市') || title.includes('建筑')) return { color: 'bg-cyan-100 text-cyan-600', Icon: Building2 };
        if (title.includes('人像') || title.includes('互动') || title.includes('社区')) return { color: 'bg-indigo-100 text-indigo-600', Icon: Users };
        if (title.includes('上传') || title.includes('拍摄')) return { color: 'bg-purple-100 text-purple-600', Icon: Camera };
        return { color: 'bg-orange-100 text-orange-600', Icon: Trophy };
    };

    const { color: iconColor, Icon } = getIconConfig(challenge.title);

    return (
        <div className="glass-panel rounded-3xl p-6 group hover:scale-[1.01] transition-all duration-300">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Icon Area */}
                <div className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center glass-card shadow-inner ${iconColor}`}>
                    <Icon className="w-8 h-8" />
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{challenge.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">{challenge.description}</p>
                        </div>
                        
                        {/* Status Tag */}
                        {!challenge.completed && !isOverdue && (
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm ${
                                isUrgent 
                                    ? 'bg-red-100/50 text-red-600 dark:bg-red-500/10 dark:text-red-400' 
                                    : 'bg-blue-100/50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                            }`}>
                                <Clock className="w-3.5 h-3.5" />
                                {remainingText}
                            </div>
                        )}
                        {challenge.completed && (
                            <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100/50 text-green-600 dark:bg-green-500/10 dark:text-green-400 flex items-center gap-1.5 backdrop-blur-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                已完成
                            </div>
                        )}
                         {isOverdue && !challenge.completed && (
                            <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100/50 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 flex items-center gap-1.5 backdrop-blur-sm">
                                <Clock className="w-3.5 h-3.5" />
                                已过期
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold">
                            <span className="text-blue-600 dark:text-blue-400">当前进度 {challenge.progress} / {challenge.target}</span>
                            <span className="text-gray-900 dark:text-white">{percent}%</span>
                        </div>
                        <div className="h-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-full overflow-hidden border border-white/10">
                            <div 
                                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>

                    {/* Rewards */}
                    <div className="pt-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-400 dark:text-gray-500">完成奖励:</span>
                        <div className="flex items-center gap-4">
                            {/* Gold (Mock) */}
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                                <div className="w-5 h-5 rounded-full bg-blue-100/50 dark:bg-blue-500/10 flex items-center justify-center text-[10px] backdrop-blur-sm">$</div>
                                <span>{challenge.reward * 2} 金币</span>
                            </div>
                            {/* EXP */}
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                                <Zap className="w-4 h-4 fill-blue-600 dark:fill-blue-400" />
                                <span>{challenge.reward} EXP</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
