import React, { useMemo } from 'react';

type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

type HeatmapData = {
  day: string;
  count: number;
  level: HeatmapLevel;
};

type HeatmapProps = {
  data: Record<string, number>;
  startDate: string;
  endDate: string;
  onDayClick?: (day: string, count: number) => void;
};

const getLevel = (count: number): HeatmapLevel => {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

const getColor = (level: HeatmapLevel) => {
  const colors = [
    'bg-gray-100 dark:bg-[#1e293b]',
    'bg-green-200 dark:bg-green-900/40',
    'bg-green-300 dark:bg-green-800/60',
    'bg-green-400 dark:bg-green-700',
    'bg-green-500 dark:bg-green-600',
  ];
  return colors[level];
};

const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const parseDate = (iso: string) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, days: number) => {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
};

const weeksBetween = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
};

export const Heatmap: React.FC<HeatmapProps> = ({ data, startDate, endDate, onDayClick }) => {
  const heatmapData = useMemo(() => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const weeks = weeksBetween(start, end);
    
    const days: HeatmapData[] = [];
    let current = start;
    
    while (current <= end) {
      const day = formatDate(current);
      const count = data[day] ?? 0;
      days.push({
        day,
        count,
        level: getLevel(count),
      });
      current = addDays(current, 1);
    }
    
    return { days, weeks };
  }, [data, startDate, endDate]);

  const { days, weeks } = heatmapData;

  const weeksArray: HeatmapData[][] = [];
  for (let i = 0; i < weeks; i++) {
    const weekDays: HeatmapData[] = [];
    for (let j = 0; j < 7; j++) {
      const index = i * 7 + j;
      if (index < days.length) {
        weekDays.push(days[index]);
      }
    }
    weeksArray.push(weekDays);
  }

  const getFirstDayOfWeek = (weekIndex: number) => {
    const index = weekIndex * 7;
    if (index >= days.length) return null;
    return days[index].day;
  };

  const getMonthLabels = () => {
    const months: Array<{ month: string; weekIndex: number }> = [];
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const monthName = monthNames[current.getMonth()];
      const weekIndex = Math.floor((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      months.push({ month: monthName, weekIndex });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const monthLabels = getMonthLabels();

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[720px] px-4 py-6 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-surface-border">
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 text-xs text-gray-400 dark:text-gray-500 pt-5">
            {dayNames.map((day) => (
              <div key={day} className="h-[10px] flex items-center">
                {day}
              </div>
            ))}
          </div>
          
          <div className="flex-1 overflow-hidden">
            <div className="flex mb-2 relative">
              <div className="flex flex-1">
                {monthLabels.map(({ month, weekIndex }) => (
                  <div
                    key={`${month}-${weekIndex}`}
                    className="absolute text-xs text-gray-500 dark:text-gray-400"
                    style={{ left: `${weekIndex * 12 + 1}px` }}
                  >
                    {month}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-[2px]">
              {weeksArray.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((dayData) => (
                    <div
                      key={dayData.day}
                      className={`w-[10px] h-[10px] rounded-sm cursor-pointer transition-transform hover:scale-110 ${getColor(dayData.level)}`}
                      title={`${dayData.day}: ${dayData.count} 张照片`}
                      onClick={() => onDayClick?.(dayData.day, dayData.count)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-[10px] h-[10px] rounded-sm ${getColor(level as HeatmapLevel)}`}
            />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  );
};
