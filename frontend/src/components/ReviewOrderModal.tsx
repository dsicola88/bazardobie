import { useEffect, useState } from "react";
import { apiFetch, uploadAdminFile } from "../api.js";
import { resolveMediaUrl } from "../utils/media.js";

const MAX_REVIEW_PHOTOS = 6;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type Props = {
  open: boolean;
  token: string | null;
  orderId: string;
  productId: string;
  productName: string;
  onClose: () => void;
  onCreated: () => void;
};

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_REVIEW_PHOTOS);
}

export function ReviewOrderModal({ open, token, orderId, productId, productName, onClose, onCreated }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setRating(5);
      setComment("");
      setUrlsText("");
      setPhotoUrls([]);
      setErr(null);
      setLoading(false);
      setUploading(false);
    }
  }, [open]);

  if (!open) return null;

  const slotsLeft = MAX_REVIEW_PHOTOS - photoUrls.length;

  async function onPickFiles(files: FileList | null) {
    if (!files?.length || !token || slotsLeft <= 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, slotsLeft);
    if (!arr.length) {
      setErr("Seleccione imagens (JPG, PNG, WebP ou GIF).");
      return;
    }
    setErr(null);
    setUploading(true);
    try {
      const next: string[] = [...photoUrls];
      for (const f of arr) {
        if (next.length >= MAX_REVIEW_PHOTOS) break;
        const url = await uploadAdminFile(token, f);
        next.push(url);
      }
      setPhotoUrls(next);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar imagens.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) return;
    setLoading(true);
    try {
      const fromText = parseUrls(urlsText).filter((u) => !photoUrls.includes(u));
      const merged = [...photoUrls, ...fromText].slice(0, MAX_REVIEW_PHOTOS);
      await apiFetch("/reviews", {
        method: "POST",
        token,
        body: JSON.stringify({
          orderId,
          productId,
          rating,
          comment: comment.trim() || undefined,
          photoUrls: merged.length ? merged : undefined,
        }),
      });
      setComment("");
      setUrlsText("");
      setPhotoUrls([]);
      onCreated();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível publicar a avaliação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="ae-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ae-review-head"
      onClick={onClose}
    >
      <div className="ae-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="ae-review-head" style={{ marginTop: 0 }}>
          Avaliar artigo
        </h2>
        <p className="ae-muted" style={{ fontSize: 13 }}>
          {productName}
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label>Avaliação (1–5 estrelas)</label>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n) + " ☆".repeat(5 - n)}
              </option>
            ))}
          </select>
          <label>Comentário</label>
          <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Opcional mas recomendado" />

          <label>Fotos da avaliação (opcional, até {MAX_REVIEW_PHOTOS})</label>
          <p className="ae-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
            Carregue fotos do produto recebido. São tratadas no servidor (orientação e tamanho).
          </p>
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            disabled={!token || slotsLeft <= 0 || uploading || loading}
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          {photoUrls.length > 0 ? (
            <ul className="ae-review-uploads">
              {photoUrls.map((url) => (
                <li key={url} className="ae-review-uploads__item">
                  <img src={resolveMediaUrl(url)} alt="" />
                  <button
                    type="button"
                    className="ae-review-uploads__rm"
                    aria-label="Remover foto"
                    disabled={loading || uploading}
                    onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uploading ? <div className="ae-muted" style={{ fontSize: 12 }}>A carregar imagens…</div> : null}

          <label className="ae-muted" style={{ fontSize: 12 }}>
            Ou cole URLs públicas (opcional, até preencher {MAX_REVIEW_PHOTOS} fotos no total)
          </label>
          <textarea
            rows={2}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder="Uma URL por linha"
            disabled={loading}
          />

          {err ? <div className="ae-checkout-msg">{err}</div> : null}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading || uploading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
              {loading ? "A publicar…" : "Publicar avaliação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
