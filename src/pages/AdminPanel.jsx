import React from "react";
import { useAuth } from "../hooks/useAuth";
import CrearJornada from "./CrearJornada";
import GestionPagos from "./GestionPagos";
import CerrarJornada from "./CerrarJornada";

// UID del admin (Panfilo P)
const ADMIN_UID = "CNTWR8yNC0SIaRtELk8aW9eldvC2";

export default function AdminPanel() {
  const { usuario } = useAuth();

  // Protección: si no eres admin, no ves nada
  if (!usuario || usuario.uid !== ADMIN_UID) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] p-6 font-['Inter',sans-serif]">
        <div className="w-full max-w-sm rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-8 text-center shadow-2xl">
          <span className="mb-3 block font-mono text-xs uppercase tracking-widest text-[var(--dash-gold)]">
            Acceso restringido
          </span>
          <p className="text-sm text-[var(--dash-muted)]">
            No tienes permisos de administrador.
          </p>
        </div>
      </div>
    );
  }

  const pasos = [
    {
      numero: "01",
      eyebrow: "Antes de la jornada",
      titulo: "Crear jornada",
      desc: "Genera la siguiente jornada con los partidos traídos de la API.",
      contenido: <CrearJornada />,
    },
    {
      numero: "02",
      eyebrow: "Durante la jornada",
      titulo: "Confirmar pagos",
      desc: 'Marca quién ya pagó su cuota. Sin esto, esa persona no ve el formulario de predicción.',
      contenido: <GestionPagos />,
    },
    {
      numero: "03",
      eyebrow: "Al terminar la jornada",
      titulo: "Cerrar jornada",
      desc: "Calcula aciertos, define ganador(es) y reparte el premio.",
      contenido: <CerrarJornada />,
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[var(--dash-bg)] font-['Inter',sans-serif] text-[var(--dash-white)]">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <header className="mb-10 border-b border-[var(--dash-border)] pb-6">
          <span className="mb-2 block font-mono text-xs uppercase tracking-widest text-[var(--dash-gold)]">
            Panel de administración
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Quinielas Angamacutiro
          </h1>
        </header>

        <div className="flex flex-col">
          {pasos.map((paso, i) => (
            <section key={paso.numero} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-5">
              {/* Marcador numerado + linea conectora */}
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--dash-gold)] bg-[var(--dash-gold-soft)] font-mono text-xs font-bold text-[var(--dash-gold)] sm:h-11 sm:w-11 sm:text-sm">
                  {paso.numero}
                </span>
                {i < pasos.length - 1 && (
                  <span className="mt-2 w-px flex-1 bg-[var(--dash-border)]" />
                )}
              </div>

              {/* Cuerpo del paso */}
              <div className="min-w-0 pb-12 last:pb-0">
                <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
                  {paso.eyebrow}
                </span>
                <h2 className="mb-2 text-xl font-bold sm:text-2xl">{paso.titulo}</h2>
                <p className="mb-5 max-w-xl text-sm leading-relaxed text-[var(--dash-muted)]">
                  {paso.desc}
                </p>
                <div className="w-full min-w-0">{paso.contenido}</div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}