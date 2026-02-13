import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { Map as MapIcon } from 'lucide-react';

// Fix Leaflet marker icons
const markerIcon2xUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
const markerIconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
const markerShadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2xUrl,
    iconUrl: markerIconUrl,
    shadowUrl: markerShadowUrl,
});

type ApiPhoto = {
    id: string;
    url: string;
    thumbUrl?: string | null;
    title: string;
    description: string;
    lat: number | null;
    lng: number | null;
    exif: string;
};

import { getPhotoUrl } from '../utils/helpers';

const MapController = ({ photos }: { photos: ApiPhoto[] }) => {
    const map = useMap();
    const [searchParams] = useSearchParams();
    const targetLat = searchParams.get('lat');
    const targetLng = searchParams.get('lng');
    const targetId = searchParams.get('id');

    useEffect(() => {
        if (photos.length === 0) return;

        if (targetLat && targetLng) {
            const lat = parseFloat(targetLat);
            const lng = parseFloat(targetLng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.flyTo([lat, lng], 16, { duration: 1.5 });
            }
        } else {
            // Auto fit bounds
            const bounds = L.latLngBounds(photos.map(p => [p.lat!, p.lng!]));
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }, [map, photos, targetLat, targetLng]);

    useEffect(() => {
        if (targetId && photos.length > 0) {
             // 打开对应的 popup 需要 ref，这里稍微复杂，暂时先只定位
        }
    }, [targetId, photos]);

    return null;
};

export const MapPage: React.FC = () => {
    const { data: photos = [], isLoading } = useQuery({
        queryKey: ['photos'],
        queryFn: async () => {
            const res = await api.get<ApiPhoto[]>('/photos');
            return res.data;
        },
    });

    const photosWithGps = useMemo(() => {
        return photos.filter(p => p.lat != null && p.lng != null);
    }, [photos]);

    if (isLoading) {
        return (
            <div className="flex-grow flex items-center justify-center relative">
                <div className="glass-panel px-8 py-6 rounded-2xl flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">正在加载地图数据...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="flex-grow flex flex-col relative h-[calc(100vh-64px)] overflow-hidden">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none w-full max-w-md px-4 flex justify-center">
                <div className="glass-panel px-5 py-2.5 rounded-full flex items-center gap-3 pointer-events-auto animate-fade-in-down shadow-lg">
                    <div className="p-1.5 bg-primary/10 rounded-full">
                        <MapIcon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        光影足迹 · {photosWithGps.length} 个地点
                    </span>
                </div>
            </div>

            <MapContainer 
                center={[20, 0]} 
                zoom={3} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {photosWithGps.map(photo => (
                    <Marker key={photo.id} position={[photo.lat!, photo.lng!]}>
                        <Popup className="photo-popup">
                            <div className="w-64 space-y-3 p-1">
                                <div className="aspect-[3/2] rounded-lg overflow-hidden bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                                    <img 
                                        src={getPhotoUrl(photo, 'thumb')} 
                                        alt={photo.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{photo.title}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2">{photo.description}</p>
                                </div>
                                <a 
                                    href={`#/photo/${photo.id}`}
                                    className="block w-full text-center py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                >
                                    查看详情
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {photosWithGps.length === 0 && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000]">
                    <div className="glass-panel bg-amber-50/80 dark:bg-amber-900/40 border-amber-200/50 dark:border-amber-700/30 px-4 py-2 rounded-lg text-sm text-amber-800 dark:text-amber-200 shadow-lg backdrop-blur-md">
                        ⚠️ 暂无带 GPS 信息的照片，无法在地图上展示。
                    </div>
                </div>
            )}
        </main>
    );
};
