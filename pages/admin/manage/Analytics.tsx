import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Users, Image as ImageIcon, Zap, TrendingUp, TrendingDown, 
    Download, BarChart2, LineChart, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../api';
import { downloadJson } from '../../../utils/exporters';

// --- Types ---
type StatCardProps = {
    title: string;
    value: string | number;
    trend?: number; // percentage
    icon: React.ElementType;
    color: string;
    subValue?: string;
};

type ApiCategory = {
    value: string;
    label: string;
    sortOrder: number;
};

// --- Components ---

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, icon: Icon, color, subValue }) => {
    const isPositive = (trend || 0) >= 0;
    const trendClasses = isPositive 
        ? 'bg-green-100/50 text-green-600 dark:bg-green-500/10 dark:text-green-400' 
        : 'bg-red-100/50 text-red-600 dark:bg-red-500/10 dark:text-red-400';
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col justify-between h-full transition-all duration-300 hover:shadow-md"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-opacity-10 ${color.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-')} ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${trendClasses}`}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        <span>{isPositive ? '+' : ''}{trend}%</span>
                    </div>
                )}
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</h3>
                {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
            </div>
        </motion.div>
    );
};

type UploadTrendPoint = { date: string; current: number; previous: number };

const formatNumber = (n: number) => {
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString();
};

const getNiceMax = (rawMax: number) => {
    const maxVal = Math.max(1, Math.ceil(rawMax));
    if (maxVal <= 8) return 8;
    if (maxVal <= 10) return 10;
    if (maxVal <= 25) return 25;
    if (maxVal <= 50) return Math.ceil(maxVal / 10) * 10;
    if (maxVal <= 200) return Math.ceil(maxVal / 50) * 50;
    return Math.ceil(maxVal / 100) * 100;
};

