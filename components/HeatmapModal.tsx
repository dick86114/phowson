import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heatmap } from './Heatmap';

type HeatmapModalProps = {
    isOpen: boolean;
    onClose: () => void;
    data: any; // Using any for simplicity as it matches Heatmap props
    year: number;
    onYearChange: (year: number) => void;
};

export const HeatmapModal: React.FC<HeatmapModalProps> = ({ 
    isOpen, 
    onClose, 
    data, 
    year, 
    onYearChange 
}) => {
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-5xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-500 dark:text-orange-400">
                                <Flame className="w-5 h-5 fill-orange-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-wide">年度打卡记录</h2>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        <Heatmap
                            data={data}
                            year={year}
                            onYearChange={onYearChange}
                            startDate={`${year}-01-01`}
                            endDate={`${year}-12-31`}
                            variant="grid"
                        />
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};
