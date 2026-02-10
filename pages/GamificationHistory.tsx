import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { MilestoneList, Milestone } from '../components/gamification/MilestoneList';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type Badge = {
    id: string;
    name: string;
    description: string;
    earned_at?: string;
};

type APIChallenge = {
    id: string;
    title: string;
    xp_reward: number;
    completed_at?: string;
};

export const GamificationHistory: React.FC = () => {
    const { data: myBadges = [] } = useQuery<Badge[]>({
        queryKey: ['gamification', 'badges', 'my'],
        queryFn: async () => {
            const res = await api.get<Badge[]>('/gamification/badges/my');
            return res.data;
        },
    });

    const { data: myChallenges = [] } = useQuery<APIChallenge[]>({
        queryKey: ['gamification', 'challenges', 'my'],
        queryFn: async () => {
            const res = await api.get<APIChallenge[]>('/gamification/challenges/my');
            return res.data;
        },
    });

    const milestones = useMemo<Milestone[]>(() => {
        const list: Milestone[] = [];

        myBadges.forEach(b => {
            if (b.earned_at) {
                list.push({
                    id: `badge-${b.id}`,
                    date: new Date(b.earned_at).toLocaleDateString(),
                    title: `获得徽章：${b.name}`,
                    description: b.description,
                    type: 'badge',
                });
            }
        });

        myChallenges.forEach(c => {
            if (c.completed_at) {
                list.push({
                    id: `challenge-${c.id}`,
                    date: new Date(c.completed_at).toLocaleDateString(),
                    title: `完成挑战：${c.title}`,
                    description: `获得 ${c.xp_reward} XP`,
                    type: 'challenge',
                });
            }
        });

        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [myBadges, myChallenges]);

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <Link to="/gamification" className="p-2 hover:bg-gray-100 dark:hover:bg-surface-border rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">完整旅程</h1>
            </div>

            <MilestoneList milestones={milestones} limit={0} />
        </div>
    );
};