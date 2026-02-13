import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DropdownFilterProps {
    label: string;
    value: string | number;
    onChange: (val: any) => void;
    options: { label: string; value: string | number }[];
    icon?: any;
    variant?: 'default' | 'ghost';
    className?: string;
    mobileGrid?: boolean;
    defaultValue?: string | number;
}

export const DropdownFilter = ({ 
    label, 
    value, 
    onChange, 
    options, 
    icon: Icon,
    variant = 'default',
    className = '',
    mobileGrid = false,
    defaultValue = 'all'
}: DropdownFilterProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Only close if it's not the mobile modal (which handles its own closing)
                // But for desktop dropdown, we need this.
                // We'll rely on the desktop dropdown being in the DOM under this container.
                // For mobile portal, it's outside.
                // So this logic is fine for desktop.
                // For mobile, we have a backdrop click handler.
                // However, if we click outside on desktop, we want to close.
                // If we click inside the portal, containerRef doesn't contain it.
                // So clicking inside portal might close it if we aren't careful?
                // No, portal is separate.
                // If isOpen is true, and we click in portal...
                // The portal is attached to body. So 'event.target' will be in body.
                // 'containerRef' is the button wrapper.
                // So !contains will be true.
                // So it will close.
                // We need to check if target is inside the portal too?
                // Or just disable this check for mobile?
                // Simplest: Check if the click target is inside a specific class/id we put on the portal.
            }
        };
        
        // Revised logic:
        // We handle desktop click-outside here.
        // Mobile modal uses a backdrop overlay for closing.
        // If we are on mobile, this effect might trigger closing if we interact with the modal?
        // Yes, if we click inside the modal (which is in Portal), it is NOT in containerRef.
        // So setIsOpen(false) will be called.
        // But we WANT it to stay open when clicking inside modal.
        // Solution: Add a check for the portal container.
    }, []);

    // Better implementation of click outside:
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (window.innerWidth < 768) return; // Disable for mobile, rely on backdrop
            
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lock body scroll when mobile modal is open
    useEffect(() => {
        if (isOpen && window.innerWidth < 768) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const selectedLabel = options.find(o => o.value === value)?.label || label;
    const isActive = value !== defaultValue;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                    variant === 'ghost'
                        ? (isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-white/10 hover:text-gray-900 dark:hover:text-white')
                        : (isActive 
                            ? 'bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm' 
                            : 'glass-card border-white/20 text-gray-700 dark:text-gray-200 hover:border-white/30 hover:shadow shadow-sm px-4 py-2.5 rounded-xl')
                }`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {Icon && <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} />}
                    <span className="truncate">{isActive ? selectedLabel : label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${isActive ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} />
            </button>

            {/* Desktop Dropdown */}
            {isOpen && (
                <div className="hidden md:block absolute top-full left-0 md:left-auto md:right-0 mt-2 w-56 max-h-80 overflow-y-auto glass-panel border-white/20 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1.5 space-y-0.5">
                        <button
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                value === defaultValue 
                                    ? 'bg-primary/5 text-primary font-semibold' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                            onClick={() => {
                                onChange(defaultValue);
                                setIsOpen(false);
                            }}
                        >
                            <span>{label}</span>
                            {value === defaultValue && <Check className="w-4 h-4" />}
                        </button>
                        <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                    value === opt.value 
                                        ? 'bg-primary/5 text-primary font-semibold' 
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="truncate">{opt.label}</span>
                                {value === opt.value && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Mobile Modal (Centered) */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                key="dropdown-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] md:hidden"
                                onClick={() => setIsOpen(false)}
                            />
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none md:hidden">
                                <motion.div
                                    key="dropdown-panel"
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 max-h-[80vh] overflow-y-auto flex flex-col pointer-events-auto"
                                >
                                    <div className="flex items-center justify-between mb-4 shrink-0">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {Icon && <Icon className="w-5 h-5 text-primary" />}
                                            {label}
                                        </h3>
                                        {value !== defaultValue && (
                                            <button 
                                                onClick={() => {
                                                    onChange(defaultValue);
                                                }} 
                                                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                            >
                                                重置
                                            </button>
                                        )}
                                    </div>

                                    <div className="w-full h-px bg-black/5 dark:bg-white/5 mb-6 shrink-0" />

                                    <div className={`mb-6 overflow-y-auto ${mobileGrid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}`}>
                                        {defaultValue === 'all' && (
                                            <button
                                                onClick={() => {
                                                    onChange('all');
                                                    setTimeout(() => setIsOpen(false), 150);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                                                    value === 'all'
                                                    ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                                    : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-lg ${
                                                    value === 'all' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    <Check className="w-4 h-4" />
                                                </div>
                                                <span className="text-base">全部</span>
                                            </button>
                                        )}

                                        {options.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    onChange(opt.value);
                                                    setTimeout(() => setIsOpen(false), 150);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                                                    value === opt.value
                                                    ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                                    : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-lg ${
                                                    value === opt.value ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    {value === opt.value ? <Check className="w-4 h-4" /> : (Icon ? <Icon className="w-4 h-4" /> : <div className="w-4 h-4" />)}
                                                </div>
                                                <span className="text-base">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-base hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mt-auto shrink-0"
                                    >
                                        取消
                                    </button>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );

};
