
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SheetData, Role, SheetStatus, Notification } from './types';
import { MOCK_USERS, MOCK_SHEETS } from './services/mockData';

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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Helper to load from storage
    const loadFromStorage = (key: string, defaultData: any) => {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultData;
        } catch (e) {
            console.error(`Failed to load ${key}`, e);
            return defaultData;
        }
    };

    const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromStorage('currentUser', null));
    const [users, setUsers] = useState<User[]>(() => loadFromStorage('users', MOCK_USERS));
    const [sheets, setSheets] = useState<SheetData[]>(() => loadFromStorage('sheets', MOCK_SHEETS));
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [activeLocks, setActiveLocks] = useState<Set<string>>(new Set());
    const [auditLogs, setAuditLogs] = useState<any[]>(() => loadFromStorage('auditLogs', [
        { id: 'l1', user: 'System', action: 'INIT', timestamp: new Date().toISOString(), details: 'System Initialized' }
    ]));

    // Persistence Effects
    useEffect(() => { localStorage.setItem('currentUser', JSON.stringify(currentUser)); }, [currentUser]);
    useEffect(() => { localStorage.setItem('users', JSON.stringify(users)); }, [users]);
    useEffect(() => { localStorage.setItem('sheets', JSON.stringify(sheets)); }, [sheets]);
    useEffect(() => { localStorage.setItem('auditLogs', JSON.stringify(auditLogs)); }, [auditLogs]);

    const addLog = (action: string, details: string) => {
        const log = {
            id: Date.now().toString(),
            user: currentUser?.username || 'System',
            action,
            timestamp: new Date().toISOString(),
            details
        };
        setAuditLogs(prev => [log, ...prev]);
    };

    const login = (username: string, pass: string, role: Role) => {
        const user = users.find(u => u.username === username && u.password === pass && u.role === role);
        if (user) {
            if (!user.isApproved) return false;
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
        setUsers(prev => [...prev, user]);
        addNotification(`New user registration: ${user.username}`);
    };

    const approveUser = (id: string, approve: boolean) => {
        if (approve) {
            setUsers(prev => prev.map(u => u.id === id ? { ...u, isApproved: true } : u));
            addLog('USER_APPROVE', `User ID ${id} approved`);
        } else {
            setUsers(prev => prev.filter(u => u.id !== id));
            addLog('USER_REJECT', `User ID ${id} rejected`);
        }
    };

    const resetPassword = (id: string, newPass: string) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, password: newPass } : u));
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
        setSheets(prev => [newSheet, ...prev]);
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

                return { ...sheet, history: [historyEntry, ...(sheet.history || [])] };
            }
            return s;
        }));
    };

    const deleteSheet = (id: string, reason: string) => {
        setSheets(prev => prev.filter(s => s.id !== id));
        addLog('SHEET_DELETE', `Sheet ${id} deleted. Reason: ${reason}`);
    };

    const addComment = (sheetId: string, text: string) => {
        const comment = {
            id: Date.now().toString(),
            author: currentUser?.username || 'Unknown',
            text,
            timestamp: new Date().toISOString()
        };
        setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, comments: [comment, ...(s.comments || [])] } : s));
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
            login, logout, register, approveUser, resetPassword,
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
