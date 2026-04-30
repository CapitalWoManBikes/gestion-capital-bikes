import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBD0-RxJoGkRUCVTBFE_ZvN4in_fzKVGuo",
  authDomain: "capital-bikes.firebaseapp.com",
  projectId: "capital-bikes",
  storageBucket: "capital-bikes.firebasestorage.app",
  messagingSenderId: "357227654554",
  appId: "1:357227654554:web:63ae552dab9b43a5055e23",
  measurementId: "G-HGXJGS8TT5",
};

const app = initializeApp(firebaseConfig);
// ignoreUndefinedProperties evita que Firestore rechace objetos con campos opcionales undefined
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

const SHOP_DOC = doc(db, "shop", "data");

export interface ShopData {
  adminPassword: string;
  team: any[];
  extendedData: Record<string, any>;
  services: any[];
  tasks: any[];
  appointments: any[];
  shift: Record<string, boolean>;
  empLunch: Record<string, boolean>;
}

/** Saves the full shop state to Firestore (merge so partial updates are safe). */
export function saveShopData(data: Partial<ShopData>): Promise<void> {
  return setDoc(SHOP_DOC, data, { merge: true });
}

/** Loads shop data once (used for migration from localStorage). */
export async function loadShopDataOnce(): Promise<ShopData | null> {
  const snap = await getDoc(SHOP_DOC);
  return snap.exists() ? (snap.data() as ShopData) : null;
}

/** Subscribes to real-time changes. Returns an unsubscribe function. */
export function subscribeShopData(cb: (data: ShopData) => void): () => void {
  return onSnapshot(SHOP_DOC, (snap) => {
    if (snap.exists()) cb(snap.data() as ShopData);
  });
}
