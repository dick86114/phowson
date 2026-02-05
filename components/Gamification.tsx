import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { Camera, Image as ImageIcon, Aperture, Flame, Zap, Mountain, User, Compass, Heart, Award, Trophy, Calendar, CheckCircle2, Lock } from 'lucide-react';
import { useModal } from './Modal';

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

type Challenge = {
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
};

type GamificationStats = {
  totalBadges: number;
  totalXp: number;
  completedChallenges: number;
  activeChallenges: number;
};

const iconMap: Record<string, any> = {
  camera: Camera,
  image: ImageIcon,
  aperture: Aperture,
  flame: Flame,
  zap: Zap,
  mountain: Mountain,
  user: User,
  compass: Compass,
  heart: Heart,
};

const BadgeIcon = ({ icon, color, size = 32 }: { icon: string; color: string; size?: number }) => {
  const IconComponent = iconMap[icon] || Award;
  return <IconComponent size={size} style={{ color }} />;
};

export const GamificationPanel: React.FC = () => {
  const { alert } = useModal();
  const { data: allBadges = [] } = useQuery<Badge[]>({
    queryKey: ['gamification', 'badges'],
    queryFn: async () => {
      const res = await api.get<Badge[]>('/gamification/badges');
      return res.data;
    },
  });

  const { data: myBadges = [] } = useQuery<Badge[]>({
    queryKey: ['gamification', 'badges', 'my'],
    queryFn: async () => {
      const res = await api.get<Badge[]>('/gamification/badges/my');
      return res.data;
    },
  });

  const { data: challenges = [] } = useQuery<Challenge[]>({
    queryKey: ['gamification', 'challenges'],
    queryFn: async () => {
      const res = await api.get<Challenge[]>('/gamification/challenges');
      return res.data;
    },
  });

  const { data: myChallenges = [] } = useQuery<Challenge[]>({
    queryKey: ['gamification', 'challenges', 'my'],
    queryFn: async () => {
      const res = await api.get<Challenge[]>('/gamification/challenges/my');
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

  const earnedBadgeIds = new Set(myBadges.map((b) => b.id));
  const joinedChallengeIds = new Set(myChallenges.map((c) => c.id));

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await api.post(`/gamification/challenges/${challengeId}/join`);
      alert({ title: '成功', content: '已加入挑战！' });
      window.location.reload();
    } catch (err) {
      alert({ title: '失败', content: '加入失败，请重试' });
    }
  };

  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-surface-border pb-4">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">成就统计</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats?.totalBadges || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">徽章</div>
          </div>
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.totalXp || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">XP</div>
          </div>
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats?.completedChallenges || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">完成挑战</div>
          </div>
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.activeChallenges || 0}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">进行中</div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-surface-border pb-4">
          <Award className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">我的徽章</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {allBadges.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);
            const myBadge = myBadges.find((b) => b.id === badge.id);

            return (
              <div
                key={badge.id}
                className={`relative rounded-xl p-6 shadow-sm transition-colors ${
                  earned
                    ? 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border hover:border-primary/50'
                    : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border opacity-60'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                      earned ? 'bg-gray-100 dark:bg-black/30' : 'bg-gray-100 dark:bg-black/30'
                    }`}
                  >
                    {earned ? (
                      <BadgeIcon icon={badge.icon} color={badge.icon_color} size={32} />
                    ) : (
                      <Lock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg">{badge.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{badge.description}</div>
                  {earned && (
                    <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 font-medium">
                      +{badge.xp_reward} XP
                    </div>
                  )}
                  {!earned && (
                    <div className="text-sm text-gray-400 dark:text-gray-500 mt-2">未解锁</div>
                  )}
                  {myBadge?.earned_at && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(myBadge.earned_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {earned && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="text-green-500 w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-surface-border pb-4">
          <Calendar className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">本周挑战</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => {
            const joined = joinedChallengeIds.has(challenge.id);
            const myChallenge = myChallenges.find((c) => c.id === challenge.id);
            const completed = myChallenge?.completed_at;

            const daysLeft = Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={challenge.id}
                className={`relative rounded-xl p-6 border shadow-sm transition-colors ${
                  completed
                    ? 'bg-white dark:bg-surface-dark border border-green-200 dark:border-green-800'
                    : joined
                    ? 'bg-white dark:bg-surface-dark border border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border hover:border-primary/50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{challenge.title}</h3>
                  {completed && (
                    <CheckCircle2 className="text-green-500 w-5 h-5 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{challenge.description}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    +{challenge.xp_reward} XP
                  </div>
                  {daysLeft >= 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {daysLeft} 天后结束
                    </div>
                  )}
                  {daysLeft < 0 && (
                    <div className="text-sm text-red-500">已结束</div>
                  )}
                </div>
                {!joined && !completed && daysLeft >= 0 && (
                  <button
                    onClick={() => handleJoinChallenge(challenge.id)}
                    className="w-full mt-3 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg font-medium transition-colors"
                  >
                    加入挑战
                  </button>
                )}
                {joined && !completed && (
                  <div className="text-sm text-blue-600 dark:text-blue-400 mt-3 text-center font-medium">
                    进行中
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {challenges.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            暂无可用挑战
          </div>
        )}
      </section>
    </div>
  );
};
