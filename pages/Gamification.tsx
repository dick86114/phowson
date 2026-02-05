import React from 'react';
import { Camera, Trophy, Flame, ArrowLeft } from 'lucide-react';
import { GamificationPanel } from '../components/Gamification';

export const Gamification: React.FC = () => {
  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto bg-background-light dark:bg-background-dark transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">成就与挑战</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            记录你的摄影旅程，解锁徽章，完成每周挑战。坚持上传照片，获得 XP 奖励。
          </p>
        </div>

        <GamificationPanel />
      </div>
    </main>
  );
};
