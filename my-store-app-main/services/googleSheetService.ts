// FIX: Removed local 'google' declaration. It's now globally available from types.ts.

interface ApiResponse {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Generic API call function to communicate with the Google Apps Script backend.
 * This function now uses `google.script.run` when deployed, and provides a mock
 * for local development.
 * @param storeId The ID of the store ('global' for shared data).
 * @param action The operation to perform (e.g., 'GET_DATA', 'SAVE_DATA').
 * @param payload The data to send with the request.
 */
async function apiCall(storeId: string, action: string, payload: any = null): Promise<any> {
    // Check if we are running inside the Google Apps Script environment
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        return new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler((response: ApiResponse) => {
                    if (response.success) {
                        resolve(response.data || { success: true });
                    } else {
                        console.error(`Apps Script Error (action: ${action}):`, response.error);
                        reject(new Error(response.error || 'An unknown error occurred in Apps Script.'));
                    }
                })
                .withFailureHandler((error: Error) => {
                    console.error(`Apps Script execution failed (action: ${action}, storeId: ${storeId}):`, error);
                    reject(error);
                })
                .serverApiCall(storeId, action, payload);
        });
    } else {
        // --- LOCAL DEVELOPMENT via FETCH ---
        console.warn(`[DEV MODE] apiCall via fetch for action: ${action}, storeId: ${storeId}`);
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIO86E_3yB65udmEbVHzvQyNCbiG133QnNY5pYZEeE5w-dCbn7j9M1PFVAT9yhxTU9kw/exec';
        
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    redirect: 'follow',
                    body: JSON.stringify({ storeId, action, payload }),
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8', // Avoid CORS preflight issues
                    }
                });

                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                
                const resultText = await response.text();
                const result: ApiResponse = JSON.parse(resultText);
                
                if (result.success) {
                    resolve(result.data || { success: true });
                } else {
                    console.error(`Google Script Error (via fetch):`, result.error);
                    reject(new Error(result.error || 'An unknown error occurred in the script.'));
                }
            } catch (error) {
                console.error(`Local fetch to GAS failed (action: ${action}):`, error);
                if (action === 'GET_DATA') {
                    // Fallback to prevent app crash if script is unreachable during dev
                    resolve({});
                } else {
                    reject(error);
                }
            }
        });
    }
}


/**
 * Fetches all data for a specific store.
 * @param storeId The unique ID of the store.
 */
export const getStoreData = async (storeId: string) => {
    return apiCall(storeId, 'GET_DATA');
};

/**
 * Saves all data for a specific store.
 * @param storeId The unique ID of the store.
 * @param data The store's data object to save.
 */
export const saveStoreData = async (storeId: string, data: any) => {
    return apiCall(storeId, 'SAVE_DATA', data);
};

/**
 * Fetches global data (e.g., users list).
 */
export const getGlobalData = async () => {
    return apiCall('global', 'GET_DATA');
};

/**
 * Saves global data (e.g., users list).
 * @param data The global data object to save.
 */
export const saveGlobalData = async (data: any) => {
    return apiCall('global', 'SAVE_DATA', data);
};