const UploadTrendChart = ({ data, type, setType, rangeLabel }: { 
    data: UploadTrendPoint[]; 
    type: 'bar' | 'line'; 
    setType: (t: 'bar' | 'line') => void;
    rangeLabel: string;
}) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [outerWidth, setOuterWidth] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!outerRef.current) return;
        const updateWidth = () => setOuterWidth(outerRef.current?.clientWidth || 0);
        updateWidth();
        const ro = new ResizeObserver(updateWidth);
        ro.observe(outerRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!data?.length) return;
        setActiveIndex(data.length - 1);
    }, [data?.length]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollLeft = el.scrollWidth;
    }, [data?.length, type]);

    if (!data || data.length === 0) {
        return <div className="h-72 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">暂无数据</div>;
    }

    const height = 300;
    const top = 20;
    const bottom = 40;
    const chartHeight = height - top - bottom;

    const rawMax = Math.max(1, ...data.map((d) => Math.max(Number(d.current) || 0, Number(d.previous) || 0)));
    const niceMax = getNiceMax(rawMax);
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => (niceMax * (tickCount - 1 - i)) / (tickCount - 1));

    const minSlot = type === 'bar' ? 40 : 32;
    const minWidth = data.length * minSlot;
    const chartWidth = Math.max(outerWidth || 0, minWidth);
    const slot = chartWidth / data.length;

    const xAt = (i: number) => i * slot + slot / 2;
    const baselineY = top + chartHeight;
    const yAt = (v: number) => top + chartHeight - (Math.max(0, v) / niceMax) * chartHeight;

    const labelEvery = (() => {
        const maxLabels = Math.max(2, Math.floor(chartWidth / 70));
        return Math.max(1, Math.ceil(data.length / maxLabels));
    })();

    const setFromClientX = (clientX: number, rect: DOMRect) => {
        const x = clientX - rect.left;
        const idx = Math.max(0, Math.min(data.length - 1, Math.floor(x / slot)));
        setActiveIndex(idx);
    };

    const active = data[Math.max(0, Math.min(data.length - 1, activeIndex))] || data[data.length - 1];
    
    const currentPoints = data.map((d, i) => `${xAt(i)},${yAt(Number(d.current) || 0)}`).join(' ');
    const previousPoints = data.map((d, i) => `${xAt(i)},${yAt(Number(d.previous) || 0)}`).join(' ');
    const currentAreaPath = `M ${xAt(0)} ${baselineY} L ${currentPoints} L ${xAt(data.length - 1)} ${baselineY} Z`;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">上传趋势</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rangeLabel}上传量 (当前 vs. 同期)</p>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">当前</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">同期</span>
                        </div>
                    </div>
                </div>
                <div className="flex bg-gray-100 dark:bg-slate-700/50 p-1 rounded-2xl">
                    <button
                        onClick={() => setType('bar')}
                        className={`px-3 py-1.5 rounded-2xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                            type === 'bar' 
                                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <BarChart2 className="w-3.5 h-3.5" />
                        柱状图
                    </button>
                    <button
                        onClick={() => setType('line')}
                        className={`px-3 py-1.5 rounded-2xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                            type === 'line' 
                                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <LineChart className="w-3.5 h-3.5" />
                        折线图
                    </button>
                </div>
            </div>

            <div className="relative flex-1 min-h-[300px]">
                <div className="absolute inset-0 flex">
                    {/* Y Axis */}
                    <div className="flex-none w-[40px] h-full flex flex-col justify-between py-[20px] pb-[40px] border-r border-dashed border-gray-200 dark:border-gray-700/50 mr-2">
                        {ticks.map((t, i) => (
                            <div key={i} className="text-[10px] text-gray-400 tabular-nums text-right pr-2">
                                {formatNumber(Math.round(t))}
                            </div>
                        ))}
                    </div>

                    {/* Chart Area */}
                    <div ref={outerRef} className="flex-1 relative overflow-hidden">
                        <div ref={scrollRef} className="h-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                            <svg width={chartWidth} height={height} className="block touch-pan-x select-none" style={{ WebkitTapHighlightColor: 'transparent' } as any}>
                                <defs>
                                    <linearGradient id="trendCurrentFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
                                    </linearGradient>
                                </defs>

                                {/* Grid Lines */}
                                {ticks.map((t, i) => {
                                    const y = yAt(t);
                                    return (
                                        <line key={i} x1={0} y1={y} x2={chartWidth} y2={y} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={1} strokeDasharray="4 4" />
                                    );
                                })}

                                {/* Interaction Layer */}
                                <rect x={activeIndex * slot} y={0} width={slot} height={height - bottom} fill="currentColor" className="text-gray-50 dark:text-white/5" />
                                
                                <AnimatePresence mode="wait">
                                    {type === 'bar' ? (
                                        <motion.g key="bars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                                            {data.map((d, i) => {
                                                const cx = xAt(i);
                                                const barW = Math.min(12, slot * 0.4); // Thinner bars
                                                const gap = Math.min(4, slot * 0.1);
                                                const prevV = Number(d.previous) || 0;
                                                const curV = Number(d.current) || 0;
                                                const prevY = yAt(prevV);
                                                const curY = yAt(curV);
                                                const prevH = Math.max(0, baselineY - prevY);
                                                const curH = Math.max(0, baselineY - curY);
                                                const prevX = cx - barW - gap / 2;
                                                const curX = cx + gap / 2;
                                                
                                                return (
                                                    <g key={d.date}>
                                                        <rect x={prevX} y={prevY} width={barW} height={prevH} rx={2} className="fill-gray-300 dark:fill-gray-600" />
                                                        <rect x={curX} y={curY} width={barW} height={curH} rx={2} className="fill-primary" />
                                                    </g>
                                                );
                                            })}
                                        </motion.g>
                                    ) : (
                                        <motion.g key="lines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                                            <motion.polyline
                                                points={previousPoints}
                                                fill="none"
                                                stroke="#9CA3AF"
                                                strokeWidth={2}
                                                strokeDasharray="4 4"
                                                strokeLinejoin="round"
                                                strokeLinecap="round"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 0.8 }}
                                            />
                                            <path d={currentAreaPath} fill="url(#trendCurrentFill)" />
                                            <motion.polyline
                                                points={currentPoints}
                                                fill="none"
                                                stroke="rgb(var(--color-primary))"
                                                strokeWidth={3}
                                                strokeLinejoin="round"
                                                strokeLinecap="round"
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 0.8 }}
                                            />
                                            {/* Dots for line chart */}
                                            {data.map((d, i) => (
                                                <circle 
                                                    key={i} 
                                                    cx={xAt(i)} 
                                                    cy={yAt(Number(d.current) || 0)} 
                                                    r={i === activeIndex ? 4 : 0} 
                                                    className="fill-white stroke-primary stroke-2"
                                                />
                                            ))}
                                        </motion.g>
                                    )}
                                </AnimatePresence>

                                {/* X Axis Labels */}
                                {data.map((d, i) => {
                                    const show = i === 0 || i === data.length - 1 || i % labelEvery === 0;
                                    if (!show) return null;
                                    return (
                                        <text key={d.date} x={xAt(i)} y={height - 15} textAnchor="middle" className="fill-gray-400 text-[10px] font-medium">
                                            {(d.date || '').slice(5)}
                                        </text>
                                    );
                                })}

                                {/* Hover Overlay */}
                                <rect
                                    x={0}
                                    y={0}
                                    width={chartWidth}
                                    height={height}
                                    fill="transparent"
                                    className="cursor-crosshair"
                                    onPointerDown={(e) => {
                                        const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                                        setDragging(true);
                                        try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}
                                        setFromClientX(e.clientX, rect);
                                    }}
                                    onPointerMove={(e) => {
                                        if (!dragging && e.pointerType !== 'mouse') return;
                                        const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                                        setFromClientX(e.clientX, rect);
                                    }}
                                    onPointerUp={(e) => {
                                        const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                                        setDragging(false);
                                        setFromClientX(e.clientX, rect);
                                        try { (e.currentTarget as any).releasePointerCapture?.(e.pointerId); } catch {}
                                    }}
                                    onPointerCancel={() => setDragging(false)}
                                    onPointerLeave={() => setDragging(false)}
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Floating Tooltip */}
                {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 shadow-lg rounded-2xl p-3 text-xs z-10">
                        <div className="font-bold text-gray-900 dark:text-white mb-1.5 text-center">{active.date}</div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 mb-0.5">当前</span>
                                <span className="font-bold text-primary text-sm">{formatNumber(Number(active.current) || 0)}</span>
                            </div>
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-500 mb-0.5">同期</span>
                                <span className="font-bold text-gray-600 dark:text-gray-400 text-sm">{formatNumber(Number(active.previous) || 0)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

type CategorySlice = { label: string; value: number; color: string };

const CategoryDistribution = ({ data, rangeLabel }: { data: CategorySlice[], rangeLabel: string }) => {
    const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0);
    const [active, setActive] = useState(0);

    useEffect(() => {
        setActive(0);
    }, [data.length]);

    if (!data || data.length === 0 || total === 0) {
        return <div className="h-full flex items-center justify-center text-gray-400 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700">暂无数据</div>;
    }

    const safeActive = Math.max(0, Math.min(data.length - 1, active));
    const activeSlice = data[safeActive];
    if (!activeSlice) return null;
    const activePercent = (activeSlice.value / total) * 100;

    let cumulative = 0;
    const polar = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y] as const;
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 h-full flex flex-col">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">分类分布</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rangeLabel}各分类占比</p>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
                {/* Donut Chart */}
                <div className="relative w-40 h-40 mx-auto">
                    <svg viewBox="-1 -1 2 2" className="relative w-full h-full -rotate-90">
                        {data.map((slice, i) => {
                            const value = Math.max(0, Number(slice.value) || 0);
                            if (!value) return null;
                            const start = cumulative;
                            const pct = value / total;
                            cumulative += pct;
                            const end = cumulative;
                            const [sx, sy] = polar(start);
                            const [ex, ey] = polar(end);
                            const large = pct > 0.5 ? 1 : 0;
                            const path = `M ${sx} ${sy} A 1 1 0 ${large} 1 ${ex} ${ey} L 0 0`;
                            const isActive = i === safeActive;

                            return (
                                <motion.path
                                    key={i}
                                    d={path}
                                    fill={slice.color}
                                    stroke="white"
                                    strokeWidth="0.05"
                                    className="origin-center cursor-pointer dark:stroke-slate-800"
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => setActive(i)}
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: isActive ? 1.05 : 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                />
                            );
                        })}
                        {/* Hole */}
                        <circle cx="0" cy="0" r="0.65" className="fill-white dark:fill-slate-800" />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{activeSlice.label}</div>
                        <div className="text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                            {activePercent.toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-gray-500">{activeSlice.value} Photos</div>
                    </div>
                </div>

                {/* Legend List */}
                <div className="flex flex-col gap-2 min-w-[140px] max-h-[220px] overflow-y-auto no-scrollbar pr-1">
                    <div className="flex justify-between text-xs text-gray-400 mb-1 px-2">
                        <span>Total {data.length} Cats</span>
                        <span>{total}</span>
                    </div>
                    {data.map((d, i) => {
                        const isActive = i === safeActive;
                        const pct = (d.value / total) * 100;
                        return (
                            <button
                                key={i}
                                onClick={() => setActive(i)}
                                onMouseEnter={() => setActive(i)}
                                className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                                    isActive ? 'bg-gray-100 dark:bg-slate-700' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{d.label}</span>
                                </div>
                                <span className="font-semibold text-gray-900 dark:text-white">{pct.toFixed(0)}%</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const Heatmap = ({ data, rangeLabel }: { data: { date: string; count: number }[]; rangeLabel: string }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [hoveredCell, setHoveredCell] = useState<{ date: string, count: number, x: number, y: number } | null>(null);

    const today = new Date();
    const days = [];
    const safeDays = 365; // Always show 1 year for heatmap or dynamic? Design says "上月" but usually heatmap is long. Let's keep 365 or dynamic.
    // The design title says "用户参与度趋势 (上月)". But heatmap is usually longer. 
    // Let's generate last 180 days to be safe and look good.
    for (let i = 180; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days.push(dateStr);
    }

    const dataMap = new Map(data.map(d => [d.date, d.count]));

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, [data]);

    const getColor = (count: number) => {
        if (count === 0) return 'bg-gray-100 dark:bg-slate-700';
        if (count <= 2) return 'bg-green-200 dark:bg-green-900/40';
        if (count <= 5) return 'bg-green-300 dark:bg-green-700/60';
        if (count <= 10) return 'bg-green-400 dark:bg-green-600/80';
        return 'bg-green-500 dark:bg-green-500';
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">全站活跃热力图</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">用户参与度趋势 (近半年)</p>
            </div>

            <div className="relative">
                <div ref={scrollContainerRef} className="w-full overflow-x-auto pb-2 no-scrollbar">
                    <div className="flex gap-1 min-w-max">
                        <div className="grid grid-rows-7 grid-flow-col gap-1">
                            {days.map((date, i) => {
                                const count = dataMap.get(date) || 0;
                                return (
                                    <div 
                                        key={date}
                                        className={`w-3.5 h-3.5 rounded-sm ${getColor(count)} transition-colors hover:ring-2 hover:ring-offset-1 dark:hover:ring-offset-slate-800 hover:ring-primary/50`}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const containerRect = scrollContainerRef.current?.getBoundingClientRect();
                                            if (containerRect) {
                                                setHoveredCell({
                                                    date,
                                                    count,
                                                    x: rect.left - containerRect.left + rect.width / 2,
                                                    y: rect.top - containerRect.top - 10
                                                });
                                            }
                                        }}
                                        onMouseLeave={() => setHoveredCell(null)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {hoveredCell && (
                        <motion.div
                            initial={{ opacity: 0, y: 5, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.9 }}
                            className="absolute z-10 pointer-events-none bg-gray-900 text-white px-3 py-1.5 rounded-xl shadow-xl text-xs whitespace-nowrap"
                            style={{  
                                left: hoveredCell.x, 
                                top: hoveredCell.y,
                                transform: 'translate(-50%, -100%)' 
                            }}
                        >
                            <div className="font-semibold">日期 {hoveredCell.date}</div>
                            <div className="text-gray-300">上传 {hoveredCell.count} 条</div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-end items-center gap-2 mt-4 text-xs text-gray-500 font-medium">
                    <span>低</span>
                    <div className="w-3 h-3 bg-gray-100 dark:bg-slate-700 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-200 dark:bg-green-900/40 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-300 dark:bg-green-700/60 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-400 dark:bg-green-600/80 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-500 dark:bg-green-500 rounded-sm"></div>
                    <span>高</span>
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

export const AnalyticsPage: React.FC = () => {
    const rangeOptions = useMemo(
        () =>
            [
                { days: 7 as const, label: '周' },
                { days: 30 as const, label: '月' },
                { days: 365 as const, label: '年' },
            ],
        [],
    );

    const [rangeDays, setRangeDays] = useState<(typeof rangeOptions)[number]['days']>(7);
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
    const rangeLabel = rangeOptions.find((x) => x.days === rangeDays)?.label || `${rangeDays}天`;

    // Fetch stats
    const { data: statsData, isLoading: statsLoading, isError, error } = useQuery({
        queryKey: ['admin-stats', rangeDays],
        queryFn: async () => {
            try {
                const res = await api.get('/stats/summary', { days: rangeDays });
                return res.data;
            } catch (err) {
                console.error('Failed to fetch stats:', err);
                throw err;
            }
        }
    });

    // Fetch categories for mapping labels
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });

    const categoryLabelByValue = useMemo(() => {
        const m = new Map<string, string>();
        for (const c of categories) {
            if (c?.value) m.set(String(c.value), String(c.label || c.value));
        }
        return m;
    }, [categories]);

    const uploadTrendData: UploadTrendPoint[] = useMemo(() => {
        const raw = (statsData?.uploadTrend || []) as any[];
        const hasAny = raw.some((d) => (Number(d?.current) || 0) > 0 || (Number(d?.previous) || 0) > 0);
        if (!hasAny) return [];

        const map = new Map<string, UploadTrendPoint>();
        for (const d of raw) {
            const date = String(d?.date || '');
            if (!date) continue;
            map.set(date, {
                date,
                current: Number(d?.current) || 0,
                previous: Number(d?.previous) || 0,
            });
        }

        const endIso = new Date().toISOString().split('T')[0];
        const start = new Date(`${endIso}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() - (rangeDays - 1));

        const filled: UploadTrendPoint[] = [];
        for (let i = 0; i < rangeDays; i++) {
            const d = new Date(start);
            d.setUTCDate(start.getUTCDate() + i);
            const date = d.toISOString().split('T')[0];
            filled.push(map.get(date) || { date, current: 0, previous: 0 });
        }
        return filled;
    }, [statsData?.uploadTrend, rangeDays]);

    if (statsLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"></div>
                <p className="mt-4 text-gray-500 animate-pulse">正在加载数据统计...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-red-500">
                <div className="text-xl font-bold mb-2">数据加载失败</div>
                <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 px-6 py-2.5 btn-liquid text-gray-900 dark:text-white font-medium hover:text-primary dark:hover:text-primary transition-colors"
                >
                    刷新页面
                </button>
            </div>
        );
    }

    const summary = statsData?.summary || {};
    
    // Prepare Donut Data
    const donutColors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#06B6D4'];
    const rawDist = statsData?.categoryDistribution || [];
    const sortedDist = [...rawDist].sort((a: any, b: any) => Number(b.count) - Number(a.count));

    const donutData = sortedDist.map((cat: any, i: number) => ({
        label: categoryLabelByValue.get(cat.category) || cat.category,
        value: Number(cat.count),
        color: donutColors[i % donutColors.length]
    }));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-6 lg:pb-20 p-3 lg:p-6 bg-gray-50/50 dark:bg-black/20 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="mb-2 md:mb-0">
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        全站数据统计
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">摄影平台全站数据概览</p>
                </div>
                <div className="flex flex-row items-center justify-between w-full md:w-auto gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-1 flex items-center shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar max-w-full">
                        {rangeOptions.map((opt) => (
                            <button
                                key={opt.days}
                                onClick={() => setRangeDays(opt.days)}
                                className={`px-4 py-1.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
                                    rangeDays === opt.days 
                                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => downloadJson(statsData, `analytics-${rangeDays}d.json`)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-green-500/30 active:scale-95 ml-auto md:ml-0"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">导出数据</span>
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
                <StatCard 
                    title="用户总量" 
                    value={formatNumber(summary.total_users)} 
                    trend={summary.users_trend}
                    icon={Users}
                    color="text-blue-500"
                />
                <StatCard 
                    title="作品总量" 
                    value={formatNumber(summary.total_photos)} 
                    trend={summary.photos_trend}
                    icon={ImageIcon}
                    color="text-purple-500"
                />
                <StatCard 
                    title="日活跃用户 (DAU)" 
                    value={formatNumber(summary.dau)} 
                    trend={summary.dau_trend}
                    icon={Zap}
                    color="text-yellow-500"
                />
                <StatCard 
                    title="平均增长率" 
                    value={`${Number.isFinite(Number(summary.avg_weekly_growth)) ? Number(summary.avg_weekly_growth).toFixed(2) : '0.00'}%`}
                    trend={summary.growth_rate_trend}
                    icon={Activity}
                    color="text-green-500"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 lg:min-h-[420px] h-auto">
                <div className="lg:col-span-2 h-auto lg:h-full w-full">
                    <UploadTrendChart 
                        data={uploadTrendData} 
                        type={chartType} 
                        setType={setChartType} 
                        rangeLabel={rangeLabel}
                    />
                </div>
                <div className="lg:col-span-1 h-auto lg:h-full w-full">
                    <CategoryDistribution 
                        data={donutData}
                        rangeLabel={rangeLabel}
                    />
                </div>
            </div>

            {/* Heatmap Row */}
            <div>
                <Heatmap data={statsData?.heatmap || []} rangeLabel={rangeLabel} />
            </div>
        </div>
    );
};

export default AnalyticsPage;
