import React from "react";
import { useAuth } from "../hooks/useAuth";
import CrearJornada from "./CrearJornada";
import "./AdminPanel.css";

// UID del admin (Panfilo P)
const ADMIN_UID = "CNTWR8yNC0SIaRtELk8aW9eldvC2";

export default function AdminPanel() {
  const { usuario } = useAuth();

  // Protección: si no eres admin, no ves nada
  if (!usuario || usuario.uid !== ADMIN_UID) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <h2>❌ Acceso denegado</h2>
        <p>No tienes permisos de administrador.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>⚙️ Panel de Administración</h1>
        <p>Quinielas Angamacutiro</p>
      </div>

      <div className="admin-content">
        <section className="admin-section">
          <h2>Crear Nueva Jornada</h2>
          <CrearJornada />
        </section>

        {/* Aquí van otros paneles admin después (gestionar jornadas, ver predicciones, etc.) */}
      </div>
    </div>
  );
}