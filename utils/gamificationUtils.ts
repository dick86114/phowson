
export interface LevelInfo {
    level: number;
    title: string;
    titleEn: string;
    description: string;
    currentLevelXp: number;
    nextLevelThreshold: number;
    progressPercent: number;
    totalXp: number;
}

export const calculateLevel = (totalXp: number): LevelInfo => {
    let level = 1;
    let xp = totalXp;
    let required = 100; // Level 1 requires 100 XP to pass

    // Simple progressive curve: Level N requires (N * 200) XP
    // Or closer to design: Level 24 needs ~5000. 
    // Let's use: Required = Level * 200.
    
    while (xp >= required) {
        xp -= required;
        level++;
        required = level * 200;
    }

    // Determine title
    let title = '初级摄影师';
    let titleEn = 'Novice Photographer';
    let description = '你的镜头刚刚开始探索这个世界。';

    if (level >= 5) {
        title = '进阶探索者';
        titleEn = 'Advanced Explorer';
        description = '你已经发现了光影的奥秘，继续前行吧！';
    }
    if (level >= 10) {
        title = '资深记录者';
        titleEn = 'Senior Chronicler';
        description = '你的作品记录了时光的痕迹。';
    }
    if (level >= 20) {
        title = '高级叙事者';
        titleEn = 'Master Storyteller';
        description = '你的快门记录了城市的灵魂，继续前行吧！';
    }
    if (level >= 30) {
        title = '影像大师';
        titleEn = 'Visionary Master';
        description = '你用光影书写传奇。';
    }

    return {
        level,
        title,
        titleEn,
        description,
        currentLevelXp: xp,
        nextLevelThreshold: required,
        progressPercent: Math.min(100, Math.floor((xp / required) * 100)),
        totalXp
    };
};
