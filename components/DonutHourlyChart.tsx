import React, { useMemo } from 'react';

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

const levelFromCount = (count: number, max: number) => {
    if (!max || max <= 0) return 0;
    const v = Math.max(0, Math.min(1, count / max));
    return Math.min(4, Math.floor(v * 4));
};

const levelColor = (level: number) => {
    switch (level) {
        case 4:
            return '#0ea5e9';
        case 3:
            return '#38bdf8';
        case 2:
            return '#7dd3fc';
        case 1:
            return '#bae6fd';
        default:
            return '#e5e7eb';
    }
};

export type DonutHourlyChartProps = {
    hours: number[];
    size?: number;
    strokeWidth?: number;
    ariaLabel?: string;
};

export const DonutHourlyChart: React.FC<DonutHourlyChartProps> = ({
    hours,
    size = 220,
    strokeWidth = 18,
    ariaLabel = '本月上传活跃度（按小时分布）',
}) => {
    const normalized = useMemo(() => {
        const arr = Array.from({ length: 24 }, (_, i) => Number(hours?.[i] || 0));
        const max = Math.max(0, ...arr);
        const total = arr.reduce((a, b) => a + b, 0);
        return { arr, max, total };
    }, [hours]);

    const cx = size / 2;
    const cy = size / 2;
    const r = cx - strokeWidth;
    const gap = 1.2;
    const step = 360 / 24;

    return (
        <div className="flex items-center gap-6">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} role="img" aria-label={ariaLabel}>
                    <circle cx={cx} cy={cy} r={r} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none" opacity={0.35} />
                    {normalized.arr.map((count, hour) => {
                        const start = hour * step + gap;
                        const end = (hour + 1) * step - gap;
                        const level = levelFromCount(count, normalized.max);
                        const color = levelColor(level);
                        const d = describeArc(cx, cy, r, start, end);
                        return (
                            <path
                                key={hour}
                                d={d}
                                stroke={color}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                fill="none"
                            >
                                <title>{`${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59：${count} 张`}</title>
                            </path>
                        );
                    })}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{normalized.total}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">本月上传</div>
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">每小时密度</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>少</span>
                    {[0, 1, 2, 3, 4].map((lvl) => (
                        <span key={lvl} className="inline-block w-4 h-3 rounded" style={{ backgroundColor: levelColor(lvl) }} />
                    ))}
                    <span>多</span>
                </div>
                <div className="sr-only">
                    {normalized.arr.map((c, i) => `${i}点：${c} 张`).join('；')}
                </div>
            </div>
        </div>
    );
};

