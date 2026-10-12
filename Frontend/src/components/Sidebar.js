"use client";

import { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { apiGet, apiPost, apiDelete } from "../utils/api";

const sidebarItems = [
  { id: "history", label: "Chat History" },
  { id: "documents", label: "Documents" },
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
];

export default function Sidebar({ isOpen = true, activeChatId, setActiveChatId }) {
  const auth = useContext(AuthContext);
  const [activePanel, setActivePanel] = useState("history");
  const [chats, setChats] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const data = await apiGet("/api/chats");
      setChats(data);
      if (data.length > 0 && !activeChatId) {
        setActiveChatId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [activeChatId, setActiveChatId]);

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
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
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

  const handleUploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF documents are supported.");
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      const newDoc = await response.json();
      setDocuments(prev => [newDoc, ...prev]);
      alert("Document indexed successfully!");
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Failed to index PDF.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document? All associated context will be un-indexed.")) return;
    try {
      await apiDelete(`/api/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
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
      className={`flex h-full flex-none flex-col overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-900/80 backdrop-blur-xl shadow-[0_30px_80px_rgba(15,23,42,0.5)] transition-all duration-300 ease-out ${
        isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
      }`}
      style={{
        width: isOpen ? "380px" : "0px",
        minWidth: isOpen ? "380px" : "0px",
        padding: isOpen ? undefined : "0px",
      }}
    >
      <div className="mb-4 border-b border-slate-800/90 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900/90 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Workspace
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Documind Space</h2>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/25">
            D
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`rounded-2xl px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${
                activePanel === item.id
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/30"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activePanel === "history" && (
          <div className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-950/30 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Chats</h3>
                <p className="text-[11px] text-slate-400">Manage your active sessions.</p>
              </div>
              <button
                onClick={handleCreateChat}
                className="rounded-xl bg-cyan-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-cyan-400 cursor-pointer"
              >
                + New
              </button>
            </div>

            {loadingChats ? (
              <p className="py-4 text-center text-sm text-cyan-300">Loading chats...</p>
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
                        ? "border-cyan-500/60 bg-slate-800 text-white shadow-[0_10px_30px_rgba(34,211,238,0.12)]"
                        : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80"
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
          <div className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-950/30 p-3">
            <div>
              <h3 className="text-base font-semibold text-white">Knowledge Source</h3>
              <p className="text-[11px] text-slate-400">Upload PDFs and index them into your private vector database.</p>
            </div>

            <div className="rounded-3xl border border-dashed border-cyan-500/30 bg-slate-900/80 p-4 text-center">
              <label className="block cursor-pointer">
                <span className="mb-2 block text-2xl">📄</span>
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {uploading ? "Indexing file..." : "Upload PDF"}
                </span>
                <span className="mt-1 block text-[10px] text-slate-500">Max size 10MB</span>
                <input type="file" accept=".pdf" onChange={handleUploadDocument} disabled={uploading} className="hidden" />
              </label>
            </div>

            {uploadError && <p className="px-2 text-center text-xs text-red-400">{uploadError}</p>}

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Indexed PDFs</h4>
              {loadingDocs ? (
                <p className="py-2 text-center text-xs text-cyan-300">Loading documents...</p>
              ) : documents.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No custom documents uploaded. The default knowledge PDF is active.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white" title={doc.filename}>{doc.filename}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{formatDate(doc.upload_time)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                        title="Remove document"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activePanel === "profile" && (
          <div className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-950/30 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-400 to-blue-500 text-xl font-bold text-slate-950">
                {(auth.user?.name || "U")[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{auth.user?.name || "User"}</h3>
                <p className="text-sm text-slate-400">Authenticated Member</p>
              </div>
            </div>

            <div className="space-y-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Email</span>
                <span className="max-w-[10rem] truncate text-xs text-slate-400">{auth.user?.email || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Account Type</span>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-300">Standard</span>
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
          <div className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-950/30 p-3">
            <div>
              <h3 className="text-base font-semibold text-white">Preferences</h3>
              <p className="text-sm text-slate-400">Adjust workspace actions.</p>
            </div>
            <div className="space-y-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Dark mode</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">Enabled</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>Notifications</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">On</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
