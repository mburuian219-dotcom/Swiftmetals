import { auth } from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

export function isAdmin(user: FirebaseUser | null) {
  if (!user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

export function useAuthState(callback: (user: FirebaseUser | null, isAdmin: boolean) => void) {
  onAuthStateChanged(auth, (user) => {
    const admin = isAdmin(user);
    callback(user, admin);
  });
}
