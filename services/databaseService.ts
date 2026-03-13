import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { User, StoreData } from '../types';

export async function getGlobalData(): Promise<{ users: User[], loyaltyData: any } | null> {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    usersSnapshot.forEach((doc) => {
      users.push(doc.data() as User);
    });
    return { users, loyaltyData: {} };
  } catch (error) {
    console.error("Error getting global data:", error);
    return null;
  }
}

export async function saveGlobalData(data: { users: User[], loyaltyData: any }): Promise<{ success: boolean; error?: string }> {
  try {
    const batch = writeBatch(db);
    data.users.forEach((user) => {
      if (user.phone) {
        const userRef = doc(db, 'users', user.phone);
        batch.set(userRef, user, { merge: true });
      }
    });
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Error saving global data:", error);
    return { success: false, error: error.message };
  }
}

export async function getStoreData(storeId: string): Promise<StoreData | null> {
  try {
    const storeRef = doc(db, 'stores', storeId);
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists()) {
      return storeSnap.data() as StoreData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting store data:", error);
    return null;
  }
}

export async function saveStoreData(storeInfo: any, storeData: StoreData): Promise<{ success: boolean; error?: string }> {
  try {
    const storeRef = doc(db, 'stores', storeInfo.id);
    await setDoc(storeRef, storeData, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error("Error saving store data:", error);
    return { success: false, error: error.message };
  }
}

export async function migrateAllLegacyDataToRelational(users: User[]): Promise<{ success: boolean; error?: string; summary?: string }> {
  return { success: true, summary: "Migration not needed for Firebase." };
}

export async function clearStoreData(storeId: string, targets: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const storeRef = doc(db, 'stores', storeId);
    const updateData: any = {};
    if (targets.includes('orders')) updateData.orders = [];
    if (targets.includes('wallet')) updateData.wallet = { balance: 0, transactions: [] };
    if (targets.includes('customers')) updateData.customers = [];
    if (targets.includes('products')) updateData.products = [];
    if (targets.includes('collections')) updateData.collections = [];
    if (targets.includes('discounts')) updateData.discounts = [];
    if (targets.includes('shipping')) updateData.shippingOptions = [];
    if (targets.includes('employees')) updateData.employees = [];
    
    await setDoc(storeRef, updateData, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error("Error clearing store data:", error);
    return { success: false, error: error.message };
  }
}
