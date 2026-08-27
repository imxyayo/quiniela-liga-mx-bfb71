// src/pages/Login.jsx
import { useState, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../services/firebase";

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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--dash-bg)] p-6 font-['Inter',sans-serif]">
      {/* Glow ambiental de fondo */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--dash-gold)]/5 blur-[120px]" />
      </div>

      {/* Boleto */}
      <div className="relative z-10 w-full max-w-[400px] overflow-visible rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-2xl">
        {/* Parte de arriba: marca */}
        <div className="relative border-b-2 border-dashed border-[var(--dash-border)] px-8 pb-6 pt-8 text-center">
          {/* Muescas del boleto */}
          <span className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-[var(--dash-bg)]" />
          <span className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full bg-[var(--dash-bg)]" />

          <img
            src="/logo.png"
            alt="Quinielas Angamacutiro"
            className="mx-auto mb-4 h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(201,169,97,0.25)]"
          />

          <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[3px] text-[var(--dash-gold)]">
            Boleto oficial
          </p>
          <h1 className="text-3xl font-extrabold uppercase leading-tight tracking-wide text-[var(--dash-white)]">
            Quinielas <span className="text-[var(--dash-gold)]">Angamacutiro</span>
          </h1>
          <p className="mt-2.5 text-[13.5px] text-[var(--dash-muted)]">
            {paso === "telefono"
              ? "Ingresa con tu número de celular"
              : "Verifica tu código de acceso"}
          </p>
        </div>

        {/* Parte de abajo: formulario */}
        <div className="px-8 pb-8 pt-7">
          {paso === "telefono" && (
            <form onSubmit={enviarCodigo}>
              <label
                htmlFor="telefono"
                className="mb-2 block text-left font-mono text-xs font-semibold uppercase tracking-wider text-[var(--dash-muted)]"
              >
                Número de celular
              </label>
              <input
                id="telefono"
                type="tel"
                placeholder="Ej. 4431234567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                className="w-full rounded-t border-0 border-b-2 border-[var(--dash-border)] bg-[var(--dash-surface-alt)] px-4 py-3.5 text-base text-[var(--dash-white)] outline-none transition focus:border-[var(--dash-gold)]"
              />
              <button
                type="submit"
                disabled={cargando}
                className="mt-6 w-full rounded bg-[var(--dash-gold)] py-4 font-mono text-sm font-bold uppercase tracking-[1.5px] text-[var(--dash-bg)] shadow-[0_4px_20px_rgba(201,169,97,0.15)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cargando ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          )}

          {paso === "codigo" && (
            <form onSubmit={verificarCodigo}>
              <label
                htmlFor="codigo"
                className="mb-2 block text-left font-mono text-xs font-semibold uppercase tracking-wider text-[var(--dash-muted)]"
              >
                Código de verificación
              </label>
              <input
                id="codigo"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                className="w-full rounded-t border-0 border-b-2 border-[var(--dash-border)] bg-[var(--dash-surface-alt)] px-4 py-3.5 text-base text-[var(--dash-white)] outline-none transition focus:border-[var(--dash-gold)]"
              />
              <button
                type="submit"
                disabled={cargando}
                className="mt-6 w-full rounded bg-[var(--dash-gold)] py-4 font-mono text-sm font-bold uppercase tracking-[1.5px] text-[var(--dash-bg)] shadow-[0_4px_20px_rgba(201,169,97,0.15)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cargando ? "Verificando..." : "Verificar código"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 border-l-2 border-[var(--dash-fallo)] bg-[var(--dash-fallo-soft)] p-3 text-sm text-[var(--dash-fallo)]">
              <span>{error}</span>
            </div>
          )}

          <p className="mt-5 text-center font-mono text-[10.5px] uppercase tracking-[1.5px] text-[var(--dash-muted)]">
            Acceso exclusivo · Grupo autorizado
          </p>
        </div>
      </div>

      {/* Este div es obligatorio: aquí Firebase monta el reCAPTCHA invisible */}
      <div id="recaptcha-container"></div>
    </div>
  );
}