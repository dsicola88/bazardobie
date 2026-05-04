import { useState } from "react";
import { apiFetch } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

type Props = {
  productId: string;
  shopId?: string;
  onClose: () => void;
};

export function ProductReportModal({ productId, shopId, onClose }: Props) {
  const { token } = useAuth();
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setErr("Inicie sessão para enviar o relatório.");
      return;
    }
    setErr(null);
    setSending(true);
    try {
      await apiFetch("/reports", {
        method: "POST",
        token,
        body: JSON.stringify({
          productId,
          ...(shopId ? { shopId } : {}),
          message: message.trim(),
        }),
      });
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Não foi possível enviar o relatório.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ae-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ae-modal"
        role="dialog"
        aria-labelledby="report-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h1 id="report-title">Reportar conteúdo</h1>
        {done ? (
          <>
            <p>O seu relatório foi registado. A equipa de moderação irá analisá-lo.</p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Fechar
            </button>
          </>
        ) : (
          <form className="ae-form" onSubmit={(e) => void submit(e)}>
            <p className="ae-muted" style={{ fontSize: 13 }}>
              Use para conteúdo enganoso, proibido ou situação grave com o parceiro. Os dados técnicos seguem com a sua
              conta autenticada.
            </p>
            <label htmlFor="rep-msg">Descrição (mín. 10 caracteres)</label>
            <textarea
              id="rep-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              rows={5}
              placeholder="Explique o problema com clareza…"
            />
            {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? "A enviar…" : "Enviar relatório"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
