
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts';
import {
    Check, X, Clipboard, Truck, Users as UserIcon, Trash2, ShieldAlert,
    Activity, Search, UserCheck, UserX, UserPlus, Key, Database,
    LayoutDashboard, Table, Clock, Calendar, ChevronDown, ChevronUp, FileText, Download
} from 'lucide-react';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database'; // Maintained for prop compatibility, but internal state handles tabs now
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string) => void;
}

// Helper to format duration
const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return '-';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = e - s;
    if (diff < 0) return '-';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
};

// Helper to format date
const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ viewMode: initialViewMode, onViewSheet, onNavigate }) => {
    const { users, approveUser, deleteUser, toggleUserActive, sheets, auditLogs, deleteSheet, register, resetPassword, currentUser } = useApp();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'tracking' | 'users' | 'database'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');

    // --- USER MANAGEMENT STATE ---
    const [isCreateUserOpen, setCreateUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '', fullName: '', empCode: '', email: '', password: '', role: Role.VIEWER
    });
    const [isResetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetData, setResetData] = useState<{ id: string, username: string, newPass: string } | null>(null);

    // --- ANALYTICS DATA ---
    const analytics = useMemo(() => {
        const total = sheets.length;
        const completed = sheets.filter(s => s.status === SheetStatus.COMPLETED).length;
        const locked = sheets.filter(s => s.status === SheetStatus.LOCKED).length;
        const draft = sheets.filter(s => s.status === SheetStatus.DRAFT).length;

        // Pending Users
        const pendingUsersCount = users.filter(u => !u.isApproved).length;

        // Daily Volume (Last 7 days)
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const volumeTrend = last7Days.map(date => {
            return {
                date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
                completed: sheets.filter(s => s.status === SheetStatus.COMPLETED && s.completedAt?.startsWith(date)).length,
                created: sheets.filter(s => s.createdAt.startsWith(date)).length
            };
        });

        // Supervisor Performance
        const supervisorStats: Record<string, number> = {};
        sheets.forEach(s => {
            if (s.supervisorName) {
                supervisorStats[s.supervisorName] = (supervisorStats[s.supervisorName] || 0) + 1;
            }
        });
        const supervisorData = Object.entries(supervisorStats)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5

        const pieData = [
            { name: 'Draft', value: draft, color: '#94a3b8' },
            { name: 'Loading', value: locked, color: '#f97316' },
            { name: 'Done', value: completed, color: '#22c55e' }
        ];

        return { total, completed, locked, draft, volumeTrend, supervisorData, pieData, pendingUsersCount };
    }, [sheets, users]);

    // --- HANDLERS ---
    const handleDeleteUser = (e: React.MouseEvent, id: string, name: string) => {
        if (window.confirm(`Are you sure you want to permanently delete ${name}?`)) deleteUser(id);
    };

    const handleCreateUserSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        register({ ...newUser, id: Date.now().toString(), isApproved: true });
        setCreateUserOpen(false);
        setNewUser({ username: '', fullName: '', empCode: '', email: '', password: '', role: Role.VIEWER });
        alert('User created successfully.');
    };

    const handleResetPasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (resetData && resetData.newPass) {
            resetPassword(resetData.id, resetData.newPass);
            alert(`Password for ${resetData.username} has been reset.`);
            setResetPasswordOpen(false);
            setResetData(null);
        }
    };

    // --- EXPORT ---
    const downloadCSV = () => {
        const headers = ['Sheet ID', 'Date', 'Shift', 'Destination', 'Status', 'Staging SV', 'Created By', 'Created At', 'Loading SV', 'Loading Start By', 'Loading Start At', 'Vehicle', 'Completed By', 'Completed At', 'Total Duration'];
        const rows = sheets.map(s => [
            s.id,
            s.date,
            s.shift,
            s.destination?.replace(/,/g, ' '), // sanitize for CSV
            s.status,
            s.supervisorName,
            s.createdBy,
            s.createdAt,
            s.loadingSvName || '-',
            s.lockedBy || '-',
            s.lockedAt || '-',
            s.vehicleNo || '-',
            s.completedBy || '-',
            s.completedAt || '-',
            formatDuration(s.createdAt, s.completedAt)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `unicharm_operations_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- RENDER CONTENT ---
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                <div className="relative z-10">
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Sheets</p>
                                    <h3 className="text-3xl font-extrabold text-gray-800">{analytics.total}</h3>
                                    <div className="mt-2 flex items-center text-xs text-blue-600 font-medium"><Activity size={14} className="mr-1" /> All Time</div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                <div className="relative z-10">
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Completed</p>
                                    <h3 className="text-3xl font-extrabold text-green-600">{analytics.completed}</h3>
                                    <div className="mt-2 flex items-center text-xs text-green-600 font-medium"><Check size={14} className="mr-1" /> Successfully processed</div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                <div className="relative z-10">
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">In Progress</p>
                                    <h3 className="text-3xl font-extrabold text-orange-600">{analytics.locked}</h3>
                                    <div className="mt-2 flex items-center text-xs text-orange-600 font-medium"><Truck size={14} className="mr-1" /> Currently Loading</div>
                                </div>
                            </div>

                            {/* Intelligent Users Card: Shows Pending if any, else Total */}
                            {analytics.pendingUsersCount > 0 ? (
                                <div
                                    className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all"
                                    onClick={() => setActiveTab('users')}
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10">
                                        <p className="text-red-600 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12} /> Action Required</p>
                                        <h3 className="text-3xl font-extrabold text-red-700">{analytics.pendingUsersCount}</h3>
                                        <div className="mt-2 flex items-center text-xs text-red-600 font-bold"><UserIcon size={14} className="mr-1" /> Users Pending Approval</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                    <div className="relative z-10">
                                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Users</p>
                                        <h3 className="text-3xl font-extrabold text-purple-600">{users.length}</h3>
                                        <div className="mt-2 flex items-center text-xs text-purple-600 font-medium"><UserIcon size={14} className="mr-1" /> Active Accounts</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Charts Row 1 */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Activity size={18} className="text-blue-500" /> Operational Volume (7 Days)
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={analytics.volumeTrend}>
                                            <defs>
                                                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                                            />
                                            <Area type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCreated)" name="Created" />
                                            <Area type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" name="Completed" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <FileText size={18} className="text-orange-500" /> Status Distribution
                                </h3>
                                <div className="h-64 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={analytics.pieData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {analytics.pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center">
                                        <div className="text-2xl font-bold text-gray-800">{analytics.total}</div>
                                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sheets</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Supervisors */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <UserCheck size={18} className="text-purple-500" /> Top Supervisors
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.supervisorData} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                        <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} name="Sheets Managed" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                );

            case 'tracking':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Clock className="text-blue-600" /> Tracking & Audit</h2>
                                    <p className="text-sm text-gray-500 mt-1">Detailed lifecycle tracking of all sheets.</p>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search sheet ID..."
                                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                                        <tr>
                                            <th className="p-4 rounded-tl-lg">Sheet ID</th>
                                            <th className="p-4">Created</th>
                                            <th className="p-4">Locked (Loading)</th>
                                            <th className="p-4">Completed</th>
                                            <th className="p-4">Total Duration</th>
                                            <th className="p-4 rounded-tr-lg text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sheets
                                            .filter(s => s.id.includes(searchTerm))
                                            .slice() // Copy to sort
                                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                            .map(s => (
                                                <tr key={s.id} className="hover:bg-gray-50 transition">
                                                    <td className="p-4 font-mono font-medium text-blue-600">{s.id}</td>
                                                    <td className="p-4 text-gray-700">
                                                        <div className="font-medium">{formatDate(s.createdAt)}</div>
                                                        <div className="text-xs text-gray-400">{s.createdBy}</div>
                                                    </td>
                                                    <td className="p-4 text-gray-700">
                                                        <div className="font-medium">{formatDate(s.lockedAt)}</div>
                                                        {s.lockedBy && <div className="text-xs text-gray-400">{s.lockedBy}</div>}
                                                    </td>
                                                    <td className="p-4 text-gray-700">
                                                        <div className="font-medium">{formatDate(s.completedAt)}</div>
                                                        {s.completedBy && <div className="text-xs text-gray-400">{s.completedBy}</div>}
                                                    </td>
                                                    <td className="p-4 font-medium text-gray-900">
                                                        {formatDuration(s.createdAt, s.completedAt)}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold 
                                                            ${s.status === 'LOCKED' ? 'bg-orange-100 text-orange-700' :
                                                                s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                    'bg-gray-100 text-gray-600'}`}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );

            case 'users':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><UserIcon className="text-blue-600" /> User Management</h2>
                                    <p className="text-sm text-gray-500 mt-1">Manage system access and permissions.</p>
                                </div>
                                <button onClick={() => setCreateUserOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-all md:w-auto w-full justify-center">
                                    <UserPlus size={16} /> Add User
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                                        <tr>
                                            <th className="p-4 rounded-tl-lg">User</th>
                                            <th className="p-4">Role</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-center rounded-tr-lg">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {users
                                            .slice()
                                            .sort((a, b) => Number(Boolean(a.isApproved)) - Number(Boolean(b.isApproved))) // Pending (false) first
                                            .map(user => (
                                                <tr key={user.id} className={`hover:bg-gray-50 transition ${!user.isApproved ? 'bg-red-50/50' : ''}`}>
                                                    <td className="p-4">
                                                        <div className="font-bold text-gray-900">{user.fullName || user.username}</div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                    </td>
                                                    <td className="p-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-600">{user.role}</span></td>
                                                    <td className="p-4">
                                                        {user.isApproved ? (
                                                            user.isActive !== false ?
                                                                <span className="text-green-600 flex items-center gap-1 text-xs font-bold"><Check size={12} /> Active</span> :
                                                                <span className="text-gray-500 flex items-center gap-1 text-xs font-bold"><X size={12} /> Inactive</span>
                                                        ) : <span className="text-orange-500 flex items-center gap-1 text-xs font-bold"><ShieldAlert size={12} /> Pending</span>}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            {!user.isApproved ? (
                                                                <>
                                                                    <button onClick={(e) => approveUser(user.id, true)} className="text-green-600 hover:bg-green-50 p-1 rounded font-bold text-xs uppercase">Approve</button>
                                                                    <button onClick={(e) => approveUser(user.id, false)} className="text-red-600 hover:bg-red-50 p-1 rounded font-bold text-xs uppercase">Reject</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => toggleUserActive(user.id, user.isActive === false)} className="text-gray-400 hover:text-blue-600 p-2 rounded" title="Toggle Active"><UserCheck size={16} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setResetData({ id: user.id, username: user.username, newPass: '' }); setResetPasswordOpen(true); }} className="text-gray-400 hover:text-orange-600 p-2 rounded" title="Reset Password"><Key size={16} /></button>
                                                                    <button onClick={(e) => handleDeleteUser(e, user.id, user.username)} className="text-gray-400 hover:text-red-600 p-2 rounded" title="Delete"><Trash2 size={16} /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );

            case 'database':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Database className="text-blue-600" /> Database Registry</h2>
                                    <p className="text-sm text-gray-500 mt-1">Full record of all operational sheets.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-all">
                                        <Download size={16} /> Export to Excel
                                    </button>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto border rounded-xl border-gray-200">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="p-3 border border-gray-300 bg-gray-50">ID</th>
                                            <th className="p-3 border border-gray-300 bg-gray-50">Date</th>
                                            <th className="p-3 border border-gray-300 bg-gray-50">Shift</th>
                                            <th className="p-3 border border-gray-300 bg-gray-50">Ship To</th>
                                            <th className="p-3 border border-gray-300 bg-gray-50">Status</th>
                                            <th className="p-3 border border-gray-300 bg-blue-50 text-blue-800">Staging By</th>
                                            <th className="p-3 border border-gray-300 bg-blue-50 text-blue-800">Started At</th>
                                            <th className="p-3 border border-gray-300 bg-orange-50 text-orange-800">Loading By</th>
                                            <th className="p-3 border border-gray-300 bg-orange-50 text-orange-800">Started At</th>
                                            <th className="p-3 border border-gray-300 bg-green-50 text-green-800">Completed By</th>
                                            <th className="p-3 border border-gray-300 bg-green-50 text-green-800">Completed At</th>
                                            <th className="p-3 border border-gray-300 bg-gray-50 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {sheets.filter(s => JSON.stringify(s).toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                                            <tr key={s.id} onClick={() => onViewSheet(s)} className="hover:bg-blue-50 transition cursor-pointer group">
                                                <td className="p-2 border border-gray-200 font-mono text-blue-600 font-bold whitespace-nowrap">{s.id}</td>
                                                <td className="p-2 border border-gray-200 whitespace-nowrap">{s.date}</td>
                                                <td className="p-2 border border-gray-200 whitespace-nowrap">{s.shift}</td>
                                                <td className="p-2 border border-gray-200 max-w-[150px] truncate" title={s.destination}>{s.destination}</td>
                                                <td className="p-2 border border-gray-200 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border
                                                            ${s.status === 'LOCKED' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                            s.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                {/* Staging Info */}
                                                <td className="p-2 border border-gray-200">
                                                    <div className="font-semibold">{s.supervisorName}</div>
                                                    <div className="text-[10px] text-gray-500">{s.createdBy}</div>
                                                </td>
                                                <td className="p-2 border border-gray-200 whitespace-nowrap text-gray-600">{formatDate(s.createdAt)}</td>

                                                {/* Loading Info */}
                                                <td className="p-2 border border-gray-200">
                                                    <div className="font-semibold">{s.loadingSvName || '-'}</div>
                                                    {s.lockedBy && <div className="text-[10px] text-gray-500">{s.lockedBy}</div>}
                                                </td>
                                                <td className="p-2 border border-gray-200 whitespace-nowrap text-gray-600">{formatDate(s.lockedAt)}</td>

                                                {/* Completion Info */}
                                                <td className="p-2 border border-gray-200 font-semibold">{s.completedBy || '-'}</td>
                                                <td className="p-2 border border-gray-200 whitespace-nowrap text-gray-600">{formatDate(s.completedAt)}</td>

                                                <td className="p-2 border border-gray-200 text-center">
                                                    <button onClick={(e) => { e.stopPropagation(); deleteSheet(s.id, 'Admin Delete'); }} className="text-gray-400 hover:text-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
            {/* Header Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex gap-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <LayoutDashboard size={18} /> Overview
                </button>
                <button
                    onClick={() => setActiveTab('tracking')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'tracking' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Activity size={18} /> Tracking
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'} relative`}
                >
                    <UserIcon size={18} /> User Access
                    {analytics.pendingUsersCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>}
                </button>
                <button
                    onClick={() => setActiveTab('database')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'database' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Database size={18} /> Database
                </button>
            </div>

            {/* Main Content Area */}
            {renderContent()}

            {/* Modals (Create User / Reset Password) */}
            {isCreateUserOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><UserPlus size={18} className="text-blue-600" /> New User</h3>
                            <button onClick={() => setCreateUserOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Username</label><input required className="w-full mt-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Full Name</label><input required className="w-full mt-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Emp Code</label><input required className="w-full mt-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.empCode} onChange={e => setNewUser({ ...newUser, empCode: e.target.value })} /></div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                                <select className="w-full mt-1 px-4 py-2 border rounded-lg text-sm bg-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}>
                                    <option value={Role.STAGING_SUPERVISOR}>Staging Supervisor</option>
                                    <option value={Role.LOADING_SUPERVISOR}>Loading Supervisor</option>
                                    <option value={Role.ADMIN}>Administrator</option>
                                    <option value={Role.VIEWER}>Viewer</option>
                                </select>
                            </div>
                            <div className="pt-2"><button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-transform active:scale-95">Create Account</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isResetPasswordOpen && resetData && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Key size={18} className="text-orange-600" /> Reset Password</h3>
                            <button onClick={() => setResetPasswordOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">Access for <span className="font-bold text-gray-900">{resetData.username}</span></p>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">New Password</label>
                                <input required type="text" className="w-full mt-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" value={resetData.newPass} onChange={e => setResetData({ ...resetData, newPass: e.target.value })} />
                            </div>
                            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-transform active:scale-95">Update Password</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
