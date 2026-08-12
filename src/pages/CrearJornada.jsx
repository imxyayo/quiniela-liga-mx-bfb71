import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import app from "../services/firebase";
import "./CrearJornada.css";

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
      // Obtener token del usuario autenticado
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No estás autenticado");
      }
      const token = await currentUser.getIdToken(true);

      // Llamar la Cloud Function vía fetch
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
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
      setNumeroJornada(""); // Limpiar input
      setActivarInmediatamente(false);
    } catch (error) {
      console.error("Error creando jornada:", error);

      // Manejo de errores
      if (error.message.includes("No estás autenticado")) {
        setMensaje("No estás autenticado.");
      } else if (error.message.includes("ya existe")) {
        setMensaje(`La jornada ${numeroJornada} ya existe.`);
      } else if (error.message.includes("No hay partidos") || error.message.toLowerCase().includes("no tiene partidos")) {
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
    <div className="crj-card">
      <form onSubmit={handleCrearJornada} className="crj-form">
        <div className="crj-group">
          <label htmlFor="numeroJornada" className="crj-label">
            Número de jornada
          </label>
          <input
            id="numeroJornada"
            type="number"
            min="1"
            max="17"
            value={numeroJornada}
            onChange={(e) => setNumeroJornada(e.target.value)}
            placeholder="Ej. 1"
            disabled={cargando}
            className="crj-input"
          />
        </div>

        <label className="crj-checkbox">
          <input
            type="checkbox"
            checked={activarInmediatamente}
            onChange={(e) => setActivarInmediatamente(e.target.checked)}
            disabled={cargando}
          />
          <span>Publicar inmediatamente</span>
        </label>

        {activarInmediatamente && (
          <p className="crj-aviso">
            Esta jornada quedará disponible de inmediato para los usuarios.
          </p>
        )}

        <button type="submit" disabled={cargando} className="crj-btn-crear">
          {cargando ? "Creando…" : "Crear jornada"}
        </button>
      </form>

      {mensaje && (
        <div className={`crj-mensaje crj-mensaje-${tipoMensaje}`}>
          {mensaje}
        </div>
      )}
    </div>
  );
}