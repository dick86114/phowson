import React, { useRef, useState } from 'react';
import { X, Copy, Share2, Download, Camera, MapPin, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../../api';
import { useModal } from '../Modal';

type PhotoData = {
  id: string;
  url: string;
  mediumUrl?: string | null;
  title: string;
  description: string;
  exif: string;
  user: {
    name: string;
  };
};

export const ShareCard: React.FC<{
  photo: PhotoData;
  onClose: () => void;
}> = ({ photo, onClose }) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { alert } = useModal();

  const shareUrl = `${window.location.origin}${window.location.pathname}#/photo/${photo.id}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert({ title: '已复制', content: '链接已复制到剪贴板' });
      } else {
        // Fallback for non-secure contexts or older browsers
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert({ title: '已复制', content: '链接已复制到剪贴板' });
      }
    } catch (err) {
      console.error('Copy failed:', err);
      alert({ title: '复制失败', content: '无法复制链接，请手动复制' });
    }
  };

  const handleSystemShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.title,
          text: `查看 ${photo.user.name} 的摄影作品：${photo.title}`,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as any).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      alert({ title: '不支持', content: '您的浏览器不支持系统分享功能，请使用复制链接' });
    }
  };

  const handleDownloadPoster = async () => {
    if (!posterRef.current || isGenerating) return;
    setIsGenerating(true);

    try {
      // Wait for fonts and images to be ready
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // Improve quality
        backgroundColor: '#111a22',
        logging: false,
        onclone: (clonedDoc) => {
            // Ensure images in the cloned document are loaded
            const images = clonedDoc.getElementsByTagName('img');
            for (let i = 0; i < images.length; i++) {
                images[i].crossOrigin = "anonymous";
            }
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Phowson-${photo.title.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate poster:', err);
      alert({ title: '生成失败', content: '海报生成失败，请稍后重试' });
    } finally {
      setIsGenerating(false);
    }
  };

  const exif = JSON.parse(photo.exif || '{}');
  const toMediaUrl = (url: string | null | undefined) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE_URL}${u}`;
  };

  // Helper to strip "ISO" prefix if present and display cleaner value
  const isoValue = exif.iso ? String(exif.iso).replace(/^ISO\s*/i, '') : '';

  // Determine layout based on content length
  const longContent = [
    exif.camera || exif.Model,
    exif.lens || exif.LensModel,
  ].some(s => String(s || '').length > 20);

  // Use the proxy URL to ensure CORS headers are present (via our backend proxy)
  const posterMainUrl = `${API_BASE_URL}/media/photos/${photo.id}?variant=medium`;
  const posterThumbUrl = `${API_BASE_URL}/media/photos/${photo.id}?variant=thumb`;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row" onClick={(e) => e.stopPropagation()}>
        
        {/* Left: Poster Preview */}
        <div className="flex-1 bg-[#0a0f14] p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-200 dark:border-surface-border overflow-hidden">
          <div className="relative group">
            {/* The actual element to be captured */}
            <div 
              ref={posterRef}
              className="w-[340px] bg-[#111a22] text-white p-5 rounded-sm shadow-2xl flex flex-col gap-4"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {/* Photo */}
              <div className="aspect-[4/5] w-full overflow-hidden rounded-sm bg-gray-900 relative">
                {/* Background image for fill (Thumb) */}
                <img 
                  src={posterThumbUrl} 
                  alt={photo.title}
                  crossOrigin="anonymous"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50"
                />
                {/* Main image (Medium) */}
                <img 
                  src={posterMainUrl} 
                  alt={photo.title}
                  crossOrigin="anonymous"
                  className="relative z-10 w-full h-full object-contain"
                />
              </div>

              {/* Info */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight">{photo.title}</h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">BY {photo.user.name}</p>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10 w-full" />

                {/* Footer Area: Params/Logo (Left) + QR (Right) */}
                <div className="relative mt-auto">
                   <div className="flex items-end justify-between">
                     {/* Left Column: Params, Location, Logo */}
                     <div className="flex-1 min-w-0 pr-4 pb-1">
                        {/* Dynamic Grid for Parameters */}
                        <div className={`grid ${longContent ? 'grid-cols-1' : 'grid-cols-2'} gap-x-4 gap-y-3 text-[10px] text-gray-300 mb-4`}>
                          <div className="flex flex-col">
                            <span className="text-gray-500 uppercase text-[8px] mb-0.5">相机</span>
                            <span className="break-words leading-tight">{exif.camera || exif.Model || 'Unknown'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 uppercase text-[8px] mb-0.5">镜头</span>
                            <span className="break-words leading-tight">{exif.lens || exif.LensModel || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 uppercase text-[8px] mb-0.5">拍摄参数</span>
                            <div className="flex flex-wrap gap-1 leading-tight">
                                 {exif.aperture && <span>{exif.aperture}</span>}
                                 {exif.shutterSpeed && <span>{exif.shutterSpeed}</span>}
                                 {isoValue && <span>ISO{isoValue}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 uppercase text-[8px] mb-0.5">拍摄日期</span>
                            <span className="break-words leading-tight">{exif.date || 'Unknown'}</span>
                          </div>
                        </div>

                        {/* Location & Logo Container - using block/margin instead of flex gap for html2canvas stability */}
                        <div className="flex flex-col">
                           {/* Location */}
                           {exif.location && (
                             <div className="flex items-center text-[9px] text-primary/80 mb-2">
                               <MapPin className="w-2.5 h-2.5 flex-shrink-0 mr-1" />
                               <span className="truncate">{exif.location}</span>
                             </div>
                           )}

                           {/* Logo */}
                           <div className="flex items-center text-primary">
                             <Camera className="w-3 h-3 mr-1.5" />
                             <span className="text-[9px] font-black tracking-widest uppercase">Phowson</span>
                           </div>
                        </div>
                     </div>

                     {/* Right Column: QR Code + Text */}
                     <div className="flex flex-col items-center flex-shrink-0">
                       <div className="bg-white p-1 rounded-sm mb-1.5">
                         <QRCodeCanvas 
                           value={shareUrl} 
                           size={48} 
                           level="L"
                           includeMargin={false}
                         />
                       </div>
                       <span className="text-[7px] text-gray-600 tracking-tight whitespace-nowrap">Scan to view original</span>
                     </div>
                   </div>
                </div>
              </div>
            </div>
            
            {/* Overlay Hint */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-sm">
              <span className="text-white text-xs bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">海报预览</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-full md:w-80 p-8 flex flex-col justify-center gap-6 bg-gray-50 dark:bg-surface-dark">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">分享艺术</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">生成精美的摄影海报，展示作品细节与拍摄参数。</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDownloadPoster}
              disabled={isGenerating}
              className="w-full inline-flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-white px-6 py-4 rounded-2xl font-bold transition-all transform active:scale-95 disabled:opacity-70"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isGenerating ? '正在生成...' : '保存分享海报'}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-surface-border hover:bg-gray-100 dark:hover:bg-[#233648] text-gray-700 dark:text-gray-200 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                <Copy className="w-4 h-4" />
                复制链接
              </button>
              <button
                onClick={handleSystemShare}
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-surface-border hover:bg-gray-100 dark:hover:bg-[#233648] text-gray-700 dark:text-gray-200 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                <Share2 className="w-4 h-4" />
                系统分享
              </button>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            取消分享
          </button>
        </div>
      </div>
    </div>
  );
};
