import React from "react";
import { useAuth } from "../hooks/useAuth";
import CrearJornada from "./CrearJornada";
import CerrarJornada from "./CerrarJornada";
import "./AdminPanel.css";

// UID del admin (Panfilo P)
const ADMIN_UID = "CNTWR8yNC0SIaRtELk8aW9eldvC2";

export default function AdminPanel() {
  const { usuario } = useAuth();

  // Protección: si no eres admin, no ves nada
  if (!usuario || usuario.uid !== ADMIN_UID) {
    return (
      <div className="ap-denegado-page">
        <div className="ap-denegado-card">
          <span className="ap-denegado-eyebrow">Acceso restringido</span>
          <p>No tienes permisos de administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-page">
      <div className="ap-header">
        <span className="ap-eyebrow">Panel de administración</span>
        <h1>Quinielas Angamacutiro</h1>
      </div>

      <div className="ap-content">
        <section className="ap-step">
          <div className="ap-step-marker">
            <span className="ap-step-number">01</span>
            <span className="ap-step-line" aria-hidden="true" />
          </div>
          <div className="ap-step-body">
            <span className="ap-step-eyebrow">Antes de la jornada</span>
            <h2>Crear jornada</h2>
            <p className="ap-step-desc">
              Genera la siguiente jornada con los partidos traídos de la API.
            </p>
            <CrearJornada />
          </div>
        </section>

        <section className="ap-step">
          <div className="ap-step-marker">
            <span className="ap-step-number">02</span>
          </div>
          <div className="ap-step-body">
            <span className="ap-step-eyebrow">Al terminar la jornada</span>
            <h2>Cerrar jornada</h2>
            <p className="ap-step-desc">
              Calcula aciertos, define ganador(es) y reparte el premio.
            </p>
            <CerrarJornada />
          </div>
        </section>
      </div>
    </div>
  );
}