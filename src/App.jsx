import { useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import CompletarPerfil from "./pages/CompletarPerfil";
import AdminPanel from "./pages/AdminPanel";
import TablaPartidos from "./pages/TablaPartidos";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import "./App.css";

const ADMIN_UID = "CNTWR8yNC0SIaRtELk8aW9eldvC2";

function ContenidoApp() {
  const { usuario, perfil } = useAuth();
  const [vista, setVista] = useState("partidos"); // "partidos" | "dashboard"

  if (!usuario) {
    return <Login />;
  }

  if (!perfil || !perfil.nombre) {
    return <CompletarPerfil />;
  }

  // Si eres admin, muestra AdminPanel (sin nav por ahora)
  if (usuario.uid === ADMIN_UID) {
    return <AdminPanel />;
  }

  // Usuario normal: nav simple entre partidos y dashboard
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <button
          className={vista === "partidos" ? "app-nav-activo" : ""}
          onClick={() => setVista("partidos")}
        >
          Partidos
        </button>
        <button
          className={vista === "dashboard" ? "app-nav-activo" : ""}
          onClick={() => setVista("dashboard")}
        >
          Mis Resultados
        </button>
        <button
          className={vista === "leaderboard" ? "app-nav-activo" : ""}
          onClick={() => setVista("leaderboard")}
        >
          Tabla de Ganadores
        </button>
      </nav>

      {vista === "partidos" && <TablaPartidos />}
      {vista === "dashboard" && <Dashboard />}
      {vista === "leaderboard" && <Leaderboard />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ContenidoApp />
    </AuthProvider>
  );
}