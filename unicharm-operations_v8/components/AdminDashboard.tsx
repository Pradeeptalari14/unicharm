
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import {
    Check, X, Clipboard, Truck, Users as UserIcon, Trash2,
    ShieldAlert, Activity, Search, UserCheck, UserX, UserPlus,
    Key, Database, FileSpreadsheet, Download, Filter, CheckCircle2, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { widgetRegistry, getWidgetDefinition } from './widgets/WidgetRegistry';
import { AddWidgetModal } from './widgets/AddWidgetModal';
import { PlusCircle, MoreHorizontal, Settings2 } from 'lucide-react';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database';
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string) => void;
    initialSearch?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ viewMode, onViewSheet, onNavigate, initialSearch = '' }) => {
    const { users, approveUser, deleteUser, sheets, deleteSheet, register, resetPassword, currentUser, isLoading } = useApp();

    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Create User State
    const [isCreateUserOpen, setCreateUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        fullName: '',
        empCode: '',
        email: '',
        password: '',
        role: Role.VIEWER
    });

    // Reset Password State
    const [isResetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetData, setResetData] = useState<{ id: string, username: string, newPass: string } | null>(null);

    // --- WIDGET SYSTEM STATE ---
    // Persist preferences to LocalStorage keyed by username
    const [userWidgets, setUserWidgets] = useState<string[]>(() => {
        if (!currentUser?.username) return ['staff-performance', 'sla-monitor'];
        try {
            const saved = localStorage.getItem(`unicharm_widgets_${currentUser.username}`);
            return saved ? JSON.parse(saved) : ['staff-performance', 'sla-monitor'];
        } catch (e) {
            console.error("Failed to parse widget preferences", e);
            return ['staff-performance', 'sla-monitor'];
        }
    });
    const [isAddWidgetOpen, setAddWidgetOpen] = useState(false);

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Save to LocalStorage whenever widgets change
    React.useEffect(() => {
        if (currentUser?.username) {
            localStorage.setItem(`unicharm_widgets_${currentUser.username}`, JSON.stringify(userWidgets));
        }
    }, [userWidgets, currentUser]);

    const handleAddWidget = (widgetId: string) => {
        if (!userWidgets.includes(widgetId)) {
            setUserWidgets([...userWidgets, widgetId]);
        }
    };

    const handleRemoveWidget = (widgetId: string) => {
        setUserWidgets(userWidgets.filter(id => id !== widgetId));
    };

    // --- ANALYTICS DATA PREP ---
    const stats = useMemo(() => {
        const total = sheets.length;
        const completed = sheets.filter(s => s.status === SheetStatus.COMPLETED).length;
        const locked = sheets.filter(s => s.status === SheetStatus.LOCKED).length;
        const draft = sheets.filter(s => s.status === SheetStatus.DRAFT).length;

        // Daily Volume for Line Chart
        const volumeByDate: Record<string, number> = {};
        sheets.forEach(s => {
            const date = s.date || 'Unknown';
            volumeByDate[date] = (volumeByDate[date] || 0) + 1;
        });

        const lineData = Object.keys(volumeByDate).sort().map(date => ({
            date,
            count: volumeByDate[date]
        })).slice(-7); // Last 7 days/entries

        const barData = [
            { name: 'Completed', count: completed },
            { name: 'Locked', count: locked },
            { name: 'Drafts', count: draft }
        ];

        const pieData = [
            { name: 'Draft', value: draft, color: '#94a3b8' },
            { name: 'Locked', value: locked, color: '#f97316' },
            { name: 'Completed', value: completed, color: '#22c55e' }
        ];

        // Advanced Stats

        // Helper to check if a date string is today (handles ISO YYYY-MM-DD and Locale formats)
        const isToday = (dateStr: string) => {
            if (!dateStr) return false;
            const today = new Date();
            const d = new Date(dateStr);

            // Check exact string matches first for speed
            if (dateStr === today.toISOString().split('T')[0]) return true;
            if (dateStr === today.toLocaleDateString()) return true;

            // Check date components (robust fallback)
            return !isNaN(d.getTime()) && d.toDateString() === today.toDateString();
        };

        const createdToday = sheets.filter(s => isToday(s.date)).length;
        const completedToday = sheets.filter(s => s.status === SheetStatus.COMPLETED && isToday(s.date)).length;

        const stagingStaff = users.filter(u => u.role === Role.STAGING_SUPERVISOR && u.isApproved).length;
        const loadingStaff = users.filter(u => u.role === Role.LOADING_SUPERVISOR && u.isApproved).length;

        return { total, completed, locked, draft, lineData, barData, pieData, createdToday, completedToday, stagingStaff, loadingStaff };
    }, [sheets, users]);

    // --- EXCEL EXPORT ---
    const handleExportExcel = () => {
        const dataToExport = sheets.map(s => ({
            ID: s.id,
            Date: s.date,
            Status: s.status,
            Shift: s.shift,
            Supervisor: s.supervisorName,
            'Supervisor (Loading)': s.loadingSvName,
            Destination: s.destination,
            'Loading Dock': s.loadingDockNo,
            Transporter: s.transporter,
            'Vehicle No': s.vehicleNo,
            'Driver Name': s.driverName,
            'Start Time': s.loadingStartTime,
            'End Time': s.loadingEndTime,
            'Created By': s.createdBy,
            'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Operations_Data");
        XLSX.writeFile(wb, "Unicharm_Operations_Report.xlsx");
        alert("Excel Report Downloaded Successfully!");
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Loading dashboard elements...</div>;
    }

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this sheet?")) {
            const reason = prompt("Enter reason for deletion:");
            if (reason) {
                deleteSheet(id, reason);
            }
        }
    };

    const handleUserDelete = (e: React.MouseEvent, id: string, username: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Are you sure you want to permanently delete user "${username}"?`)) {
            deleteUser(id);
        }
    };

    const handleApprove = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        approveUser(id, true);
    };

    const handleReject = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        approveUser(id, false);
    };

    const handleCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password || !newUser.fullName || !newUser.empCode) {
            alert("All fields are required");
            return;
        }

        await register({
            id: Date.now().toString(), // Will be superseded by Supabase ID
            username: newUser.username,
            fullName: newUser.fullName,
            empCode: newUser.empCode,
            email: newUser.email,
            password: newUser.password,
            role: newUser.role,
            isApproved: true // Auto-approve admin created users
        });

        setCreateUserOpen(false);
        setNewUser({ username: '', fullName: '', empCode: '', email: '', password: '', role: Role.VIEWER });
        alert('User created successfully.');
    };

    const openResetPassword = (e: React.MouseEvent, user: any) => {
        e.preventDefault();
        e.stopPropagation();
        setResetData({ id: user.id, username: user.username, newPass: '' });
        setResetPasswordOpen(true);
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetData && resetData.newPass) {
            await resetPassword(resetData.id, resetData.newPass);
            setResetPasswordOpen(false);
            setResetData(null);
        }
    };

    const isAdmin = currentUser?.role === Role.ADMIN;
    const showStaging = isAdmin || currentUser?.role === Role.STAGING_SUPERVISOR;
    const showLoading = isAdmin || currentUser?.role === Role.LOADING_SUPERVISOR;

    // --- VIEW 1: ANALYTICS DASHBOARD (Monitoring) ---
    if (viewMode === 'analytics') {
        const sortedWidgets = userWidgets
            .map(id => getWidgetDefinition(id))
            .filter(w => w !== undefined);

        return (
            <div className="space-y-6 pb-20">
                {/* Dashboard Header / Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="text-blue-600" /> Operational Overview
                        </h2>
                        <p className="text-sm text-slate-500">ServiceNow-style customizable workspace</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportExcel}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-green-200 transition-all hover:scale-105"
                        >
                            <FileSpreadsheet size={16} /> Export
                        </button>
                    </div>
                </div>

                {/* --- STANDARD KPIS (Fixed for now, can be widgets later) --- */}
                {/* --- STANDARD KPIS (Fixed for now, can be widgets later) --- */}
                {/* --- STANDARD KPIS (Fixed for now, can be widgets later) --- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* KPI 1: Total Sheets (Visible to All) */}
                    <div
                        onClick={() => onNavigate?.('database')}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer hover:shadow-md group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">Total Sheets</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</h3>
                            </div>
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><FileSpreadsheet size={18} /></div>
                        </div>
                    </div>

                    {/* KPI 2: Active Loads (Visible to Loading & Admin Only) */}
                    {showLoading && (
                        <div
                            onClick={() => onNavigate?.('loading')}
                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-orange-300 transition-colors cursor-pointer hover:shadow-md group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-orange-500 transition-colors">Active Loads</p>
                                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.locked}</h3>
                                </div>
                                <div className="p-2 bg-orange-100 rounded-lg text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors"><Truck size={18} /></div>
                            </div>
                        </div>
                    )}

                    {/* KPI 3: Completed Today (Visible to All) */}
                    <div
                        onClick={() => onNavigate?.('database')}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-green-300 transition-colors cursor-pointer hover:shadow-md group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-green-500 transition-colors">Completed Today</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.completedToday}</h3>
                            </div>
                            <div className="p-2 bg-green-100 rounded-lg text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors"><CheckCircle2 size={18} /></div>
                        </div>
                    </div>

                    {/* KPI 4: Staff Active (Visible to Admin Only - or segregated count) */}
                    {isAdmin && (
                        <div
                            onClick={() => onNavigate?.('admin')}
                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer hover:shadow-md group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">Total Staff Active</p>
                                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.stagingStaff + stats.loadingStaff}</h3>
                                </div>
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors"><UserIcon size={18} /></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- DEPARTMENT OVERVIEWS (Role Based) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Staging Overview & Loading Overview Logic Here (Existing Code moved/kept) */}
                    {showStaging && (
                        <div
                            onClick={() => onNavigate?.('staging')}
                            className="bg-slate-50 p-5 rounded-xl border border-slate-200 cursor-pointer hover:bg-blue-50/50 transition-colors group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Clipboard size={18} /></div>
                                <h3 className="font-bold text-slate-700">Staging Overview</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Drafts</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.draft}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">New Today</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.createdToday}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Staff</p>
                                    <p
                                        className="text-xl font-bold text-slate-800 cursor-pointer hover:text-blue-600 hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate?.('admin_STAGING_SUPERVISOR');
                                        }}
                                    >
                                        {stats.stagingStaff}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading Overview */}
                    {showLoading && (
                        <div
                            onClick={() => onNavigate?.('loading')}
                            className="bg-slate-50 p-5 rounded-xl border border-slate-200 cursor-pointer hover:bg-orange-50/50 transition-colors group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors"><Truck size={18} /></div>
                                <h3 className="font-bold text-slate-700">Loading Overview</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Active</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.locked}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Done Today</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.completedToday}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Staff</p>
                                    <p
                                        className="text-xl font-bold text-slate-800 cursor-pointer hover:text-orange-600 hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate?.('admin_LOADING_SUPERVISOR');
                                        }}
                                    >
                                        {stats.loadingStaff}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- WIDGET GRID (ServiceNow Style) --- */}
                {sortedWidgets.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {sortedWidgets.map((def, idx) => {
                            if (!def) return null;
                            const WidgetComponent = def.component;
                            const colSpan = def.defaultSize === 'large' || def.defaultSize === 'full' ? 'lg:col-span-2' : '';

                            return (
                                <div key={def.id} className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow ${colSpan}`}>
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                                                {def.title}
                                            </h3>
                                            <p className="text-[10px] text-slate-400">{def.description}</p>
                                        </div>
                                        <div className="relative">
                                            <button
                                                className="text-slate-300 hover:text-slate-600 transition-colors p-1"
                                                onClick={() => handleRemoveWidget(def.id)}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <WidgetComponent />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add Widget Modal */}
                <AddWidgetModal
                    isOpen={isAddWidgetOpen}
                    onClose={() => setAddWidgetOpen(false)}
                    onAdd={handleAddWidget}
                    activeWidgets={userWidgets}
                />
            </div>
        );
    }

    // User Filter State
    const [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');

    // --- VIEW 2: USERS PANEL ---
    if (viewMode === 'users') {
        const filteredUsers = users
            .filter(u => {
                const searchMatch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

                // Role Filter (Tabs)
                const roleMatch = filterRole === 'ALL' || u.role === filterRole;

                // STRICT ROLE SEGREGATION (Security)
                if (currentUser?.role === Role.ADMIN) return searchMatch && roleMatch; // Admin sees all (filtered by tabs)
                if (currentUser?.role === Role.STAGING_SUPERVISOR) {
                    return searchMatch && u.role === Role.STAGING_SUPERVISOR; // Staging sees Staging
                }
                if (currentUser?.role === Role.LOADING_SUPERVISOR) {
                    return searchMatch && u.role === Role.LOADING_SUPERVISOR; // Loading sees Loading
                }
                return false;
            })
            .sort((a, b) => (a.isApproved === b.isApproved) ? 0 : a.isApproved ? 1 : -1);

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <UserIcon className="text-blue-600" /> User Administration
                            </h2>
                            <p className="text-sm text-gray-500">Manage staff and permissions.</p>
                        </div>

                        {/* Role Filter Tabs (Admin Only) */}
                        {currentUser?.role === Role.ADMIN && (
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setFilterRole('ALL')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilterRole(Role.STAGING_SUPERVISOR)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === Role.STAGING_SUPERVISOR ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}
                                >
                                    <Clipboard size={14} /> Staging
                                </button>
                                <button
                                    onClick={() => setFilterRole(Role.LOADING_SUPERVISOR)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === Role.LOADING_SUPERVISOR ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-orange-600'}`}
                                >
                                    <Truck size={14} /> Loading
                                </button>
                                <button
                                    onClick={() => setFilterRole(Role.ADMIN)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === Role.ADMIN ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-purple-600'}`}
                                >
                                    <ShieldAlert size={14} /> Admin
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            {currentUser?.role === Role.ADMIN && (
                                <button
                                    onClick={() => setCreateUserOpen(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-200"
                                >
                                    <UserPlus size={16} /> Add User
                                </button>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all w-64"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Full Name</th>
                                    <th className="p-4">Role</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center w-40">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className={`hover:bg-slate-50 transition group ${!user.isApproved ? 'bg-orange-50/30' : ''}`}>
                                        <td className="p-4 font-medium text-slate-900 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            {user.username}
                                        </td>
                                        <td className="p-4 text-slate-700">{user.fullName || '-'}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                                        ${user.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' :
                                                    user.role === Role.LOADING_SUPERVISOR ? 'bg-orange-100 text-orange-700' :
                                                        user.role === Role.STAGING_SUPERVISOR ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                }`}>
                                                {user.role === Role.LOADING_SUPERVISOR && <Truck size={12} />}
                                                {user.role === Role.STAGING_SUPERVISOR && <Clipboard size={12} />}
                                                {user.role === Role.ADMIN && <ShieldAlert size={12} />}
                                                {user.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500 text-xs">{user.email || 'N/A'}</td>
                                        <td className="p-4 text-center">
                                            {user.isApproved ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                                                    <ShieldAlert size={12} /> Pending Approval
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {!user.isApproved ? (
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={(e) => handleApprove(e, user.id)}
                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md shadow-sm transition-all text-xs font-bold"
                                                        title="Approve User"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleReject(e, user.id)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md shadow-sm transition-all text-xs font-bold"
                                                        title="Reject User"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {user.id === currentUser?.id && (
                                                        <button
                                                            onClick={(e) => openResetPassword(e, user)}
                                                            className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <Key size={16} />
                                                        </button>
                                                    )}
                                                    {currentUser?.role === Role.ADMIN && (
                                                        <button
                                                            onClick={(e) => handleUserDelete(e, user.id, user.username)}
                                                            className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">No users found matching your search.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create User Modal */}
                {isCreateUserOpen && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={20} className="text-blue-600" /> Create New User</h3>
                                <button onClick={() => setCreateUserOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 hover:bg-slate-200"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                        placeholder="jdoe"
                                        value={newUser.username}
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                        placeholder="John Doe"
                                        value={newUser.fullName}
                                        onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email (Optional)</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                        placeholder="john@example.com"
                                        value={newUser.email || ''}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emp Code</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="E12345"
                                            value={newUser.empCode}
                                            onChange={e => setNewUser({ ...newUser, empCode: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                                        <input
                                            type="password"
                                            required
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="••••••••"
                                            value={newUser.password}
                                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role Assignment</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white transition-all cursor-pointer"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}
                                    >
                                        <option value={Role.STAGING_SUPERVISOR}>Staging Supervisor</option>
                                        <option value={Role.LOADING_SUPERVISOR}>Loading Supervisor</option>
                                        <option value={Role.ADMIN}>Administrator</option>
                                        <option value={Role.VIEWER}>Viewer</option>
                                    </select>
                                </div>
                                <div className="pt-4">
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]">
                                        Create User
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Reset Password Modal (Admin) */}
                {isResetPasswordOpen && resetData && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Key size={20} className="text-orange-600" /> Reset Password</h3>
                                <button onClick={() => setResetPasswordOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 hover:bg-slate-200"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-5">
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                    <p className="text-sm text-orange-800">Resetting password for: <span className="font-bold">{resetData.username}</span></p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-mono"
                                        placeholder="Enter new password"
                                        value={resetData.newPass}
                                        onChange={e => setResetData({ ...resetData, newPass: e.target.value })}
                                    />
                                </div>
                                <div className="pt-2">
                                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98]">
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW 3: DATABASE PANEL ---
    if (viewMode === 'database') {
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Database className="text-blue-600" /> Database Management
                            </h2>
                            <p className="text-sm text-gray-500">View and manage all system data records.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-medium"
                            >
                                <Download size={16} /> Export All
                            </button>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search sheets..."
                                    className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all min-w-[240px]"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>
                                        <div className="flex items-center gap-1">Sheet ID {sortConfig?.key === 'id' && <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'rotate-180' : ''} />}</div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>
                                        <div className="flex items-center gap-1">Date {sortConfig?.key === 'date' && <ArrowUpDown size={12} />}</div>
                                    </th>
                                    <th className="p-4">Dock/Dest</th>
                                    <th className="p-4">Transporter</th>
                                    <th className="p-4">Start</th>
                                    <th className="p-4">End</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-1">Status {sortConfig?.key === 'status' && <ArrowUpDown size={12} />}</div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('supervisorName')}>
                                        <div className="flex items-center gap-1">Supervisor {sortConfig?.key === 'supervisorName' && <ArrowUpDown size={12} />}</div>
                                    </th>
                                    <th className="p-4 text-center w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {sheets
                                    .filter(s => s.id.includes(searchTerm) || s.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .sort((a, b) => {
                                        if (!sortConfig) return 0;
                                        const { key, direction } = sortConfig;
                                        const valA = a[key as keyof SheetData] || '';
                                        const valB = b[key as keyof SheetData] || '';

                                        if (valA < valB) return direction === 'asc' ? -1 : 1;
                                        if (valA > valB) return direction === 'asc' ? 1 : -1;
                                        return 0;
                                    })
                                    .map(s => {
                                        // Duration Calculation Helper
                                        let duration = '-';
                                        if (s.loadingStartTime && s.loadingEndTime) {
                                            const start = new Date(`1970-01-01T${s.loadingStartTime}`);
                                            const end = new Date(`1970-01-01T${s.loadingEndTime}`);
                                            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                                                const diffMs = end.getTime() - start.getTime();
                                                const diffMins = Math.round(diffMs / 60000);
                                                if (diffMins >= 0) {
                                                    const hrs = Math.floor(diffMins / 60);
                                                    const mins = diffMins % 60;
                                                    duration = `${hrs}h ${mins}m`;
                                                }
                                            }
                                        }

                                        return (
                                            <tr key={s.id} onClick={() => onViewSheet(s)} className="hover:bg-slate-50 transition cursor-pointer group">
                                                <td className="p-4 font-mono font-medium text-blue-600 group-hover:underline decoration-blue-200 underline-offset-4">{s.id}</td>
                                                <td className="p-4 text-slate-500">{s.date}</td>
                                                <td className="p-4 text-slate-700 font-medium">{s.loadingDockNo} / {s.destination}</td>
                                                <td className="p-4 text-slate-500">{s.transporter || '-'}</td>
                                                <td className="p-4 text-slate-600 font-mono text-xs">{s.loadingStartTime || '-'}</td>
                                                <td className="p-4 text-slate-600 font-mono text-xs">{s.loadingEndTime || '-'}</td>
                                                <td className="p-4 text-slate-800 font-bold text-xs">{duration}</td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide
                                        ${s.status === 'LOCKED' ? 'bg-orange-100 text-orange-700' :
                                                            s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                'bg-slate-100 text-slate-600'}`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-700">{s.supervisorName}</td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={(e) => handleDelete(e, s.id)}
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete Sheet"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                {sheets.length === 0 && (
                                    <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">No records found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return <div>Unknown View Mode</div>;
};
