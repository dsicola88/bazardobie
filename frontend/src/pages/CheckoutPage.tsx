import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, apiErrorDetailsCode, cartSessionHeaders, uploadAdminFile } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { useSiteContent } from "../site/SiteContentContext.js";
import { useToast } from "../ui/ToastProvider.js";
import { formatKz, formatFreteKz, formatBusinessDaysPt } from "../utils/format.js";
import { resolveMediaUrl } from "../utils/media.js";
import { productConditionLabel } from "../utils/productCondition.js";
import { variantEffectiveUnitKz } from "../utils/variantPrice.js";
import { variantDisplayBuyerLine } from "../utils/variantDisplay.js";

type CheckoutCartItem = {
  id: string;
  quantity: number;
  variant?: {
    id?: string;
    sku?: string | null;
    name?: string | null;
    color?: string | null;
    size?: string | null;
    salePrice?: string | null;
    priceAdjust?: string | null;
    imageUrl?: string | null;
    properties?: { label: string; value: string }[];
    variantStructuredValues?: {
      value: string;
      attribute: {
        label: string;
        sortOrder?: number;
        primaryRank?: number;
        inputType?: string;
        unitCode?: string | null;
      };
    }[];
  } | null;
  product: {
    id: string;
    name: string;
    condition?: string | null;
    price: string;
    promoPrice?: string | null;
    displayPrice: string;
    images?: { url: string }[];
  };
  productDeliveryOption: {
    tipoEntrega: string;
    custoEntrega: string;
    prazoEstimado: number;
    logisticsPartner?: { id: string; name: string } | null;
  };
};

type FreightLocalityDto = {
  id: string;
  label: string;
  province: string;
  city: string;
  municipalityId?: string | null;
};

type GeoProvinceDto = { id: string; code: string; namePt: string; sortOrder: number };
type GeoMunicipalityDto = {
  id: string;
  code: string;
  namePt: string;
  provinceId: string;
  sortOrder: number;
};
type PickupDto = { id: string; namePt: string; refCode?: string | null };
type MeProfileDto = {
  phone?: string | null;
  municipalityId?: string | null;
  neighborhood?: string | null;
  addressLine?: string | null;
  municipality?: { id: string; namePt: string; province: { id: string; namePt: string } } | null;
};

type FreightMode = "ZONE" | "DISTANCE" | "NONE";

type FreightMetaResponse = {
  freightMode?: string;
};

function coerceFreightMode(raw: unknown): FreightMode {
  if (raw === "ZONE") return "ZONE";
  if (raw === "DISTANCE") return "DISTANCE";
  return "NONE";
}

