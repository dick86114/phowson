import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 text-gray-600 dark:text-gray-300">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                setModalConfig(null);
                if (onConfirm) onConfirm();
                resolve(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
