// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCIb11E04otR45A9_M13rE6R7CIU1AJysU",
  authDomain: "quiniela-liga-mx-90c95.firebaseapp.com",
  projectId: "quiniela-liga-mx-90c95",
  storageBucket: "quiniela-liga-mx-90c95.firebasestorage.app",
  messagingSenderId: "703452018726",
  appId: "1:703452018726:web:b95fd7fda78f5da6614ee7"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios que vamos a usar en toda la app
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;