function unitPriceKz(it: CheckoutCartItem): number {
  return variantEffectiveUnitKz(it.product, it.variant ?? null);
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

const SHOW_ONLINE_PAYMENT =
  import.meta.env.VITE_SHOW_ONLINE_PAYMENT === "true" || Boolean(import.meta.env.DEV);

function paymentMethodOptions(): { key: PayMethod; title: string; sub: string }[] {
  const base: { key: PayMethod; title: string; sub: string }[] = [
    { key: "COD", title: "Pagamento à entrega", sub: "Liquidar em kwanzas na entrega." },
    { key: "TRANSFERENCIA", title: "Transferência bancária", sub: "Comprovativo: carregar ficheiro ou link." },
  ];
  if (!SHOW_ONLINE_PAYMENT) return base;
  const onlineSub = import.meta.env.DEV
    ? "Fluxo de demonstração ligado à API — não movimenta valores reais."
    : "Disponível apenas em piloto autorizado enquanto o gateway de produção é finalizado.";
  return [...base, { key: "PAGAMENTO_ONLINE", title: "Pagamento online", sub: onlineSub }];
}

export default function CheckoutPage() {
  const { token, user, refreshMe } = useAuth();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const toast = useToast();
  const [cart, setCart] = useState<{ items: CheckoutCartItem[] } | null>(null);
  const [cartErr, setCartErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  /** null = cliente ainda a carregar; object = estado conhecido (pode faltar telefone ou município). */
  const [meLoad, setMeLoad] = useState<MeProfileDto | null>(null);
  const [profilePhoneDraft, setProfilePhoneDraft] = useState("");
  const [profileSavingPhone, setProfileSavingPhone] = useState(false);
  const [profileSavingAddress, setProfileSavingAddress] = useState(false);

  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [geoProvinces, setGeoProvinces] = useState<GeoProvinceDto[]>([]);
  const [geoProvinceId, setGeoProvinceId] = useState("");
  const [geoMunicipalities, setGeoMunicipalities] = useState<GeoMunicipalityDto[]>([]);
  const [geoMunicipalityId, setGeoMunicipalityId] = useState("");
  const [pickupPoints, setPickupPoints] = useState<PickupDto[]>([]);
  const [shippingPickupPointId, setShippingPickupPointId] = useState("");
  const [shippingNeighborhood, setShippingNeighborhood] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("COD");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const paymentProofFileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const [freightMode, setFreightMode] = useState<FreightMode>("NONE");
  const [freightLocals, setFreightLocals] = useState<FreightLocalityDto[]>([]);
  const [freightLocalityId, setFreightLocalityId] = useState("");

  const [zoneFreightMatched, setZoneFreightMatched] = useState(false);
  const [zoneFreightPrice, setZoneFreightPrice] = useState<number | null>(null);
  const [zoneFreightHint, setZoneFreightHint] = useState<string | null>(null);
  const [zoneFreightLoading, setZoneFreightLoading] = useState(false);

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
      setFreightMode("NONE");
      setFreightLocals([]);
      setFreightLocalityId("");
      setGeoProvinces([]);
      setGeoProvinceId("");
      setGeoMunicipalities([]);
      setGeoMunicipalityId("");
      return;
    }
    void apiFetch<FreightMetaResponse>("/freight/meta")
      .then((m) => setFreightMode(coerceFreightMode(m.freightMode)))
      .catch(() => setFreightMode("NONE"));
  }, [token, user]);

  useEffect(() => {
    if (!token || user?.role !== "CLIENTE") return;
    void apiFetch<{ items: GeoProvinceDto[] }>("/shipping/geo/provinces")
      .then((r) => setGeoProvinces(r.items ?? []))
      .catch(() => setGeoProvinces([]));
  }, [token, user]);

  useEffect(() => {
    if (!geoProvinceId) {
      setGeoMunicipalities([]);
      return;
    }
    void apiFetch<{ items: GeoMunicipalityDto[] }>(
      `/shipping/geo/municipalities?provinceId=${encodeURIComponent(geoProvinceId)}`
    )
      .then((r) => setGeoMunicipalities(r.items ?? []))
      .catch(() => setGeoMunicipalities([]));
  }, [geoProvinceId]);

  useEffect(() => {
    if (!geoMunicipalityId) {
      setPickupPoints([]);
      setShippingPickupPointId("");
      return;
    }
    void apiFetch<{ items: PickupDto[] }>(
      `/shipping/geo/pickup-points?municipalityId=${encodeURIComponent(geoMunicipalityId)}`
    )
      .then((r) => setPickupPoints(r.items ?? []))
      .catch(() => setPickupPoints([]));
  }, [geoMunicipalityId]);

  useEffect(() => {
    if (freightMode !== "DISTANCE") {
      setFreightLocals([]);
      setFreightLocalityId("");
      return;
    }
    if (!geoMunicipalityId) {
      setFreightLocals([]);
      setFreightLocalityId("");
      return;
    }
    void apiFetch<{ items: FreightLocalityDto[] }>(
      `/freight/localities?municipalityId=${encodeURIComponent(geoMunicipalityId)}`
    )
      .then((r) => setFreightLocals(r.items ?? []))
      .catch(() => setFreightLocals([]));
  }, [freightMode, geoMunicipalityId]);

  useEffect(() => {
    if (freightMode !== "ZONE") {
      setZoneFreightMatched(false);
      setZoneFreightPrice(null);
      setZoneFreightHint(null);
      setZoneFreightLoading(false);
      return;
    }
    if (!geoMunicipalityId.trim()) {
      setZoneFreightMatched(false);
      setZoneFreightPrice(null);
      setZoneFreightHint(null);
      setZoneFreightLoading(false);
      return;
    }
    setZoneFreightLoading(true);
    const tm = window.setTimeout(() => {
      void apiFetch<{
        active: boolean;
        matched?: boolean;
        price?: number;
        label?: string | null;
        message?: string;
      }>("/freight/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipalityId: geoMunicipalityId.trim() }),
      })
        .then((res) => {
          setZoneFreightLoading(false);
          if (!res.active) {
            setZoneFreightMatched(false);
            setZoneFreightPrice(null);
            setZoneFreightHint("Modo zona não disponível neste momento.");
            return;
          }
          if (res.matched === true && typeof res.price === "number") {
            setZoneFreightMatched(true);
            setZoneFreightPrice(res.price);
            setZoneFreightHint(null);
          } else {
            setZoneFreightMatched(false);
            setZoneFreightPrice(null);
            setZoneFreightHint(res.message ?? "Sem tarifa cadastrada para este município.");
          }
        })
        .catch(() => {
          setZoneFreightLoading(false);
          setZoneFreightMatched(false);
          setZoneFreightPrice(null);
          setZoneFreightHint("Não foi possível calcular o frete. Tente de novo.");
        });
    }, 420);
    return () => window.clearTimeout(tm);
  }, [freightMode, geoMunicipalityId]);

  useEffect(() => {
    if (!token || user?.role !== "CLIENTE") {
      setMeLoad(null);
      return;
    }
    void apiFetch<MeProfileDto>("/auth/me", { token })
      .then((m) => {
        const tel = m.phone ?? null;
        setMeLoad(m);
        const p = tel?.trim();
        if (p && p.length >= 6) setShippingPhone((s) => (s.trim() ? s : p));
        setProfilePhoneDraft((prev) => (prev.trim() ? prev : p ?? ""));
        if (m.municipality?.province?.id) setGeoProvinceId((prev) => prev || m.municipality!.province.id);
        if (m.municipality?.id) setGeoMunicipalityId((prev) => prev || m.municipality!.id);
        if (m.neighborhood?.trim()) setShippingNeighborhood((prev) => prev || m.neighborhood!.trim());
        if (m.addressLine?.trim()) setShippingAddress((prev) => prev || m.addressLine!.trim());
      })
      .catch(() => setMeLoad({ phone: null, municipalityId: null }));
  }, [token, user]);

  const { subtotal, shipping, grand } = useMemo(
    () => totals(cart?.items ?? []),
    [cart?.items]
  );

  const effectiveShipping =
    freightMode === "ZONE" && zoneFreightMatched && zoneFreightPrice != null ? zoneFreightPrice : shipping;
  const effectiveGrand = subtotal + effectiveShipping;

  const selectedDestinationLabel = useMemo(() => {
    const m = geoMunicipalities.find((x) => x.id === geoMunicipalityId);
    const p = geoProvinces.find((x) => x.id === geoProvinceId);
    if (!m || !p) return "";
    return `${m.namePt}, ${p.namePt}`;
  }, [geoMunicipalities, geoMunicipalityId, geoProvinces, geoProvinceId]);

  const awaitingMe = Boolean(token && user?.role === "CLIENTE" && meLoad === null);
  const profilePhoneIncomplete = Boolean(
    token &&
      user?.role === "CLIENTE" &&
      meLoad !== null &&
      (!meLoad.phone?.trim() || meLoad.phone.trim().length < 6)
  );
  const profileMunicipalityMissing = Boolean(
    token && user?.role === "CLIENTE" && meLoad !== null && !meLoad.municipalityId?.trim()
  );

  /** Frete dinâmico: município catalogado + zona ou âncora GPS alinhada ao mesmo município. */
  const checkoutBlockedFreight =
    freightMode === "ZONE" &&
    Boolean(
      !geoMunicipalityId.trim() ||
        zoneFreightLoading ||
        !zoneFreightMatched ||
        zoneFreightPrice == null
    );
  const checkoutBlockedFreightDist =
    freightMode === "DISTANCE" &&
    Boolean(!geoMunicipalityId.trim() || !freightLocalityId.trim());

  const checkoutBlocked =
    awaitingMe ||
    profilePhoneIncomplete ||
    profileMunicipalityMissing ||
    checkoutBlockedFreight ||
    checkoutBlockedFreightDist;

  async function saveAccountPhone() {
    if (!token) return;
    const p = profilePhoneDraft.trim();
    if (p.length < 6) {
      setMsg("O telefone na conta deve ter pelo menos 6 caracteres.");
      return;
    }
    setProfileSavingPhone(true);
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
      toast("Telefone guardado no perfil.", "ok");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível guardar o telefone.");
    } finally {
      setProfileSavingPhone(false);
    }
  }

  async function savePrimaryAddress() {
    if (!token) return;
    if (!geoMunicipalityId.trim()) {
      setMsg("Selecione o município principal para gravar no perfil.");
      return;
    }
    setProfileSavingAddress(true);
    setMsg(null);
    try {
      const updated = await apiFetch<MeProfileDto>("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          municipalityId: geoMunicipalityId.trim(),
          neighborhood: shippingNeighborhood.trim() || "",
          addressLine: shippingAddress.trim() || "",
        }),
      });
      setMeLoad(updated);
      await refreshMe();
      toast("Morada principal actualizada no perfil.", "ok");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Não foi possível guardar a morada principal.");
    } finally {
      setProfileSavingAddress(false);
    }
  }

  if (!token || user?.role !== "CLIENTE") {
    return (
      <div className="ae-checkout ae-checkout--gate">
        <div className="ae-checkout__breadcrumb">
          <Link to="/">Início</Link>
          <span className="ae-checkout__sep">›</span>
          <Link to="/cart">Carrinho</Link>
          <span className="ae-checkout__sep">›</span>
          <span className="ae-on">Fecho da compra</span>
        </div>
        <h1 className="ae-checkout__title">Fecho da compra</h1>
        <div className="page-panel ae-empty-center" style={{ maxWidth: 480, margin: "0 auto" }}>
          <p style={{ marginTop: 0 }}>
            O fecho online está reservado a contas de <strong>comprador</strong>.
          </p>
          <p className="ae-muted" style={{ fontSize: 14 }}>
            Inicie sessão com a mesma conta onde guardou o carrinho ou crie um registo gratuito.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 18 }}>
            <Link className="btn btn-primary" to="/login?next=/checkout">
              Iniciar sessão
            </Link>
            <Link className="btn" to="/login?register=1&next=/checkout">
              Criar conta
            </Link>
          </div>
          <p className="ae-muted" style={{ fontSize: 13, marginTop: 22 }}>
            <Link to="/cart">← Voltar ao carrinho</Link>
            {" · "}
            <Link to="/search">Continuar a comprar</Link>
          </p>
        </div>
      </div>
    );
  }

  if (cartErr && !cart) {
    return (
      <div className="ae-checkout">
        <h1 className="ae-checkout__title">Fecho da compra</h1>
        <div className="page-panel ae-admin-alert ae-admin-alert--err" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
          {cartErr}
        </div>
        <p style={{ textAlign: "center", marginTop: 16 }}>
          <Link to="/cart">Voltar ao carrinho</Link>
          {" · "}
          <button type="button" className="ae-linkbtn" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
          {" · "}
          <Link to="/search">Explorar catálogo</Link>
        </p>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="ae-checkout">
        <h1 className="ae-checkout__title">Fecho da compra</h1>
        <p className="ae-muted" style={{ margin: "16px 0" }} aria-busy="true">
          A carregar o carrinho…
        </p>
        <p className="ae-muted" style={{ fontSize: 13 }}>
          Se demorar, verifique a ligação ou{" "}
          <button type="button" className="ae-linkbtn" onClick={() => window.location.reload()}>
            actualize a página
          </button>
          .
        </p>
      </div>
    );
  }

  if (cart.items.length === 0 && !done) {
    return (
      <div className="ae-checkout">
        <h1 className="ae-checkout__title">Fecho da compra</h1>
        <div className="page-panel ae-empty-center" style={{ maxWidth: 480, margin: "0 auto" }}>
          <p className="ae-muted" style={{ marginTop: 0 }}>
            O carrinho está vazio. Adicione artigos antes de concluir a compra.
          </p>
          <Link to="/search" className="btn btn-primary" style={{ marginTop: 12 }}>
            Explorar catálogo
          </Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!geoMunicipalityId.trim()) {
      setMsg("Seleccione província e município no catálogo (entrega estruturada).");
      return;
    }
    if (freightMode === "DISTANCE" && !freightLocalityId.trim()) {
      setMsg("Escolha a zona GPS de destino dentro do município para calcular o frete por distância.");
      return;
    }
    if (freightMode === "ZONE" && (!zoneFreightMatched || zoneFreightPrice == null)) {
      setMsg(
        zoneFreightHint ??
          "Este município ainda não tem tarifa de portes no marketplace — experimente outra localidade ou contacte o suporte."
      );
      return;
    }
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
          shippingMunicipalityId: geoMunicipalityId.trim(),
          ...(shippingPickupPointId.trim() ? { shippingPickupPointId: shippingPickupPointId.trim() } : {}),
          shippingNeighborhood: shippingNeighborhood.trim() || undefined,
          ...(shippingAddress.trim() ? { shippingAddress: shippingAddress.trim() } : {}),
          notes,
          ...(freightMode === "DISTANCE" && freightLocalityId.trim()
            ? { freightLocalityId: freightLocalityId.trim() }
            : {}),
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
      const code = apiErrorDetailsCode(err);
      if (code === "FREIGHT_ZONE_NOT_FOUND") {
        setMsg(
          "A transportadora/plataforma ainda não entrega nesta localidade. Escolha um município coberto ou atualize o endereço para uma zona atendida."
        );
        return;
      }
      if (code === "PROFILE_MUNICIPALITY_MISMATCH") {
        setMsg(
          "O município escolhido no checkout não corresponde ao município principal do seu perfil. Atualize o endereço principal para calcular o frete correto."
        );
        return;
      }
      if (code === "PROFILE_MUNICIPALITY_REQUIRED") {
        setMsg(
          "Defina primeiro o município principal no seu perfil. Isso evita cobrança de frete incorreta para outra localidade."
        );
        return;
      }
      if (code === "FREIGHT_LOCALITY_INVALID" || code === "FREIGHT_ADDRESS_MISMATCH_MUNICIPALITY") {
        setMsg(
          "A zona de frete selecionada não pertence ao município de entrega. Selecione a zona correta da sua localidade."
        );
        return;
      }
      if (apiErrorDetailsCode(err) === "PHONE_REQUIRED" && token) {
        void apiFetch<MeProfileDto>("/auth/me", { token }).then((m) => {
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
      toast("Comprovativo carregado. Confirme o endereço ou edite se necessário.", "info");
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
        <Link to="/">Início</Link>
        <span className="ae-checkout__sep">›</span>
        <Link to="/cart">Carrinho</Link>
        <span className="ae-checkout__sep">›</span>
        <span className="ae-on">Fecho da compra</span>
      </div>
      <h1 className="ae-checkout__title">Fecho da compra</h1>

      <nav className="ae-checkout-progress" aria-label="Progresso do fecho da compra">
        <ol>
          <li className="ae-checkout-progress__done">
            <Link to="/cart">1 · Carrinho</Link>
          </li>
          <li className="ae-checkout-progress__current" aria-current="step">
            2 · Dados e pagamento
          </li>
          <li className="ae-checkout-progress__next">3 · Confirmação</li>
        </ol>
      </nav>

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
                  disabled={profileSavingPhone}
                  onClick={() => void saveAccountPhone()}
                >
                  {profileSavingPhone ? "A guardar…" : "Guardar"}
                </button>
              </div>
            </section>
          ) : null}
          {profileMunicipalityMissing ? (
            <section className="page-panel ae-checkout-msg" style={{ marginBottom: 16 }}>
              <strong style={{ display: "block", marginBottom: 10 }}>Município principal do perfil — obrigatório</strong>
              <p className="ae-muted" style={{ marginTop: 0, fontSize: 13 }}>
                Para evitar frete errado, a compra só conclui quando o município principal do perfil está definido.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={profileSavingAddress || !geoMunicipalityId.trim()}
                onClick={() => void savePrimaryAddress()}
              >
                {profileSavingAddress ? "A guardar morada…" : "Guardar município principal"}
              </button>
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
              <label htmlFor="checkout-geo-prov">Província (catálogo oficial)</label>
              <select
                id="checkout-geo-prov"
                required
                value={geoProvinceId}
                onChange={(e) => {
                  const v = e.target.value;
                  setGeoProvinceId(v);
                  setGeoMunicipalityId("");
                  setShippingPickupPointId("");
                  setFreightLocalityId("");
                }}
              >
                <option value="">— seleccione —</option>
                {geoProvinces.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.namePt}
                  </option>
                ))}
              </select>
              <label htmlFor="checkout-geo-mun">Município / comuna</label>
              <select
                id="checkout-geo-mun"
                required
                disabled={!geoProvinceId}
                value={geoMunicipalityId}
                onChange={(e) => {
                  setGeoMunicipalityId(e.target.value);
                  setShippingPickupPointId("");
                  setFreightLocalityId("");
                }}
              >
                <option value="">{geoProvinceId ? "— seleccione —" : "— escolha primeiro a província —"}</option>
                {geoMunicipalities.map((mu) => (
                  <option key={mu.id} value={mu.id}>
                    {mu.namePt}
                  </option>
                ))}
              </select>
              <p className="ae-muted" style={{ fontSize: 12, margin: 0 }}>
                O valor do frete e a operação usam sempre estes identificadores estruturados — sem depender de texto livre
                de morada.
              </p>
              {meLoad?.municipalityId ? (
                <p className="ae-muted" style={{ fontSize: 12, margin: 0 }}>
                  Município principal no perfil: <strong>{meLoad.municipality?.namePt ?? meLoad.city ?? "definido"}</strong>.
                  A entrega deve usar este município para evitar divergência de frete.
                </p>
              ) : null}
              {pickupPoints.length > 0 ? (
                <div className="form-stack" style={{ marginTop: 6 }}>
                  <label htmlFor="checkout-pickup">Ponto fixo de entrega / recolha (opcional)</label>
                  <select
                    id="checkout-pickup"
                    value={shippingPickupPointId}
                    onChange={(e) => setShippingPickupPointId(e.target.value)}
                  >
                    <option value="">— entrega ao domicílio / morada indicada abaixo —</option>
                    {pickupPoints.map((pp) => (
                      <option key={pp.id} value={pp.id}>
                        {pp.namePt}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {freightMode === "DISTANCE" ? (
                <div className="form-stack" style={{ marginTop: 10 }}>
                  <label htmlFor="checkout-freight-locality">Zona GPS · frete por distância</label>
                  <select
                    id="checkout-freight-locality"
                    required
                    disabled={!geoMunicipalityId}
                    value={freightLocalityId}
                    onChange={(e) => setFreightLocalityId(e.target.value)}
                  >
                    <option value="">
                      {geoMunicipalityId
                        ? freightLocals.length === 0
                          ? "— sem âncora GPS para este município (admin) —"
                          : "— escolha a zona —"
                        : "— seleccione primeiro o município —"}
                    </option>
                    {freightLocals.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.label} — {loc.province}, {loc.city}
                      </option>
                    ))}
                  </select>
                  <p className="ae-muted" style={{ fontSize: 12, margin: 0 }}>
                    Os quilómetros até este ponto catalogado determinam a faixa de portes. O município de entrega deve
                    coincidir com a âncora seleccionada.
                  </p>
                </div>
              ) : null}
              {freightMode === "ZONE" ? (
                <div className="page-panel" style={{ marginTop: 10, padding: "12px 14px", fontSize: 14 }}>
                  {zoneFreightLoading ? (
                    <p className="ae-muted" style={{ margin: 0 }}>
                      A consultar tarifa para o município…
                    </p>
                  ) : zoneFreightMatched && zoneFreightPrice != null ? (
                    <p style={{ margin: 0 }}>
                      <strong>Entrega:</strong> {formatKz(zoneFreightPrice)}
                      <span className="ae-muted" style={{ display: "block", fontSize: 12, marginTop: 6 }}>
                        Tabela da plataforma para{" "}
                        <strong>{selectedDestinationLabel || "município seleccionado"}</strong>.
                      </span>
                    </p>
                  ) : (
                    <p className="ae-muted" style={{ margin: 0 }}>
                      {zoneFreightHint ??
                        (!geoMunicipalityId
                          ? "Escolha o município para aparecer o valor dos portes."
                          : "Este município ainda não tem tarifa configurada no marketplace.")}
                    </p>
                  )}
                </div>
              ) : null}
              <label htmlFor="checkout-bairro">Bairro / distrito (opcional)</label>
              <input
                id="checkout-bairro"
                maxLength={160}
                value={shippingNeighborhood}
                onChange={(e) => setShippingNeighborhood(e.target.value)}
                placeholder="Ex.: Benfica · complemento humano; o cálculo territorial vem do catálogo."
              />
              <label htmlFor="checkout-instructions">Instruções de entrega (opcional)</label>
              <textarea
                id="checkout-instructions"
                rows={3}
                maxLength={600}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Andar, porta, ponto de referência, contacto à chegada — não substitui província/município."
              />
              <label>Observações (opcional)</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn"
                  disabled={profileSavingAddress || !geoMunicipalityId.trim()}
                  onClick={() => void savePrimaryAddress()}
                >
                  {profileSavingAddress ? "A guardar morada…" : "Atualizar morada principal no perfil"}
                </button>
              </div>
            </div>
          </section>

          <section className="ae-checkout-panel">
            <div className="ae-checkout-step">
              <span className="ae-checkout-step__n">2</span>
              <h2>Pagamento</h2>
            </div>
            <div className="ae-pay-options">
              {paymentMethodOptions().map((opt) => (
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
              <div
                className="page-panel"
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderLeft: "4px solid var(--ae-warn)",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                <p className="ae-muted" style={{ margin: "0 0 8px" }}>
                  Após confirmar a compra será gerada uma sessão de pagamento na área «As minhas encomendas».
                </p>
                <p style={{ margin: 0 }}>
                  {import.meta.env.DEV ? (
                    <>
                      <strong>Ambiente local:</strong> a API usa o fornecedor MOCK — não há cobrança real.
                    </>
                  ) : (
                    <>
                      <strong>Piloto:</strong> confirme com o suporte se deve usar este meio; o gateway público será
                      anunciado quando estiver disponível.
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </section>

          {msg ? (
            <div className="ae-checkout-msg ae-checkout-msg--alert" role="alert">
              {msg}
            </div>
          ) : null}

          <div className="ae-checkout-submit">
            <button
              type="submit"
              disabled={loading || checkoutBlocked}
              className="btn btn-primary ae-checkout-submit-btn"
            >
              {loading
                ? "A processar…"
                : freightMode === "ZONE"
                  ? zoneFreightMatched && zoneFreightPrice != null
                    ? `Confirmar compra · ${formatKz(effectiveGrand)}`
                    : "Confirmar compra · município com tarifa"
                  : freightMode === "DISTANCE"
                    ? `Confirmar · ${formatKz(subtotal)} + portes por distância`
                    : `Confirmar compra · ${formatKz(grand)}`}
            </button>
            {checkoutBlocked && profilePhoneIncomplete ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                Guarde telefone acima.
              </p>
            ) : checkoutBlockedFreightDist ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                Escolha município no catálogo e depois a zona GPS com frete válido para esse município.
              </p>
            ) : checkoutBlockedFreight ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                Escolha um município com tarifa publicada ou confira no suporte quando a cobertura estiver disponível.
              </p>
            ) : profileMunicipalityMissing ? (
              <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                Guarde o município principal do perfil para validar o frete da sua localidade.
              </p>
            ) : null}
            <p className="ae-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              Uma encomenda por loja parceira · totais em kwanzas
              {freightMode === "ZONE"
                ? " · o porte fixa‑se ao município oficialmente coberto (cadastro admin)."
                : freightMode === "DISTANCE"
                  ? " · faixas de quilómetros até ao ponto seleccionado."
                  : "."}
            </p>
          </div>
        </form>

        <aside className="ae-checkout__aside" aria-label="Resumo da encomenda">
          <div className="ae-checkout-summary page-panel">
            <h3 className="ae-checkout-summary__h">Resumo da encomenda</h3>
            <ul className="ae-checkout-summary__lines">
              {cart.items.map((it) => {
                const thumb = it.variant?.imageUrl || it.product.images?.[0]?.url || "";
                const ship = Number(it.productDeliveryOption.custoEntrega);
                const line = unitPriceKz(it) * it.quantity;
                return (
                  <li key={it.id}>
                    <div className="ae-checkout-sum-line">
                      {thumb ? (
                        <img
                          src={resolveMediaUrl(thumb)}
                          alt=""
                          className="ae-checkout-sum-line__img"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="ae-checkout-sum-line__img ae-checkout-sum-line__ph" />
                      )}
                      <div className="ae-checkout-sum-line__meta">
                        <div className="ae-checkout-sum-line__name">{it.product.name}</div>
                        <div className="ae-muted" style={{ fontSize: 12 }}>
                          {productConditionLabel(it.product.condition)} ·{" "}
                          Qtd. {it.quantity} · envio{" "}
                          {it.productDeliveryOption.tipoEntrega === "PLATAFORMA"
                            ? it.productDeliveryOption.logisticsPartner
                              ? `plataforma · ${it.productDeliveryOption.logisticsPartner.name}`
                              : "plataforma (BAZAR DO BIÉ)"
                            : "loja parceira"}{" "}
                          · {formatBusinessDaysPt(it.productDeliveryOption.prazoEstimado)}
                          {it.variant
                            ? ` · ${variantDisplayBuyerLine(it.variant, it.product.name)}`
                            : ""}
                        </div>
                        <div className="ae-checkout-sum-line__pr">
                          <span>{formatKz(line)}</span>
                          {freightMode === "ZONE" || freightMode === "DISTANCE" ? (
                            <span className="ae-muted"> · portes no total do pedido</span>
                          ) : ship > 0 ? (
                            <span className="ae-muted"> + {formatKz(ship)} portes</span>
                          ) : (
                            <span className="ae-muted"> · portes grátis</span>
                          )}
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
                <span>Portes</span>
                <span>
                  {freightMode === "ZONE" ? (
                    zoneFreightLoading ? (
                      <span className="ae-muted">A calcular…</span>
                    ) : zoneFreightMatched && zoneFreightPrice != null ? (
                      formatKz(zoneFreightPrice)
                    ) : (
                      <span className="ae-muted">—</span>
                    )
                  ) : freightMode === "DISTANCE" ? (
                    <span className="ae-muted">Conforme km</span>
                  ) : (
                    formatFreteKz(shipping)
                  )}
                </span>
              </div>
              <div className="ae-checkout-sum-row ae-checkout-sum-row--bold">
                <span>Total</span>
                <span>
                  {freightMode === "ZONE" && !zoneFreightMatched ? (
                    <span className="ae-muted">{formatKz(subtotal)} + portes</span>
                  ) : (
                    formatKz(effectiveGrand)
                  )}
                </span>
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
