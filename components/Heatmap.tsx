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
    'bg-black/5 dark:bg-white/5',
    'bg-green-500/30 dark:bg-green-500/20',
    'bg-green-500/50 dark:bg-green-500/40',
    'bg-green-500/70 dark:bg-green-500/60',
    'bg-green-500 dark:bg-green-500',
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

export const Heatmap: React.FC<HeatmapProps & { variant?: 'scroll' | 'grid' | 'compact' }> = ({ 
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

  // Helper to determine cell size style based on variant
  const getCellClass = () => {
    if (variant === 'grid') return 'w-3 h-3'; // Smaller, refined for desktop modal
    return 'w-full h-full'; // Default fluid
  };

  const getContainerClass = () => {
    if (variant === 'scroll') return "flex gap-2 pb-2 min-w-max";
    if (variant === 'compact') return "grid grid-cols-3 gap-x-2 gap-y-4";
    // Grid variant (Desktop Modal): 3 columns (4 rows) or 4 columns (3 rows)
    return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";
  };
  
  const getCardClass = () => {
    if (variant === 'scroll') return 'w-40 glass-card rounded-2xl p-3 flex-shrink-0';
    if (variant === 'compact') return 'w-full flex-shrink-0';
    // Grid variant: Transparent background or very subtle
    return 'w-full bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl p-4 flex-shrink-0 hover:border-gray-200 dark:hover:border-white/10 transition-colors';
  };

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
    if (variant === 'grid' || variant === 'compact') return;
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
    if (!isDragging || variant === 'grid' || variant === 'compact') return;
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
          {variant !== 'compact' && (
            <>
              <Flame className="text-primary w-4 h-4" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">上传热力图</h3>
            </>
          )}
        </div>
        
        {/* Year Switcher */}
        <div className="flex bg-black/5 dark:bg-white/5 rounded-md p-0.5 border border-white/10">
          <button
            onClick={() => onYearChange(currentYear - 1)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              year === currentYear - 1
                ? 'glass-card text-primary shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {currentYear - 1}年
          </button>
          <button
            onClick={() => onYearChange(currentYear)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              year === currentYear
                ? 'glass-card text-primary shadow-sm'
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
        <div className={getContainerClass()}>
          {months.map((month) => (
            <div 
              key={month.name}
              className={getCardClass()}
            >
              <h4 className={`font-bold text-gray-900 dark:text-white ${variant === 'compact' ? 'text-[10px] mb-1 text-center' : 'text-sm mb-3 tracking-wide pl-1'}`}>
                {variant === 'compact' ? month.name : month.fullDate}
              </h4>
              
              <div className="grid grid-cols-7 gap-1.5">
                {/* Day Headers */}
                {dayNames.map(d => (
                  <div key={d} className={`text-gray-400 text-center ${variant === 'compact' ? 'text-[8px] mb-0.5 scale-90' : 'text-[10px] mb-1'}`}>
                    {d}
                  </div>
                ))}
                
                {/* Days */}
                {month.days.map((day, idx) => (
                  <div key={idx} className={variant === 'grid' ? 'flex justify-center items-center' : 'aspect-square'}>
                    {day ? (
                      <div
                        className={`${variant === 'grid' ? getCellClass() : 'w-full h-full'} rounded-[1px] transition-transform hover:scale-110 ${getColor(day.level)}`}
                        title={`${day.date}: ${day.count} 张照片`}
                      />
                    ) : (
                      <div className={variant === 'grid' ? getCellClass() : 'w-full h-full'} />
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
