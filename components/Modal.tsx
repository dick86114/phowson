import React, { createContext, useContext, useId, useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const contentId = useId();

  // Focus management and body scroll locking
  useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.setTimeout(() => {
        restoreFocusRef.current?.focus?.();
      }, 0);
    };
  }, [isOpen]);

  // Keyboard event listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (overlayRef.current === e.target) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={contentId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const root = dialogRef.current;
          if (!root) return;
          const focusables = Array.from(
            root.querySelectorAll(
              'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ) as HTMLElement[];
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement as HTMLElement | null;
          if (e.shiftKey) {
            if (!active || active === first || !root.contains(active)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (!active || active === last || !root.contains(active)) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        className="glass-panel rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 focus:outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            type="button"
            aria-label="关闭对话框"
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div id={contentId} className="p-6 text-gray-600 dark:text-gray-300">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/30 border-t border-white/10 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

interface ConfirmOptions {
  title?: string;
  content: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ModalContextType {
  alert: (message: string) => Promise<void>;
  confirm: (optionsOrMessage: string | ConfirmOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
    footer?: React.ReactNode;
    onClose: () => void;
  } | null>(null);

  const close = useCallback(() => {
    setModalConfig(null);
  }, []);

  const alert = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      setModalConfig({
        isOpen: true,
        title: '提示',
        content: message,
        onClose: () => {
          setModalConfig(null);
          resolve();
        },
        footer: (
          <button
            onClick={() => {
              setModalConfig(null);
              resolve();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
          >
            确定
          </button>
        )
      });
    });
  }, []);

  const confirm = useCallback((optionsOrMessage: string | ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      let title = '确认';
      let content: React.ReactNode = '';
      let onConfirm: (() => void) | undefined;
      let onCancel: (() => void) | undefined;

      if (typeof optionsOrMessage === 'string') {
        content = optionsOrMessage;
      } else {
        title = optionsOrMessage.title || '确认';
        content = optionsOrMessage.content;
        onConfirm = optionsOrMessage.onConfirm;
        onCancel = optionsOrMessage.onCancel;
      }

      setModalConfig({
        isOpen: true,
        title,
        content,
        onClose: () => {
          setModalConfig(null);
          if (onCancel) onCancel();
          resolve(false);
        },
        footer: (
          <>
            <button
              onClick={() => {
                setModalConfig(null);
                if (onCancel) onCancel();
                resolve(false);
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
            >
              取消
            </button>
            <button
              onClick={() => {
                setModalConfig(null);
                if (onConfirm) onConfirm();
                resolve(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
            >
              确定
            </button>
          </>
        )
      });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {modalConfig && (
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={modalConfig.onClose}
          title={modalConfig.title}
          footer={modalConfig.footer}
        >
          {modalConfig.content}
        </Modal>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
