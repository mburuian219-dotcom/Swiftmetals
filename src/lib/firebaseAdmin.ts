import * as admin from "firebase-admin";

// Check if we're on the server side
const isServer = typeof window === 'undefined';

// Only initialize on server side
if (!admin.apps.length && isServer) {
  try {
    // Get environment variables
    let projectId = process.env.FIREBASE_PROJECT_ID;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log('🔧 Initializing Firebase Admin...');
    console.log('📋 Project ID:', projectId);
    console.log('📧 Client Email:', clientEmail);
    console.log('🔑 Private Key length:', privateKey?.length || 0);

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Missing Firebase Admin environment variables');
      throw new Error('Missing Firebase Admin credentials');
    }

    // Clean up the private key
    let cleanPrivateKey = privateKey;
    
    // Remove surrounding quotes if present
    if (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) {
      cleanPrivateKey = cleanPrivateKey.slice(1, -1);
    }
    
    // Replace escaped newlines with actual newlines
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    
    // Trim any whitespace
    cleanPrivateKey = cleanPrivateKey.trim();
    
    // Validate key format
    if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('❌ Invalid private key format - missing BEGIN marker');
      throw new Error('Invalid private key format');
    }
    
    if (!cleanPrivateKey.includes('-----END PRIVATE KEY-----')) {
      console.error('❌ Invalid private key format - missing END marker');
      throw new Error('Invalid private key format');
    }

    console.log('✅ Private key format validated');

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: cleanPrivateKey,
      }),
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    // Don't throw - let the app continue but log the error
  }
}

// Export admin
export { admin };

// Helper to check if Firebase Admin is ready
export const isFirebaseAdminReady = () => {
  return admin.apps && admin.apps.length > 0;
};

// Safe auth getter
export const getFirebaseAuth = () => {
  if (!isFirebaseAdminReady()) {
    throw new Error('Firebase Admin is not initialized');
  }
  return admin.auth();
};