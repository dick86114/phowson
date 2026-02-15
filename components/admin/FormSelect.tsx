import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface FormSelectProps {
    value: string | number;
    onChange: (val: any) => void;
    options: { label: string; value: string | number; icon?: React.ReactNode }[];
    placeholder?: string;
    className?: string;
    mobileGrid?: boolean;
}

export const FormSelect = ({ 
    value, 
    onChange, 
    options, 
    placeholder = '请选择',
    className = '',
    mobileGrid = false
}: FormSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside handler for desktop
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (window.innerWidth < 768) return;
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lock body scroll for mobile modal
    useEffect(() => {
        if (isOpen && window.innerWidth < 768) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const selectedOption = options.find(o => o.value === value);
    const selectedLabel = selectedOption?.label || placeholder;
    const SelectedIcon = selectedOption?.icon;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full mt-1 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-2xl p-3 text-gray-900 dark:text-white text-base focus:outline-none focus:border-primary backdrop-blur-sm flex items-center justify-between text-left transition-colors hover:bg-white/80 dark:hover:bg-white/5"
            >
                <div className="flex items-center gap-2">
                    {SelectedIcon && <span className="text-gray-500 dark:text-gray-400">{SelectedIcon}</span>}
                    <span className={!value ? "text-gray-400" : ""}>{selectedLabel}</span>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform text-gray-500 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Desktop Dropdown */}
            {isOpen && (
                <div className="hidden md:block absolute top-full left-0 w-full mt-2 max-h-60 overflow-y-auto glass-panel border-white/20 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1 space-y-0.5">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between ${
                                    value === opt.value 
                                        ? 'bg-primary/10 text-primary font-semibold' 
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    {opt.icon && <span className={value === opt.value ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}>{opt.icon}</span>}
                                    <span>{opt.label}</span>
                                </div>
                                {value === opt.value && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Mobile Centered Modal */}
            {isOpen && createPortal(
                <div className="md:hidden fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={() => setIsOpen(false)} />
                    <div className="relative glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/10 max-h-[80vh] overflow-y-auto flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {placeholder}
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                                <ChevronDown className="w-5 h-5 rotate-180 text-gray-500" />
                            </button>
                        </div>

                        <div className={`mb-6 ${mobileGrid ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}`}>
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setTimeout(() => setIsOpen(false), 150);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${
                                        value === opt.value 
                                        ? 'bg-primary/10 border-primary text-primary shadow-sm font-bold' 
                                        : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl shrink-0 ${
                  value === opt.value ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                }`}>
                                        {opt.icon ? opt.icon : <Check className={`w-4 h-4 ${value === opt.value ? 'opacity-100' : 'opacity-0'}`} />}
                                    </div>
                                    <span className="text-base truncate">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
