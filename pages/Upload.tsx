import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    ArrowLeft, Upload as UploadIcon, X, MapPin, Camera, 
    Aperture, Timer, Zap, Disc, Tag, Save, Image as ImageIcon,
    ChevronDown, Calendar, Sparkles, AlertTriangle
} from 'lucide-react';
import exifr from 'exifr';
import { useQuery } from '@tanstack/react-query';
import api, { API_BASE_URL } from '../api';
import { useModal } from '../components/Modal';

type ApiCategory = {
    value: string;
    label: string;
    sortOrder: number;
};

type UploadStatus = 'queued' | 'uploading' | 'success' | 'failed';

type UploadItem = {
    id: string;
    file: File;
    previewUrl: string;
    title: string;
    description: string;
    status: UploadStatus;
    error?: string;
    photoId?: string;
};

const filenameToTitle = (name: string) => {
    const base = String(name || '').split('/').pop() || '';
    const withoutExt = base.replace(/\.[^.]+$/, '');
    return withoutExt.trim() || '未命名';
};

const statusText = (s: UploadStatus) => {
    if (s === 'queued') return '排队中';
    if (s === 'uploading') return '上传中';
    if (s === 'success') return '完成';
    return '失败';
};

const statusClassName = (s: UploadStatus) => {
    if (s === 'queued') return 'bg-gray-100 text-gray-700 dark:bg-surface-border dark:text-gray-200';
    if (s === 'uploading') return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200';
    if (s === 'success') return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200';
    return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200';
};

