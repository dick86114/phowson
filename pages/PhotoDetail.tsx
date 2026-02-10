import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, MessageCircle, MoreHorizontal, Send, Bookmark, Maximize2, X, ZoomIn, ZoomOut, Download, RefreshCcw, Sparkles, Loader2, Monitor, HardDrive, RefreshCw, LogIn, ChevronDown, ChevronUp, MapPin, Camera, Disc, Timer, Aperture, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TransformWrapper, TransformComponent, useControls, useTransformComponent } from "react-zoom-pan-pinch";
import api, { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../components/Modal';
import { PhotoExifBadge } from '../components/PhotoComponents';
import { ShareCard } from '../components/shared/ShareCard';
import { ProgressiveImage } from '../components/ProgressiveImage';
import { getPhotoUrl, getAvatarUrl, generateFallbackAvatar } from '../utils/helpers';

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
    const modal = useModal();
    const [guestId, setGuestId] = useState('');
    
    // Guest Comment State
    const [guestNickname, setGuestNickname] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [captchaSvg, setCaptchaSvg] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');

    useEffect(() => {
        window.scrollTo(0, 0);
        
        // Init Guest ID
        let gid = localStorage.getItem('phowson_guest_id');
        if (!gid) {
            gid = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('phowson_guest_id', gid);
        }
        setGuestId(gid);
    }, [id]);

    const refreshCaptcha = async () => {
        try {
            const res = await api.get('/auth/captcha');
            let svg = res.data.svg;
            // Make SVG responsive
            svg = svg.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"');
            // Ensure viewBox is preserved (it usually is in the output)
            setCaptchaSvg(svg);
            setCaptchaToken(res.data.token);
            setCaptchaInput('');
        } catch (e) {
            console.error('Failed to fetch captcha', e);
        }
    };

    useEffect(() => {
        if (!currentUser) refreshCaptcha();
    }, [currentUser]);
    
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
    const [isAiCritiqueOpen, setIsAiCritiqueOpen] = useState(true);
    
    // Mutations
    const toggleLikeMutation = useMutation({
        mutationFn: () => api.post(`/photos/${id}/like`, { guestId: !currentUser ? guestId : undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo', id] });
        }
    });

    const addCommentMutation = useMutation({
        mutationFn: (data: any) => api.post(`/photos/${id}/comment`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo', id] });
            setCommentText('');
            if (currentUser) {
                window.alert('评论已提交，等待管理员审核后展示');
            } else {
                setCaptchaInput('');
                refreshCaptcha();
                window.alert('评论已提交，等待审核后展示');
            }
        },
        onError: (err: any) => {
             if (!currentUser) refreshCaptcha();
             window.alert(String(err?.response?.data?.message || '评论失败'));
        }
    });

    // --- Interaction Handlers ---
    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const content = commentText.trim();
        if (!content) return;
        
        if (currentUser) {
            addCommentMutation.mutate({ content });
        } else {
            if (!guestNickname || !guestEmail || !captchaInput) {
                modal.alert({ title: '提示', content: '请填写完整信息' });
                return;
            }
            addCommentMutation.mutate({
                content,
                guestId,
                nickname: guestNickname,
                email: guestEmail,
                captcha: captchaInput,
                captchaToken
            });
        }
    };

    const handleLikeToggle = () => {
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
    const isLiked = photo.likes?.some((l: any) => {
        if (currentUser) return l.userId === currentUser.id;
        return l.userId === guestId;
    });

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20 transition-colors duration-300">
             {/* Toolbar */}
             <div className="sticky top-16 z-30 bg-white/90 dark:bg-[#111a22]/90 backdrop-blur-md border-b border-gray-200 dark:border-surface-border px-4 py-3 flex items-center justify-between">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-2 active:scale-95"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回画廊
                </button>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowShareCard(true)}
                        type="button"
                        aria-label="分享"
                        className="p-3 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors hover:bg-gray-100 dark:hover:bg-surface-dark rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark active:scale-95"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="max-w-[1920px] mx-auto">
                <div className="flex flex-col xl:flex-row h-full">
                    {/* Image Viewer (Inline) */}
                    <div className="xl:flex-1 bg-gray-100 dark:bg-black flex items-center justify-center p-4 xl:p-8 min-h-[60vh] xl:h-[calc(100vh-8rem)] xl:sticky xl:top-32 relative group overflow-hidden transition-colors">
                        <div className="relative w-full h-full flex items-center justify-center">
                        <ProgressiveImage
                                src={getPhotoUrl(photo, 'medium')}
                                placeholderSrc={getPhotoUrl(photo, 'thumb')}
                                alt={photo.title}
                                className="w-full h-full"
                                imgClassName="shadow-2xl rounded-sm cursor-zoom-in"
                                fit="contain"
                                loading="eager"
                                decoding="async"
                                maxRetries={3}
                            />
                            <button
                                onClick={() => setIsFullScreen(true)}
                                className="absolute inset-0"
                                aria-label="全屏查看"
                                aria-hidden="true"
                                tabIndex={-1}
                                type="button"
                            />
                        </div>
                         <button
                            onClick={() => setIsFullScreen(true)}
                            type="button"
                            aria-label="全屏查看"
                            className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                            title="全屏查看"
                        >
                            <Maximize2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Info Sidebar */}
                    <div className="xl:w-[500px] border-l border-gray-200 dark:border-surface-border bg-white dark:bg-background-dark flex flex-col transition-colors duration-300">
                        <div className="p-6 space-y-8">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{photo.title}</h1>
                                </div>
                                <div className="flex items-center gap-4">
                                    <img src={getAvatarUrl(photo.user)} alt={photo.user.name} className="w-10 h-10 rounded-full border border-gray-200 dark:border-surface-border" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{photo.user.name}</p>
                                        <p className="text-xs text-gray-500">发布于 {new Date(photo.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-4">
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
                                {currentUser && (
                                    <a href={getPhotoUrl(photo, 'original')} download target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-dark px-3 py-1.5 rounded-lg transition-colors">
                                        <Download className="w-4 h-4" />
                                        下载原图
                                    </a>
                                )}
                            </div>

                            {/* AI Critique Section */}
                            {currentUser?.role === 'admin' && photo.aiCritique && (
                                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl relative overflow-hidden group transition-all duration-300">
                                    <button 
                                        onClick={() => setIsAiCritiqueOpen(!isAiCritiqueOpen)}
                                        type="button"
                                        className="w-full p-5 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark rounded-2xl"
                                    >
                                        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            AI 摄影评论
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {isAiCritiqueOpen ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
                                        </div>
                                    </button>
                                    
                                    <div className={`px-5 pb-5 transition-all duration-300 ${isAiCritiqueOpen ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden pb-0'}`}>
                                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none">
                                            <Sparkles className="w-12 h-12 text-primary" />
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic relative z-10">
                                            "{photo.aiCritique}"
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">照片故事</h3>
                                <p className="text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">{photo.description}</p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {photo.tags?.split(',').map((tag: string) => <span key={tag} className="text-xs text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 cursor-pointer">#{tag}</span>)}
                                </div>
                            </div>

                            <div className="space-y-3 border-t border-gray-200 dark:border-surface-border pt-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">拍摄参数</h3>
                                <div className="space-y-4">
                                    {/* Row 1: Camera & Location */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <PhotoExifBadge 
                                            icon={<Camera className="w-4 h-4"/>} 
                                            label="相机" 
                                            value={exif.camera || '未知'} 
                                        />
                                        <PhotoExifBadge 
                                            icon={<MapPin className="w-4 h-4"/>} 
                                            label="拍摄地点" 
                                            value={exif.location || '未知'} 
                                        />
                                    </div>

                                    {/* Row 2: Lens, Shutter, Aperture, ISO */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <PhotoExifBadge 
                                            icon={<Disc className="w-4 h-4"/>} 
                                            label="镜头" 
                                            value={exif.lens || '未知'} 
                                        />
                                        <PhotoExifBadge 
                                            icon={<Timer className="w-4 h-4"/>} 
                                            label="快门" 
                                            value={exif.shutterSpeed || '未知'} 
                                        />
                                        <PhotoExifBadge 
                                            icon={<Aperture className="w-4 h-4"/>} 
                                            label="光圈" 
                                            value={exif.aperture || '未知'} 
                                        />
                                        <PhotoExifBadge 
                                            icon={<Zap className="w-4 h-4"/>} 
                                            label="感光度" 
                                            value={exif.iso || '未知'} 
                                        />
                                    </div>

                                    {/* Row 3: Resolution & File Size */}
                                    <div className="grid grid-cols-2 gap-4">
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
                            </div>

                            <div className="space-y-4 border-t border-gray-200 dark:border-surface-border pt-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">评论 ({photo.comments?.length || 0})</h3>
                                <div className="space-y-4">
                                    {photo.comments?.map((comment: any) => {
                                        const userAvatar = comment.user 
                                            ? getAvatarUrl(comment.user) 
                                            : generateFallbackAvatar(comment.guestNickname || '游客');
                                        const userName = comment.user?.name || comment.guestNickname || '游客';
                                        
                                        return (
                                        <div key={comment.id} className="flex gap-3">
                                            <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full" />
                                            <div className="flex-1">
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{userName}</span>
                                                    <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{comment.content}</p>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                                <form onSubmit={handleCommentSubmit} className="relative mt-4 space-y-3">
                                    {!currentUser && (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input 
                                                    type="text" 
                                                    placeholder="昵称 (必填)" 
                                                    required
                                                    value={guestNickname}
                                                    onChange={e => setGuestNickname(e.target.value)}
                                                    className="w-full bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                />
                                                <input 
                                                    type="email" 
                                                    placeholder="邮箱 (必填)" 
                                                    required
                                                    value={guestEmail}
                                                    onChange={e => setGuestEmail(e.target.value)}
                                                    className="w-full bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                            <div className="flex gap-3">
                                                <input 
                                                    type="text" 
                                                    placeholder="验证码" 
                                                    required
                                                    value={captchaInput}
                                                    onChange={e => setCaptchaInput(e.target.value)}
                                                    className="flex-1 bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                />
                                                <div 
                                                    className="h-10 w-24 bg-white rounded overflow-hidden cursor-pointer border border-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                                                    onClick={refreshCaptcha}
                                                    title="点击刷新"
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label="刷新验证码"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            refreshCaptcha();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={refreshCaptcha}
                                                    aria-label="刷新验证码"
                                                    className="p-2 text-gray-500 hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                                >
                                                    <RefreshCw className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder={currentUser ? "写下你的评论..." : "写下你的评论..."} 
                                            value={commentText} 
                                            onChange={(e) => setCommentText(e.target.value)} 
                                            className="w-full bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-lg py-3 pl-4 pr-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-500 disabled:opacity-50" 
                                        />
                                        <button
                                            type="submit"
                                            aria-label="发送评论"
                                            disabled={!commentText.trim() || addCommentMutation.isPending}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background-dark"
                                        >
                                            {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {!currentUser && (
                                        <div className="text-right">
                                            <Link to="/login" className="text-xs text-primary hover:underline flex items-center justify-end gap-1">
                                                <LogIn className="w-3 h-3" />
                                                已有账号？去登录
                                            </Link>
                                        </div>
                                    )}
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
                            type="button"
                            aria-label="关闭全屏"
                            className="p-2 bg-black/40 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors pointer-events-auto border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
                                src={getPhotoUrl(photo, 'medium')}
                                placeholderSrc={getPhotoUrl(photo, 'thumb')}
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
