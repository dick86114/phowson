import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { 
    Upload as UploadIcon, X, MapPin, Calendar, 
    Camera, Aperture, Timer, Zap, MoveDiagonal, 
    Image as ImageIcon, Check, Loader2, ArrowLeft,
    Maximize2, Sliders, Save, Send, Sparkles, Tag,
    Map as MapIcon, Trash2, RefreshCw, Eye, EyeOff,
    HelpCircle, Mountain, User, Building, Plane, Film, FileText, AlertCircle, RotateCcw, ScanLine
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import toast from 'react-hot-toast';
import exifr from 'exifr';
import DatePicker from '../components/DatePicker';
import { getPhotoUrl } from '../utils/helpers';
import { FormSelect } from '../components/admin/FormSelect';
import { LocationPicker } from '../components/LocationPicker';

// Interface for Technical Details
interface ExifData {
    camera: string;
    lens: string;
    aperture: string;
    shutterSpeed: string;
    iso: string;
    focalLength: string;
    lat: number | null;
    lng: number | null;
}

type SupplementalItem = {
    field: 'location' | 'date';
    value: string;
    source: 'filename' | 'watermark';
    prevValue: string;
    lat?: number | null;
    lng?: number | null;
    prevLat?: number | null;
    prevLng?: number | null;
};

export const Upload = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    
    // State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('uncategorized');
    const [categories, setCategories] = useState<{ value: string; label: string; icon: React.ReactNode }[]>([]);
    const [isPublic, setIsPublic] = useState(true);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [location, setLocation] = useState('');
    const [date, setDate] = useState('');
    const [exif, setExif] = useState<ExifData>({
        camera: '', lens: '', aperture: '', shutterSpeed: '', iso: '', focalLength: '', lat: null, lng: null
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [fileMeta, setFileMeta] = useState<{ width: number | null, height: number | null, bytes: number }>({ width: null, height: null, bytes: 0 });
    const [supplementalInfo, setSupplementalInfo] = useState<SupplementalItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toDateOnly = (value: any) => {
        if (!value) return '';
        if (typeof value === 'string') {
            const s = value.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;
            const ms = Date.parse(s);
            if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
        }
        try {
            const d = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(d.getTime())) return '';
            return d.toISOString().slice(0, 10);
        } catch {
            return '';
        }
    };

    // Load existing data for edit mode
    useEffect(() => {
        if (isEditMode && id) {
            const fetchPhoto = async () => {
                try {
                    const { data } = await api.get(`/photos/${id}`);
                    setTitle(data.title || '');
                    setDescription(data.description || '');
                    setCategory(data.category || 'uncategorized');
                    setTags(data.tags ? data.tags.split(',').filter(Boolean) : []);
                    if (data.isPublic !== undefined && data.isPublic !== null) setIsPublic(!!data.isPublic);
                    
                    // Set preview
                    const pUrl = getPhotoUrl(data, 'medium');
                    setPreviewUrl(pUrl);
                    
                    // Get dimensions
                    if (pUrl) {
                        getImageDimensions(pUrl)
                            .then(({ width, height }) => setFileMeta(prev => ({ ...prev, width, height })))
                            .catch(() => {});
                    }
                    
                    // Set EXIF if available
                    if (data.exif) {
                        try {
                            const parsedExif = typeof data.exif === 'string' ? JSON.parse(data.exif) : data.exif;
                            const locationValue = String(parsedExif?.location || '').trim();
                            if (locationValue) setLocation(locationValue);
                            const dateValue = toDateOnly(parsedExif?.date || parsedExif?.DateTimeOriginal || parsedExif?.CreateDate || parsedExif?.DateTime);
                            if (dateValue) setDate(dateValue);
                            setExif({
                                camera: parsedExif.Model || '',
                                lens: parsedExif.LensModel || '',
                                aperture: parsedExif.FNumber ? `f/${parsedExif.FNumber}` : '',
                                shutterSpeed: parsedExif.ExposureTime ? `${parsedExif.ExposureTime}s` : '',
                                iso: parsedExif.ISO?.toString() || '',
                                focalLength: parsedExif.FocalLength ? `${parsedExif.FocalLength}mm` : '',
                                lat: parsedExif.lat || null,
                                lng: parsedExif.lng || null
                            });
                        } catch (e) {
                            console.error('Failed to parse EXIF', e);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load photo', error);
                    toast.error('加载照片信息失败');
                    navigate('/admin/manage/photos');
                }
            };
            fetchPhoto();
        }
    }, [isEditMode, id, navigate]);

    // Constants & Icon Mapping
    const CATEGORY_ICONS: Record<string, React.ReactNode> = {
        'uncategorized': <HelpCircle className="w-4 h-4" />,
        'landscape': <Mountain className="w-4 h-4" />,
        'portrait': <User className="w-4 h-4" />,
        'street': <Camera className="w-4 h-4" />,
        'documentary': <FileText className="w-4 h-4" />,
        'architecture': <Building className="w-4 h-4" />,
        'travel': <Plane className="w-4 h-4" />,
        'movie': <Film className="w-4 h-4" />,
    };
    
    const VISIBILITY_OPTIONS = [
        { value: 'public', label: '公开', icon: <Eye className="w-4 h-4" /> },
        { value: 'private', label: '私密', icon: <EyeOff className="w-4 h-4" /> }
    ];

    // Load categories
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const res = await api.get('/categories');
                // Ensure data is array
                const data = Array.isArray(res) ? res : (res as any).data || [];
                
                const formatted = data.map((c: any) => {
                    let Icon = <HelpCircle className="w-4 h-4" />;
                    // Prioritize icon from DB setting
                    if (c.icon && (LucideIcons as any)[c.icon]) {
                         const IconComponent = (LucideIcons as any)[c.icon];
                         Icon = <IconComponent className="w-4 h-4" />;
                    } 
                    // Fallback to hardcoded mapping
                    else if (CATEGORY_ICONS[c.value]) {
                         Icon = CATEGORY_ICONS[c.value];
                    }
                    
                    return {
                        value: c.value,
                        label: c.label,
                        icon: Icon
                    };
                });
                setCategories(formatted);
            } catch (err) {
                console.error('Failed to load categories', err);
                // Fallback
                setCategories([
                    { value: 'uncategorized', label: '未分类', icon: <HelpCircle className="w-4 h-4" /> }
                ]);
            }
        };
        loadCategories();
    }, []);

    // Helper: Get Image Dimensions
    const getImageDimensions = (url: string): Promise<{ width: number, height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = reject;
            img.src = url;
        });
    };

    // Helper: File to Base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };

    // Helper: Fetch Geocode
    const fetchGeocode = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN`, {
                headers: {
                    'User-Agent': 'Phowson/1.0 (https://phowson.com)'
                }
            });
            const data = await res.json();
            const addr = data.address;
            const country = addr.country || '';
            // Remove country from city/state if present to avoid duplication (e.g. "美国;美國")
            let city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
            if (country && city.includes(country)) {
                city = city.replace(country, '').replace(/^[·,;\s]+|[·,;\s]+$/g, '');
            }
            // Clean up any remaining weird characters
            city = city.replace(/[;；].*$/, ''); 
            
            return country && city ? `${country} · ${city}` : (country || city || '');
        } catch (e) {
            console.error('地理编码失败', e);
            return '';
        }
    };

    // Handle File Selection
    const handleFile = async (file: File) => {
        setSelectedFile(file);
        setFileMeta({ width: null, height: null, bytes: file.size });
        setSupplementalInfo([]);
        
        // Auto set title
        const base = String(file.name || '').split('/').pop() || '';
        const withoutExt = base.replace(/\.[^.]+$/, '');
        if (!title) setTitle(withoutExt.trim() || '未命名');

        // Create Preview & Get Dimensions
        const objUrl = URL.createObjectURL(file);
        setPreviewUrl(objUrl);
        getImageDimensions(objUrl)
            .then(({ width, height }) => setFileMeta(prev => ({ ...prev, width, height })))
            .catch(() => {}); // Ignore error

        // Parse EXIF
        try {
            const exifData = await exifr.parse(file);
            if (exifData) {
                const lat = typeof exifData.latitude === 'number' ? exifData.latitude : null;
                const lng = typeof exifData.longitude === 'number' ? exifData.longitude : null;

                setExif({
                    camera: exifData.Model || '',
                    lens: exifData.LensModel || '',
                    aperture: exifData.FNumber ? `f/${exifData.FNumber}` : '',
                    shutterSpeed: exifData.ExposureTime ? (exifData.ExposureTime < 1 ? `1/${Math.round(1/exifData.ExposureTime)}` : `${exifData.ExposureTime}`) + 's' : '',
                    iso: exifData.ISO?.toString() || '',
                    focalLength: exifData.FocalLength ? `${exifData.FocalLength}mm` : '',
                    lat,
                    lng
                });
                
                if (lat != null && lng != null) {
                    fetchGeocode(lat, lng).then(loc => {
                        if (loc) setLocation(loc);
                    });
                }

                if (exifData.DateTimeOriginal) {
                    setDate(new Date(exifData.DateTimeOriginal).toISOString().split('T')[0]);
                }
            }
        } catch (err) {
            console.error('EXIF 解析失败:', err);
        }
    };

    // Drag & Drop Handlers
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter((f: any) => f.type.startsWith('image/')) as File[];
        if (files.length > 0) handleFile(files[0]);
    };

    // Remove Photo
    const handleRemovePhoto = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setFileMeta({ width: null, height: null, bytes: 0 });
        setTitle('');
        setDescription('');
        setTags([]);
        setLocation('');
        setDate('');
        setExif({ camera: '', lens: '', aperture: '', shutterSpeed: '', iso: '', focalLength: '', lat: null, lng: null });
        setSupplementalInfo([]);
    };

    // Tag Handlers
    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newTag = tagInput.trim();
            if (newTag && !tags.includes(newTag)) {
                setTags([...tags, newTag]);
                setTagInput('');
            }
        }
    };
    const removeTag = (tagToRemove: string) => setTags(tags.filter(t => t !== tagToRemove));

    const resizeImage = (file: File, maxDim: number = 1024): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                };
                img.onerror = reject;
                img.src = event.target?.result as string;
            };
            reader.onerror = reject;
        });
    };

    const handleAIAnalysis = async () => {
        if (isAnalyzing) return;
        setAiError(null);
        setSupplementalInfo([]);
        if (!user || user.role !== 'admin') {
            toast.error('AI 功能仅管理员可用');
            return;
        }
        if (!selectedFile && !(isEditMode && id)) {
            toast.error('请先选择照片');
            return;
        }

        setIsAnalyzing(true);
        try {
            let imageBase64 = '';
            let mimeType = 'image/jpeg';
            let filename = '';
            const tzOffsetMinutes = new Date().getTimezoneOffset();

            if (selectedFile) {
                imageBase64 = await resizeImage(selectedFile, 1024);
                mimeType = 'image/jpeg';
                filename = selectedFile.name;
            }

            const res = selectedFile
                ? await api.post('/ai/fill', {
                    imageBase64,
                    mimeType,
                    locationHint: location,
                    filename,
                    tzOffsetMinutes
                })
                : await api.post(`/photos/${id}/ai-fill`, { tzOffsetMinutes });

            const data = res.data as any;
            if (data) {
                if (data.title) setTitle(data.title);
                if (data.description) setDescription(data.description);
                if (data.tags && Array.isArray(data.tags)) {
                    const newTags = data.tags.filter((t: string) => !tags.includes(t));
                    if (newTags.length > 0) setTags([...tags, ...newTags]);
                }
                if (data.category) {
                    const match = categories.find(c => c.label === data.category || c.value === data.category);
                    if (match) setCategory(match.value ? match.value : 'uncategorized');
                }
                const supplementalItems: SupplementalItem[] = [];
                const supplemental = data?.supplemental || {};
                if (!location && supplemental?.location?.value) {
                    const nextLocation = String(supplemental.location.value || '').trim();
                    if (nextLocation) {
                        const prevLat = exif.lat;
                        const prevLng = exif.lng;
                        setLocation(nextLocation);
                        const lat = supplemental.location.lat;
                        const lng = supplemental.location.lng;
                        if (typeof lat === 'number' && typeof lng === 'number' && exif.lat == null && exif.lng == null) {
                            setExif(prev => ({ ...prev, lat, lng }));
                        }
                        supplementalItems.push({
                            field: 'location',
                            value: nextLocation,
                            source: supplemental.location.source === 'watermark' ? 'watermark' : 'filename',
                            prevValue: location,
                            lat: typeof lat === 'number' ? lat : null,
                            lng: typeof lng === 'number' ? lng : null,
                            prevLat,
                            prevLng
                        });
                    }
                }
                if (!date && supplemental?.dateTime?.dateOnly) {
                    const nextDate = String(supplemental.dateTime.dateOnly || '').trim();
                    if (nextDate) {
                        setDate(nextDate);
                        supplementalItems.push({
                            field: 'date',
                            value: nextDate,
                            source: supplemental.dateTime.source === 'watermark' ? 'watermark' : 'filename',
                            prevValue: date
                        });
                    }
                }
                if (supplementalItems.length > 0) setSupplementalInfo(supplementalItems);
                toast.success('AI 分析完成');
            }
        } catch (err: any) {
            console.error('AI Analysis failed', err);
            const status = Number(err?.status);
            const code = typeof err?.data?.code === 'string' ? String(err.data.code) : '';
            const requestId = typeof err?.data?.requestId === 'string' ? String(err.data.requestId) : '';
            const detail = String(err?.data?.message || err?.serverMessage || err?.message || '未知错误');
            const parts: string[] = [];
            if (Number.isFinite(status) && status > 0) parts.push(`[${status}]`);
            if (code) parts.push(code);
            if (detail) parts.push(detail);
            if (requestId) parts.push(`requestId: ${requestId}`);
            
            const errorMsg = parts.join(' ');
            setAiError(errorMsg);
            toast.error(`AI 分析失败：${errorMsg}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUndoSupplemental = (item: SupplementalItem) => {
        if (item.field === 'location') {
            setLocation(item.prevValue);
            setExif(prev => ({
                ...prev,
                lat: item.prevLat ?? null,
                lng: item.prevLng ?? null
            }));
        } else {
            setDate(item.prevValue);
        }
        setSupplementalInfo(prev => prev.filter(s => s.field !== item.field));
    };

    // Submit Handler
    const handleSubmit = async () => {
        if (!selectedFile && !isEditMode) {
            toast.error('请选择照片');
            return;
        }
        if (!title) {
            toast.error('请输入标题');
            return;
        }

        setIsUploading(true);
        const fd = new FormData();
        if (selectedFile) {
            fd.append('photo', selectedFile);
        }
        fd.append('title', title);
        fd.append('description', description);
        fd.append('category', category);
        fd.append('tags', tags.join(','));
        fd.append('isPublic', String(isPublic));
        fd.append('exif', JSON.stringify({
            Model: exif.camera,
            LensModel: exif.lens,
            FNumber: exif.aperture ? parseFloat(exif.aperture.replace('f/', '')) : null,
            ExposureTime: exif.shutterSpeed ? (exif.shutterSpeed.includes('/') ? 1/parseFloat(exif.shutterSpeed.split('/')[1].replace('s','')) : parseFloat(exif.shutterSpeed.replace('s',''))) : null,
            ISO: parseInt(exif.iso) || null,
            FocalLength: parseFloat(exif.focalLength.replace('mm','')) || null,
            DateTimeOriginal: date ? new Date(date).toISOString() : null,
            lat: exif.lat,
            lng: exif.lng,
            location: location
        }));

        try {
            if (isEditMode && id) {
                await api.patch(`/photos/${id}`, fd);
                toast.success('更新成功');
            } else {
                await api.post('/photos', fd);
                toast.success('发布成功');
            }
            navigate(-1);
        } catch (err: any) {
            toast.error(err?.data?.message || err.message || '操作失败');
        } finally {
            setIsUploading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col md:flex-row">
            {/* Hidden Input for File Replacement */}
            <input 
                ref={fileInputRef} 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
            />

            {/* Left Column: Preview */}
            <div className="w-full md:w-[55%] lg:w-[60%] bg-gray-50 dark:bg-gray-900/50 p-6 md:p-8 flex flex-col h-[50vh] md:h-screen relative border-r border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="absolute top-6 left-6 z-10">
                    <button 
                        onClick={() => navigate(-1)}
                        className="group flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        返回
                    </button>
                </div>

                {/* Main Preview Area */}
                <div 
                    className={`flex-1 flex items-center justify-center relative rounded-2xl overflow-hidden transition-all duration-300 ${
                        isDragging ? 'ring-4 ring-primary/20 bg-primary/5 scale-[0.99]' : ''
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    {previewUrl ? (
                        <>
                            {/* Image Actions: AI, Replace, Remove */}
                            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                                <span className="hidden sm:inline-block text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-black/60 backdrop-blur-md px-2 py-1 rounded-full shadow-sm border border-white/20 dark:border-white/10 animate-in fade-in slide-in-from-right-4 duration-500">
                                    已保留 EXIF 信息，仅补全缺失字段
                                </span>
                                <div className="flex items-center gap-1 bg-white/50 dark:bg-black/20 backdrop-blur-sm p-1 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm">
                                    <button 
                                        onClick={handleAIAnalysis}
                                        disabled={isAnalyzing}
                                        className="px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-primary transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                        <span className="hidden sm:inline">AI 智能分析</span>
                                        <span className="sm:hidden">AI</span>
                                    </button>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-white dark:hover:bg-gray-700 transition-all"
                                        title="更换照片"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={handleRemovePhoto}
                                        className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-white dark:hover:bg-gray-700 transition-all"
                                        title="移除照片"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <img 
                                src={previewUrl} 
                                alt="Preview" 
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl"
                            />

                            {/* Image Metadata Footer */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-4 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-lg whitespace-nowrap">
                                <span>{selectedFile?.name || title || '未命名'}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                <span>{fileMeta.width && fileMeta.height ? `${fileMeta.width} × ${fileMeta.height}` : '计算中...'}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                <span>{formatBytes(fileMeta.bytes)}</span>
                            </div>
                        </>
                    ) : (
                        <div 
                            className="w-full h-full flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6">
                                <UploadIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">拖拽照片到此处</h3>
                            <p className="text-sm text-gray-500 mb-6">支持 JPEG, PNG, WEBP 格式</p>
                            <button className="btn-primary cursor-pointer inline-flex pointer-events-none">
                                浏览文件
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Form */}
            <div className="w-full md:w-[45%] lg:w-[40%] bg-white dark:bg-black h-auto md:h-screen overflow-y-auto flex flex-col">
                <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full space-y-6">

                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {isEditMode ? '编辑照片' : '发布新作品'}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isEditMode ? '更新照片信息' : '分享你的摄影作品'}
                        </p>
                    </div>

                    {aiError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-300">AI 分析遇到问题</h3>
                                <p className="text-sm text-red-600 dark:text-red-400 mt-1 break-all">{aiError}</p>
                            </div>
                            <button 
                                onClick={() => setAiError(null)}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    {/* General Information */}
                    <section className="space-y-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-primary" />
                            基本信息
                        </h2>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    标题
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="为照片起个标题..."
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">照片故事</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="这张照片背后有什么故事？"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm font-medium min-h-[120px] resize-none focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">拍摄地点</label>
                                <div className="relative flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="添加地点"
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => setShowMap(true)}
                                        className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                                        title="在地图上选择"
                                    >
                                        <MapIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">分类</label>
                                    <FormSelect
                                        value={category}
                                        onChange={setCategory}
                                        options={categories}
                                        placeholder="选择分类"
                                        mobileGrid={true}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">拍摄日期</label>
                                    <DatePicker
                                        value={date}
                                        onChange={setDate}
                                        placeholder="选择日期"
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">可见性</label>
                                    <FormSelect
                                        value={isPublic ? 'public' : 'private'}
                                        onChange={(v) => setIsPublic(v === 'public')}
                                        options={VISIBILITY_OPTIONS}
                                        placeholder="选择可见性"
                                        mobileGrid={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {supplementalInfo.length > 0 && (
                        <section className="space-y-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-blue-500" />
                                补充信息
                            </h2>
                            <div className="space-y-3 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4">
                                {supplementalInfo.map((item) => (
                                    <div key={item.field} className="group flex items-center justify-between gap-4 p-2 hover:bg-white/50 dark:hover:bg-white/5 rounded-xl transition-all">
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-100">
                                                {item.field === 'location' ? <MapPin className="w-4 h-4 text-blue-500" /> : <Calendar className="w-4 h-4 text-blue-500" />}
                                                {item.field === 'location' ? 'AI 补全地点' : 'AI 补全日期'}
                                            </div>
                                            <div className="text-sm text-gray-700 dark:text-gray-300 break-all pl-6 font-medium">{item.value}</div>
                                            <div className="flex items-center gap-1.5 text-xs text-blue-600/70 dark:text-blue-400/70 pl-6">
                                                {item.source === 'filename' ? <FileText className="w-3 h-3" /> : <ScanLine className="w-3 h-3" />}
                                                {item.source === 'filename' ? '来自文件名解析' : '来自水印识别'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleUndoSupplemental(item)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-red-600 hover:bg-red-50 dark:text-blue-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 transition-all opacity-70 group-hover:opacity-100 bg-white/50 dark:bg-white/5 border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                            title="撤销此更改"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            撤销
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* EXIF Data */}
                    <section className="space-y-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Camera className="w-5 h-5 text-primary" />
                            拍摄参数（EXIF）
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { icon: Camera, label: '相机', value: exif.camera, key: 'camera' },
                                { icon: Aperture, label: '镜头', value: exif.lens, key: 'lens' },
                                { icon: Timer, label: '快门', value: exif.shutterSpeed, key: 'shutterSpeed' },
                                { icon: MoveDiagonal, label: '光圈', value: exif.aperture, key: 'aperture' },
                                { icon: Zap, label: 'ISO', value: exif.iso, key: 'iso' },
                                { icon: MoveDiagonal, label: '焦距', value: exif.focalLength, key: 'focalLength' },
                            ].map((item) => (
                                <div key={item.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-4 hover:border-primary/20 transition-colors shadow-sm">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                        <item.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="overflow-hidden flex-1 group/input">
                                        <div className="text-xs font-medium text-gray-400 mb-0.5 group-focus-within/input:text-primary transition-colors">{item.label}</div>
                                        {/* Editable Input for EXIF */}
                                        <textarea
                                            value={item.value}
                                            onChange={(e) => {
                                                setExif({ ...exif, [item.key]: e.target.value });
                                                // Auto-resize
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            placeholder="-"
                                            rows={1}
                                            className="w-full bg-transparent border-none p-0 text-sm font-bold text-gray-900 dark:text-white focus:ring-0 focus:outline-none placeholder:font-normal placeholder:text-gray-300 transition-all resize-none overflow-hidden whitespace-pre-wrap break-words"
                                            style={{ minHeight: '1.5em', height: 'auto' }}
                                            onFocus={(e) => {
                                                 e.target.style.height = 'auto';
                                                 e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                        />
                                        <div className="h-0.5 w-0 bg-primary group-focus-within/input:w-full transition-all duration-300 ease-out" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Discovery Tags */}
                    <section className="space-y-6 pb-20">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Tag className="w-5 h-5 text-primary" />
                            发现标签
                        </h2>
                        
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                        #{tag}
                                        <button onClick={() => removeTag(tag)} className="ml-1.5 hover:text-blue-900 dark:hover:text-blue-100">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder="+ 添加标签 (按回车或逗号)"
                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </section>

                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 p-6 md:px-10 flex items-center justify-end gap-4 z-10">
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 rounded-full text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isUploading}
                        className="px-10 py-3 btn-liquid text-gray-900 dark:text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditMode ? <Save className="w-5 h-5" /> : <Send className="w-5 h-5" />)}
                        {isUploading ? (isEditMode ? '保存中...' : '发布中...') : (isEditMode ? '保存修改' : '立即发布')}
                    </button>
                </div>
            </div>

            {/* Map Picker Modal */}
            {showMap && (
                <LocationPicker 
                    initialLat={exif.lat}
                    initialLng={exif.lng}
                    onSelect={(lat, lng, addr) => {
                        setExif(prev => ({ ...prev, lat, lng }));
                        if (addr) setLocation(addr);
                        setShowMap(false);
                    }}
                    onClose={() => setShowMap(false)}
                />
            )}
        </div>
    );
};

export default Upload;
