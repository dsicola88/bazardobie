import { useState } from "react";
import { apiFetch } from "../api.js";

type Props = {
  orderId: string;
  token: string | null;
  initial?: {
    trackingCarrier?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
  };
  onSaved: () => void;
  disabled?: boolean;
};

/** Formulário compacto: transportadora, código e URL de seguimento (vendedor / logística / admin). */
export function OrderTrackingEditor({ orderId, token, initial, onSaved, disabled }: Props) {
  const [carrier, setCarrier] = useState(initial?.trackingCarrier ?? "");
  const [code, setCode] = useState(initial?.trackingCode ?? "");
  const [url, setUrl] = useState(initial?.trackingUrl ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || disabled) return;
    setMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/orders/${encodeURIComponent(orderId)}/tracking`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          trackingCarrier: carrier.trim() || "",
          trackingCode: code.trim() || "",
          trackingUrl: url.trim() || "",
        }),
      });
      setMsg("Rastreio guardado.");
      onSaved();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Erro ao guardar.");
    } finally {
      setLoading(false);
    }
  }

  if (disabled) return null;

  return (
    <form className="ae-tracking-editor" onSubmit={(e) => void save(e)}>
      <div className="ae-tracking-editor__head">Rastreio da encomenda</div>
      <div className="ae-tracking-editor__grid">
        <label>
          <span>Transportadora</span>
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="Ex.: motoboy interno, DHL"
            maxLength={120}
          />
        </label>
        <label>
          <span>Código de rastreio / guia</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Nº que o comprador usa no site da transportadora"
            maxLength={160}
          />
        </label>
        <label className="ae-tracking-editor__full">
          <span>URL de seguimento (opcional)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" maxLength={2048} />
        </label>
      </div>
      <button type="submit" className="btn btn-ghost" disabled={loading || !token}>
        {loading ? "A guardar…" : "Guardar rastreio"}
      </button>
      {msg ? <span className="ae-tracking-editor__msg">{msg}</span> : null}
    </form>
  );
}
