// src/pages/Login.jsx
import { useState, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../services/firebase";
import "./Login.css";

export default function Login() {
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirmacionResult, setConfirmacionResult] = useState(null);
  const [paso, setPaso] = useState("telefono"); // "telefono" | "codigo"
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const recaptchaVerifierRef = useRef(null);

  const configurarRecaptcha = () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  };

  const enviarCodigo = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const telefonoFormateado = `+52${telefono.replace(/\D/g, "")}`;
      const appVerifier = configurarRecaptcha();
      const result = await signInWithPhoneNumber(auth, telefonoFormateado, appVerifier);

      setConfirmacionResult(result);
      setPaso("codigo");
    } catch (err) {
      console.error(err);
      setError("No se pudo enviar el código. Verifica el número e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const verificarCodigo = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      await confirmacionResult.confirm(codigo);
    } catch (err) {
      console.error(err);
      setError("Código incorrecto. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="ticket">
        <div className="ticket-top">
          {/* Escudo tipo equipo de fútbol, hecho en SVG */}
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

          <p className="ticket-eyebrow">Boleto oficial</p>
          <h1 className="ticket-title">
            Quinielas <span>Angamacutiro</span>
          </h1>
          <p className="ticket-subtitle">
            {paso === "telefono"
              ? "Ingresa con tu número de celular"
              : "Verifica tu código de acceso"}
          </p>
        </div>

        <div className="ticket-bottom">
          {paso === "telefono" && (
            <form onSubmit={enviarCodigo}>
              <label className="login-label" htmlFor="telefono">
                Número de celular
              </label>
              <input
                id="telefono"
                className="login-input"
                type="tel"
                placeholder="Ej. 4431234567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
              />
              <button className="login-button" type="submit" disabled={cargando}>
                {cargando ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          )}

          {paso === "codigo" && (
            <form onSubmit={verificarCodigo}>
              <label className="login-label" htmlFor="codigo">
                Código de verificación
              </label>
              <input
                id="codigo"
                className="login-input"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
              <button className="login-button" type="submit" disabled={cargando}>
                {cargando ? "Verificando..." : "Verificar código"}
              </button>
            </form>
          )}

          {error && <div className="login-error">{error}</div>}

          <p className="ticket-footer">Acceso exclusivo · Grupo autorizado</p>
        </div>
      </div>

      {/* Este div es obligatorio: aquí Firebase monta el reCAPTCHA invisible */}
      <div id="recaptcha-container"></div>
    </div>
  );
}