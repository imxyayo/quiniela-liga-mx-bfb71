// src/context/AuthContext.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { crearUsuarioSiNoExiste } from "../services/usuarios";
import { AuthContext } from "./AuthContextObject";

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUsuario(firebaseUser);

      if (firebaseUser) {
        // Crea el documento en Firestore si es la primera vez, o lo trae si ya existe
        const datosPerfil = await crearUsuarioSiNoExiste(
          firebaseUser.uid,
          firebaseUser.phoneNumber
        );
        setPerfil(datosPerfil);
      } else {
        setPerfil(null);
      }

      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { usuario, perfil, setPerfil, cargando };

  return (
    <AuthContext.Provider value={value}>
      {!cargando && children}
    </AuthContext.Provider>
  );
}