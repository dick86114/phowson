import { pool } from '../db.mjs';
import { requireMember } from '../plugins/rbac.mjs';
import { getAllBadges, getUserBadges, checkAndAwardBadges, seedBadges } from '../db/badges.mjs';
import { getActiveChallenges, getUserChallenges, getUserChallengesWithProgress, joinChallenge, checkChallengeCompletion, seedWeeklyChallenges, recalculateChallengeProgress } from '../db/challenges.mjs';

export const registerGamificationRoutes = async (app) => {
  app.addHook('onReady', async () => {
    try {
      await seedBadges();
      await seedWeeklyChallenges();
    } catch (e) {
      app.log.warn({ err: e }, 'gamification seeding skipped');
    }
  });

  app.get('/gamification/badges', async () => {
    return await getAllBadges();
  });

  app.get('/gamification/badges/my', { preHandler: requireMember() }, async (req) => {
    return await getUserBadges(req.authUser.id);
  });

  app.post('/gamification/badges/check', { preHandler: requireMember() }, async (req) => {
    const newlyEarned = await checkAndAwardBadges(req.authUser.id);
    return { newlyEarned, count: newlyEarned.length };
  });

  app.get('/gamification/challenges', async () => {
    return await getActiveChallenges();
  });

  app.get('/gamification/challenges/my', { preHandler: requireMember() }, async (req) => {
    return await getUserChallengesWithProgress(req.authUser.id);
  });

  app.post('/gamification/challenges/:challengeId/join', {
    preHandler: requireMember(),
    schema: {
      params: {
        type: 'object',
        required: ['challengeId'],
        properties: { challengeId: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req) => {
      const challengeId = String(req.params.challengeId);
      await joinChallenge(req.authUser.id, challengeId);
      await recalculateChallengeProgress(req.authUser.id, challengeId);
      return { success: true };
    },
  });

  app.post('/gamification/challenges/:challengeId/progress', { preHandler: requireMember() }, async (req) => {
    const challengeId = String(req.params.challengeId);
    const { progressType, currentValue, targetValue } = req.body || {};

    if (!progressType || currentValue === undefined || targetValue === undefined) {
      throw { code: 'INVALID_PROGRESS', message: '缺少进度参数' };
    }

    const result = await checkChallengeCompletion(req.authUser.id, challengeId);
    return result;
  });

  app.get('/gamification/stats', { preHandler: requireMember() }, async (req) => {
    const userId = req.authUser.id;

    const badges = await getUserBadges(userId);
    const challenges = await getUserChallenges(userId);

    const totalXp = badges.reduce((sum, b) => sum + (b.xp_reward || 0), 0);

    const completedChallenges = challenges.filter((c) => c.completed_at).length;
    const activeChallenges = challenges.filter((c) => !c.completed_at).length;

    return {
      totalBadges: badges.length,
      totalXp,
      completedChallenges,
      activeChallenges,
    };
  });
};
