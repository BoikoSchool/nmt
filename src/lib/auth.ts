import { Auth, User, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getSdks } from "@/firebase";

// IMPORTANT: Add your admin emails here
const ADMIN_EMAILS = ['user@example.com'];

/**
 * Handles the Google sign-in process.
 * After successful authentication, it creates or updates the user's document
 * in the 'users' collection in Firestore.
 * @param auth The Firebase Auth instance.
 * @returns The authenticated user object from Firebase.
 */
export const handleSignInWithGoogle = async (auth: Auth): Promise<User> => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // After sign-in, create/update user document in Firestore
    await createOrUpdateUserInFirestore(user);
    
    return user;
  } catch (error) {
    console.error("Error during Google sign-in:", error);
    throw error;
  }
};

/**
 * Handles the sign-out process.
 * @param auth The Firebase Auth instance.
 */
export const handleSignOut = async (auth: Auth): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error during sign-out:", error);
    throw error;
  }
};


/**
 * Creates a new user document in Firestore or updates an existing one.
 * It assigns a role ('admin' or 'student') based on the user's email.
 * The role is only set on creation and is not updated on subsequent sign-ins.
 * @param user The Firebase user object.
 */
const createOrUpdateUserInFirestore = async (user: User) => {
  const { firestore } = getSdks(user.auth.app);
  const userRef = doc(firestore, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    // User does not exist, create new document
    const role = ADMIN_EMAILS.includes(user.email || "") ? 'admin' : 'student';
    await setDoc(userRef, {
      fullName: user.displayName || "Anonymous",
      email: user.email,
      role: role,
      class: null,
      createdAt: serverTimestamp(),
    });
  } else {
    // User exists, update non-critical info, but DO NOT overwrite the role.
    await setDoc(userRef, {
      fullName: user.displayName || "Anonymous",
      email: user.email,
    }, { merge: true });
  }
};
