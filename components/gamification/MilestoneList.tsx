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
        <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-surface-border h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">最近里程碑</h3>
            </div>

            <div className="flex-1 relative space-y-8">
                {/* Vertical Line */}
                <div className="absolute top-2 bottom-2 left-[15px] w-0.5 bg-gray-100 dark:bg-gray-700" />

                {displayMilestones.length === 0 ? (
                    <div className="text-gray-400 text-sm py-4 pl-8">暂无里程碑记录，快去上传照片吧！</div>
                ) : (
                    displayMilestones.map((item) => (
                        <div key={item.id} className="relative flex gap-4">
                            <div className={`relative z-10 w-8 h-8 rounded-full ${getBgColor(item.type)} flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-surface-dark`}>
                                {getIcon(item.type)}
                            </div>
                            <div className="pt-1">
                                <div className="text-xs text-gray-400 mb-1">{item.date}</div>
                                <div className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {hasMore && (
                <Link to="/gamification/history" className="mt-6 w-full py-3 bg-gray-50 dark:bg-surface-border/50 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-surface-border transition-colors text-center block">
                    查看完整旅程
                </Link>
            )}
        </div>
    );
};
