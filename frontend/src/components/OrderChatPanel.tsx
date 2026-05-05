import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, uploadAdminFile } from "../api.js";

type ChatMsg = {
  id: string;
  orderId: string;
  senderId: string;
  type: "TEXT" | "IMAGE" | "VIDEO";
  text?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  sender: { id: string; name: string; role: string };
};

type Props = {
  orderId: string;
  token: string;
  currentUserId: string;
  title?: string;
};

const VIDEO_MAX_SECONDS = 60;
const VIDEO_MAX_HEIGHT = 720;
const VIDEO_MAX_WIDTH = 1280;

async function validateVideoConstraints(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      };
      v.onerror = () => reject(new Error("Nao foi possivel ler metadados do video."));
      v.src = url;
    });
    if (!Number.isFinite(meta.duration) || meta.duration <= 0) {
      throw new Error("Video invalido.");
    }
    if (meta.duration > VIDEO_MAX_SECONDS) {
      throw new Error("Video acima de 60 segundos. Envie um clip mais curto.");
    }
    if (meta.width > VIDEO_MAX_WIDTH || meta.height > VIDEO_MAX_HEIGHT) {
      throw new Error("Resolucao alta demais. Use ate 1280x720 para poupar espaco.");
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function OrderChatPanel({ orderId, token, currentUserId, title = "Chat com parceiro" }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    void apiFetch<ChatMsg[]>(`/orders/${encodeURIComponent(orderId)}/chat/messages`, { token })
      .then(setMessages)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Falha ao carregar chat."));
  }, [orderId, token]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending]);

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr(null);
    try {
      const out = await apiFetch<ChatMsg>(`/orders/${encodeURIComponent(orderId)}/chat/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ text: body }),
      });
      setMessages((prev) => [...prev, out]);
      setText("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Nao foi possivel enviar.");
    } finally {
      setSending(false);
    }
  }

  async function uploadAndSend(file: File) {
    if (uploading) return;
    setUploading(true);
    setErr(null);
    try {
      if (file.type.startsWith("video/")) {
        await validateVideoConstraints(file);
      }
      const mediaUrl = await uploadAdminFile(token, file);
      const out = await apiFetch<ChatMsg>(`/orders/${encodeURIComponent(orderId)}/chat/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ mediaUrl }),
      });
      setMessages((prev) => [...prev, out]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar media.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="ae-chat-panel page-panel">
      <h3 className="ae-chat-panel__title">{title}</h3>
      <p className="ae-muted" style={{ marginTop: 0, fontSize: 12 }}>
        Troque mensagens com anexos (imagem/video curto ate 60s).
      </p>
      <div className="ae-chat-list">
        {messages.length === 0 ? (
          <p className="ae-muted" style={{ margin: 0, fontSize: 13 }}>
            Ainda sem mensagens neste pedido.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <article key={m.id} className={`ae-chat-msg ${mine ? "ae-chat-msg--mine" : ""}`}>
                <div className="ae-chat-msg__meta">
                  <strong>{mine ? "Voce" : m.sender.name}</strong> · {new Date(m.createdAt).toLocaleString("pt-AO")}
                </div>
                {m.text ? <p className="ae-chat-msg__text">{m.text}</p> : null}
                {m.mediaUrl && m.type === "IMAGE" ? (
                  <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
                    <img className="ae-chat-msg__img" src={m.mediaUrl} alt="Anexo do chat" />
                  </a>
                ) : null}
                {m.mediaUrl && m.type === "VIDEO" ? (
                  <video className="ae-chat-msg__video" src={m.mediaUrl} controls preload="metadata" />
                ) : null}
              </article>
            );
          })
        )}
      </div>
      {err ? (
        <p className="ae-admin-alert ae-admin-alert--err" style={{ marginTop: 10 }}>
          {err}
        </p>
      ) : null}
      <div className="ae-chat-compose">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Escreva uma mensagem..."
        />
        <div className="ae-chat-compose__actions">
          <input
            id={`chat-file-${orderId}`}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadAndSend(file);
            }}
          />
          <label htmlFor={`chat-file-${orderId}`} className="btn" style={{ margin: 0, cursor: "pointer" }}>
            {uploading ? "A enviar ficheiro..." : "Imagem/Video"}
          </label>
          <button type="button" className="btn btn-primary" disabled={!canSend} onClick={() => void sendText()}>
            {sending ? "A enviar..." : "Enviar"}
          </button>
        </div>
      </div>
    </section>
  );
}
