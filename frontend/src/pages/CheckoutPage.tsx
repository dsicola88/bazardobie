import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, apiErrorDetailsCode, cartSessionHeaders, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { formatKz } from "../utils/format.js";

type CheckoutCartItem = {
  id: string;
  quantity: number;
  variant?: { id?: string; name?: string | null; priceAdjust?: string | null } | null;
  product: {
    id: string;
    name: string;
    price: string;
    promoPrice?: string | null;
    images?: { url: string }[];
  };
  productDeliveryOption: {
    tipoEntrega: string;
    custoEntrega: string;
    prazoEstimado: number;
    logisticsPartner?: { id: string; name: string } | null;
  };
};

function unitPriceKz(it: CheckoutCartItem): number {
  const p = it.product;
  const promo =
    p.promoPrice != null && String(p.promoPrice).trim() !== "" ? Number(p.promoPrice) : null;
  const base = promo ?? Number(p.price);
  const adj =
    it.variant?.priceAdjust != null && String(it.variant.priceAdjust).trim() !== ""
      ? Number(it.variant.priceAdjust)
      : 0;
  return base + adj;
}

function totals(items: CheckoutCartItem[]) {
  let sub = 0;
  let ship = 0;
  for (const it of items) {
    sub += unitPriceKz(it) * it.quantity;
    ship += Number(it.productDeliveryOption.custoEntrega);
  }
  return { subtotal: sub, shipping: ship, grand: sub + ship };
}

type PayMethod = "COD" | "TRANSFERENCIA" | "PAGAMENTO_ONLINE";

function ordersPathAfterCheckout(pm: PayMethod): string {
  if (pm === "PAGAMENTO_ONLINE") return "/orders?tab=pagar";
  return "/orders?tab=espera_loja";
}

