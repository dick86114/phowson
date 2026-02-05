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
      await navigator.clipboard.writeText(shareUrl);
      alert({ title: '已复制', content: '链接已复制' });
    } catch {
      alert({ title: '复制失败', content: '复制失败，请手动复制' });
    }
  };

  const handleSystemShare = async () => {
    try {
      if (!('share' in navigator)) return;
      await (navigator as any).share({ title: photo.title, url: shareUrl });
    } catch {
      return;
    }
  };

  const handleDownloadPoster = async () => {
    if (!posterRef.current || isGenerating) return;
    setIsGenerating(true);

    try {
      // 增加延时确保图片加载
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: 2, // 提高清晰度
        backgroundColor: '#111a22',
        logging: false,
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
              <div className="aspect-[4/5] w-full overflow-hidden rounded-sm bg-gray-900">
                <img 
                  src={toMediaUrl(photo.mediumUrl || photo.url)} 
                  alt={photo.title}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
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

                {/* EXIF & Footer Area */}
                <div className="flex justify-between items-end gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-300">
                      <div className="flex flex-col">
                        <span className="text-gray-500 uppercase text-[8px] mb-0.5">Camera</span>
                        <span className="truncate">{exif.camera || exif.Model || 'Unknown'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 uppercase text-[8px] mb-0.5">Lens</span>
                        <span className="truncate">{exif.lens || exif.LensModel || '-'}</span>
                      </div>
                      <div className="flex flex-col mt-1">
                        <span className="text-gray-500 uppercase text-[8px] mb-0.5">Settings</span>
                        <span>{exif.aperture} {exif.shutterSpeed} ISO {exif.iso}</span>
                      </div>
                      <div className="flex flex-col mt-1">
                        <span className="text-gray-500 uppercase text-[8px] mb-0.5">Date</span>
                        <span>{exif.date || 'Unknown'}</span>
                      </div>
                    </div>
                    {exif.location && (
                      <div className="flex items-center gap-1 text-[9px] text-primary/80">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{exif.location}</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code */}
                  <div className="bg-white p-1 rounded-sm flex-shrink-0">
                    <QRCodeCanvas 
                      value={shareUrl} 
                      size={48} 
                      level="L"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Camera className="w-3 h-3" />
                    <span className="text-[9px] font-black tracking-widest uppercase">Phowson</span>
                  </div>
                  <span className="text-[8px] text-gray-600">Scan to view original</span>
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
