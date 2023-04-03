import * as admin from "firebase-admin";
import secret from "../secret.json";

const clientEmail = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      privateKey: secret.private_key,
      //privateKey: process.env.FIREBASE_ADMIN
      //  ? process.env.FIREBASE_ADMIN.replace(/\\n/gm, "\n")
      //  : undefined,
      clientEmail,
      projectId,
    }),
  });
}

export { admin };
