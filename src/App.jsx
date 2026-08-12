import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import CompletarPerfil from "./pages/CompletarPerfil";
import AdminPanel from "./pages/AdminPanel";
import TablaPartidos from "./pages/TablaPartidos"; // ← NUEVA IMPORTACIÓN

const ADMIN_UID = "CNTWR8yNC0SIaRtELk8aW9eldvC2";

function ContenidoApp() {
  const { usuario, perfil } = useAuth();

  if (!usuario) {
    return <Login />;
  }

  if (!perfil || !perfil.nombre) {
    return <CompletarPerfil />;
  }

  // Si eres admin, muestra AdminPanel
  if (usuario.uid === ADMIN_UID) {
    return <AdminPanel />;
  }

  // Si eres usuario normal, muestra la tabla de partidos
  return <TablaPartidos />;
}

export default function App() {
  return (
    <AuthProvider>
      <ContenidoApp />
    </AuthProvider>
  );
}