import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Users, Image as ImageIcon, Zap, TrendingUp, TrendingDown, 
    Download, Calendar, Activity, PieChart, BarChart2 
} from 'lucide-react';
import api from '../../../api';
import { downloadJson } from '../../../utils/exporters';

// --- Types ---
type StatCardProps = {
    title: string;
    value: string | number;
    trend?: number; // percentage
    trendLabel?: string;
    icon: React.ElementType;
    color: string;
};

type ApiCategory = {
    value: string;
    label: string;
    sortOrder: number;
};

// --- Components ---

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, icon: Icon, color }) => {
    const isPositive = (trend || 0) >= 0;
    const trendClasses = isPositive 
        ? 'bg-green-100/50 text-green-600 dark:bg-green-500/10 dark:text-green-400' 
        : 'bg-red-100/50 text-red-600 dark:bg-red-500/10 dark:text-red-400';
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className="glass-card p-6 rounded-xl shadow-sm flex flex-col justify-between h-full hover:scale-[1.02] transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl backdrop-blur-md ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full backdrop-blur-sm ${trendClasses}`}>
                        <TrendIcon className="w-3 h-3" />
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</h3>
            </div>
        </div>
    );
};

const SvgBarChart = ({ data }: { data: { date: string, current: number, previous: number }[] }) => {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">暂无数据</div>;

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.current, d.previous)));
    const chartHeight = 240;
    const chartWidth = 1000;
    const paddingBottom = 20;
    const availableHeight = chartHeight - paddingBottom;
    
    // X-axis labels step
    const step = Math.ceil(data.length / 12);

    const getBarHeight = (val: number) => (val / maxVal) * availableHeight;
    const slotWidth = chartWidth / data.length;
    const barWidth = Math.max(2, slotWidth * 0.35);
    const groupGap = slotWidth * 0.1;

    return (
        <div className="w-full h-64 relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                    const y = availableHeight - (availableHeight * tick);
                    return (
                        <line 
                            key={tick} 
                            x1="0" 
                            y1={y} 
                            x2={chartWidth} 
                            y2={y} 
                            stroke="currentColor" 
                            strokeOpacity="0.1" 
                            strokeDasharray="4 4"
                            className="text-gray-400 dark:text-gray-600"
                        />
                    );
                })}

                {/* Bars */}
                {data.map((d, i) => {
                    const xStart = i * slotWidth;
                    const hPrev = getBarHeight(d.previous);
                    const hCurr = getBarHeight(d.current);
                    
                    const yPrev = availableHeight - hPrev;
                    const yCurr = availableHeight - hCurr;

                    const xPrev = xStart + groupGap;
                    const xCurr = xPrev + barWidth;

                    return (
                        <g 
                            key={i} 
                            onMouseEnter={() => setHoverIndex(i)}
                            onMouseLeave={() => setHoverIndex(null)}
                            className="cursor-crosshair"
                        >
                            {/* Hit Area for easy hovering */}
                            <rect x={xStart} y="0" width={slotWidth} height={chartHeight} fill="transparent" />
                            
                            {/* Previous Bar */}
                            <rect 
                                x={xPrev} 
                                y={yPrev} 
                                width={barWidth} 
                                height={hPrev} 
                                className="fill-gray-300/50 dark:fill-gray-600/50 transition-all duration-300"
                                rx={2}
                            />
                            
                            {/* Current Bar */}
                            <rect 
                                x={xCurr} 
                                y={yCurr} 
                                width={barWidth} 
                                height={hCurr} 
                                className="fill-primary transition-all duration-300 hover:fill-primary/80 filter drop-shadow-sm"
                                rx={2}
                            />

                            {/* X Axis Label */}
                            {i % step === 0 && (
                                <text 
                                    x={xStart + slotWidth / 2} 
                                    y={chartHeight} 
                                    textAnchor="middle" 
                                    className="text-[10px] fill-gray-400 dark:fill-gray-500 font-medium"
                                    fontSize="12"
                                >
                                    {d.date.slice(5)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Tooltip */}
            {hoverIndex !== null && data[hoverIndex] && (
                <div 
                    className="absolute pointer-events-none glass-panel px-3 py-2 rounded-lg shadow-xl z-10 transform -translate-x-1/2 -translate-y-full border border-white/20 backdrop-blur-md"
                    style={{ 
                        left: `${(hoverIndex * slotWidth + slotWidth / 2) / 10}%`, 
                        top: '10%' // Approximate position, or follow mouse
                    }}
                >
                    <div className="font-bold mb-1 text-gray-900 dark:text-white text-xs">{data[hoverIndex].date}</div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.5)]"></div>
                        <span className="text-gray-700 dark:text-gray-300">本期: {data[hoverIndex].current}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <span className="text-gray-500 dark:text-gray-400">上期: {data[hoverIndex].previous}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const DonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    let cumulativeAngle = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    if (total === 0) return <div className="h-64 flex items-center justify-center text-gray-400">暂无数据</div>;

    return (
        <div className="relative w-48 h-48 mx-auto group">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full drop-shadow-lg">
                {data.map((slice, i) => {
                    if (slice.value === 0) return null;
                    const startAngle = cumulativeAngle;
                    const slicePercent = slice.value / total;
                    cumulativeAngle += slicePercent;
                    const endAngle = cumulativeAngle;

                    const [startX, startY] = getCoordinatesForPercent(startAngle);
                    const [endX, endY] = getCoordinatesForPercent(endAngle);

                    const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                    const pathData = [
                        `M ${startX} ${startY}`,
                        `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                        `L 0 0`,
                    ].join(' ');

                    return (
                        <path 
                            key={i} 
                            d={pathData} 
                            fill={slice.color} 
                            stroke="rgba(255,255,255,0.1)" 
                            strokeWidth="0.02"
                            className="transition-all duration-300 hover:opacity-90 hover:scale-105 origin-center cursor-pointer"
                            style={{ transformBox: 'fill-box' }}
                        />
                    );
                })}
                {/* Inner Circle for Donut Effect */}
                <circle cx="0" cy="0" r="0.6" className="fill-white/90 dark:fill-gray-900/90 backdrop-blur-sm" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-sm">{data.length}</span>
                <span className="text-xs text-gray-500 font-medium">主要分类</span>
            </div>
        </div>
    );
};

const Heatmap = ({ data }: { data: { date: string, count: number }[] }) => {
    // Generate last 365 days
    const today = new Date();
    const days = [];
    for (let i = 364; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days.push(dateStr);
    }

    const dataMap = new Map(data.map(d => [d.date, d.count]));

    const getColor = (count: number) => {
        if (count === 0) return 'bg-gray-100/50 dark:bg-white/5 border border-transparent';
        if (count <= 2) return 'bg-green-200/50 dark:bg-green-900/30 border border-green-200/20 dark:border-green-800/20 backdrop-blur-sm';
        if (count <= 5) return 'bg-green-300/60 dark:bg-green-700/40 border border-green-300/30 dark:border-green-600/30 backdrop-blur-sm';
        if (count <= 10) return 'bg-green-400/70 dark:bg-green-600/60 border border-green-400/40 dark:border-green-500/40 backdrop-blur-sm';
        return 'bg-green-500/80 dark:bg-green-500/80 border border-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.4)] backdrop-blur-sm';
    };

    return (
        <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            <div className="flex gap-1 min-w-max p-1">
                <div className="grid grid-rows-7 grid-flow-col gap-1">
                    {days.map((date) => {
                        const count = dataMap.get(date) || 0;
                        return (
                            <div 
                                key={date}
                                className={`w-3 h-3 rounded-sm ${getColor(count)} transition-all duration-300 hover:scale-125`}
                                title={`${date}: ${count} items`}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="flex justify-end items-center gap-2 mt-4 text-xs text-gray-500">
                <span>低</span>
                <div className="w-3 h-3 bg-gray-100/50 dark:bg-white/5 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-200/80 dark:bg-green-900/40 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-300/80 dark:bg-green-700/60 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-400/90 dark:bg-green-600/80 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-500 dark:bg-green-500 rounded-sm"></div>
                <span>活跃</span>
            </div>
        </div>
    );
};

// --- Main Page ---

export const AnalyticsPage: React.FC = () => {
    const [days, setDays] = useState<30 | 90 | 180>(30);

    // Fetch stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['admin-stats', days],
        queryFn: async () => {
            const res = await api.get('/stats/summary', { days });
            return res.data;
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

    if (statsLoading && !statsData) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"></div>
                <p className="mt-4 text-gray-500 animate-pulse">正在加载数据统计...</p>
            </div>
        );
    }

    const summary = statsData?.summary || {};
    
    // Prepare Donut Data
    const donutColors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
    const rawDist = statsData?.categoryDistribution || [];
    const top5 = rawDist.slice(0, 5);
    const othersCount = rawDist.slice(5).reduce((sum: number, item: any) => sum + Number(item.count), 0);
    
    const donutData = top5.map((cat: any, i: number) => ({
        label: categoryLabelByValue.get(cat.category) || cat.category,
        value: Number(cat.count),
        color: donutColors[i % donutColors.length]
    }));

    if (othersCount > 0) {
        donutData.push({
            label: '其他',
            value: othersCount,
            color: '#9CA3AF'
        });
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <BarChart2 className="w-8 h-8 text-primary drop-shadow-md" />
                        全站数据统计
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">实时监控平台增长与用户活跃状态</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="glass-panel rounded-lg p-1 flex items-center">
                        {[30, 90, 180].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d as any)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    days === d 
                                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-md transform scale-105' 
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                            >
                                {d === 180 ? '半年' : `${d}天`}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => downloadJson(statsData, `analytics-report-${new Date().toISOString().split('T')[0]}.json`)}
                        className="glass-card hover:bg-green-500 hover:text-white text-green-600 border-green-200 dark:border-green-800 dark:text-green-400 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow-green-500/30"
                    >
                        <Download className="w-4 h-4" />
                        导出报表
                    </button>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="总用户数" 
                    value={summary.total_users?.toLocaleString() || 0} 
                    trend={summary.users_trend || 0}
                    icon={Users}
                    color="bg-blue-500/10 text-blue-500"
                />
                <StatCard 
                    title="照片总量" 
                    value={summary.total_photos?.toLocaleString() || 0} 
                    trend={summary.photos_trend || 0}
                    icon={ImageIcon}
                    color="bg-purple-500/10 text-purple-500"
                />
                <StatCard 
                    title="日活跃用户 (DAU)" 
                    value={summary.dau?.toLocaleString() || 0} 
                    trend={summary.dau_trend || 0}
                    icon={Zap}
                    color="bg-orange-500/10 text-orange-500"
                />
                <StatCard 
                    title="平均周增长率" 
                    value={`${summary.avg_weekly_growth || 0}%`} 
                    trend={summary.growth_rate_trend || 0}
                    icon={TrendingUp}
                    color="bg-green-500/10 text-green-500"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Trends */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">上传趋势</h3>
                            <p className="text-xs text-gray-500 mt-1">最近 {days} 天上传数量波动统计</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.5)]"></div>
                                <span className="text-gray-600 dark:text-gray-300">本期</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                                <span className="text-gray-600 dark:text-gray-300">上期</span>
                            </div>
                        </div>
                    </div>
                    <SvgBarChart data={statsData?.uploadTrend || []} />
                </div>

                {/* Category Distribution */}
                <div className="glass-panel p-6 rounded-xl shadow-sm flex flex-col">
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-900 dark:text-white">类目分布</h3>
                        <p className="text-xs text-gray-500 mt-1">各摄影门类的照片占比</p>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center">
                        <DonutChart data={donutData} />
                        
                        <div className="mt-8 space-y-3">
                            {donutData.map((d: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm group cursor-default">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full transition-transform group-hover:scale-150" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{d.label}</span>
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {Math.round((d.value / (summary.total_photos || 1)) * 100)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Heatmap */}
            <div className="glass-panel p-6 rounded-xl shadow-sm">
                <div className="mb-6">
                    <h3 className="font-bold text-gray-900 dark:text-white">全站活跃热力图</h3>
                    <p className="text-xs text-gray-500 mt-1">聚合所有用户的上传行为数据（最近一年）</p>
                </div>
                <Heatmap data={statsData?.heatmap || []} />
            </div>
        </div>
    );
};
