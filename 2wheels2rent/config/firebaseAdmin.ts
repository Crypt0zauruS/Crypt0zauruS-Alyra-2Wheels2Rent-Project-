import * as admin from "firebase-admin";

const clientEmail = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      privateKey: process.env.FIREBASE_ADMIN
        ? process.env.FIREBASE_ADMIN.replace(/\\n/gm, "\n")
        : undefined,
      clientEmail,
      projectId,
    }),
  });
}

export { admin };
