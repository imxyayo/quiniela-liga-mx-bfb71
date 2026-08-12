import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import app from "../services/firebase";

import "./CrearJornada.css";

const auth = getAuth(app);

export default function CrearJornada() {
  const [numeroJornada, setNumeroJornada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState(""); // "error" o "exito"

  const handleCrearJornada = async (e) => {
    e.preventDefault();

    if (!numeroJornada || numeroJornada < 1 || numeroJornada > 17) {
      setMensaje("❌ Ingresa un número de jornada entre 1 y 17");
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

      const token = await currentUser.getIdToken();

      // Llamar la Cloud Function vía fetch
      const response = await fetch(
        "https://us-central1-quiniela-liga-mx-90c95.cloudfunctions.net/crearJornadaDesdeAPI",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            numeroJornada: parseInt(numeroJornada),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error desconocido");
      }

      setMensaje(
        `✅ Jornada ${numeroJornada} creada exitosamente con ${data.partidos} partidos`
      );
      setTipoMensaje("exito");
      setNumeroJornada(""); // Limpiar input
    } catch (error) {
      console.error("Error creando jornada:", error);

      // Manejo de errores
      if (error.message.includes("No estás autenticado")) {
        setMensaje("❌ No estás autenticado");
      } else if (error.message.includes("ya existe")) {
        setMensaje(`❌ La jornada ${numeroJornada} ya existe`);
      } else if (error.message.includes("No hay partidos")) {
        setMensaje(`❌ No hay partidos para la jornada ${numeroJornada}`);
      } else {
        setMensaje(`❌ Error: ${error.message}`);
      }
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="crear-jornada">
      <form onSubmit={handleCrearJornada}>
        <div className="form-group">
          <label htmlFor="numeroJornada">Número de Jornada:</label>
          <input
            id="numeroJornada"
            type="number"
            min="1"
            max="17"
            value={numeroJornada}
            onChange={(e) => setNumeroJornada(e.target.value)}
            placeholder="Ej: 1"
            disabled={cargando}
          />
        </div>

        <button type="submit" disabled={cargando} className="btn-crear">
          {cargando ? "⏳ Creando..." : "📝 Crear Jornada"}
        </button>
      </form>

      {mensaje && (
        <div className={`mensaje ${tipoMensaje}`}>
          {mensaje}
        </div>
      )}
    </div>
  );
}