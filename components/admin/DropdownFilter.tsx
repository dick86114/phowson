import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const DropdownFilter = ({ 
    label, 
    value, 
    onChange, 
    options, 
    icon: Icon 
}: { 
    label: string; 
    value: string | number; 
    onChange: (val: any) => void; 
    options: { label: string; value: string | number }[];
    icon?: any;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || label;
    const isActive = value !== 'all';

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 ${
                    isActive 
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                        : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow'
                }`}
            >
                {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />}
                <span>{isActive ? selectedLabel : label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${isActive ? 'text-primary' : 'text-gray-400'}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1.5 space-y-0.5">
                        <button
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                value === 'all' 
                                    ? 'bg-primary/5 text-primary font-semibold' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border'
                            }`}
                            onClick={() => {
                                onChange('all');
                                setIsOpen(false);
                            }}
                        >
                            <span>{label}</span>
                            {value === 'all' && <Check className="w-4 h-4" />}
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-surface-border my-1" />
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                    value === opt.value 
                                        ? 'bg-primary/5 text-primary font-semibold' 
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border'
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
        </div>
    );
};
