
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import { StagingOverview, LoadingOverview } from './DashboardOverviews';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import {
    Check, X, Clipboard, Truck, Users as UserIcon, Trash2,
    ShieldAlert, Activity, Search, UserCheck, UserX, UserPlus,
    Key, Database, FileSpreadsheet, Download, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database';
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ viewMode, onViewSheet, onNavigate }) => {
    const { users, approveUser, deleteUser, sheets, deleteSheet, register, resetPassword, currentUser, isLoading } = useApp();
    const [searchTerm, setSearchTerm] = useState('');

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
        const todayStr = new Date().toISOString().split('T')[0];
        const createdToday = sheets.filter(s => s.date === todayStr).length;
        const completedToday = sheets.filter(s => s.status === SheetStatus.COMPLETED && s.date === todayStr).length;

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

    // --- VIEW 1: ANALYTICS DASHBOARD (Monitoring) ---
    if (viewMode === 'analytics') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Executive Overview</h2>
                        <p className="text-gray-500 text-sm">Real-time operational insights and performance metrics.</p>
                    </div>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all hover:shadow-md font-medium text-sm"
                    >
                        <FileSpreadsheet size={16} /> Export Report
                    </button>
                </div>

                {/* KPIs */}
                <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                    <div
                        onClick={() => onNavigate?.('staging')}
                        className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full -mr-2 -mt-2"></div>
                        <div>
                            <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Sheets</p>
                            <p className="text-3xl font-extrabold text-slate-800">{stats.total}</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm"><Clipboard size={24} /></div>
                    </div>
                    <div
                        onClick={() => onNavigate?.('loading')}
                        className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-bl-full -mr-2 -mt-2"></div>
                        <div>
                            <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Active Loading</p>
                            <p className="text-3xl font-extrabold text-slate-800">{stats.locked}</p>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-colors shadow-sm"><Truck size={24} /></div>
                    </div>
                    <div
                        onClick={() => onNavigate?.('loading')}
                        className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-bl-full -mr-2 -mt-2"></div>
                        <div>
                            <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Completed</p>
                            <p className="text-3xl font-extrabold text-slate-800">{stats.completed}</p>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors shadow-sm"><Check size={24} /></div>
                    </div>
                    {isAdmin && (
                        <div
                            onClick={() => onNavigate?.('admin')}
                            className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full -mr-2 -mt-2"></div>
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Pending Users</p>
                                <p className="text-3xl font-extrabold text-slate-800">{users.filter(u => !u.isApproved).length}</p>
                            </div>
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm"><UserIcon size={24} /></div>
                        </div>
                    )}
                </div>



                {/* --- DEPARTMENT OVERVIEWS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StagingOverview stats={stats} onNavigate={(filter) => onNavigate?.('staging')} />
                    <LoadingOverview stats={stats} onNavigate={(filter) => onNavigate?.('loading')} />
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Trend Chart (Line) */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Activity size={18} className="text-blue-500" /> Daily Volume Trend</h3>
                            <select className="text-xs border-none bg-slate-50 rounded-md px-2 py-1 text-slate-500 cursor-pointer hover:text-slate-800 outline-none">
                                <option>Last 7 Days</option>
                                <option>Last 30 Days</option>
                            </select>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.lineData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                                        cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                                    />
                                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Operational Status (Pie) */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <h3 className="text-lg font-bold mb-2 text-gray-800">Status Distribution</h3>
                        <div className="h-56 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        cornerRadius={4}
                                    >
                                        {stats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row 2 */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <h3 className="text-lg font-bold mb-6 text-gray-800">Workload Distribution</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.barData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={60}>
                                        {stats.barData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : index === 1 ? '#f97316' : '#94a3b8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW 2: USERS PANEL ---
    if (viewMode === 'users') {
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <UserIcon className="text-blue-600" /> User Administration
                            </h2>
                            <p className="text-sm text-gray-500">Approve new registrations and manage existing accounts.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCreateUserOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-200"
                            >
                                <UserPlus size={16} /> Add User
                            </button>
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
                                {users
                                    .filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) || (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase())))
                                    .sort((a, b) => (a.isApproved === b.isApproved) ? 0 : a.isApproved ? 1 : -1) // Pending first
                                    .map(user => (
                                        <tr key={user.id} className={`hover:bg-slate-50 transition group ${!user.isApproved ? 'bg-orange-50/30' : ''}`}>
                                            <td className="p-4 font-medium text-slate-900 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                {user.username}
                                            </td>
                                            <td className="p-4 text-slate-700">{user.fullName || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                                        ${user.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' :
                                                        user.role === Role.LOADING_SUPERVISOR ? 'bg-orange-100 text-orange-700' :
                                                            user.role === Role.STAGING_SUPERVISOR ? 'bg-blue-100 text-blue-700' :
                                                                'bg-slate-100 text-slate-600'
                                                    }`}>
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
                                                        <button
                                                            onClick={(e) => openResetPassword(e, user)}
                                                            className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <Key size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleUserDelete(e, user.id, user.username)}
                                                            className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                {users.length === 0 && (
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
                                    <th className="p-4">Sheet ID</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Dock/Dest</th>
                                    <th className="p-4">Transporter</th>
                                    <th className="p-4">Start</th>
                                    <th className="p-4">End</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Supervisor</th>
                                    <th className="p-4 text-center w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {sheets
                                    .filter(s => s.id.includes(searchTerm) || s.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(s => (
                                        <tr key={s.id} onClick={() => onViewSheet(s)} className="hover:bg-slate-50 transition cursor-pointer group">
                                            <td className="p-4 font-mono font-medium text-blue-600 group-hover:underline decoration-blue-200 underline-offset-4">{s.id}</td>
                                            <td className="p-4 text-slate-500">{s.date}</td>
                                            <td className="p-4 text-slate-700 font-medium">{s.loadingDockNo} / {s.destination}</td>
                                            <td className="p-4 text-slate-500">{s.transporter || '-'}</td>
                                            <td className="p-4 text-slate-600 font-mono text-xs">{s.loadingStartTime || '-'}</td>
                                            <td className="p-4 text-slate-600 font-mono text-xs">{s.loadingEndTime || '-'}</td>
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
                                    ))}
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
