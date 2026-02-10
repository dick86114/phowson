import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { LevelCard } from './gamification/LevelCard';
import { WeeklyChallenges, Challenge as UIChallenge } from './gamification/WeeklyChallenges';
import { MilestoneList, Milestone } from './gamification/MilestoneList';
import { calculateLevel } from '../utils/gamificationUtils';

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  icon_color: string;
  condition_type: string;
  xp_reward: number;
  earned_at?: string;
};

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

type GamificationStats = {
  totalBadges: number;
  totalXp: number;
  completedChallenges: number;
  activeChallenges: number;
};

export const GamificationPanel: React.FC = () => {
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

  const { data: stats } = useQuery<GamificationStats>({
    queryKey: ['gamification', 'stats'],
    queryFn: async () => {
      const res = await api.get<GamificationStats>('/gamification/stats');
      return res.data;
    },
  });

  const levelInfo = useMemo(() => calculateLevel(stats?.totalXp || 0), [stats?.totalXp]);

  const weeklyChallenges = useMemo<UIChallenge[]>(() => {
    return myChallenges.filter(c => !c.completed_at).map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      progress: c.current_value || 0,
      target: c.target_value || 100,
      reward: c.xp_reward,
      type: c.challenge_type,
      completed: !!c.completed_at,
    }));
  }, [myChallenges]);

  const milestones = useMemo<Milestone[]>(() => {
    const list: Milestone[] = [];

    // Badges
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

    // Completed Challenges
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

    // Sort by date desc
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [myBadges, myChallenges]);

  return (
    <div className="space-y-8 animate-fade-in">
      <LevelCard levelInfo={levelInfo} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <WeeklyChallenges challenges={weeklyChallenges} />
        </div>
        <div>
          <MilestoneList milestones={milestones} />
        </div>
      </div>
    </div>
  );
};
