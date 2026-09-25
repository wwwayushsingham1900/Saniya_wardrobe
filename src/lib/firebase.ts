import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
declare global {
  interface Window {
    FIREBASE_CONFIG?: FirebaseOptions;
  }
}
const config =
  import.meta.env.VITE_USE_EMULATORS === "true"
    ? {
        apiKey: "demo-key",
        projectId: "demo-wardrobe",
        authDomain: "demo-wardrobe.firebaseapp.com",
        databaseURL: "https://demo-wardrobe-default-rtdb.firebaseio.com",
      }
    : window.FIREBASE_CONFIG;
export const configured =
  !!config?.apiKey && !config.apiKey.startsWith("PASTE_");
export const app = configured ? initializeApp(config!) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getDatabase(app) : null;
if (import.meta.env.VITE_USE_EMULATORS === "true" && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}
