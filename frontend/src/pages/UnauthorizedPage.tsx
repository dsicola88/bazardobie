import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export default function UnauthorizedPage() {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: 520, margin: "48px auto" }} className="ae-panel">
      <h1>Acesso restringido</h1>
      <p>
        Esta área destina-se a perfis autorizados. A sessão actual (
        {user?.role ?? "não autenticado"}) não dispõe de permissão.
      </p>
      <p>
        <Link to="/">Voltar à loja pública</Link>
        {" · "}
        <Link to="/login">Iniciar sessão noutra conta</Link>
      </p>
      {user?.role === "ADMIN" ? (
        <p className="ae-muted">
          Se é administrador e vê esta mensagem, confirme que está na rota <code>/admin/…</code> com sessão válida.
        </p>
      ) : null}
    </div>
  );
}
