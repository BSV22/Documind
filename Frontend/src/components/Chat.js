"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiGet, getErrorMessage } from "../utils/api";

function MarkdownTable({ children }) {
    return (
        <div className="chat-table-wrap">
            <table>{children}</table>
        </div>
    );
}

const markdownComponents = { table: MarkdownTable };

export default function Chat({ activeChatId, settings }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState(null);
    const [errorDetails, setErrorDetails] = useState(null);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const historyRequestIdRef = useRef(0);
    const activeChatIdRef = useRef(activeChatId);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    useEffect(() => {
        const requestId = ++historyRequestIdRef.current;
        if (!activeChatId) {
            const timer = setTimeout(() => {
                if (historyRequestIdRef.current === requestId) {
                    setMessages([]);
                    setError(null);
                    setLoadingMessages(false);
                }
            }, 0);
            return () => clearTimeout(timer);
        }

        const fetchMessages = async () => {
            setLoadingMessages(true);
            setError(null);
            try {
                const data = await apiGet(`/api/chats/${activeChatId}/messages`);
                if (historyRequestIdRef.current === requestId) {
                    setMessages(
                        data.map(m => ({
                            id: m.id,
                            from: m.from_user ? "user" : "bot",
                            text: m.text,
                            sources: m.sources || [],
                        }))
                    );
                }
            } catch (err) {
                if (historyRequestIdRef.current !== requestId) return;
                console.error("Failed to load messages:", err);
                setError("Failed to load chat history");
                setErrorDetails(getErrorMessage(err));
                setMessages([]);
            } finally {
                if (historyRequestIdRef.current === requestId) {
                    setLoadingMessages(false);
                }
            }
        };

        fetchMessages();
    }, [activeChatId]);

    useEffect(() => {
        if (settings?.autoScroll !== false) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading, settings?.autoScroll]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        const maxHeight = 160;

        if (textarea.scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
            textarea.style.overflowY = "auto";
        } else {
            textarea.style.height = `${textarea.scrollHeight}px`;
            textarea.style.overflowY = "hidden";
        }
    }, [input]);

    const handleChange = (e) => {
        setInput(e.target.value);
    };

    const send = async () => {
        if (!input.trim() || !activeChatId || loading) return;

        const requestChatId = activeChatId;
        const userMsgText = input.trim();
        const userMsgId = String(Date.now());
        const userMsg = {
            id: userMsgId,
            from: "user",
            text: userMsgText,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setError(null);
        setLoading(true);

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.overflowY = "hidden";
            }
        });

        const botMsgId = String(Date.now() + 1);
        const controller = new AbortController();
        const requestTimeout = setTimeout(() => controller.abort(), 120000);
        setMessages((prev) => [
            ...prev,
            { id: botMsgId, from: "bot", text: "", sources: [] },
        ]);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chat_id: activeChatId,
                    message: userMsgText,
                    show_retrieved_chunks: Boolean(settings?.showRetrievedChunks),
                }),
                credentials: "same-origin",
                signal: controller.signal,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || errData.message || "Server error occurred");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";
            let hasError = false;
            let streamFinished = false;
            let pendingLine = "";

            try {
                while (!streamFinished) {
                    const { value, done } = await reader.read();
                    if (done) {
                        pendingLine += decoder.decode();
                        streamFinished = true;
                        break;
                    }

                    pendingLine += decoder.decode(value, { stream: true });
                    const lines = pendingLine.split("\n");
                    pendingLine = lines.pop() || "";

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith("data: ")) {
                            const dataStr = trimmedLine.slice(6).trim();
                            if (dataStr === "[DONE]") {
                                streamFinished = true;
                                break;
                            }
                            try {
                                const parsed = JSON.parse(dataStr);
                                if (parsed.text) {
                                    accumulatedText += parsed.text;
                                    if (activeChatIdRef.current === requestChatId) {
                                        setMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === botMsgId
                                                    ? { ...msg, text: accumulatedText }
                                                    : msg
                                            )
                                        );
                                    }
                                } else if (Array.isArray(parsed.sources)) {
                                    if (activeChatIdRef.current === requestChatId) {
                                        setMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === botMsgId
                                                    ? { ...msg, sources: parsed.sources }
                                                    : msg
                                            )
                                        );
                                    }
                                } else if (parsed.error) {
                                    hasError = true;
                                    console.warn("Stream error:", parsed.error);
                                    accumulatedText = `⚠️ Error: ${parsed.error}`;
                                    if (activeChatIdRef.current === requestChatId) {
                                        setMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === botMsgId
                                                    ? { ...msg, text: accumulatedText }
                                                    : msg
                                            )
                                        );
                                        setError("Failed to process request");
                                        setErrorDetails(parsed.error);
                                    }
                                    break;
                                }
                            } catch (parseErr) {
                                console.debug("Parse error for chunk:", parseErr);
                            }
                        }
                    }
                }
            } catch (streamErr) {
                console.error("Stream reading error:", streamErr);
                if (!hasError && activeChatIdRef.current === requestChatId) {
                    const timedOut = controller.signal.aborted;
                    setError(timedOut ? "Response timed out" : "Stream interrupted");
                    setErrorDetails(
                        timedOut
                            ? "The response took too long. Please try again."
                            : "Connection was interrupted while streaming response"
                    );
                    setMessages((prev) => {
                        const exists = prev.some(m => m.id === botMsgId);
                        if (exists) {
                            return prev.map(msg =>
                                msg.id === botMsgId
                                    ? {
                                        ...msg,
                                        text: timedOut
                                            ? "⚠️ Error: The response timed out. Please try again."
                                            : "⚠️ Error: Connection was interrupted. Please try again.",
                                    }
                                    : msg
                            );
                        }
                        return prev;
                    });
                }
            } finally {
                if (
                    streamFinished &&
                    !hasError &&
                    settings?.desktopNotifications &&
                    document.visibilityState === "hidden" &&
                    "Notification" in window &&
                    Notification.permission === "granted"
                ) {
                    try {
                        new Notification("Documind", { body: "Your response is ready." });
                    } catch (notificationError) {
                        console.warn("Could not display desktop notification:", notificationError);
                    }
                }
            }
        } catch (err) {
            console.error("Chat error:", err);

            const errorMsg = controller.signal.aborted
                ? "The response timed out. Please try again."
                : getErrorMessage(err);
            if (activeChatIdRef.current === requestChatId) {
                setError("Failed to send message");
                setErrorDetails(errorMsg);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === botMsgId
                            ? { ...msg, text: `⚠️ Error: ${errorMsg}` }
                            : msg
                    )
                );
            }
        } finally {
            clearTimeout(requestTimeout);
            setLoading(false);
        }
    };

    function onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    if (!activeChatId) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] p-8 text-center shadow-xl shadow-black/20">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#30363d] bg-[#161b22] text-4xl text-[#58a6ff]">💬</div>
                <h3 className="mb-2 text-xl font-semibold text-white">Documind RAG Assistant</h3>
                <p className="max-w-md text-sm leading-6 text-slate-400">
                    Select a chat session from the sidebar history or create a new session to begin asking questions about your indexed documents.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-4 py-3 text-white">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#8b949e]">Conversation</p>
                    <h2 className="mt-1 text-base font-semibold">Documind Chatbot</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Online
                </span>
            </div>

            {error && (
                <div className="border-b border-red-700/60 bg-red-950/35 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-red-300">{error}</p>
                            {errorDetails && <p className="mt-1 text-xs text-red-200/80">{errorDetails}</p>}
                        </div>
                        <button onClick={() => setError(null)} className="text-red-300 transition hover:text-red-200 cursor-pointer">✕</button>
                    </div>
                </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {loadingMessages ? (
                    <div className="py-8 text-center text-sm text-[#58a6ff]">Loading history...</div>
                ) : messages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">No messages yet. Ask a question to begin.</div>
                ) : (
                    messages.map((m) => (
                        <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[78%] break-words rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm ${
                                    m.from === "user"
                                        ? "whitespace-pre-wrap bg-[#1f6feb] text-white rounded-br-md"
                                        : m.text.startsWith("⚠️")
                                            ? "whitespace-pre-wrap bg-red-950/50 text-red-100 border border-red-500/20 rounded-bl-md"
                                            : "whitespace-normal border border-[#30363d] bg-[#161b22] text-[#e6edf3] rounded-bl-md"
                                }`}
                            >
                                {!m.text ? (
                                    <span className="text-xs italic text-slate-400">Streaming...</span>
                                ) : m.from === "bot" && settings?.markdownFormatting !== false && !m.text.startsWith("⚠️") ? (
                                    <div className="chat-markdown">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                            {m.text}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    m.text
                                )}
                                {m.from === "bot" && m.sources?.length > 0 && (
                                    <details className="chat-sources">
                                        <summary>Retrieved context ({m.sources.length} chunks)</summary>
                                        <div className="chat-sources-list">
                                            {m.sources.map((source) => (
                                                <section className="chat-source" key={source.rank}>
                                                    <h4>Chunk {source.rank}</h4>
                                                    <p>{source.text}</p>
                                                </section>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {loading && (
                    <div className="flex justify-start">
                        <div className="flex max-w-[75%] items-center gap-2 rounded-xl rounded-bl-md border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#e6edf3]">
                            <span className="text-xs uppercase tracking-[0.1em] text-[#58a6ff]">Thinking</span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#58a6ff]" style={{ animationDelay: '0ms' }}></span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#58a6ff]" style={{ animationDelay: '150ms' }}></span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#58a6ff]" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-[#30363d] bg-[#161b22] p-3">
                <div className="flex items-end gap-3 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2 transition focus-within:border-[#2f81f7] focus-within:ring-2 focus-within:ring-[#2f81f7]/20">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleChange}
                        onKeyDown={onKeyDown}
                        rows={1}
                        disabled={loading || loadingMessages}
                        placeholder="Ask a question about your documents..."
                        className="max-h-40 min-h-[44px] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                        onClick={send}
                        disabled={loading || loadingMessages || !input.trim()}
                        className="rounded-lg border border-[#3b82f6] bg-[#1f6feb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:border-[#30363d] disabled:bg-[#21262d] disabled:text-[#8b949e] cursor-pointer"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
