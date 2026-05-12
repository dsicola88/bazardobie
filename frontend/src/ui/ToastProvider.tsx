import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ToastTone = "ok" | "err" | "info";

type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastCtx = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="ae-toast-host" aria-live="polite" aria-relevant="additions text">
        {items.map((t) => (
          <div key={t.id} className={`ae-toast ae-toast--${t.tone}`} role="status">
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): (message: string, tone?: ToastTone) => void {
  return useContext(ToastCtx);
}
