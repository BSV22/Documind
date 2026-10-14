"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

const toastStyles = {
  success: "border-emerald-500/30 bg-[#13231d] text-emerald-100",
  error: "border-red-500/30 bg-[#2a1719] text-red-100",
  info: "border-blue-500/30 bg-[#142033] text-blue-100",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(({
    type = "info",
    title = "",
    message,
    duration = 4500,
  }) => {
    const id = ++nextId.current;
    const toast = { id, type, title, message };
    setToasts((current) => [...current.slice(-3), toast]);
    window.setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            className={`toast-enter flex items-start gap-3 rounded-xl border p-4 shadow-2xl shadow-black/40 backdrop-blur ${toastStyles[toast.type] || toastStyles.info}`}
          >
            <span className="mt-0.5 text-sm" aria-hidden="true">
              {toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "i"}
            </span>
            <div className="min-w-0 flex-1">
              {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
              {toast.message && <p className="mt-0.5 text-sm leading-5 opacity-85">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 rounded-md px-1.5 py-0.5 text-lg leading-none opacity-70 transition hover:bg-white/10 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}