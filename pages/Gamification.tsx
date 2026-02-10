import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../hooks/useAuth';
import { calculateLevel } from '../utils/gamificationUtils';
import { LevelCard } from '../components/gamification/LevelCard';
import { MilestoneList, Milestone } from '../components/gamification/MilestoneList';
import { WeeklyChallenges, Challenge } from '../components/gamification/WeeklyChallenges';
import { BadgeGallery, Badge } from '../components/gamification/BadgeGallery';

export const Gamification: React.FC = () => {
    const { user } = useAuth();

    // 1. Fetch Stats (XP)
    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['gamification-stats'],
        queryFn: async () => {
            const res = await api.get('/gamification/stats');
            return res.data;
        },
        enabled: !!user
    });

    // 2. Fetch All Badges
    const { data: allBadges, isLoading: isLoadingAllBadges } = useQuery({
        queryKey: ['gamification-badges'],
        queryFn: async () => {
            const res = await api.get('/gamification/badges');
            return res.data;
        }
    });

    // 3. Fetch My Badges
    const { data: myBadges, isLoading: isLoadingMyBadges } = useQuery({
        queryKey: ['gamification-badges-my'],
        queryFn: async () => {
            const res = await api.get('/gamification/badges/my');
            return res.data;
        },
        enabled: !!user
    });

    // 4. Fetch Active Challenges
    const { data: activeChallenges, isLoading: isLoadingChallenges } = useQuery({
        queryKey: ['gamification-challenges'],
        queryFn: async () => {
            const res = await api.get('/gamification/challenges');
            return res.data;
        }
    });

    // 5. Fetch My Challenges Progress
    const { data: myChallenges, isLoading: isLoadingMyChallenges } = useQuery({
        queryKey: ['gamification-challenges-my'],
        queryFn: async () => {
            const res = await api.get('/gamification/challenges/my');
            return res.data;
        },
        enabled: !!user
    });

    const isLoading = isLoadingStats || isLoadingAllBadges || isLoadingMyBadges || isLoadingChallenges || isLoadingMyChallenges;

    // Process Data
    const levelInfo = useMemo(() => {
        return calculateLevel(stats?.totalXp || 0);
    }, [stats]);

    const milestones = useMemo(() => {
        if (!myBadges && !myChallenges) return [];
        
        const list: Milestone[] = [];

        // Badges
        myBadges?.forEach((b: any) => {
            if (b.earned_at) {
                list.push({
                    id: `badge-${b.id}`,
                    date: new Date(b.earned_at).toLocaleDateString(),
                    title: `获得徽章：${b.name}`,
                    description: b.description,
                    type: 'badge'
                });
            }
        });

        // Completed Challenges
        myChallenges?.forEach((c: any) => {
            if (c.completed_at) {
                list.push({
                    id: `challenge-${c.id}`,
                    date: new Date(c.completed_at).toLocaleDateString(),
                    title: `完成挑战：${c.title}`,
                    description: `获得 ${c.xp_reward} XP`,
                    type: 'challenge'
                });
            }
        });

        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [myBadges, myChallenges]);

    const challengesDisplay = useMemo(() => {
        if (!activeChallenges) return [];
        
        return activeChallenges.map((c: any) => {
            const myProgress = myChallenges?.find((mc: any) => mc.id === c.id);
            
            // Use real progress from backend if available
            const current = myProgress?.current_value || 0;
            // Target priority: myProgress target (from DB) > config target > 100 default
            let target = myProgress?.target_value;
            if (!target) {
                if (c.challenge_type === 'upload_category') target = c.config?.min_photos;
                else if (c.challenge_type === 'daily_upload') target = c.config?.min_days;
                else target = 100;
            }

            return {
                id: c.id,
                title: c.title,
                description: c.description,
                progress: current,
                target: Number(target),
                reward: c.xp_reward,
                type: c.challenge_type,
                completed: !!myProgress?.completed_at
            };
        });
    }, [activeChallenges, myChallenges]);

    const badgesDisplay = useMemo(() => {
        if (!allBadges) return [];
        return allBadges.map((b: any) => {
            const earned = myBadges?.find((mb: any) => mb.id === b.id);
            return {
                id: b.id,
                name: b.name,
                description: b.description,
                icon: b.icon,
                unlocked: !!earned,
                earnedAt: earned?.earned_at
            };
        });
    }, [allBadges, myBadges]);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-4 dark:text-white">请先登录</h2>
                    <p className="text-gray-500 dark:text-gray-400">查看您的成就需要登录账号</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b1218] transition-colors duration-300 pb-20">
            {/* Header / Nav is handled by App Layout, but design shows sub-nav. 
                We'll stick to App Layout's header and just implement the content area styled as requested. 
            */}
            
            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Main Content */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Level Card */}
                        <LevelCard levelInfo={levelInfo} />

                        {/* Weekly Challenges */}
                        <WeeklyChallenges challenges={challengesDisplay} />
                        
                        {/* Badge Gallery */}
                        <BadgeGallery badges={badgesDisplay} />
                    </div>

                    {/* Right Sidebar */}
                    <div className="lg:col-span-4 space-y-8">
                        <MilestoneList milestones={milestones} />
                    </div>
                </div>
            </main>
        </div>
    );
};
