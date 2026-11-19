import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client appears offline).');
    }
    return false;
  }
}

export async function signInWithGoogleFirebase(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;

  if (fbUser.emailVerified) {
    const userPath = `users/${fbUser.uid}`;
    try {
      const ref = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: (fbUser.displayName || 'Dundee Student').slice(0, 60),
          courseOrSubject: '',
          studyPreferences: ['Quiet study'],
          accessibilityPreferences: '',
          role: 'student',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }

  return fbUser;
}

export async function signOutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function syncOccupancyToFirestore(
  locationId: string,
  occupancy: 'Low' | 'Medium' | 'Busy' | 'Unknown',
  activeCheckIns: number,
  pseudonym: string
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const path = `studySpaceOccupancy/${locationId}`;
  try {
    await setDoc(doc(db, 'studySpaceOccupancy', locationId), {
      locationId,
      occupancy,
      activeCheckIns,
      lastReporterPseudonym: pseudonym.slice(0, 60),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
