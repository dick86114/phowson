import React, { useMemo } from 'react';

type MiniHeatmapProps = {
  data: Record<string, number>;
  className?: string;
};

type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

const getLevel = (count: number): HeatmapLevel => {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

const getColor = (level: HeatmapLevel) => {
  const colors = [
    'bg-white/10 dark:bg-white/5',
    'bg-green-500/30',
    'bg-green-500/50',
    'bg-green-500/70',
    'bg-green-500',
  ];
  return colors[level];
};

export const MiniHeatmap: React.FC<MiniHeatmapProps> = ({ data, className = '' }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11

  const monthData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    
    const days = [];
    
    // Padding for empty cells
    for (let j = 0; j < firstDay; j++) {
      days.push(null);
    }
    
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        count: data?.[dateStr] || 0,
        level: getLevel(data?.[dateStr] || 0),
        isToday: d === today.getDate(),
      });
    }

    return days;
  }, [data, year, month]);

  return (
    <div className={`grid grid-cols-7 gap-1 ${className}`}>
      {/* Grid */}
      {monthData.map((day, idx) => (
        <div 
          key={idx}
          className={`
            w-2 h-2 rounded-[2px] transition-all duration-300
            ${day ? getColor(day.level) : 'bg-transparent'}
            ${day?.isToday ? 'ring-1 ring-white shadow-[0_0_4px_rgba(255,255,255,0.5)]' : ''}
          `}
          title={day ? `${day.date}: ${day.count} photos` : ''}
        />
      ))}
    </div>
  );
};
