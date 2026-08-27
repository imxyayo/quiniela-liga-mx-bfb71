import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import app from "../services/firebase";

const auth = getAuth(app);

const FUNCTION_URL =
  "https://crearjornadadesdeapi-faiy4zqaaq-uc.a.run.app";

export default function CrearJornada() {
  const [numeroJornada, setNumeroJornada] = useState("");
  const [activarInmediatamente, setActivarInmediatamente] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState(""); // "error" o "exito"

  const handleCrearJornada = async (e) => {
    e.preventDefault();

    if (!numeroJornada || numeroJornada < 1 || numeroJornada > 17) {
      setMensaje("Ingresa un número de jornada entre 1 y 17.");
      setTipoMensaje("error");
      return;
    }

    setCargando(true);
    setMensaje("");

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No estás autenticado");
      }
      const token = await currentUser.getIdToken(true);

      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numeroJornada: parseInt(numeroJornada),
          activarInmediatamente: activarInmediatamente === true,
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || "Error desconocido");
      }

      setMensaje(
        data.mensaje ||
          `Jornada ${numeroJornada} creada con ${data.partidos} partidos.`
      );
      setTipoMensaje("exito");
      setNumeroJornada("");
      setActivarInmediatamente(false);
    } catch (error) {
      console.error("Error creando jornada:", error);

      if (error.message.includes("No estás autenticado")) {
        setMensaje("No estás autenticado.");
      } else if (error.message.includes("ya existe")) {
        setMensaje(`La jornada ${numeroJornada} ya existe.`);
      } else if (
        error.message.includes("No hay partidos") ||
        error.message.toLowerCase().includes("no tiene partidos")
      ) {
        setMensaje(`No hay partidos para la jornada ${numeroJornada}.`);
      } else {
        setMensaje(`Error: ${error.message}`);
      }
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-lg rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/60 p-5 backdrop-blur-md">
      <form onSubmit={handleCrearJornada} className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="numeroJornada"
            className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]"
          >
            Número de jornada
          </label>
          <input
            id="numeroJornada"
            type="number"
            min="1"
            max="17"
            value={numeroJornada}
            onChange={(e) => setNumeroJornada(e.target.value)}
            placeholder="Ej. 7"
            disabled={cargando}
            className="w-full rounded-t border-b-2 border-[var(--dash-border)] bg-[var(--dash-surface-alt)] px-4 py-3 text-center font-mono text-lg text-[var(--dash-gold)] outline-none transition focus:border-[var(--dash-gold)] disabled:opacity-50"
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm text-[var(--dash-white)]">Publicar inmediatamente</span>
          <span className="relative inline-flex h-6 w-11 flex-shrink-0 items-center">
            <input
              type="checkbox"
              checked={activarInmediatamente}
              onChange={(e) => setActivarInmediatamente(e.target.checked)}
              disabled={cargando}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-[var(--dash-surface-alt)] border border-[var(--dash-border)] transition peer-checked:bg-[var(--dash-gold-soft)] peer-checked:border-[var(--dash-gold)]" />
            <span className="relative h-4 w-4 translate-x-1 rounded-full bg-[var(--dash-muted)] transition peer-checked:translate-x-6 peer-checked:bg-[var(--dash-gold)]" />
          </span>
        </label>

        {activarInmediatamente && (
          <p className="-mt-2 rounded border border-[var(--dash-gold)]/30 bg-[var(--dash-gold-soft)] px-3 py-2 text-xs text-[var(--dash-gold)]">
            Esta jornada quedará disponible de inmediato para los usuarios.
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="rounded bg-[var(--dash-gold)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14120c] transition hover:brightness-110 disabled:opacity-50"
        >
          {cargando ? "Creando…" : "Crear jornada"}
        </button>
      </form>

      {mensaje && (
        <div
          className={`mt-4 rounded border-l-4 px-3 py-2 text-sm ${
            tipoMensaje === "exito"
              ? "border-[var(--dash-acierto)] bg-[var(--dash-acierto-soft)] text-[var(--dash-acierto)]"
              : "border-[var(--dash-fallo)] bg-[var(--dash-fallo-soft)] text-[var(--dash-fallo)]"
          }`}
        >
          {mensaje}
        </div>
      )}
    </div>
  );
}