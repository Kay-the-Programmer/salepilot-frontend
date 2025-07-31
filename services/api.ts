import { dbService } from './dbService';

const API_BASE_URL = 'http://localhost:5000/api';
const CURRENT_USER_KEY = 'salePilotUser';

// --- Online/Offline Status ---
let isOnline = navigator.onLine;
window.addEventListener('online', () => { isOnline = true; window.dispatchEvent(new CustomEvent('onlineStatusChange')); });
window.addEventListener('offline', () => { isOnline = false; window.dispatchEvent(new CustomEvent('onlineStatusChange')); });
export const getOnlineStatus = () => isOnline;


async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T & { offline?: boolean }> {
    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    const user = userJson ? JSON.parse(userJson) : null;

    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
    }
    const config: RequestInit = { ...options, headers };

    // --- Offline Handling for Mutations ---
    if (config.method && config.method !== 'GET' && !isOnline) {
        console.log('Offline: Queuing mutation for', endpoint);
        await dbService.addMutationToQueue(endpoint, config);
        // The calling function will construct a temporary object for optimistic UI.
        return { offline: true } as unknown as T & { offline?: boolean };
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized - likely an expired token. Log out the user.
                localStorage.removeItem(CURRENT_USER_KEY);
                window.location.reload();
            }

            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                // Try to parse a JSON error response from the backend
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // If the response is not JSON (e.g., HTML error page), use the status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json() as T;
        } else {
            // Handle 204 No Content or non-JSON success responses
            return {} as T;
        }
    } catch (error) {
        // --- Offline Handling for GET requests ---
        if (config.method === 'GET' || !config.method) {
            console.log('Offline or network error: Falling back to IndexedDB for GET', endpoint);
            const storeNameKey = endpoint.substring(1).split('/')[0];
            const id = endpoint.split('/')[2];

            try {
                if (storeNameKey === 'settings') {
                    const settings = await dbService.get('settings', 'main');
                    if(settings) return settings as T;
                } else {
                    if (id) {
                        const item = await dbService.get(storeNameKey, id);
                        if (item) return item as T;
                    } else {
                        const data = await dbService.getAll(storeNameKey);
                        if (data.length > 0) return data as T;
                    }
                }
            } catch (dbError) {
                console.error(`Failed to get from IndexedDB store "${storeNameKey}":`, dbError);
            }
        }
        console.error(`API request failed: ${options.method || 'GET'} ${endpoint}`, error);
        throw error;
    }
}

export const api = {
    get: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'GET' }),
    post: <T>(endpoint: string, body: any, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: <T>(endpoint: string, body: any, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    patch: <T>(endpoint: string, body: any, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export async function syncOfflineMutations(): Promise<{succeeded: number, failed: number}> {
    const queue = await dbService.getQueuedMutations();
    if (queue.length === 0) {
        return { succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    console.log(`Syncing ${queue.length} offline mutations...`);

    for (const item of queue) {
        try {
            // Re-use the request function, which will now be online
            await request(item.endpoint, item.options);
            await dbService.deleteQueuedMutation(item.id!);
            succeeded++;
        } catch (error) {
            console.error('Failed to sync mutation:', {item}, error);
            failed++;
        }
    }

    console.log(`Sync complete. Succeeded: ${succeeded}, Failed: ${failed}`);
    return { succeeded, failed };
}