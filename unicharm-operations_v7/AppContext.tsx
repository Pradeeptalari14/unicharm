
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SheetData, Role, SheetStatus, Notification } from './types';
import { MOCK_USERS, MOCK_SHEETS } from './services/mockData';
import { supabase } from './services/supabaseClient';

interface AppContextType {
    currentUser: User | null;
    users: User[];
    sheets: SheetData[];
    notifications: Notification[];
    auditLogs: any[];
    login: (username: string, pass: string, role: Role) => boolean;
    logout: () => void;
    register: (user: User) => void;
    approveUser: (id: string, approve: boolean) => void;
    deleteUser: (id: string) => void;
    toggleUserActive: (id: string, isActive: boolean) => void;
    resetPassword: (id: string, newPass: string) => void;
    addSheet: (sheet: SheetData) => void;
    updateSheet: (sheet: SheetData) => void;
    deleteSheet: (id: string, reason: string) => void;
    addComment: (sheetId: string, text: string) => void;
    acquireLock: (sheetId: string) => boolean;
    releaseLock: (sheetId: string) => void;
    addNotification: (msg: string) => void;
    markAllRead: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Storage Keys
const STORAGE_KEYS = {
    USERS: 'UCIA_USERS',
    SHEETS: 'UCIA_SHEETS',
    LOGS: 'UCIA_LOGS',
    NOTIFS: 'UCIA_NOTIFS'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize state
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
    const [sheets, setSheets] = useState<SheetData[]>(MOCK_SHEETS);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [activeLocks, setActiveLocks] = useState<Set<string>>(new Set());

    // --- Supabase Persistence ---

    // Load Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Load Users
                const { data: userData, error: userError } = await supabase.from('users').select('*');
                if (userData && !userError && userData.length > 0) {
                    setUsers(userData.map(r => r.data));
                } else if (localStorage.getItem(STORAGE_KEYS.USERS)) {
                    // Fallback to local storage if DB empty or error
                    setUsers(JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)!));
                }

                // Load Sheets
                const { data: sheetData, error: sheetError } = await supabase.from('sheets').select('*');
                if (sheetData && !sheetError && sheetData.length > 0) {
                    setSheets(sheetData.map(r => r.data));
                } else if (localStorage.getItem(STORAGE_KEYS.SHEETS)) {
                    setSheets(JSON.parse(localStorage.getItem(STORAGE_KEYS.SHEETS)!));
                }

                // Load Logs
                const { data: logData, error: logError } = await supabase.from('logs').select('*');
                if (logData && !logError && logData.length > 0) {
                    setAuditLogs(logData.map(r => r.data));
                }

            } catch (err) {
                console.error("Error loading data from Supabase:", err);
            }
        };
        fetchData();
    }, []);

    // Save Effects (Optimistic UI + Background Save)

    const saveUserToSupabase = async (user: User) => {
        // Upsert user by ID
        const { error } = await supabase.from('users').upsert({ id: user.id, data: user });
        if (error) console.error("Error saving user:", error);
    };

    const saveSheetToSupabase = async (sheet: SheetData) => {
        const { error } = await supabase.from('sheets').upsert({ id: sheet.id, data: sheet, created_at: sheet.createdAt });
        if (error) console.error("Error saving sheet:", error);
    };

    const deleteSheetFromSupabase = async (id: string) => {
        const { error } = await supabase.from('sheets').delete().eq('id', id);
        if (error) console.error("Error deleting sheet:", error);
    };

    const deleteUserFromSupabase = async (id: string) => {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) console.error("Error deleting user:", error);
    };

    const saveLogToSupabase = async (log: any) => {
        const { error } = await supabase.from('logs').insert({ id: log.id, data: log });
        if (error) console.error("Error saving log:", error);
    };


    // --- Actions ---

    const addLog = (action: string, details: string) => {
        const log = {
            id: Date.now().toString(),
            user: currentUser?.username || 'System',
            action,
            timestamp: new Date().toISOString(),
            details
        };
        setAuditLogs(prev => [log, ...prev]);
        saveLogToSupabase(log);
    };

    const login = (username: string, pass: string, role: Role) => {
        const user = users.find(u => u.username === username && u.password === pass && u.role === role);
        if (user) {
            if (!user.isApproved) return false;
            // Check isActive (default true if undefined)
            if (user.isActive === false) return false;

            setCurrentUser(user);
            addLog('LOGIN', `User ${username} logged in`);
            return true;
        }
        return false;
    };

    const logout = () => {
        addLog('LOGOUT', `User ${currentUser?.username} logged out`);
        setCurrentUser(null);
    };

    const register = (user: User) => {
        // Ensure new users are active by default
        const userWithStatus = { ...user, isActive: true };
        setUsers(prev => {
            const newState = [...prev, userWithStatus];
            saveUserToSupabase(userWithStatus);
            return newState;
        });
        addNotification(`New user registration: ${user.username}`);
    };

    const approveUser = (id: string, approve: boolean) => {
        if (approve) {
            setUsers(prev => {
                const newState = prev.map(u => {
                    if (u.id === id) {
                        const updated = { ...u, isApproved: true };
                        saveUserToSupabase(updated);
                        return updated;
                    }
                    return u;
                });
                return newState;
            });
            addLog('USER_APPROVE', `User ID ${id} approved`);
        } else {
            setUsers(prev => {
                const newState = prev.filter(u => u.id !== id);
                // In a real app we might soft delete, but here we just delete from state. 
                // For DB we should delete too.
                if (approve === false) { // Rejection
                    // Implementation detail: we're not deleting from DB here for safety in this demo, 
                    // but strictly we should: supabase.from('users').delete().eq('id', id);
                }
                return newState;
            });
            addLog('USER_REJECT', `User ID ${id} rejected`);
        }
    };

    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        deleteUserFromSupabase(id);
        addLog('USER_DELETE', `User ID ${id} deleted`);
    };

    const toggleUserActive = (id: string, isActive: boolean) => {
        setUsers(prev => {
            const newState = prev.map(u => {
                if (u.id === id) {
                    const updated = { ...u, isActive };
                    saveUserToSupabase(updated);
                    return updated;
                }
                return u;
            });
            return newState;
        });
        addLog('USER_STATUS_CHANGE', `User ID ${id} status changed to ${isActive ? 'Active' : 'Inactive'}`);
    };

    const resetPassword = (id: string, newPass: string) => {
        setUsers(prev => {
            const newState = prev.map(u => {
                if (u.id === id) {
                    const updated = { ...u, password: newPass };
                    saveUserToSupabase(updated);
                    return updated;
                }
                return u;
            });
            return newState;
        });
        // If the user resets their own password, update the current user state reference
        if (currentUser && currentUser.id === id) {
            setCurrentUser(prev => prev ? { ...prev, password: newPass } : null);
        }
        addLog('PASSWORD_RESET', `Password reset for user ID ${id}`);
    };

    const addSheet = (sheet: SheetData) => {
        const newSheet = {
            ...sheet,
            history: [...(sheet.history || []), {
                id: Date.now().toString(),
                actor: currentUser?.username || 'Unknown',
                action: 'CREATED',
                timestamp: new Date().toISOString(),
                details: 'Sheet Created'
            }]
        };
        setSheets(prev => {
            const newState = [newSheet, ...prev];
            saveSheetToSupabase(newSheet);
            return newState;
        });
        addLog('SHEET_CREATE', `Sheet ${sheet.id} created`);
        addNotification(`New Staging Sheet ${sheet.id} created.`);
    };

    const updateSheet = (sheet: SheetData) => {
        setSheets(prev => prev.map(s => {
            if (s.id === sheet.id) {
                // Determine what changed for history
                let action = 'UPDATED';
                if (s.status !== sheet.status) action = `STATUS_CHANGE_TO_${sheet.status}`;

                const historyEntry = {
                    id: Date.now().toString(),
                    actor: currentUser?.username || 'Unknown',
                    action,
                    timestamp: new Date().toISOString(),
                    details: action === 'UPDATED' ? 'Sheet updated' : `Status changed from ${s.status} to ${sheet.status}`
                };

                const updatedSheet = { ...sheet, history: [historyEntry, ...(sheet.history || [])] };
                saveSheetToSupabase(updatedSheet);
                return updatedSheet;
            }
            return s;
        }));
    };

    const deleteSheet = (id: string, reason: string) => {
        setSheets(prev => prev.filter(s => s.id !== id));
        deleteSheetFromSupabase(id);
        addLog('SHEET_DELETE', `Sheet ${id} deleted. Reason: ${reason}`);
    };

    const addComment = (sheetId: string, text: string) => {
        const comment = {
            id: Date.now().toString(),
            author: currentUser?.username || 'Unknown',
            text,
            timestamp: new Date().toISOString()
        };

        // We need to find the sheet to update it properly in DB
        setSheets(prev => {
            const newState = prev.map(s => {
                if (s.id === sheetId) {
                    const updated = { ...s, comments: [comment, ...(s.comments || [])] };
                    saveSheetToSupabase(updated);
                    return updated;
                }
                return s;
            });
            return newState;
        });
    };

    const acquireLock = (sheetId: string) => {
        // In a real app, this checks server side lock
        if (activeLocks.has(sheetId)) return false;
        setActiveLocks(prev => new Set(prev).add(sheetId));
        return true;
    };

    const releaseLock = (sheetId: string) => {
        setActiveLocks(prev => {
            const next = new Set(prev);
            next.delete(sheetId);
            return next;
        });
    };

    const addNotification = (msg: string) => {
        setNotifications(prev => [{ id: Date.now().toString(), message: msg, read: false, timestamp: new Date().toISOString() }, ...prev]);
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return (
        <AppContext.Provider value={{
            currentUser, users, sheets, notifications, auditLogs,
            login, logout, register, approveUser, deleteUser, toggleUserActive, resetPassword,
            addSheet, updateSheet, deleteSheet, addComment,
            acquireLock, releaseLock, addNotification, markAllRead
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
