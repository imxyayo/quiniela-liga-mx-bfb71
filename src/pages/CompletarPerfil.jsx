// src/pages/CompletarPerfil.jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { actualizarNombre } from "../services/usuarios";
import "./Login.css"; // Reusamos el mismo estilo de boleto

export default function CompletarPerfil() {
  const { usuario, perfil, setPerfil } = useAuth();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const guardarNombre = async (e) => {
    e.preventDefault();
    setError("");

    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 3) {
      setError("Escribe tu nombre completo, por favor.");
      return;
    }

    setCargando(true);
    try {
      await actualizarNombre(usuario.uid, nombreLimpio);
      // Actualiza el perfil en memoria para que la app avance a la siguiente pantalla
      setPerfil({ ...perfil, nombre: nombreLimpio });
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar tu nombre. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="ticket">
        <div className="ticket-top">
          <svg className="crest" viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M32 2 L60 12 V34 C60 52 48 64 32 70 C16 64 4 52 4 34 V12 Z"
              fill="#14251b"
              stroke="#d4af37"
              strokeWidth="2"
            />
            <path
              d="M32 8 L54 16 V34 C54 48 44 58 32 63 C20 58 10 48 10 34 V16 Z"
              fill="#1a7a4c"
            />
            <text
              x="32"
              y="42"
              textAnchor="middle"
              fontFamily="Oswald, sans-serif"
              fontWeight="700"
              fontSize="24"
              fill="#f7f4ea"
            >
              QA
            </text>
          </svg>

          <p className="ticket-eyebrow">Último paso</p>
          <h1 className="ticket-title">
            Completa tu <span>perfil</span>
          </h1>
          <p className="ticket-subtitle">
            Así te vamos a reconocer en el leaderboard
          </p>
        </div>

        <div className="ticket-bottom">
          <form onSubmit={guardarNombre}>
            <label className="login-label" htmlFor="nombre">
              Nombre completo
            </label>
            <input
              id="nombre"
              className="login-input"
              type="text"
              placeholder="Ej. Juan López"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
            />
            <button className="login-button" type="submit" disabled={cargando}>
              {cargando ? "Guardando..." : "Guardar y continuar"}
            </button>
          </form>

          {error && <div className="login-error">{error}</div>}

          <p className="ticket-footer">Acceso exclusivo · Grupo autorizado</p>
        </div>
      </div>
    </div>
  );
}