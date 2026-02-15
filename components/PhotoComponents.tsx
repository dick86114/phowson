import React from 'react';
import { MapPin, Camera, Aperture, Timer, Zap, Disc } from 'lucide-react';
import { Photo, ExifData } from '../types';

export function PhotoExifBadge({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gray-100 dark:bg-surface-dark text-primary border border-gray-200 dark:border-surface-border">
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
            </div>
        </div>
    );
}

export function ExifGrid({ exif }: { exif: ExifData }) {
    return (
        <div className="grid grid-cols-2 gap-4">
            <PhotoExifBadge icon={<Camera className="w-4 h-4"/>} label="相机" value={exif.camera} />
            <PhotoExifBadge icon={<Disc className="w-4 h-4"/>} label="镜头" value={exif.lens} />
            <PhotoExifBadge icon={<Timer className="w-4 h-4"/>} label="快门" value={exif.shutterSpeed} />
            <PhotoExifBadge icon={<Aperture className="w-4 h-4"/>} label="光圈" value={exif.aperture} />
            <PhotoExifBadge icon={<Zap className="w-4 h-4"/>} label="感光度" value={exif.iso} />
        </div>
    );
}
