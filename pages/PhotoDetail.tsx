import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, MessageCircle, MoreHorizontal, Send, Bookmark, Maximize2, X, ZoomIn, ZoomOut, Download, RefreshCcw, Sparkles, Loader2, Monitor, HardDrive } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TransformWrapper, TransformComponent, useControls, useTransformComponent } from "react-zoom-pan-pinch";
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { ExifGrid, PhotoExifBadge } from '../components/PhotoComponents';
import { ShareCard } from '../components/shared/ShareCard';
import { ProgressiveImage } from '../components/ProgressiveImage';

const toMediaUrl = (url: string | null | undefined) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE_URL}${u}`;
};

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const v = bytes / Math.pow(1024, i);
    const fixed = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
};

const ZoomControls = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    const transformState = useTransformComponent(({ state }) => state);

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#1a2632]/80 backdrop-blur-md px-3 py-2 rounded-full border border-surface-border shadow-2xl pointer-events-auto">
            <button onClick={() => zoomOut()} className="p-2 text-gray-300 hover:text-white transition-colors" disabled={transformState.scale <= 0.5}>
                <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm font-mono w-14 text-center text-white select-none">{Math.round(transformState.scale * 100)}%</span>
            <button onClick={() => zoomIn()} className="p-2 text-gray-300 hover:text-white transition-colors" disabled={transformState.scale >= 8}>
                <ZoomIn className="w-5 h-5" />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={() => resetTransform()} className="p-2 text-gray-300 hover:text-primary transition-colors" title="重置">
                <RefreshCcw className="w-4 h-4" />
            </button>
        </div>
    );
};

export const PhotoDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const [inlineAspectRatio, setInlineAspectRatio] = useState<number>(4 / 3);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);
    
    // Fetch photo data
    const { data: photo, isLoading } = useQuery({
        queryKey: ['photo', id],
        queryFn: async () => {
            const res = await api.get(`/photos/${id}`);
            return res.data;
        }
    });

    // Fetch all photos to handle navigation
    const { data: allPhotos } = useQuery({
        queryKey: ['photos'],
        queryFn: async () => {
            const res = await api.get('/photos');
            return res.data;
        }
    });

    const [commentText, setCommentText] = useState('');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareCard, setShowShareCard] = useState(false);
    
    // Mutations
    const toggleLikeMutation = useMutation({
        mutationFn: () => api.post(`/photos/${id}/like`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo', id] });
        }
    });

    const addCommentMutation = useMutation({
        mutationFn: (content: string) => api.post(`/photos/${id}/comment`, { content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo', id] });
            setCommentText('');
        }
    });

    // --- Interaction Handlers ---
    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser) return;
        addCommentMutation.mutate(commentText);
    };

    const handleLikeToggle = () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        toggleLikeMutation.mutate();
    };

    // Prevent scrolling when fullscreen
    useEffect(() => {
        if (isFullScreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isFullScreen]);

    if (isLoading) return <div className="p-8 flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    if (!photo) return <div className="p-8 text-center text-gray-500">Photo not found</div>;

    const exif = JSON.parse(photo.exif || '{}');
    const isLiked = photo.likes?.some((l: any) => l.userId === currentUser?.id);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20 transition-colors duration-300">
             {/* Toolbar */}
             <div className="sticky top-16 z-30 bg-white/90 dark:bg-[#111a22]/90 backdrop-blur-md border-b border-gray-200 dark:border-surface-border px-4 py-3 flex items-center justify-between">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回画廊
                </button>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowShareCard(true)}
                        className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors hover:bg-gray-100 dark:hover:bg-surface-dark rounded-full"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors hover:bg-gray-100 dark:hover:bg-surface-dark rounded-full">
                        <Bookmark className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="max-w-[1920px] mx-auto">
                <div className="flex flex-col xl:flex-row h-full">
                    {/* Image Viewer (Inline) */}
                    <div className="xl:flex-1 bg-gray-100 dark:bg-black flex items-center justify-center p-4 xl:p-8 min-h-[60vh] xl:min-h-[calc(100vh-8rem)] relative group overflow-hidden transition-colors">
                        <div className="relative w-full mx-auto" style={{ 
                            aspectRatio: `${inlineAspectRatio}`,
                            maxHeight: 'calc(100vh - 10rem)',
                            maxWidth: `calc((100vh - 10rem) * ${inlineAspectRatio})`
                        }}>
                            <ProgressiveImage
                                src={toMediaUrl(photo.mediumUrl || photo.url)}
                                placeholderSrc={toMediaUrl(photo.thumbUrl || '')}
                                alt={photo.title}
                                className="w-full h-full"
                                imgClassName="object-contain shadow-2xl rounded-sm cursor-zoom-in"
                                loading="eager"
                                decoding="async"
                                maxRetries={3}
                                onImageLoad={(img) => {
                                    const w = img.naturalWidth || 0;
                                    const h = img.naturalHeight || 0;
                                    if (!w || !h) return;
                                    setInlineAspectRatio(w / h);
                                }}
                            />
                            <button
                                onClick={() => setIsFullScreen(true)}
                                className="absolute inset-0"
                                aria-label="全屏查看"
                                type="button"
                            />
                        </div>
                         <button
                            onClick={() => setIsFullScreen(true)}
                            className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 backdrop-blur-sm"
                            title="全屏查看"
                        >
                            <Maximize2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Info Sidebar */}
                    <div className="xl:w-[500px] border-l border-gray-200 dark:border-surface-border bg-white dark:bg-background-dark flex flex-col transition-colors duration-300">
                        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(100vh-8rem)] custom-scrollbar">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{photo.title}</h1>
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                        <MoreHorizontal className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <img src={toMediaUrl(photo.user.avatar) || `https://ui-avatars.com/api/?name=${photo.user.name}`} alt={photo.user.name} className="w-10 h-10 rounded-full border border-gray-200 dark:border-surface-border" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{photo.user.name}</p>
                                        <p className="text-xs text-gray-500">发布于 {new Date(photo.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <button className="ml-auto bg-primary text-white text-xs px-3 py-1.5 rounded-full font-medium hover:bg-primary/90 transition">
                                        关注
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-4 border-y border-gray-200 dark:border-surface-border">
                                <div className="flex items-center gap-6">
                                    <button onClick={handleLikeToggle} className={`flex items-center gap-2 transition-colors group ${isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-300 hover:text-red-500'}`}>
                                        <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500' : 'group-hover:fill-red-500'}`} />
                                        <span className="font-medium">{photo.likesCount}</span>
                                    </button>
                                    <button className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                                        <MessageCircle className="w-6 h-6" />
                                        <span className="font-medium">{photo.comments?.length || 0}</span>
                                    </button>
                                </div>
                                <a href={toMediaUrl(photo.originalUrl || photo.url)} download target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark px-3 py-1.5 rounded-lg transition-colors">
                                    <Download className="w-4 h-4" />
                                    下载原图
                                </a>
                            </div>

                            {/* AI Critique Section */}
                            {currentUser?.role === 'admin' && photo.aiCritique && (
                                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-5 rounded-2xl space-y-3 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                        <Sparkles className="w-12 h-12 text-primary" />
                                    </div>
                                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        AI 摄影评论 (Gemini)
                                    </h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                                        "{photo.aiCritique}"
                                    </p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">照片故事</h3>
                                <p className="text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">{photo.description}</p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {photo.tags?.split(',').map((tag: string) => <span key={tag} className="text-xs text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 cursor-pointer">#{tag}</span>)}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">拍摄参数</h3>
                                <ExifGrid exif={exif} />
                                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-surface-border">
                                    <PhotoExifBadge 
                                        icon={<Monitor className="w-4 h-4"/>} 
                                        label="分辨率" 
                                        value={photo.imageWidth && photo.imageHeight ? `${photo.imageWidth} × ${photo.imageHeight}` : '未知'} 
                                    />
                                    <PhotoExifBadge 
                                        icon={<HardDrive className="w-4 h-4"/>} 
                                        label="文件大小" 
                                        value={photo.imageSizeBytes ? formatBytes(photo.imageSizeBytes) : '未知'} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">评论 ({photo.comments?.length || 0})</h3>
                                <div className="space-y-4">
                                    {photo.comments?.map((comment: any) => (
                                        <div key={comment.id} className="flex gap-3">
                                            <img src={comment.user.avatar || `https://ui-avatars.com/api/?name=${comment.user.name}`} alt={comment.user.name} className="w-8 h-8 rounded-full" />
                                            <div className="flex-1">
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{comment.user.name}</span>
                                                    <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleCommentSubmit} className="relative mt-4">
                                    <input type="text" placeholder={currentUser ? "写下你的评论..." : "登录后即可发表评论"} disabled={!currentUser} value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg py-3 pl-4 pr-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-500 disabled:opacity-50" />
                                    <button type="submit" disabled={!commentText.trim() || addCommentMutation.isPending} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FULLSCREEN OVERLAY */}
            {isFullScreen && (
                <div 
                    className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200 overflow-hidden"
                >
                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                        <h2 className="text-white font-medium text-lg drop-shadow-md pointer-events-auto">{photo.title}</h2>
                        <button 
                            onClick={() => setIsFullScreen(false)} 
                            className="p-2 bg-black/40 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors pointer-events-auto border border-white/10"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <TransformWrapper
                        initialScale={1}
                        minScale={0.5}
                        maxScale={8}
                        centerOnInit
                        wheel={{ step: 0.1 }}
                    >
                        <ZoomControls />
                        <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center">
                            <TransformComponent
                                wrapperClass="!w-full !h-full"
                                contentClass="!w-full !h-full flex items-center justify-center"
                            >
                                <ProgressiveImage
                                src={toMediaUrl(photo.originalUrl || photo.mediumUrl || photo.url)}
                                placeholderSrc={toMediaUrl(photo.thumbUrl || '')}
                                alt={photo.title}
                                className="w-full h-full"
                                imgClassName="w-full h-full"
                                fit="contain"
                                loading="eager"
                                decoding="async"
                                maxRetries={3}
                            />
                            </TransformComponent>
                        </div>
                    </TransformWrapper>
                </div>
            )}

            {showShareCard && (
                <ShareCard photo={photo} onClose={() => setShowShareCard(false)} />
            )}
        </div>
    );
};
