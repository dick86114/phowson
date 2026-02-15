import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Check, X, Loader2, Search, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

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

interface LocationPickerProps {
    initialLat?: number | null;
    initialLng?: number | null;
    onSelect: (lat: number, lng: number, address: string) => void;
    onClose: () => void;
}

// Component to handle map clicks and position updates
const LocationMarker = ({ position, setPosition, onPositionChange }: { 
    position: [number, number] | null, 
    setPosition: (pos: [number, number]) => void,
    onPositionChange: (lat: number, lng: number) => void
}) => {
    const map = useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            setPosition([lat, lng]);
            onPositionChange(lat, lng);
        },
    });

    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);

    return position ? <Marker position={position} /> : null;
};

export const LocationPicker: React.FC<LocationPickerProps> = ({ initialLat, initialLng, onSelect, onClose }) => {
    const [position, setPosition] = useState<[number, number] | null>(
        initialLat && initialLng ? [initialLat, initialLng] : null
    );
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Reverse Geocoding Helper
    const fetchAddress = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN`, {
                headers: {
                    'User-Agent': 'Phowson/1.0 (https://phowson.com)'
                }
            });
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            
            if (data && data.address) {
                const addr = data.address;
                const country = addr.country || '';
                let city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
                
                // Clean up duplicate country name
                if (country && city.includes(country)) {
                    city = city.replace(country, '').replace(/^[·,;\s]+|[·,;\s]+$/g, '');
                }
                city = city.replace(/[;；].*$/, '');

                const formatted = country && city ? `${country} · ${city}` : (country || city || data.display_name);
                setAddress(formatted);
            } else if (data && data.display_name) {
                setAddress(data.display_name);
            } else {
                setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        } catch (err) {
            console.error('Geocoding failed', err);
            setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
    };

    // Initial load logic
    useEffect(() => {
        if (!initialLat || !initialLng) {
            handleLocateMe();
        } else {
            // Fetch address for initial position if needed
            fetchAddress(initialLat, initialLng);
        }
    }, []);

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            setLoading(true);
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setPosition(newPos);
                    fetchAddress(newPos[0], newPos[1]);
                    setLoading(false);
                },
                (err) => {
                    console.error("Error getting location", err);
                    setLoading(false);
                    if (!position) setPosition([39.9042, 116.4074]);
                }
            );
        } else {
            if (!position) setPosition([39.9042, 116.4074]);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&accept-language=zh-CN`, {
                headers: {
                    'User-Agent': 'Phowson/1.0 (https://phowson.com)'
                }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
                setPosition(newPos);
                fetchAddress(newPos[0], newPos[1]);
            } else {
                toast.error('未找到该地点');
            }
        } catch (err) {
            console.error('Search failed', err);
            toast.error('搜索失败');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (position) {
            onSelect(position[0], position[1], address);
            onClose();
        } else {
            toast.error('请在地图上选择一个位置');
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary" />
                        选择位置
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative">
                    {loading && (
                        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="absolute top-4 left-4 right-4 z-[900] max-w-md mx-auto">
                        <form onSubmit={handleSearch} className="relative shadow-lg rounded-2xl">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索地点..."
                                className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none dark:text-white"
                            />
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <button type="submit" className="absolute right-2 top-2 p-1 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-colors">
                                <Search className="w-4 h-4" />
                            </button>
                        </form>
                    </div>

                    {/* Locate Me Button */}
                    <button 
                        onClick={handleLocateMe}
                        className="absolute bottom-20 right-4 z-[900] p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                        title="定位到当前位置"
                    >
                        <Navigation className="w-5 h-5" />
                    </button>

                    <MapContainer 
                        center={position || [39.9042, 116.4074]} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker 
                            position={position} 
                            setPosition={setPosition} 
                            onPositionChange={(lat, lng) => fetchAddress(lat, lng)} 
                        />
                    </MapContainer>
                    
                    {/* Address Overlay */}
                    {address && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap border border-gray-100 dark:border-gray-700">
                            {address}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900 z-10">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-2xl text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="px-6 py-2 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        确认位置
                    </button>
                </div>
            </div>
        </div>
    );
};
