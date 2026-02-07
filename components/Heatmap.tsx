import React, { useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';

type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

type HeatmapProps = {
  data: Record<string, number>;
  year: number;
  onYearChange: (year: number) => void;
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

// Helper to get days in a month
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

// Helper to get day of week for the 1st of the month (0-6, 0 is Sunday)
const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export const Heatmap: React.FC<HeatmapProps & { variant?: 'scroll' | 'grid' }> = ({ 
  data, 
  year, 
  onYearChange,
  variant = 'scroll'
}) => {
  const currentYear = new Date().getFullYear();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const daysInMonth = getDaysInMonth(year, i);
      const firstDay = getFirstDayOfMonth(year, i);
      const days = [];
      
      // Padding for empty cells before 1st day
      for (let j = 0; j < firstDay; j++) {
        days.push(null);
      }
      
      // Actual days
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(i + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({
          date: dateStr,
          day: d,
          count: data[dateStr] || 0,
          level: getLevel(data[dateStr] || 0),
        });
      }
      
      return {
        name: monthNames[i],
        fullDate: `${year}年${monthNames[i]}`,
        days,
      };
    });
  }, [year, data]);

  // Auto-scroll to current month (only for scroll variant)
  React.useEffect(() => {
    if (variant === 'scroll' && scrollContainerRef.current) {
      if (year === currentYear) {
        const currentMonth = new Date().getMonth();
        const cardWidth = 160; // w-40
        const gap = 8; // gap-2
        // Scroll to current month
        scrollContainerRef.current.scrollLeft = currentMonth * (cardWidth + gap);
      } else {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }
  }, [year, currentYear, variant]);

  // Drag to scroll logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (variant === 'grid') return;
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || variant === 'grid') return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2; // Scroll speed multiplier
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="text-primary w-4 h-4" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">上传热力图</h3>
        </div>
        
        {/* Year Switcher */}
        <div className="flex bg-gray-100 dark:bg-surface-dark rounded-md p-0.5 border border-gray-200 dark:border-surface-border">
          <button
            onClick={() => onYearChange(currentYear - 1)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              year === currentYear - 1
                ? 'bg-white dark:bg-surface-border text-primary shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {currentYear - 1}年
          </button>
          <button
            onClick={() => onYearChange(currentYear)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              year === currentYear
                ? 'bg-white dark:bg-surface-border text-primary shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {currentYear}年
          </button>
        </div>
      </div>

      {/* Heatmap Container */}
      <div 
        ref={scrollContainerRef}
        className={variant === 'scroll' 
          ? "w-full overflow-x-auto cursor-grab active:cursor-grabbing no-scrollbar select-none"
          : "w-full"
        }
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className={variant === 'scroll' 
          ? "flex gap-2 pb-2 min-w-max"
          : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        }>
          {months.map((month) => (
            <div 
              key={month.name}
              className={`${variant === 'scroll' ? 'w-40' : 'w-full'} bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-surface-border p-3 flex-shrink-0`}
            >
              <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2">
                {month.fullDate}
              </h4>
              
              <div className="grid grid-cols-7 gap-1">
                {/* Day Headers */}
                {dayNames.map(d => (
                  <div key={d} className="text-[10px] text-gray-400 text-center mb-1">
                    {d}
                  </div>
                ))}
                
                {/* Days */}
                {month.days.map((day, idx) => (
                  <div key={idx} className="aspect-square">
                    {day ? (
                      <div
                        className={`w-full h-full rounded-[2px] transition-transform hover:scale-110 ${getColor(day.level)}`}
                        title={`${day.date}: ${day.count} 张照片`}
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-gray-400">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`w-3 h-3 rounded-[1px] ${getColor(level as HeatmapLevel)}`}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
};