export default function CheckoutPage() {
  const { token, user, refreshMe } = useAuth();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const [cart, setCart] = useState<{ items: CheckoutCartItem[] } | null>(null);
  const [cartErr, setCartErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  /** null = cliente ainda a carregar; object = estado conhecido (pode não ter telefone). */
  const [meLoad, setMeLoad] = useState<{ phone: string | null } | null>(null);
  const [profilePhoneDraft, setProfilePhoneDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingProvince, setShippingProvince] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("COD");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const paymentProofFileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const [done, setDone] = useState<{
    checkoutGroupId: string;
    orderIds: string[];
    paySessionFallback?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!token || user?.role !== "CLIENTE") return;
    void apiFetch<{ items: CheckoutCartItem[] }>("/cart", { headers: cartSessionHeaders(), token })
      .then((c) => {
        setCart(c);
        setCartErr(null);
      })
      .catch(() => {
        setCartErr("Não foi possível carregar o carrinho.");
        setCart({ items: [] });
      });
  }, [token, user]);

  useEffect(() => {
    if (!token || user?.role !== "CLIENTE") {
      setMeLoad(null);
      return;
    }
    void apiFetch<{ phone?: string | null }>("/auth/me", { token })
      .then((m) => {
        const tel = m.phone ?? null;
        setMeLoad({ phone: tel });
        const p = tel?.trim();
        if (p && p.length >= 6) setShippingPhone((s) => (s.trim() ? s : p));
        setProfilePhoneDraft((prev) => (prev.trim() ? prev : p ?? ""));
      })
      .catch(() => setMeLoad({ phone: null }));
  }, [token, user]);

  const { subtotal, shipping, grand } = useMemo(
    () => totals(cart?.items ?? []),
    [cart?.items]
  );

  const awaitingMe = Boolean(token && user?.role === "CLIENTE" && meLoad === null);
  const profilePhoneIncomplete = Boolean(
    token &&
      user?.role === "CLIENTE" &&
      meLoad !== null &&
      (!meLoad.phone?.trim() || meLoad.phone.trim().length < 6)
  );
  const checkoutBlocked = awaitingMe || profilePhoneIncomplete;

  async function saveAccountPhone() {
    if (!token) return;
    const p = profilePhoneDraft.trim();
    if (p.length < 6) {
      setMsg("O telefone na conta deve ter pelo menos 6 caracteres.");
      return;
    }
    setProfileSaving(true);
    setMsg(null);
    try {
      await apiFetch("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ phone: p }),
      });
      await refreshMe();
      setMeLoad({ phone: p });
      setShippingPhone((s) => (s.trim() ? s : p));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível guardar o telefone.");
    } finally {
      setProfileSaving(false);
    }
  }

  if (!token || user?.role !== "CLIENTE") {
    return (
      <p>
        O fecho de compra online destina-se a contas de comprador. <Link to="/login">Iniciar sessão</Link>
      </p>
    );
  }

  if (cartErr && !cart) {
    return <p className="ae-muted">{cartErr}</p>;
  }

  if (!cart) {
    return <p className="ae-muted">A carregar o carrinho…</p>;
  }

  if (cart.items.length === 0 && !done) {
    return (
      <div className="ae-checkout">
        <h1 className="ae-checkout__title">Fecho da compra</h1>
        <div className="page-panel ae-empty-center">
          O carrinho está vazio.
          <br />
          <Link to="/search">Continuar a comprar</Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const out = await apiFetch<{ checkoutGroupId: string; orders: { id: string }[] }>("/checkout", {
        method: "POST",
        token,
        headers: cartSessionHeaders(),
        body: JSON.stringify({
          paymentMethod,
          paymentProofUrl: paymentProofUrl || undefined,
          shippingName,
          shippingPhone,
          shippingProvince,
          shippingCity,
          shippingAddress,
          notes,
        }),
      });
      window.dispatchEvent(new Event("cart-updated"));

      if (paymentMethod === "PAGAMENTO_ONLINE") {
        try {
          const sess = await apiFetch<{ approveUrl?: string }>(
            `/checkout/group/${encodeURIComponent(out.checkoutGroupId)}/pay`,
            {
              method: "POST",
              token,
              body: JSON.stringify({ provider: "MOCK" }),
            }
          );
          if (sess.approveUrl) {
            window.location.assign(sess.approveUrl);
            return;
          }
          setDone({
            checkoutGroupId: out.checkoutGroupId,
            orderIds: out.orders.map((o) => o.id),
            paySessionFallback: true,
          });
          setMsg("Pagamento electrónico: resposta sem URL de autorização.");
        } catch (payErr: unknown) {
          const hint =
            payErr instanceof Error
              ? payErr.message +
                (payErr && typeof payErr === "object" && "status" in payErr && payErr.status === 501
                  ? " No ambiente de demonstração confirme o fornecedor MOCK pré-configurado."
                  : "")
              : "Não foi possível iniciar o pagamento online.";
          setDone({
            checkoutGroupId: out.checkoutGroupId,
            orderIds: out.orders.map((o) => o.id),
            paySessionFallback: true,
          });
          setMsg(hint);
        }
        return;
      }

      setDone({
        checkoutGroupId: out.checkoutGroupId,
        orderIds: out.orders.map((o) => o.id),
      });
    } catch (err: unknown) {
      if (apiErrorDetailsCode(err) === "PHONE_REQUIRED" && token) {
        void apiFetch<{ phone?: string | null }>("/auth/me", { token }).then((m) => {
          setMeLoad({ phone: m.phone ?? null });
          setProfilePhoneDraft(m.phone?.trim() ?? "");
        });
      }
      setMsg(err instanceof Error ? err.message : "Não foi possível concluir a encomenda.");
    } finally {
      setLoading(false);
    }
  }

  async function onPaymentProofFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f || !token) return;
    setMsg(null);
    setProofUploading(true);
    try {
      const url = await uploadAdminFile(token, f);
      setPaymentProofUrl(url);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível carregar o comprovativo.");
    } finally {
      setProofUploading(false);
    }
  }

  async function retryMockPay() {
    if (!done || !token) return;
    setMsg(null);
    try {
      const sess = await apiFetch<{ approveUrl?: string }>(
        `/checkout/group/${encodeURIComponent(done.checkoutGroupId)}/pay`,
        { method: "POST", token, body: JSON.stringify({ provider: "MOCK" }) }
      );
      if (sess.approveUrl) {
        window.location.assign(sess.approveUrl);
        return;
      }
          setMsg("Pagamento electrónico: URL de autorização indisponível — contacte o suporte técnico.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível abrir o pagamento.");
    }
  }

  if (done) {
    return (
      <div className="ae-checkout">
        <h1 className="ae-checkout__title">Encomenda registada</h1>
        <div className="ae-checkout-success page-panel">
          <p style={{ marginTop: 0 }}>
            <strong>{done.orderIds.length} encomenda(s)</strong> registada(s) · grupo <code>{done.checkoutGroupId}</code>
          </p>
          {paymentMethod === "PAGAMENTO_ONLINE" ? (
            done.paySessionFallback ? (
              <div style={{ marginTop: 12 }}>
                {msg ? (
                  <div className="ae-checkout-msg" style={{ marginBottom: 12 }}>
                    {msg}
                  </div>
                ) : null}
                <button type="button" className="btn btn-primary" onClick={() => void retryMockPay()}>
                  Tentar pagamento outra vez
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={() => navigate(ordersPathAfterCheckout(paymentMethod))}>
                  Ver encomendas
                </button>
              </div>
            )
          ) : paymentMethod === "TRANSFERENCIA" ? (
            <>
              <p style={{ fontSize: 14, marginTop: 12 }}>
                A loja parceira ou o suporte analisará o comprovativo. O estado da encomenda segue em «As minhas encomendas».
              </p>
              {content["public.checkout_transfer_instructions"]?.trim() ? (
                <div
                  className="ae-checkout-msg"
                  style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}
                >
                  {content["public.checkout_transfer_instructions"]}
                </div>
              ) : null}
            </>
          ) : (
            <p style={{ fontSize: 14, marginTop: 12 }}>Pagamento à entrega — liquidar em kwanzas na recepção da mercadoria.</p>
          )}
          <div className="ae-checkout-success__actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate(ordersPathAfterCheckout(paymentMethod))}>
              As minhas encomendas
            </button>
            <Link className="btn btn-ghost" to="/search">
              Continuar a comprar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ae-checkout">
      <div className="ae-checkout__breadcrumb">
        <Link to="/cart">Carrinho</Link>
        <span className="ae-checkout__sep">›</span>
        <span className="ae-on">Fecho da compra</span>
      </div>
      <h1 className="ae-checkout__title">Fecho da compra</h1>

      <div className="ae-checkout__grid">
        <form className="ae-checkout__main" onSubmit={submit}>
          {awaitingMe ? (
            <p className="ae-checkout-msg ae-muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
              A carregar dados da conta…
            </p>
          ) : null}
          {profilePhoneIncomplete ? (
            <section className="page-panel ae-checkout-msg" style={{ marginBottom: 16 }}>
              <strong style={{ display: "block", marginBottom: 10 }}>Telefone no perfil — obrigatório</strong>
              <div className="form-stack" style={{ maxWidth: 360 }}>
                <label htmlFor="acct-phone">Telefone</label>
                <input
                  id="acct-phone"
                  value={profilePhoneDraft}
                  onChange={(e) => setProfilePhoneDraft(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="tel"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={profileSaving}
                  onClick={() => void saveAccountPhone()}
                >
                  {profileSaving ? "A guardar…" : "Guardar"}
                </button>
              </div>
            </section>
          ) : null}
          <section className="ae-checkout-panel">
            <div className="ae-checkout-step">
              <span className="ae-checkout-step__n">1</span>
              <h2>Morada</h2>
            </div>
            <div className="form-stack ae-checkout-fields">
              <label>Nome do destinatário</label>
              <input value={shippingName} onChange={(e) => setShippingName(e.target.value)} required />
              <label>Telefone para entrega</label>
              <input value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} required />
              <div className="ae-checkout-fields__row">
                <div>
                  <label>Província</label>
                  <input value={shippingProvince} onChange={(e) => setShippingProvince(e.target.value)} required />
                </div>
                <div>
                  <label>Cidade / município</label>
                  <input value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} required />
                </div>
              </div>
              <label>Rua / bairro / ponto de referência</label>
              <textarea rows={3} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} required />
              <label>Observações (opcional)</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>

          <section className="ae-checkout-panel">
            <div className="ae-checkout-step">
              <span className="ae-checkout-step__n">2</span>
              <h2>Pagamento</h2>
            </div>
            <div className="ae-pay-options">
              {(
                [
                  {
                    key: "COD" as const,
                    title: "Pagamento à entrega",
                    sub: "Liquidar em kwanzas na entrega.",
                  },
                  {
                    key: "TRANSFERENCIA" as const,
                    title: "Transferência bancária",
                    sub: "Comprovativo: carregar ficheiro ou link.",
                  },
                  {
                    key: "PAGAMENTO_ONLINE" as const,
                    title: "Meio electrónico",
                    sub: "Multicaixa ou carteira (se activo).",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.key}
                  className={`ae-pay-opt ${paymentMethod === opt.key ? "ae-pay-opt--on" : ""}`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === opt.key}
                    onChange={() => setPaymentMethod(opt.key)}
                  />
                  <span className="ae-pay-opt__body">
                    <strong>{opt.title}</strong>
                    <span className="ae-pay-opt__sub">{opt.sub}</span>
                  </span>
                </label>
              ))}
            </div>

            {paymentMethod === "TRANSFERENCIA" ? (
              <div className="form-stack" style={{ marginTop: 16 }}>
                {content["public.checkout_transfer_instructions"]?.trim() ? (
                  <div
                    className="page-panel ae-muted"
                    style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 8 }}
                  >
                    {content["public.checkout_transfer_instructions"]}
                  </div>
                ) : null}
                <div>
                  <span className="ae-muted" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                    Comprovativo de transferência <strong style={{ color: "var(--ae-deep)" }}>(obrigatório)</strong> —
                    carregue um ficheiro ou cole um link HTTPS.
                  </span>
                  <input
                    ref={paymentProofFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => void onPaymentProofFile(e)}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={proofUploading || !token}
                      onClick={() => paymentProofFileRef.current?.click()}
                    >
                      {proofUploading ? "A carregar…" : "Carregar ficheiro (foto ou PDF)"}
                    </button>
                    {paymentProofUrl.trim() ? (
                      <button type="button" className="ae-linkbtn" onClick={() => setPaymentProofUrl("")}>
                        Limpar
                      </button>
                    ) : null}
                  </div>
                </div>
                <label htmlFor="checkout-proof-url">Endereço do comprovativo (preenchido automaticamente após upload ou manualmente)</label>
                <input
                  id="checkout-proof-url"
                  type="url"
                  placeholder="https://…"
                  value={paymentProofUrl}
                  onChange={(e) => setPaymentProofUrl(e.target.value)}
                  required
                />
                <p className="ae-muted" style={{ fontSize: 12, margin: 0 }}>
                  Limite típico de 5&nbsp;MB por ficheiro. O endereço gerado após o upload pode ser editado, se
                  necessário.
                </p>
              </div>
            ) : null}

            {paymentMethod === "PAGAMENTO_ONLINE" ? (
              <div className="ae-pay-online-hint ae-muted" style={{ fontSize: 12, marginTop: 12 }}>
                Próximo passo: ecrã de pagamento.
              </div>
            ) : null}
          </section>

          {msg ? <div className="ae-checkout-msg">{msg}</div> : null}

          <div className="ae-checkout-submit">
            <button
              type="submit"
              disabled={loading || checkoutBlocked}
              className="btn btn-primary ae-checkout-submit-btn"
            >
              {loading ? "A processar…" : `Confirmar compra · ${formatKz(grand)}`}
            </button>
            {checkoutBlocked && profilePhoneIncomplete ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                Guarde telefone acima.
              </p>
            ) : null}
            <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              Uma encomenda por loja parceira · totais em kwanzas.
            </p>
          </div>
        </form>

        <aside className="ae-checkout__aside" aria-label="Resumo da encomenda">
          <div className="ae-checkout-summary page-panel">
            <h3 className="ae-checkout-summary__h">Resumo da encomenda</h3>
            <ul className="ae-checkout-summary__lines">
              {cart.items.map((it) => {
                const thumb = it.product.images?.[0]?.url;
                const ship = Number(it.productDeliveryOption.custoEntrega);
                const line = unitPriceKz(it) * it.quantity;
                return (
                  <li key={it.id}>
                    <div className="ae-checkout-sum-line">
                      {thumb ? (
                        <img src={thumb} alt="" className="ae-checkout-sum-line__img" />
                      ) : (
                        <div className="ae-checkout-sum-line__img ae-checkout-sum-line__ph" />
                      )}
                      <div className="ae-checkout-sum-line__meta">
                        <div className="ae-checkout-sum-line__name">{it.product.name}</div>
                        <div className="ae-muted" style={{ fontSize: 12 }}>
                          Qtd. {it.quantity} · envio{" "}
                          {it.productDeliveryOption.tipoEntrega === "PLATAFORMA"
                            ? it.productDeliveryOption.logisticsPartner
                              ? `plataforma · ${it.productDeliveryOption.logisticsPartner.name}`
                              : "plataforma (BAZAR DO BIÉ)"
                            : "loja parceira"}{" "}
                          · {it.productDeliveryOption.prazoEstimado}d
                          {it.variant?.name ? ` · ${it.variant.name}` : ""}
                        </div>
                        <div className="ae-checkout-sum-line__pr">
                          <span>{formatKz(line)}</span>
                          <span className="ae-muted"> + {formatKz(ship)} portes</span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="ae-checkout-sum-tot">
              <div className="ae-checkout-sum-row">
                <span>Subtotal produtos</span>
                <span>{formatKz(subtotal)}</span>
              </div>
              <div className="ae-checkout-sum-row">
                <span>Portes (por linha)</span>
                <span>{formatKz(shipping)}</span>
              </div>
              <div className="ae-checkout-sum-row ae-checkout-sum-row--bold">
                <span>Total</span>
                <span>{formatKz(grand)}</span>
              </div>
            </div>
            <Link to="/cart" className="ae-checkout-back">
              ‹ Voltar ao carrinho
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
