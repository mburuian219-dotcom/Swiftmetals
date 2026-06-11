import * as admin from "firebase-admin";

// Skip initialization during build time and on client side
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
const isServer = typeof window === 'undefined';

if (!admin.apps.length && isServer && !isBuildTime) {
  try {
    // Validate environment variables exist
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
      console.error('Missing Firebase Admin environment variables');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
      console.log('Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Export a mock admin during build time to prevent errors
const mockAdmin = isBuildTime ? {
  auth: () => ({
    verifyIdToken: async () => ({ uid: 'mock', email: 'mock@example.com', role: 'staff' })
  })
} : admin;

export { admin };
export const getAdmin = () => isBuildTime ? mockAdmin : admin;