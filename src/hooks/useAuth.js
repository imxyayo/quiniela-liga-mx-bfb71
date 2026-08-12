// src/hooks/useAuth.js
import { useContext } from "react";
import { AuthContext } from "../context/AuthContextObject";

// Hook para usar el contexto fácilmente en cualquier componente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}