import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface DatePickerProps {
    value: string;
    onChange: (date: string) => void;
    className?: string;
    placeholder?: string;
}

export default function DatePicker({ value, onChange, className = '', placeholder = '选择日期' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date()); // For navigation
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

    // Initialize calendar based on value prop
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setCurrentDate(date);
            }
        }
    }, [value, isOpen]);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Mobile handled by backdrop click
            if (window.innerWidth < 768) return;

            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if the click was on the portal content
                const portalElement = document.getElementById('datepicker-portal');
                if (portalElement && portalElement.contains(event.target as Node)) {
                    return;
                }
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate position for the portal
    useEffect(() => {
        if (isOpen && containerRef.current && window.innerWidth >= 768) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    // Lock body scroll for mobile modal
    useEffect(() => {
        if (isOpen && window.innerWidth < 768) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

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
            const isSelected = value === dateStr;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            daysArray.push(
                <button
                    key={i}
                    type="button"
                    onClick={() => {
                        onChange(dateStr);
                        setIsOpen(false);
                    }}
                    className={`h-8 w-8 flex items-center justify-center text-sm rounded-full transition-all duration-200 relative
                        ${isSelected 
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold scale-110 z-10' 
                            : isToday 
                                ? 'text-primary font-bold bg-primary/10 border border-primary/20' 
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 hover:scale-105'
                        }
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

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full mt-1 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-left text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-sm text-base transition-all flex items-center justify-between group hover:bg-white/60 dark:hover:bg-black/30 ${isOpen ? 'ring-2 ring-primary/50 border-primary' : ''}`}
      >
                <span className={!value ? 'text-gray-400' : ''}>{value || placeholder}</span>
                <CalendarIcon className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-colors group-hover:text-primary ${isOpen ? 'text-primary' : ''}`} />
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Desktop Popover */}
                            <div 
                                id="datepicker-portal"
                                className="hidden md:block absolute z-[9999]"
                                style={{ 
                                    top: position.top, 
                                    left: position.left,
                                    maxWidth: 'calc(100vw - 32px)'
                                }}
                            >
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-4 w-[320px]"
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
                                </motion.div>
                            </div>

                            {/* Mobile Centered Modal */}
                            <div className="md:hidden fixed inset-0 z-[9999] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                                    onClick={() => setIsOpen(false)}
                                />
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <button 
                                            onClick={prevMonth}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                        <span className="text-lg font-bold text-gray-800 dark:text-white">
                                            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                                        </span>
                                        <button 
                                            onClick={nextMonth}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {/* Weekdays */}
                                    <div className="grid grid-cols-7 mb-4">
                                        {weekDays.map(day => (
                                            <div key={day} className="h-8 flex items-center justify-center text-sm font-medium text-gray-400 dark:text-gray-500">
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Days Grid */}
                                    <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                                        {renderCalendarDays()}
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
