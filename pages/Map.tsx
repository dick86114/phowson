import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { Map as MapIcon, ArrowRight } from 'lucide-react';

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

// Amap Sources (Stable & Fast in China)
const MAP_PROVIDERS = {
    standard: {
        name: '标准 (高德)',
        url: 'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
        attribution: 'Map data &copy; <a href="https://ditu.amap.com/">高德地图</a>',
        className: ''
    }
};

const MapController = ({ photos }: { photos: ApiPhoto[] }) => {
    const map = useMap();
    const [searchParams] = useSearchParams();
    const targetLat = searchParams.get('lat');
    const targetLng = searchParams.get('lng');
    const targetId = searchParams.get('id');

    // Force map resize when window resizes or component mounts
    useEffect(() => {
        const resizeMap = () => {
            requestAnimationFrame(() => {
                map.invalidateSize();
            });
        };
        
        // Initial resize with delay
        const timer = setTimeout(resizeMap, 200);
        
        // Add listener
        window.addEventListener('resize', resizeMap);
        
        // Cleanup
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', resizeMap);
        };
    }, [map]);

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
                // Use smaller padding for mobile devices
                const isMobile = window.innerWidth < 768;
                map.fitBounds(bounds, { 
                    padding: isMobile ? [20, 20] : [50, 50],
                    maxZoom: 18
                });
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
        <main className="w-full relative h-[calc(100vh-64px)] overflow-hidden bg-gray-100 dark:bg-gray-900">
            <style>{`
                /* Custom Leaflet Popup Styles */
                .leaflet-popup-content-wrapper {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-radius: 16px;
                    box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.2), 0 8px 16px -4px rgba(0, 0, 0, 0.1);
                    padding: 0 !important;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.6);
                }
                .dark .leaflet-popup-content-wrapper {
                    background: rgba(30, 30, 30, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.5), 0 8px 16px -4px rgba(0, 0, 0, 0.3);
                }
                .leaflet-popup-content {
                    margin: 0 !important;
                    width: 280px !important;
                    line-height: 1.5;
                }
                .leaflet-popup-tip {
                    background: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                .dark .leaflet-popup-tip {
                    background: rgba(30, 30, 30, 0.95);
                }
                .leaflet-container a.leaflet-popup-close-button {
                    top: 8px !important;
                    right: 8px !important;
                    width: 24px !important;
                    height: 24px !important;
                    font-size: 18px !important;
                    line-height: 24px !important;
                    color: white !important;
                    background: rgba(0, 0, 0, 0.3) !important;
                    border-radius: 50% !important;
                    backdrop-filter: blur(4px);
                    text-shadow: none !important;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 !important;
                }
                .leaflet-container a.leaflet-popup-close-button:hover {
                    background: rgba(0, 0, 0, 0.6) !important;
                    color: white !important;
                }
            `}</style>
            
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none w-full max-w-md px-4 flex justify-center">
                <div className="glass-panel px-5 py-2.5 rounded-full flex items-center gap-3 pointer-events-auto animate-fade-in-down shadow-lg backdrop-blur-md bg-white/80 dark:bg-black/60 border border-white/20">
                    <div className="p-1.5 bg-primary/10 rounded-full">
                        <MapIcon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        光影足迹 · {photosWithGps.length} 个地点
                    </span>
                </div>
            </div>

            <div className="absolute inset-0 z-0">
                <MapContainer 
                    center={[35, 105]} 
                    zoom={4} 
                    style={{ height: '100%', width: '100%', background: '#f0f0f0' }}
                    scrollWheelZoom={true}
                    className="w-full h-full"
                    minZoom={3}
                >
                    <MapController photos={photosWithGps} />
                    <TileLayer
                        attribution={MAP_PROVIDERS.standard.attribution}
                        url={MAP_PROVIDERS.standard.url}
                        className={MAP_PROVIDERS.standard.className}
                    />
                    {photosWithGps.map(photo => (
                        <Marker key={photo.id} position={[photo.lat!, photo.lng!]}>
                            <Popup className="photo-popup" closeButton={true}>
                                <div className="flex flex-col">
                                    <div className="relative aspect-[16/10] w-full bg-gray-100 dark:bg-gray-800 overflow-hidden group">
                                        <img 
                                            src={getPhotoUrl(photo, 'thumb')} 
                                            alt={photo.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                                        <div className="absolute bottom-3 left-4 right-4 text-white pointer-events-none">
                                            <h3 className="font-bold text-base leading-tight drop-shadow-md line-clamp-1">{photo.title}</h3>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 flex flex-col gap-3">
                                        <div className="max-h-[100px] overflow-y-auto custom-scrollbar">
                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                                {photo.description || '暂无描述...'}
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5 mt-1 gap-2">
                                            <div className="flex flex-col shrink-0">
                                               <span className="text-[10px] text-gray-400 uppercase tracking-wider">Coordinates</span>
                                               <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                                   {photo.lat?.toFixed(4)}, {photo.lng?.toFixed(4)}
                                               </span>
                                            </div>
                                            <a 
                                                href={`#/photo/${photo.id}`}
                                                className="group/btn px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-xs font-bold rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 flex-1 max-w-[130px]"
                                            >
                                                <span>查看详情</span>
                                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 text-gray-400 group-hover/btn:text-gray-600" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {photosWithGps.length === 0 && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000]">
                    <div className="glass-panel bg-amber-50/80 dark:bg-amber-900/40 border-amber-200/50 dark:border-amber-700/30 px-4 py-2 rounded-xl text-sm text-amber-800 dark:text-amber-200 shadow-lg backdrop-blur-md">
                        ⚠️ 暂无带 GPS 信息的照片，无法在地图上展示。
                    </div>
                </div>
            )}
        </main>
    );
};
