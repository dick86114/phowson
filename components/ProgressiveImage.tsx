import React, { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  placeholderSrc?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'sync' | 'async' | 'auto';
  onImageLoad?: (img: HTMLImageElement) => void;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
};

export const ProgressiveImage: React.FC<Props> = ({
  src,
  alt,
  className,
  imgClassName,
  placeholderSrc,
  loading = 'lazy',
  decoding = 'async',
  onImageLoad,
  maxRetries = 2,
  retryBaseDelayMs = 500,
  fit = 'cover',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setAttempt(0);
  }, [src]);

  useEffect(() => {
    if (!failed) return;
    if (attempt >= maxRetries) return;
    const delay = Math.min(8000, retryBaseDelayMs * Math.pow(2, attempt));
    const t = window.setTimeout(() => {
      setFailed(false);
      setAttempt((v) => v + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [attempt, failed, maxRetries, retryBaseDelayMs]);

  useEffect(() => {
    if (failed || loaded) return;
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
      onImageLoad?.(img);
    }
  }, [attempt, failed, loaded, onImageLoad, src]);

  return (
    <div className={`relative ${className || ''}`.trim()}>
      <div className="absolute inset-0">
        {placeholderSrc ? (
          <img
            src={placeholderSrc}
            alt=""
            aria-hidden="true"
            className="w-full h-full scale-110 blur-xl opacity-70"
            style={{ objectFit: fit }}
            loading="eager"
            decoding="async"
          />
        ) : null}
        {!loaded && !failed ? <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-surface-dark" /> : null}
      </div>

      {failed ? (
        <div className="relative w-full h-full bg-gray-100 dark:bg-surface-dark flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              setFailed(false);
              setAttempt((v) => v + 1);
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#111a22]/90 border border-gray-200 dark:border-surface-border text-gray-700 dark:text-gray-200 hover:text-primary hover:border-primary transition-colors backdrop-blur-sm"
          >
            图片加载失败，点击重试
          </button>
        </div>
      ) : (
        <img
          key={attempt}
          ref={imgRef}
          src={src}
          alt={alt}
          className={`relative w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName || ''}`}
          style={{ objectFit: fit }}
          loading={loading}
          decoding={decoding}
          onLoad={(e) => {
            setLoaded(true);
            onImageLoad?.(e.currentTarget);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};
