
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Check, X, Clipboard, Truck, Users as UserIcon, Trash2, ShieldAlert, Activity, Search, UserCheck, UserX, UserPlus, Key, Database } from 'lucide-react';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'data';
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ viewMode, onViewSheet, onNavigate }) => {
  const { users, approveUser, sheets, auditLogs, deleteSheet, register, resetPassword, currentUser } = useApp();
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

  // Stats Logic
  const totalSheets = sheets.length;
  const completed = sheets.filter(s => s.status === SheetStatus.COMPLETED).length;
  const locked = sheets.filter(s => s.status === SheetStatus.LOCKED).length;
  const draft = sheets.filter(s => s.status === SheetStatus.DRAFT).length;
  
  const barData = [
    { name: 'Completed', count: completed },
    { name: 'Locked (Ready)', count: locked },
    { name: 'Drafts', count: draft }
  ];

  const pieData = [
      { name: 'Draft', value: draft, color: '#94a3b8' },
      { name: 'Locked', value: locked, color: '#f97316' },
      { name: 'Completed', value: completed, color: '#22c55e' }
  ];

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    const reason = prompt("Enter reason for deletion:");
    if (reason) {
        deleteSheet(id, reason);
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

  const handleCreateUserSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUser.username || !newUser.password || !newUser.fullName || !newUser.empCode) {
          alert("All fields are required");
          return;
      }

      register({
          id: Date.now().toString(),
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

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetData && resetData.newPass) {
        resetPassword(resetData.id, resetData.newPass);
        alert(`Password for ${resetData.username} has been reset.`);
        setResetPasswordOpen(false);
        setResetData(null);
    }
  };

  const isAdmin = currentUser?.role === Role.ADMIN;

  // --- VIEW 1: ANALYTICS DASHBOARD (Monitoring) ---
  if (viewMode === 'analytics') {
      return (
          <div className="space-y-6">
              {/* KPIs */}
              <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                  <div 
                    onClick={() => onNavigate?.('staging')}
                    className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                  >
                      <div>
                          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider group-hover:text-blue-600 transition-colors">Total Sheets</p>
                          <p className="text-2xl font-bold text-gray-800">{totalSheets}</p>
                      </div>
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors"><Clipboard size={20}/></div>
                  </div>
                  <div 
                    onClick={() => onNavigate?.('loading')}
                    className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-orange-200 transition-all group"
                  >
                      <div>
                          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider group-hover:text-orange-600 transition-colors">Active Loading</p>
                          <p className="text-2xl font-bold text-orange-600">{locked}</p>
                      </div>
                      <div className="p-3 bg-orange-50 text-orange-600 rounded-full group-hover:bg-orange-600 group-hover:text-white transition-colors"><Truck size={20}/></div>
                  </div>
                  <div 
                    onClick={() => onNavigate?.('loading')}
                    className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-green-200 transition-all group"
                  >
                      <div>
                          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider group-hover:text-green-600 transition-colors">Completed</p>
                          <p className="text-2xl font-bold text-green-600">{completed}</p>
                      </div>
                      <div className="p-3 bg-green-50 text-green-600 rounded-full group-hover:bg-green-600 group-hover:text-white transition-colors"><Check size={20}/></div>
                  </div>
                  {isAdmin && (
                      <div 
                        onClick={() => onNavigate?.('admin')}
                        className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-purple-200 transition-all group"
                      >
                          <div>
                              <p className="text-gray-500 text-xs uppercase font-bold tracking-wider group-hover:text-purple-600 transition-colors">Pending Users</p>
                              <p className="text-2xl font-bold text-purple-600">{users.filter(u => !u.isApproved).length}</p>
                          </div>
                          <div className="p-3 bg-purple-50 text-purple-600 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors"><UserIcon size={20}/></div>
                      </div>
                  )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Chart */}
                  <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold mb-6 text-gray-800">Operational Volume</h3>
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={barData}>
                                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={50} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Status Distribution */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold mb-2 text-gray-800">Status Ratio</h3>
                      <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                      {pieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend verticalAlign="bottom" height={36}/>
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="mt-4 space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase">System Health</h4>
                          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                              <Activity size={16} /> All Systems Operational
                          </div>
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
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                      >
                          <UserPlus size={16} /> Add User
                      </button>
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <input 
                              type="text" 
                              placeholder="Search users..." 
                              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                          />
                      </div>
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                          <tr>
                              <th className="p-3 rounded-tl-lg">User</th>
                              <th className="p-3">Full Name</th>
                              <th className="p-3">Role</th>
                              <th className="p-3">Email</th>
                              <th className="p-3 text-center">Status</th>
                              <th className="p-3 text-center rounded-tr-lg w-40">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {users
                            .filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) || (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase())))
                            .sort((a, b) => (a.isApproved === b.isApproved) ? 0 : a.isApproved ? 1 : -1) // Pending first
                            .map(user => (
                              <tr key={user.id} className={`hover:bg-gray-50 transition ${!user.isApproved ? 'bg-orange-50/50' : ''}`}>
                                  <td className="p-3 font-medium text-gray-900">{user.username}</td>
                                  <td className="p-3 text-gray-700">{user.fullName || '-'}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                                        {user.role}
                                    </span>
                                  </td>
                                  <td className="p-3 text-gray-500">{user.email || 'N/A'}</td>
                                  <td className="p-3 text-center">
                                      {user.isApproved ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                              <Check size={12} /> Active
                                          </span>
                                      ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 animate-pulse">
                                              <ShieldAlert size={12} /> Pending
                                          </span>
                                      )}
                                  </td>
                                  <td className="p-3 text-center">
                                      {!user.isApproved ? (
                                          <div className="flex justify-center gap-2">
                                              <button 
                                                onClick={(e) => handleApprove(e, user.id)}
                                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded shadow-sm transition-colors text-xs font-bold"
                                                title="Approve"
                                              >
                                                  Approve
                                              </button>
                                              <button 
                                                onClick={(e) => handleReject(e, user.id)}
                                                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded shadow-sm transition-colors text-xs font-bold"
                                                title="Reject"
                                              >
                                                  Reject
                                              </button>
                                          </div>
                                      ) : (
                                          <button 
                                            onClick={(e) => openResetPassword(e, user)}
                                            className="text-gray-400 hover:text-blue-600 p-2 rounded transition-colors"
                                            title="Reset Password"
                                          >
                                            <Key size={16} />
                                          </button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                          {users.length === 0 && (
                              <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">No users found.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
          
           {/* Create User Modal */}
          {isCreateUserOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                          <h3 className="font-bold text-gray-700 flex items-center gap-2"><UserPlus size={18} className="text-blue-600"/> Create New User</h3>
                          <button onClick={() => setCreateUserOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4">
                          <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Username</label>
                              <input 
                                  type="text" 
                                  required
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter username"
                                  value={newUser.username}
                                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                              />
                          </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                              <input 
                                  type="text" 
                                  required
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter full name"
                                  value={newUser.fullName}
                                  onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Employee Code</label>
                              <input 
                                  type="text" 
                                  required
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter employee code"
                                  value={newUser.empCode}
                                  onChange={e => setNewUser({...newUser, empCode: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                              <input 
                                  type="email" 
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter email address"
                                  value={newUser.email}
                                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                              <input 
                                  type="password" 
                                  required
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter password"
                                  value={newUser.password}
                                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
                              <select 
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  value={newUser.role}
                                  onChange={e => setNewUser({...newUser, role: e.target.value as Role})}
                              >
                                  <option value={Role.STAGING_SUPERVISOR}>Staging Supervisor</option>
                                  <option value={Role.LOADING_SUPERVISOR}>Loading Supervisor</option>
                                  <option value={Role.ADMIN}>Administrator</option>
                                  <option value={Role.VIEWER}>Viewer</option>
                              </select>
                          </div>
                          <div className="pt-2">
                              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-all active:scale-[0.98]">
                                  Create User
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          )}

          {/* Reset Password Modal (Admin) */}
          {isResetPasswordOpen && resetData && (
               <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                          <h3 className="font-bold text-gray-700 flex items-center gap-2"><Key size={18} className="text-orange-600"/> Reset Password</h3>
                          <button onClick={() => setResetPasswordOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                          <div>
                              <p className="text-sm text-gray-600 mb-2">Resetting password for: <span className="font-bold text-gray-900">{resetData.username}</span></p>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
                              <input 
                                  type="text" // Visible text for admin to see what they set
                                  required
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                  placeholder="Enter new password"
                                  value={resetData.newPass}
                                  onChange={e => setResetData({...resetData, newPass: e.target.value})}
                              />
                          </div>
                          <div className="pt-2">
                              <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-all active:scale-[0.98]">
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

  // --- VIEW 3: DATA PANEL ---
  if (viewMode === 'data') {
      return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <Database className="text-blue-600" /> Data Management
                  </h2>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                          type="text" 
                          placeholder="Search sheets..." 
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                          <tr>
                              <th className="p-3 rounded-tl-lg">Sheet ID</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Dock/Dest</th>
                              <th className="p-3">Transporter</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Supervisor</th>
                              <th className="p-3 text-center rounded-tr-lg w-24">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {sheets
                              .filter(s => s.id.includes(searchTerm) || s.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(s => (
                              <tr key={s.id} onClick={() => onViewSheet(s)} className="hover:bg-gray-50 transition cursor-pointer">
                                  <td className="p-3 font-mono font-medium text-blue-600">{s.id}</td>
                                  <td className="p-3 text-gray-500">{s.date}</td>
                                  <td className="p-3 text-gray-700 font-medium">{s.loadingDockNo || s.destination || '-'}</td>
                                  <td className="p-3 text-gray-500">{s.transporter || '-'}</td>
                                  <td className="p-3">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                        ${s.status === 'LOCKED' ? 'bg-orange-100 text-orange-800' : 
                                          s.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                                          'bg-gray-100 text-gray-600'}`}>
                                        {s.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-gray-700">{s.supervisorName}</td>
                                  <td className="p-3 text-center">
                                      <button 
                                        onClick={(e) => handleDelete(e, s.id)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                                        title="Delete Sheet"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {sheets.length === 0 && (
                              <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic">No records found.</td></tr>
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
