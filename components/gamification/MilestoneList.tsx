import React from 'react';
import { Trophy, TrendingUp, Heart, CheckSquare, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Milestone {
    id: string;
    date: string;
    title: string;
    description: string;
    type: 'badge' | 'level' | 'like' | 'challenge';
}

interface MilestoneListProps {
    milestones: Milestone[];
    limit?: number;
}

export const MilestoneList: React.FC<MilestoneListProps> = ({ milestones, limit = 4 }) => {
    const displayMilestones = limit > 0 ? milestones.slice(0, limit) : milestones;
    const hasMore = limit > 0 && milestones.length > limit;

    const getIcon = (type: Milestone['type']) => {
        switch (type) {
            case 'badge': return <Trophy className="w-4 h-4 text-white" />;
            case 'level': return <TrendingUp className="w-4 h-4 text-white" />;
            case 'like': return <Heart className="w-4 h-4 text-white" />;
            case 'challenge': return <CheckSquare className="w-4 h-4 text-white" />;
        }
    };

    const getBgColor = (type: Milestone['type']) => {
        switch (type) {
            case 'badge': return 'bg-yellow-500';
            case 'level': return 'bg-primary';
            case 'like': return 'bg-red-500';
            case 'challenge': return 'bg-green-500';
        }
    };

    return (
        <div className="glass-panel rounded-2xl p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">最近里程碑</h3>
            </div>

            <div className="flex-1 relative space-y-8">
                {/* Vertical Line */}
                <div className="absolute top-2 bottom-2 left-[15px] w-0.5 bg-gray-200/50 dark:bg-gray-700/50" />

                {displayMilestones.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400 text-sm py-4 pl-8">暂无里程碑记录，快去上传照片吧！</div>
                ) : (
                    displayMilestones.map((item) => (
                        <div key={item.id} className="relative flex gap-4 group">
                            <div className={`relative z-10 w-8 h-8 rounded-full ${getBgColor(item.type)} flex items-center justify-center shrink-0 ring-4 ring-white/20 dark:ring-white/5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                {getIcon(item.type)}
                            </div>
                            <div className="pt-1 group-hover:translate-x-1 transition-transform duration-300">
                                <div className="text-xs text-gray-400 mb-1">{item.date}</div>
                                <div className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {hasMore && (
                <Link to="/gamification/history" className="mt-6 w-full py-3 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold rounded-2xl text-sm hover:bg-white/80 dark:hover:bg-white/10 transition-all text-center block shadow-sm hover:shadow-md">
                    查看完整旅程
                </Link>
            )}
        </div>
    );
};
