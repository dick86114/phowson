import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { Challenge as UIChallenge } from '../components/gamification/WeeklyChallenges';
import { ChallengeListCard } from '../components/gamification/ChallengeListCard';
import { ChallengeStatsCard, RecentRewardsCard, ChallengeTipsCard } from '../components/gamification/ChallengeSidebar';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type APIChallenge = {
    id: string;
    title: string;
    description: string;
    challenge_type: string;
    config: any;
    start_date: string;
    end_date: string;
    xp_reward: number;
    joined_at?: string;
    completed_at?: string;
    current_value?: number;
    target_value?: number;
};

type TabType = 'active' | 'completed' | 'expired';

export const ChallengesPage: React.FC = () => {
    const [currentTab, setCurrentTab] = useState<TabType>('active');

    // Fetch Active Challenges
    const { data: activeChallenges = [] } = useQuery<APIChallenge[]>({
        queryKey: ['gamification', 'challenges', 'active'],
        queryFn: async () => {
            const res = await api.get<APIChallenge[]>('/gamification/challenges');
            return res.data;
        },
    });

    // Fetch My Challenges (Progress)
    const { data: myChallenges = [] } = useQuery<APIChallenge[]>({
        queryKey: ['gamification', 'challenges', 'my'],
        queryFn: async () => {
            const res = await api.get<APIChallenge[]>('/gamification/challenges/my');
            return res.data;
        },
    });

    // Fetch My Badges for Sidebar
    const { data: myBadges = [] } = useQuery({
        queryKey: ['gamification-badges-my'],
        queryFn: async () => {
            const res = await api.get('/gamification/badges/my');
            return res.data;
        }
    });

    // Fetch Stats for Sidebar
    const { data: stats } = useQuery({
        queryKey: ['gamification-stats'],
        queryFn: async () => {
            const res = await api.get('/gamification/stats');
            return res.data;
        }
    });

    const challenges = useMemo(() => {
        if (!activeChallenges.length && !myChallenges.length) return [];

        // Combine active challenges with user progress
        // Note: activeChallenges API only returns currently active ones.
        // myChallenges API returns all joined challenges (including historical ones).
        
        // We start with a map of all challenges to avoid duplicates
        const challengeMap = new Map<string, UIChallenge & { endDate: string }>();

        // 1. Add currently active challenges
        activeChallenges.forEach(c => {
             const myProgress = myChallenges.find(mc => mc.id === c.id);
             const current = myProgress?.current_value || 0;
             let target = myProgress?.target_value;
             if (!target) {
                 if (c.challenge_type === 'upload_category') target = c.config?.min_photos;
                 else if (c.challenge_type === 'daily_upload') target = c.config?.min_days;
                 else target = 100;
             }

             challengeMap.set(c.id, {
                id: c.id,
                title: c.title,
                description: c.description,
                progress: current,
                target: Number(target),
                reward: c.xp_reward,
                type: c.challenge_type,
                completed: !!myProgress?.completed_at,
                endDate: c.end_date
            });
        });

        // 2. Add historical challenges from myChallenges that might not be in active list
        myChallenges.forEach(c => {
            if (!challengeMap.has(c.id)) {
                challengeMap.set(c.id, {
                    id: c.id,
                    title: c.title,
                    description: c.description,
                    progress: c.current_value || 0,
                    target: c.target_value || 100, // Historical ones should have target_value from DB
                    reward: c.xp_reward,
                    type: c.challenge_type,
                    completed: !!c.completed_at,
                    endDate: c.end_date
                });
            }
        });

        return Array.from(challengeMap.values());
    }, [activeChallenges, myChallenges]);

    const filteredChallenges = useMemo(() => {
        const now = new Date().toISOString().slice(0, 10);
        
        return challenges.filter(c => {
            const isExpired = c.endDate < now;
            
            if (currentTab === 'completed') return c.completed;
            if (currentTab === 'active') return !c.completed && !isExpired;
            if (currentTab === 'expired') return !c.completed && isExpired;
            return true;
        });
    }, [challenges, currentTab]);

    // Calculate Win Rate
    const winRate = useMemo(() => {
        if (!stats) return 0;
        const total = stats.completedChallenges + stats.activeChallenges;
        if (total === 0) return 0;
        return Math.floor((stats.completedChallenges / total) * 100);
    }, [stats]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b1218] pb-20">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Breadcrumb-like Feel */}
                <div className="flex items-center gap-2 mb-8 text-sm text-gray-500">
                    <Link to="/gamification" className="hover:text-primary transition-colors">成就与挑战</Link>
                    <span>/</span>
                    <span className="text-gray-900 dark:text-gray-300 font-medium">全部挑战</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">每周挑战任务</h1>
                    
                    {/* Tabs */}
                    <div className="bg-white dark:bg-surface-dark p-1 rounded-full shadow-sm border border-gray-100 dark:border-surface-border inline-flex">
                        {(['active', 'completed', 'expired'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setCurrentTab(tab)}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                                    currentTab === tab
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-surface-border/50'
                                }`}
                            >
                                {tab === 'active' && '进行中'}
                                {tab === 'completed' && '已完成'}
                                {tab === 'expired' && '已过期'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Main Content - Challenge List */}
                    <div className="lg:col-span-8 space-y-6">
                        {filteredChallenges.length > 0 ? (
                            filteredChallenges.map(challenge => (
                                <ChallengeListCard 
                                    key={challenge.id} 
                                    challenge={challenge} 
                                    endDate={challenge.endDate} 
                                />
                            ))
                        ) : (
                            <div className="bg-white dark:bg-surface-dark rounded-3xl p-12 text-center border border-dashed border-gray-200 dark:border-surface-border">
                                <div className="text-gray-400 mb-2">暂无相关挑战</div>
                                <p className="text-sm text-gray-500">
                                    {currentTab === 'active' && '当前没有进行中的挑战，请稍后查看。'}
                                    {currentTab === 'completed' && '您还没有完成任何挑战，加油！'}
                                    {currentTab === 'expired' && '没有已过期的挑战。'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        <ChallengeStatsCard 
                            totalCompleted={stats?.completedChallenges || 0} 
                            winRate={winRate} 
                        />
                        
                        <RecentRewardsCard badges={myBadges} />
                        
                        <ChallengeTipsCard />
                    </div>
                </div>
            </div>
        </div>
    );
};