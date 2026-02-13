import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onChange: (start: string, end: string) => void;
    className?: string;
    placeholder?: string;
}

export default function DateRangePicker({ startDate, endDate, onChange, className = '', placeholder = '选择时间范围' }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date()); // For navigation
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isMobile, setIsMobile] = useState(false);

    // Initialize calendar based on startDate prop or current date
    useEffect(() => {
        if (startDate) {
            const date = new Date(startDate);
            if (!isNaN(date.getTime())) {
                setCurrentDate(date);
            }
        }
    }, [startDate, isOpen]);

    // Handle resize to update mobile state
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Only for desktop mode where we rely on document click
            // For mobile modal, we use the backdrop click
            if (isMobile) return;

            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if the click was on the portal content
                const portalElement = document.getElementById('daterangepicker-portal');
                if (portalElement && portalElement.contains(event.target as Node)) {
                    return;
                }
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, isMobile]);

    // Calculate position for the portal
    useEffect(() => {
        if (isOpen && containerRef.current && !isMobile) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                width: 320
            });
        }
    }, [isOpen, isMobile]);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handleDateClick = (dateStr: string) => {
        if (!startDate || (startDate && endDate)) {
            // Start new selection
            onChange(dateStr, '');
        } else {
            // Complete selection
            if (dateStr < startDate) {
                onChange(dateStr, startDate);
            } else {
                onChange(startDate, dateStr);
            }
            // Optional: Close on selection complete? Maybe keep open to see result.
            // Let's keep open so user can adjust if needed, or close.
            // Actually, closing on complete selection is standard UX for some, but let's wait for user to click outside or confirm.
            // For now, let's auto-close if we want to mimic the single date picker, but ranges often need verification.
            // Let's Auto-close for convenience.
            setIsOpen(false);
        }
    };

    const renderCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const days = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        const daysArray = [];

        // Previous month filler
        const prevMonthDays = daysInMonth(year, month - 1);
        for (let i = firstDay - 1; i >= 0; i--) {
            daysArray.push(
                <div key={`prev-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-gray-400 dark:text-gray-600">
                    {prevMonthDays - i}
                </div>
            );
        }

        // Current month days
        for (let i = 1; i <= days; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isStart = startDate === dateStr;
            const isEnd = endDate === dateStr;
            const isInRange = startDate && endDate && dateStr > startDate && dateStr < endDate;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            daysArray.push(
                <button
                    key={i}
                    type="button"
                    onClick={() => handleDateClick(dateStr)}
                    className={`h-8 w-8 flex items-center justify-center text-sm rounded-full transition-all duration-200 relative
                        ${isStart || isEnd
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold z-10' 
                            : isInRange
                                ? 'bg-primary/10 text-primary font-medium rounded-none w-full mx-[-2px]' // Connect range
                                : isToday 
                                    ? 'text-primary font-bold bg-primary/10 border border-primary/20' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                        }
                        ${isInRange ? 'rounded-none' : 'rounded-full'}
                        ${isStart && endDate ? 'rounded-r-none' : ''}
                        ${isEnd && startDate ? 'rounded-l-none' : ''}
                    `}
                >
                    {i}
                </button>
            );
        }

        return daysArray;
    };

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    const displayValue = startDate && endDate 
        ? `${startDate} - ${endDate}`
        : startDate 
            ? `${startDate} - 选择结束`
            : '';

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg pl-10 pr-8 py-2.5 text-left text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm text-sm transition-all flex items-center group hover:bg-white/60 dark:hover:bg-black/30 ${isOpen ? 'ring-2 ring-primary/50 border-primary' : ''}`}
            >
                <CalendarIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 transition-colors group-hover:text-primary ${isOpen ? 'text-primary' : ''}`} />
                <span className={!displayValue ? 'text-gray-500' : ''}>{displayValue || placeholder}</span>
                {displayValue && (
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('', '');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-3 h-3 text-gray-400" />
                    </div>
                )}
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div 
                            id="daterangepicker-portal"
                            className={isMobile 
                                ? "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
                                : "absolute z-[9999]"
                            }
                            style={isMobile ? {} : { 
                                top: position.top, 
                                left: position.left,
                                width: position.width,
                                maxWidth: '100vw'
                            }}
                            onClick={(e) => {
                                if (isMobile && e.target === e.currentTarget) {
                                    setIsOpen(false);
                                }
                            }}
                        >
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: isMobile ? 20 : -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: isMobile ? 20 : -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-4 w-full md:w-[320px] mx-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button 
                                        onClick={prevMonth}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-base font-bold text-gray-800 dark:text-white">
                                        {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                                    </span>
                                    <button 
                                        onClick={nextMonth}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Weekdays */}
                                <div className="grid grid-cols-7 mb-2">
                                    {weekDays.map(day => (
                                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-gray-500">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-y-1">
                                    {renderCalendarDays()}
                                </div>
                                
                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex justify-between text-xs text-gray-400">
                                   <span>{startDate || '开始日期'}</span>
                                   <span>至</span>
                                   <span>{endDate || '结束日期'}</span>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}