const toMediaUrl = (url: string | null | undefined) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE_URL}${u}`;
};

export const Upload: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>(); 
    const isEditMode = !!id;

    // Form State
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [isUploadingQueue, setIsUploadingQueue] = useState(false);
    
    // Data State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('landscape');
    const [location, setLocation] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    const uploadItemsRef = useRef<UploadItem[]>([]);

    const isQueueMode = !isEditMode && uploadItems.length > 0;

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get<ApiCategory[]>('/categories');
            return res.data;
        },
    });
    
    const { data: aiStatus } = useQuery({
        queryKey: ['ai-enabled'],
        queryFn: async () => {
            const res = await api.get<{ enabled: boolean; provider: string }>('/ai/enabled');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
    
    // EXIF State
    const [exif, setExif] = useState({
        camera: '',
        lens: '',
        aperture: '',
        shutterSpeed: '',
        iso: '',
        focalLength: ''
    });

    // Load data if edit mode
    useEffect(() => {
        if (isEditMode) {
            const fetchPhoto = async () => {
                try {
                    const res = await api.get(`/photos/${id}`);
                    const photo = res.data;
                    setPreviewUrl(toMediaUrl(photo.mediumUrl || photo.url));
                    setTitle(photo.title);
                    setDescription(photo.description);
                    setCategory(photo.category);
                    const parsedExif = JSON.parse(photo.exif || '{}');
                    setLocation(parsedExif.location || '');
                    setDate(parsedExif.date || photo.createdAt.split('T')[0]);
                    setTags(photo.tags?.split(',') || []);
                    setExif({
                        camera: parsedExif.camera || parsedExif.Model || '',
                        lens: parsedExif.lens || parsedExif.LensModel || '',
                        aperture: parsedExif.aperture || (parsedExif.FNumber ? `f/${parsedExif.FNumber}` : ''),
                        shutterSpeed: parsedExif.shutterSpeed || (parsedExif.ExposureTime ? `1/${Math.round(1/parsedExif.ExposureTime)}s` : ''),
                        iso: parsedExif.iso?.toString?.() || parsedExif.ISO?.toString?.() || String(parsedExif.iso || parsedExif.ISO || ''),
                        focalLength: parsedExif.focalLength || (parsedExif.FocalLength ? `${parsedExif.FocalLength}mm` : '')
                    });
                } catch (err) {
                    console.error('Error fetching photo:', err);
                }
            };
            fetchPhoto();
        }
    }, [id, isEditMode]);

    // Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files || []) as File[];
        if (files.length) {
            handleFiles(files);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length) {
            handleFiles(files);
        }
        e.target.value = '';
    };

    const addFilesToQueue = (files: File[]) => {
        const next = files
            .filter(f => f && f.type.startsWith('image/'))
            .map((file) => {
                const id = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`;
                const previewUrl = URL.createObjectURL(file);
                return {
                    id,
                    file,
                    previewUrl,
                    title: filenameToTitle(file.name),
                    description: '',
                    status: 'queued' as const,
                };
            });

        if (!next.length) return;
        setUploadItems(prev => [...prev, ...next]);
    };

    const handleFiles = async (files: File[]) => {
        if (isEditMode) {
            await handleFile(files[0]);
            return;
        }
        if (files.length === 1 && uploadItems.length === 0) {
            await handleFile(files[0]);
            return;
        }

        setPreviewUrl(null);
        setSelectedFile(null);
        addFilesToQueue(files);
    };

    const handleFile = async (file: File) => {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Parse EXIF
        try {
            const exifData = await exifr.parse(file);
            if (exifData) {
                setExif({
                    camera: exifData.Model || '',
                    lens: exifData.LensModel || '',
                    aperture: exifData.FNumber ? `f/${exifData.FNumber}` : '',
                    shutterSpeed: exifData.ExposureTime ? `1/${Math.round(1/exifData.ExposureTime)}s` : '',
                    iso: exifData.ISO?.toString() || '',
                    focalLength: exifData.FocalLength ? `${exifData.FocalLength}mm` : ''
                });
                if (exifData.DateTimeOriginal) {
                    setDate(new Date(exifData.DateTimeOriginal).toISOString().split('T')[0]);
                }
            }
        } catch (err) {
            console.error('EXIF parsing failed:', err);
        }
    };

    useEffect(() => {
        uploadItemsRef.current = uploadItems;
    }, [uploadItems]);

    useEffect(() => {
        return () => {
            for (const it of uploadItemsRef.current) {
                try {
                    URL.revokeObjectURL(it.previewUrl);
                } catch {
                }
            }
        };
    }, []);

    const uploadConcurrency = 3;

    const uploadSingleItem = async (current: UploadItem) => {
        if (current.status !== 'queued') return;

        setUploadItems(prev => prev.map(i => (i.id === current.id ? { ...i, status: 'uploading', error: undefined } : i)));

        const formData = new FormData();
        formData.append('photo', current.file);
        formData.append('title', current.title);
        formData.append('description', current.description);
        formData.append('category', category);
        formData.append('tags', tags.join(','));
        formData.append('exif', JSON.stringify({ location }));

        try {
            const res = await api.post<any>('/photos', formData);
            const photoId = String((res.data as any)?.id || '');
            setUploadItems(prev => prev.map(i => (i.id === current.id ? { ...i, status: 'success', photoId } : i)));
        } catch (err: any) {
            const msg = String(err?.data?.message || err?.message || '上传失败');
            setUploadItems(prev => prev.map(i => (i.id === current.id ? { ...i, status: 'failed', error: msg } : i)));
        }
    };

    const pumpQueue = () => {
        const snapshot = uploadItems;
        const uploading = snapshot.filter(i => i.status === 'uploading').length;
        const queued = snapshot.filter(i => i.status === 'queued');
        if (!isUploadingQueue) return;
        if (queued.length === 0) return;
        if (uploading >= uploadConcurrency) return;

        const toStart = queued.slice(0, uploadConcurrency - uploading);
        for (const it of toStart) {
            uploadSingleItem(it);
        }
    };

    useEffect(() => {
        if (!isQueueMode) return;
        if (!isUploadingQueue) return;

        pumpQueue();

        const hasQueued = uploadItems.some(i => i.status === 'queued');
        const hasUploading = uploadItems.some(i => i.status === 'uploading');
        if (!hasQueued && !hasUploading) setIsUploadingQueue(false);
    }, [uploadItems, isQueueMode, isUploadingQueue]);

    useEffect(() => {
        if (!isQueueMode) return;
        if (isUploadingQueue) return;
        if (uploadItems.length === 0) return;
        const allSuccess = uploadItems.every(i => i.status === 'success');
        if (allSuccess) {
            navigate('/admin');
        }
    }, [uploadItems, isQueueMode, isUploadingQueue, navigate]);

    const startQueueUpload = async () => {
        if (!isQueueMode) return;
        setIsUploadingQueue(true);
    };

    const retryItem = (id: string) => {
        setUploadItems(prev => prev.map(i => (i.id === id ? { ...i, status: 'queued', error: undefined } : i)));
    };

    const removeItem = (id: string) => {
        setUploadItems(prev => {
            const target = prev.find(i => i.id === id);
            if (target) {
                try {
                    URL.revokeObjectURL(target.previewUrl);
                } catch {
                }
            }
            return prev.filter(i => i.id !== id);
        });
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    // AI Analysis Handler
    const { alert, confirm } = useModal();
    const blobToDataUrl = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('读取图片失败'));
            reader.readAsDataURL(blob);
        });

    const compressImageForAi = async (file: File) => {
        const maxEdge = 1280;
        const quality = 0.82;
        const outType = 'image/jpeg';

        const drawToCanvas = async (source: CanvasImageSource, width: number, height: number) => {
            const scale = Math.min(1, maxEdge / Math.max(width, height));
            const targetW = Math.max(1, Math.round(width * scale));
            const targetH = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('浏览器不支持 Canvas');
            ctx.drawImage(source, 0, 0, targetW, targetH);
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))), outType, quality);
            });
            const dataUrl = await blobToDataUrl(blob);
            const base64 = dataUrl.split(',')[1] || '';
            return { base64, mimeType: outType };
        };

        try {
            const bitmap = await createImageBitmap(file);
            try {
                return await drawToCanvas(bitmap, bitmap.width, bitmap.height);
            } finally {
                (bitmap as any).close?.();
            }
        } catch {
            const url = URL.createObjectURL(file);
            try {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const el = new Image();
                    el.onload = () => resolve(el);
                    el.onerror = () => reject(new Error('加载图片失败'));
                    el.src = url;
                });
                return await drawToCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
            } finally {
                try {
                    URL.revokeObjectURL(url);
                } catch {
                }
            }
        }
    };
    const handleAnalyzePhoto = async () => {
        if (isQueueMode) return;
        if (!previewUrl) return;
        setIsAnalyzing(true);

        try {
            let res;
            if (String(previewUrl).startsWith('data:')) {
                if (!selectedFile) {
                    alert({ title: '无法识别', content: '未找到本地文件，无法用于 AI 识别。请重新选择要分析的图片。' });
                    return;
                }
                const { base64, mimeType } = await compressImageForAi(selectedFile);
                res = await api.post<any>('/ai/fill', {
                    imageBase64: base64,
                    mimeType,
                });
            } else if (isEditMode && id) {
                let proceed = false;
                await new Promise<void>((resolve) => {
                    confirm({
                        title: '覆盖确认',
                        content: 'AI 智能填单会覆盖当前已填写内容，是否继续？',
                        onConfirm: () => { proceed = true; resolve(); },
                        onCancel: () => { proceed = false; resolve(); },
                    });
                });
                if (!proceed) return;
                res = await api.post<any>(`/photos/${id}/ai-fill`, {});
            } else {
                alert({ title: '无法识别', content: '当前图片不是本地选中的文件，无法用于 AI 识别。请重新选择要分析的图片。' });
                return;
            }
            const data = res.data as any;

            if (data.title) setTitle(data.title);
            if (data.description) setDescription(data.description);
            if (data.tags && Array.isArray(data.tags)) setTags(data.tags);
            if (data.category) setCategory(data.category);
            
            if (data.exif && typeof data.exif === 'object') {
                setExif(prev => ({
                    ...prev,
                    camera: data.exif.camera ?? prev.camera,
                    lens: data.exif.lens ?? prev.lens,
                    aperture: data.exif.aperture ?? prev.aperture,
                    shutterSpeed: data.exif.shutterSpeed ?? prev.shutterSpeed,
                    iso: data.exif.iso ?? prev.iso,
                    focalLength: data.exif.focalLength ?? prev.focalLength,
                }));
            }

        } catch (error) {
            console.error("AI Analysis failed:", error);
            const err: any = error;
            const code = String(err?.data?.code || '');
            const msg = String(err?.data?.message || '');
            if (code === 'AI_NOT_CONFIGURED') {
                alert({ title: 'AI 未配置', content: msg || 'AI 未配置（请在服务端配置环境变量），已降级为手动填写。' });
                return;
            }
            alert({ title: '分析失败', content: msg || 'AI 分析失败，请手动输入。' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = async (e?: any) => {
        e?.preventDefault?.();
        if (isQueueMode) {
            await startQueueUpload();
            return;
        }
        if (!selectedFile && !isEditMode) return;
        
        setIsLoading(true);
        const formData = new FormData();
        if (selectedFile) {
            formData.append('photo', selectedFile);
        }
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('tags', tags.join(','));
        formData.append('exif', JSON.stringify({ ...exif, location, date }));

        try {
            if (isEditMode) {
                await api.patch(`/photos/${id}`, formData);
            } else {
                await api.post('/photos', formData);
            }
            navigate('/admin');
        } catch (error) {
            console.error('Upload failed:', error);
            const err: any = error;
            const msg = String(err?.data?.message || '');
            const requestId = String(err?.data?.requestId || '');
            alert({ title: '上传失败', content: msg ? `${msg}${requestId ? `\n请求ID: ${requestId}` : ''}` : '上传失败，请重试' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20 transition-colors duration-300">
            {/* Top Bar */}
            <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#111a22]/90 backdrop-blur-md border-b border-gray-200 dark:border-surface-border px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">{isEditMode ? '编辑照片' : '上传新照片'}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/admin')}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isQueueMode ? uploadItems.length === 0 || isUploadingQueue : isLoading || !previewUrl}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-full font-medium transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isQueueMode ? (
                            isUploadingQueue ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    上传中...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    开始上传
                                </>
                            )
                        ) : isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                保存中...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                发布
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left: Image Upload & Preview */}
                    <div className="lg:w-2/3 space-y-6">
                        <div 
                            className={`
                                relative aspect-[4/3] rounded-2xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center
                                ${isDragging 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-gray-300 dark:border-surface-border bg-white dark:bg-surface-dark'
                                }
                                ${!previewUrl && !isQueueMode ? 'cursor-pointer hover:border-primary/50' : ''}
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            {isQueueMode ? (
                                <div className="w-full h-full p-4 flex flex-col">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                            已添加 {uploadItems.length} 张
                                        </div>
                                        <label className="px-3 py-2 text-sm font-medium bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg hover:bg-gray-50 dark:hover:bg-[#23303e] cursor-pointer transition-colors">
                                            继续添加
                                            <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" multiple />
                                        </label>
                                    </div>

                                    <div className="mt-4 flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-surface-border bg-gray-50/50 dark:bg-[#0f1720]">
                                        <div className="divide-y divide-gray-200 dark:divide-surface-border">
                                            {uploadItems.map((it) => (
                                                <div key={it.id} className="flex items-center gap-3 p-3">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-surface-border shrink-0">
                                                        <img src={it.previewUrl} alt={it.title} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <input
                                                            type="text"
                                                            value={it.title}
                                                            disabled={it.status === 'uploading' || it.status === 'success' || isUploadingQueue}
                                                            onChange={(e) => setUploadItems(prev => prev.map(p => (p.id === it.id ? { ...p, title: e.target.value } : p)))}
                                                            className="w-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary truncate disabled:opacity-70"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClassName(it.status)}`}>{statusText(it.status)}</span>
                                                            {it.error ? <span className="text-xs text-red-600 dark:text-red-300 truncate">{it.error}</span> : null}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {it.status === 'failed' && !isUploadingQueue ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => retryItem(it.id)}
                                                                className="px-3 py-2 text-xs font-medium bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg hover:bg-gray-50 dark:hover:bg-[#23303e] transition-colors"
                                                            >
                                                                重试
                                                            </button>
                                                        ) : null}
                                                        {it.status !== 'uploading' && !isUploadingQueue ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(it.id)}
                                                                className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                            >
                                                                移除
                                                            </button>
                                                        ) : null}
                                                        {it.status === 'uploading' ? <span className="w-4 h-4 border-2 border-gray-400/40 border-t-gray-600 dark:border-white/30 dark:border-t-white rounded-full animate-spin" /> : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <div>
                                            已完成 {uploadItems.filter(i => i.status === 'success').length} / {uploadItems.length}
                                        </div>
                                        <div>
                                            失败 {uploadItems.filter(i => i.status === 'failed').length}
                                        </div>
                                    </div>
                                </div>
                            ) : previewUrl ? (
                                <div className="relative w-full h-full group">
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain bg-black/5 dark:bg-black/20" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <button 
                                            onClick={() => setPreviewUrl(null)}
                                            className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                            title="移除照片"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                        <label className="p-3 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors shadow-lg cursor-pointer">
                                            <UploadIcon className="w-6 h-6" />
                                            <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" multiple={!isEditMode} />
                                        </label>
                                    </div>
                                    
                                    {/* AI Analyze Button */}
                                    <button 
                                        onClick={handleAnalyzePhoto}
                                        disabled={isAnalyzing || aiStatus?.enabled === false}
                                        className="absolute bottom-4 right-4 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all disabled:opacity-70 font-medium text-sm"
                                    >
                                        {isAnalyzing ? (
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        ) : (
                                            <Sparkles className="w-4 h-4" />
                                        )}
                                        {isAnalyzing ? 'AI 识别中...' : (aiStatus?.enabled === false ? 'AI 未配置' : 'AI 智能填单')}
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                    <div className="p-4 bg-primary/10 rounded-full text-primary mb-4">
                                        <UploadIcon className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">拖放照片至此，或点击上传</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">支持 JPG, PNG, WEBP (最大 20MB)</p>
                                    <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" multiple={!isEditMode} />
                                </label>
                            )}
                        </div>

                        {!isQueueMode ? (
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-primary" />
                                    拍摄参数 (EXIF)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                            <Camera className="w-3 h-3" /> 机身
                                        </label>
                                        <input 
                                            type="text" 
                                            value={exif.camera}
                                            onChange={e => setExif({...exif, camera: e.target.value})}
                                            className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                            placeholder="Sony A7R V"
                                        />
                                    </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                        <Disc className="w-3 h-3" /> 镜头
                                    </label>
                                    <input 
                                        type="text" 
                                        value={exif.lens}
                                        onChange={e => setExif({...exif, lens: e.target.value})}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                        placeholder="FE 35mm F1.4 GM"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                        <Aperture className="w-3 h-3" /> 光圈
                                    </label>
                                    <input 
                                        type="text" 
                                        value={exif.aperture}
                                        onChange={e => setExif({...exif, aperture: e.target.value})}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                        placeholder="f/1.4"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                        <Timer className="w-3 h-3" /> 快门
                                    </label>
                                    <input 
                                        type="text" 
                                        value={exif.shutterSpeed}
                                        onChange={e => setExif({...exif, shutterSpeed: e.target.value})}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                        placeholder="1/200s"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> ISO
                                    </label>
                                    <input 
                                        type="text" 
                                        value={exif.iso}
                                        onChange={e => setExif({...exif, iso: e.target.value})}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                        placeholder="100"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> 焦段
                                    </label>
                                    <input 
                                        type="text" 
                                        value={exif.focalLength}
                                        onChange={e => setExif({...exif, focalLength: e.target.value})}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                                        placeholder="35mm"
                                    />
                                </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-primary" />
                                    批量上传
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    批量模式下会按右侧的分类/标签/地点统一应用。EXIF 归一与更完整的批量表单会在后续阶段补齐。
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right: Info Form */}
                    <div className="lg:w-1/3 space-y-6">
                        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl p-6 space-y-6">
                            {!isQueueMode ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">标题</label>
                                        <input 
                                            type="text" 
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-400 dark:placeholder-gray-600"
                                            placeholder="给照片起个好听的名字"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">描述 / 故事</label>
                                        <textarea 
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            rows={5}
                                            className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-400 dark:placeholder-gray-600 resize-none"
                                            placeholder="讲述这张照片背后的故事..."
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-4 rounded-xl text-sm text-gray-700 dark:text-gray-200">
                                    标题默认取文件名，可在左侧列表逐张修改。分类/标签/地点会统一应用到本次批量上传。
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {!isQueueMode ? (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">拍摄日期</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="date" 
                                                value={date}
                                                onChange={e => setDate(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg pl-10 pr-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary text-sm"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div />
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">拍摄地点</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="text" 
                                            value={location}
                                            onChange={e => setLocation(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg pl-10 pr-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary text-sm"
                                            placeholder="城市, 国家"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">分类</label>
                                <div className="relative">
                                    <select 
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-primary appearance-none"
                                    >
                                        {categories.length === 0 ? (
                                            <option value={category}>{category}</option>
                                        ) : categories.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">标签</label>
                                <div className="bg-gray-50 dark:bg-[#111a22] border border-gray-200 dark:border-surface-border rounded-lg p-2 min-h-[80px] flex flex-wrap gap-2 items-start">
                                    {tags.map(tag => (
                                        <span key={tag} className="inline-flex items-center gap-1 bg-white dark:bg-surface-border text-gray-700 dark:text-gray-200 px-2 py-1 rounded text-xs border border-gray-200 dark:border-gray-600">
                                            #{tag}
                                            <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                    <input 
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        className="bg-transparent text-sm min-w-[100px] flex-1 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                                        placeholder="输入标签按回车..."
                                    />
                                </div>
                            </div>
                        </div>

                        {!previewUrl && !isQueueMode && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 p-4 rounded-xl flex gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0" />
                                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <p className="font-medium">提示</p>
                                    <p className="mt-1">上传照片后，您可以点击 "AI 智能填单" 让系统自动识别照片内容、生成标题、描述和标签。</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
