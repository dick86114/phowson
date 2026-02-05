import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ModalButton = {
  text: string;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
};

type ModalOptions = {
  title?: string;
  content?: React.ReactNode;
  type?: 'success' | 'warning' | 'error' | 'confirm' | 'info';
  buttons?: ModalButton[];
  escClosable?: boolean;
  maskClosable?: boolean;
  onClose?: () => void;
};

type ModalContextValue = {
  open: (opts: ModalOptions) => void;
  close: () => void;
  confirm: (opts: Omit<ModalOptions, 'type' | 'buttons'> & { onConfirm?: () => void; onCancel?: () => void }) => void;
  alert: (opts: Omit<ModalOptions, 'type' | 'buttons'>) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export const useModal = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    return {
      open: () => {},
      close: () => {},
      confirm: () => {},
      alert: () => {},
    };
  }
  return ctx;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<ModalOptions | null>(null);

  const close = useCallback(() => {
    setVisible(false);
    const onClose = opts?.onClose;
    setTimeout(() => onClose && onClose(), 0);
  }, [opts]);

  const open = useCallback((next: ModalOptions) => {
    setOpts(next);
    setVisible(true);
  }, []);

  const confirm = useCallback((next: Omit<ModalOptions, 'type' | 'buttons'> & { onConfirm?: () => void; onCancel?: () => void }) => {
    open({
      ...next,
      type: 'confirm',
      buttons: [
        { text: '取消', onClick: () => { next.onCancel && next.onCancel(); close(); } },
        { text: '确认', primary: true, onClick: () => { next.onConfirm && next.onConfirm(); close(); } },
      ],
    });
  }, [open, close]);

  const alert = useCallback((next: Omit<ModalOptions, 'type' | 'buttons'>) => {
    open({
      ...next,
      type: 'info',
      buttons: [{ text: '知道了', primary: true, onClick: () => close() }],
    });
  }, [open, close]);

  const value = useMemo(() => ({ open, close, confirm, alert }), [open, close, confirm, alert]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {visible && opts && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => {
            if (opts?.maskClosable) close();
          }}
        >
          <div
            className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-border rounded-xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {opts.title ? (
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {opts.title}
              </h3>
            ) : null}
            {opts.content ? (
              <div className="text-sm text-gray-700 dark:text-gray-200">{opts.content}</div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              {(opts.buttons || []).map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.onClick}
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    btn.primary
                      ? 'bg-primary hover:bg-primary/90 text-white'
                      : btn.danger
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-border',
                  ].join(' ')}
                >
                  {btn.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

