// src/firebase/index.ts
"use client";

import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Тип для обʼєкта з SDK
type FirebaseSdks = {
  firebaseApp: FirebaseApp;
  auth: ReturnType<typeof getAuth>;
  firestore: ReturnType<typeof getFirestore>;
};

// Кешуємо, щоб не створювати інстанси кілька разів
let cachedSdks: FirebaseSdks | null = null;

/**
 * Централізована ініціалізація Firebase.
 * Працює і локально, і на Vercel.
 */
export function initializeFirebase(): FirebaseSdks {
  if (cachedSdks) {
    return cachedSdks;
  }

  // Якщо App ще не ініціалізований – робимо це через firebaseConfig
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  cachedSdks = getSdks(app);
  return cachedSdks;
}

/**
 * Створює обʼєкт з основними SDK (App, Auth, Firestore)
 */
export function getSdks(firebaseApp: FirebaseApp): FirebaseSdks {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };
}

// Зручні іменовані експорти, якщо десь імпортуєш напряму
export const { firebaseApp, auth, firestore } = initializeFirebase();

// Реекспорти, як було раніше
export * from "./provider";
export * from "./client-provider";
export * from "./firestore/use-collection";
export * from "./firestore/use-doc";
export * from "./non-blocking-updates";
export * from "./errors";
export * from "./error-emitter";
