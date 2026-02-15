import React from 'react';
import { BarChart3, Trophy, Lightbulb, ChevronRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatsCardProps {
    totalCompleted: number;
    winRate: number;
}

export const ChallengeStatsCard: React.FC<StatsCardProps> = ({ totalCompleted, winRate }) => {
    return (
        <div className="glass-panel rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-xl bg-blue-100/50 dark:bg-blue-500/10 text-blue-600 backdrop-blur-sm">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">个人挑战统计</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{totalCompleted}</div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">累计完成挑战</div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{winRate}%</div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">本月挑战胜率</div>
                </div>
            </div>
        </div>
    );
};

interface RecentRewardProps {
    badges: any[];
}

export const RecentRewardsCard: React.FC<RecentRewardProps> = ({ badges }) => {
    return (
        <div className="glass-panel rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-xl bg-blue-100/50 dark:bg-blue-500/10 text-blue-600 backdrop-blur-sm">
                    <Trophy className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">最近获得的奖励</h3>
            </div>

            <div className="space-y-6 mb-6">
                {badges.slice(0, 2).map((badge) => (
                    <div key={badge.id} className="flex items-center gap-3 p-3 glass-card">
                        <div className="w-10 h-10 bg-white/50 dark:bg-white/10 rounded-xl flex items-center justify-center shadow-sm text-2xl backdrop-blur-md">
                            {badge.icon || '🏆'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{badge.name}</h4>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                解锁于 {new Date(badge.earned_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                ))}
                {badges.length === 0 && (
                     <div className="text-center py-4 text-gray-400 text-sm">暂无最近奖励</div>
                )}
            </div>

            <Link 
                to="/gamification/history"
                className="w-full py-3 bg-blue-100/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold rounded-2xl text-sm hover:bg-blue-200/50 dark:hover:bg-blue-500/20 transition-colors text-center block backdrop-blur-sm"
            >
                查看详细挑战报告
            </Link>
        </div>
    );
};

export const ChallengeTipsCard: React.FC = () => {
    return (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden backdrop-blur-xl border border-white/20">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 animate-pulse" />
            
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-xl bg-white/20 backdrop-blur-sm">
                        <Lightbulb className="w-5 h-5 text-yellow-300" />
                    </div>
                    <h3 className="font-bold text-lg">挑战小贴士</h3>
                </div>
                
                <p className="text-blue-100 text-sm leading-relaxed mb-1">
                    每周一 00:00 准时发布新一轮挑战。
                </p>
                <p className="text-blue-100 text-sm leading-relaxed">
                    连续 4 周完成所有每周挑战，即可获得本月专属限定摄影师徽章！
                </p>
            </div>
        </div>
    );
};
