import { User } from '../types';
import { api } from './api';

const CURRENT_USER_KEY = 'salePilotUser';

// --- Private Helper ---
const updateStoredUser = (updatedFields: Partial<User>): User | null => {
    const user = getCurrentUser();
    if (user) {
        const newUser = { ...user, ...updatedFields };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
        return newUser;
    }
    return null;
};


// --- Public API ---

export const login = async (email: string, password?: string): Promise<User> => {
    const user = await api.post<User>('/auth/login', { email, password });
    if (user && user.token) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
    }
    throw new Error('Login failed: No user data or token returned.');
};

export const register = async (name: string, email: string, password?: string): Promise<User> => {
    return await api.post<User>('/auth/register', { name, email, password });
};

export const logout = (): void => {
    localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    if (!userJson) return null;

    try {
        return JSON.parse(userJson) as User;
    } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        return null;
    }
};

export const forgotPassword = async (email: string): Promise<void> => {
     await api.post('/auth/forgot-password', { email });
};

export const getUsers = (): Promise<User[]> => {
    return api.get<User[]>('/users');
};

export const saveUser = (user: Omit<User, 'id'>, id?: string): Promise<User> => {
     if (id) {
        // If we are updating the current user, update localStorage too
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === id) {
            updateStoredUser(user);
        }
        return api.put<User>(`/users/${id}`, user);
    }
    return api.post<User>('/users', user);
};

export const deleteUser = (userId: string): Promise<void> => {
    return api.delete<void>(`/users/${userId}`);
};

export const verifySession = (): Promise<User> => {
    return api.get<User>('/auth/me');
};

export const changePassword = (passwordData: { currentPassword: string, newPassword: string }): Promise<void> => {
    return api.post('/auth/change-password', passwordData);
};
