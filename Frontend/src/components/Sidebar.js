"use client";

import { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiGet, apiPost, apiDelete } from "../utils/api";

const sidebarItems = [
  { id: "history", label: "Chat History" },
  { id: "documents", label: "Documents" },
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
];

export default function Sidebar({
  isOpen = true,
  activeChatId,
  setActiveChatId,
  settings,
  onSettingChange,
  onResetSettings,
}) {
  const auth = useContext(AuthContext);
  const { notify } = useToast();
  const [activePanel, setActivePanel] = useState("history");
  const [chats, setChats] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const data = await apiGet("/api/chats");
      setChats(data);
      if (data.length > 0) {
        setActiveChatId((currentChatId) => currentChatId || data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [setActiveChatId]);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const data = await apiGet("/api/documents");
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated) {
      const timer = setTimeout(() => {
        fetchChats();
        fetchDocuments();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [auth.isAuthenticated, fetchChats, fetchDocuments]);

  const handleCreateChat = async () => {
    const title = `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const newChat = await apiPost("/api/chats", { title });
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setActivePanel("history");
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (settings?.confirmDelete !== false && !window.confirm("Are you sure you want to delete this chat?")) return;
    try {
      await apiDelete(`/api/chats/${chatId}`);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) {
        const remaining = chats.filter(c => c.id !== chatId);
        setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  const toggleSetting = async (key) => {
    const nextValue = !settings?.[key];
    if (key === "desktopNotifications" && nextValue) {
      if (!("Notification" in window)) {
        setSettingsNotice("Desktop notifications are not supported by this browser.");
        return;
      }

      try {
        const permission = Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission !== "granted") {
          setSettingsNotice("Allow notifications in your browser to enable this option.");
          return;
        }
      } catch {
        setSettingsNotice("Could not request notification permission from this browser.");
        return;
      }
    }

    setSettingsNotice("");
    onSettingChange?.(key, nextValue);
  };

  const handleUploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/\.(pdf|md)$/i.test(file.name)) {
      setUploadError("Choose a PDF or Markdown (.md) document.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File size exceeds the 50MB limit.");
      return;
    }

    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        const serverMessage = responseData?.detail || responseData?.message;
        const plainTextMessage = responseData ? "" : responseText
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const usefulPlainText = plainTextMessage && !/^internal server error$/i.test(plainTextMessage)
          ? plainTextMessage.slice(0, 240)
          : "The server could not process the upload. Please try again or check the backend logs.";
        throw new Error(serverMessage || `${usefulPlainText} (HTTP ${response.status})`);
      }

      if (!responseData?.id || !responseData?.filename) {
        throw new Error("The server returned an invalid upload response. Please try again.");
      }

      const newDoc = responseData;
      setDocuments(prev => [newDoc, ...prev]);
      notify({
        type: "success",
        title: "Document indexed",
        message: `${newDoc.filename} is ready to use in chat.`,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Failed to index PDF.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (settings?.confirmDelete !== false && !window.confirm("Are you sure you want to delete this document? All associated context will be un-indexed.")) return;
    setDeletingDocumentId(docId);
    try {
      await apiDelete(`/api/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      notify({ type: "success", title: "Document removed", message: "The document and its indexed context were deleted." });
    } catch (err) {
      console.error("Failed to delete document:", err);
      notify({ type: "error", title: "Could not remove document", message: err.message || "Please try again." });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const formatDate = (isoStr) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <aside
      className={`flex h-full flex-none flex-col overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-xl shadow-black/20 transition-all duration-300 ease-out ${
        isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
      }`}
      style={{
        width: isOpen ? "380px" : "0px",
        minWidth: isOpen ? "380px" : "0px",
        padding: isOpen ? undefined : "0px",
      }}
    >
      <div className="mb-4 border-b border-[#30363d] bg-[#161b22] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b949e]">
              Workspace
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Documind Space</h2>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f81f7] text-lg font-bold text-white shadow-md shadow-blue-950/40">
            D
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`min-w-0 whitespace-nowrap rounded-2xl px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] transition-all duration-200 ${
                activePanel === item.id
                  ? "bg-[#1f6feb] text-white shadow-md shadow-blue-950/40"
                  : "border border-transparent bg-[#21262d] text-[#8b949e] hover:border-[#30363d] hover:bg-[#30363d] hover:text-[#e6edf3]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activePanel === "history" && (
          <div className="space-y-4 rounded-xl border border-[#30363d] bg-[#161b22]/55 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Chats</h3>
                <p className="text-[11px] text-slate-400">Manage your active sessions.</p>
              </div>
              <button
                onClick={handleCreateChat}
                className="rounded-lg border border-[#3b82f6] bg-[#1f6feb] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#388bfd] cursor-pointer"
              >
                + New
              </button>
            </div>

            {loadingChats ? (
              <p className="py-4 text-center text-sm text-[#58a6ff]">Loading chats...</p>
            ) : chats.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No chats found. Start a new conversation.
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveChatId(item.id)}
                    className={`group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-all duration-200 ${
                      activeChatId === item.id
                        ? "border-[#2f81f7]/70 bg-[#161b22] text-[#e6edf3] shadow-sm shadow-blue-950/30"
                        : "border-[#30363d] bg-[#0d1117] text-[#c9d1d9] hover:border-[#8b949e] hover:bg-[#161b22]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold">{item.title}</h4>
                      <p className="mt-1 text-[11px] text-slate-400">{formatDate(item.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChat(e, item.id)}
                      className="rounded-lg p-1.5 text-slate-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 cursor-pointer"
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activePanel === "documents" && (
          <div className="space-y-4 rounded-xl border border-[#30363d] bg-[#161b22]/55 p-3">
            <div>
              <h3 className="text-base font-semibold text-white">Knowledge Source</h3>
              <p className="text-[11px] text-slate-400">Upload PDFs or Markdown files to index them for chat.</p>
            </div>

            <div className="rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] p-4 text-center transition hover:border-[#2f81f7]/70 hover:bg-[#161b22]">
              <label className="block cursor-pointer">
                <span className="mb-2 block text-2xl">📄</span>
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#58a6ff]">
                  {uploading ? "Indexing file..." : "Upload PDF or .md"}
                </span>
                <span className="mt-1 block text-[10px] text-slate-500">PDF or Markdown · Max size 50MB</span>
                <input type="file" accept=".pdf,.md,application/pdf,text/markdown,text/plain" onChange={handleUploadDocument} disabled={uploading} className="hidden" />
              </label>
            </div>

            {uploadError && <p className="px-2 text-center text-xs text-red-400">{uploadError}</p>}

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Indexed Documents</h4>
              {loadingDocs ? (
                <p className="py-2 text-center text-xs text-[#58a6ff]">Loading documents...</p>
              ) : documents.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No custom documents uploaded. The default knowledge PDF is active.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#30363d] bg-[#0d1117] p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white" title={doc.filename}>{doc.filename}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{formatDate(doc.upload_time)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingDocumentId === doc.id}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-wait disabled:opacity-50 cursor-pointer"
                        title="Remove document"
                        aria-label={`Remove ${doc.filename}`}
                      >
                        {deletingDocumentId === doc.id ? "…" : "❌"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activePanel === "profile" && (
          <div className="space-y-4 rounded-xl border border-[#30363d] bg-[#161b22]/55 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f81f7] text-xl font-bold text-white">
                {(auth.user?.name || "U")[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{auth.user?.name || "User"}</h3>
                <p className="text-sm text-slate-400">Authenticated Member</p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Email</span>
                <span className="max-w-[10rem] truncate text-xs text-slate-400">{auth.user?.email || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Account Type</span>
                <span className="rounded-full border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-[#8b949e]">Standard</span>
              </div>
            </div>

            <button
              onClick={auth.logout}
              className="w-full rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        )}

        {activePanel === "settings" && (
          <div className="space-y-4 rounded-xl border border-[#30363d] bg-[#161b22]/55 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Preferences</h3>
                <p className="text-sm text-slate-400">Customize chat behavior on this device.</p>
              </div>
              <button
                type="button"
                onClick={onResetSettings}
                className="shrink-0 rounded-lg border border-[#30363d] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-[#58a6ff] hover:text-white"
              >
                Reset
              </button>
            </div>

            <div className="divide-y divide-[#30363d] rounded-xl border border-[#30363d] bg-[#0d1117] px-3">
              {[
                { key: "autoScroll", label: "Auto-scroll", description: "Keep the newest message in view." },
                { key: "markdownFormatting", label: "Format responses", description: "Render headings, lists, and tables." },
                { key: "showRetrievedChunks", label: "Show retrieved chunks", description: "Inspect document excerpts used to answer." },
                { key: "desktopNotifications", label: "Desktop notifications", description: "Notify when a reply finishes in the background." },
                { key: "confirmDelete", label: "Confirm before deleting", description: "Ask before removing a chat." },
              ].map((option) => {
                const enabled = Boolean(settings?.[option.key]);
                return (
                  <div key={option.key} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200">{option.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{option.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={option.label}
                      onClick={() => toggleSetting(option.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-[#1f6feb]" : "bg-[#30363d]"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
            {settingsNotice && <p role="status" className="text-xs leading-5 text-amber-300">{settingsNotice}</p>}
          </div>
        )}
      </div>
    </aside>
  );
}
