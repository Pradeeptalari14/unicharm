
import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { AdminDashboard } from './components/AdminDashboard';
import { StagingSheet } from './components/StagingSheet';
import { LoadingSheet } from './components/LoadingSheet';
import { StagingOverview, LoadingOverview } from './components/DashboardOverviews';
import { Role, SheetStatus, SheetData } from './types';
import { PlusCircle, Search, Edit3, Eye, Lock, Printer, XCircle } from 'lucide-react';

const App = () => {
    const { currentUser, users, sheets } = useApp();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [openInPreviewMode, setOpenInPreviewMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    if (!currentUser) {
        return <Auth />;
    }

    // --- STATS CALCULATION (Shared) ---
    const stats = useMemo(() => {
        if (!sheets || !users) return { draft: 0, locked: 0, createdToday: 0, completedToday: 0, stagingStaff: 0, loadingStaff: 0 };

        const todayStr = new Date().toISOString().split('T')[0];
        return {
            draft: sheets.filter(s => s.status === SheetStatus.DRAFT).length,
            locked: sheets.filter(s => s.status === SheetStatus.LOCKED).length,
            createdToday: sheets.filter(s => s.date === todayStr).length,
            completedToday: sheets.filter(s => s.status === SheetStatus.COMPLETED && s.date === todayStr).length,
            stagingStaff: users.filter(u => u.role === Role.STAGING_SUPERVISOR && u.isApproved).length,
            loadingStaff: users.filter(u => u.role === Role.LOADING_SUPERVISOR && u.isApproved).length
        };
    }, [sheets, users]);


    const activeSheet = selectedSheetId ? sheets.find(s => s.id === selectedSheetId) : null;

    const handleNavigate = (page: string) => {
        setCurrentPage(page);
        setSelectedSheetId(null);
        setIsCreatingNew(false);
        setIsEditing(false);
        setOpenInPreviewMode(false);
        setStatusFilter(null); // Reset filter on nav
    };

    const handleSwitchToOverview = (filterType: string) => {
        if (filterType.startsWith('STAFF')) {
            // If we had a staff view we'd go there, for now just clear filter
            alert(`Active Staff: ${filterType === 'STAFF_STAGING' ? stats.stagingStaff : stats.loadingStaff}`);
            return;
        }
        setStatusFilter(filterType);
    };

    const handleCreateSheet = () => {
        setSelectedSheetId(null);
        setIsCreatingNew(true);
        setIsEditing(true);
        setOpenInPreviewMode(false);
        setCurrentPage('staging-editor');
    };

    const handleViewSheet = (sheet: SheetData, source?: string) => {
        setSelectedSheetId(sheet.id);
        setIsCreatingNew(false);
        setIsEditing(true);
        setOpenInPreviewMode(false);

        if (source === 'staging') {
            setCurrentPage('staging-editor');
            return;
        }

        if (sheet.status === SheetStatus.DRAFT) {
            setCurrentPage('staging-editor');
        } else {
            setCurrentPage('loading-editor');
        }
    };

    const handlePrintSheet = (e: React.MouseEvent, sheet: SheetData) => {
        e.stopPropagation();
        setSelectedSheetId(sheet.id);
        setIsCreatingNew(false);
        setIsEditing(true);
        setOpenInPreviewMode(true);
        setCurrentPage('loading-editor');
    };

    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard':
                return <AdminDashboard viewMode="analytics" onViewSheet={(s) => handleViewSheet(s)} onNavigate={handleNavigate} />;

            case 'admin':
                return <AdminDashboard viewMode="users" onViewSheet={(s) => handleViewSheet(s)} />;

            case 'database':
                return <AdminDashboard viewMode="database" onViewSheet={(s) => handleViewSheet(s)} />;

            case 'staging-editor':
                return <StagingSheet
                    key={isCreatingNew ? 'new' : activeSheet?.id}
                    existingSheet={isCreatingNew ? undefined : activeSheet || undefined}
                    onCancel={() => handleNavigate('staging')}
                    onLock={(updatedSheet) => { handleNavigate('staging'); }}
                    initialPreview={openInPreviewMode}
                />;

            case 'loading-editor':
                if (!activeSheet) return <div>Error loading sheet data. Please try again.</div>;
                return <LoadingSheet
                    key={activeSheet.id}
                    sheet={activeSheet}
                    onClose={() => handleNavigate('loading')}
                    initialPreview={openInPreviewMode}
                />;

            case 'staging':
            case 'loading':
                const isStagingView = currentPage === 'staging';
                const filteredSheets = sheets.filter(s => {
                    const matchesSearch = s.id.includes(searchTerm) || s.supervisorName.toLowerCase().includes(searchTerm.toLowerCase());

                    // Apply Status/Date Filter from Clickable Cards
                    if (statusFilter) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        if (statusFilter === 'DRAFT' && s.status !== SheetStatus.DRAFT) return false;
                        if (statusFilter === 'LOCKED' && s.status !== SheetStatus.LOCKED) return false;
                        if (statusFilter === 'TODAY_CREATED' && s.date !== todayStr) return false;
                        if (statusFilter === 'TODAY_COMPLETED' && (s.status !== SheetStatus.COMPLETED || s.date !== todayStr)) return false;
                    }

                    if (isStagingView) {
                        return matchesSearch;
                    } else {
                        return matchesSearch && (s.status === SheetStatus.LOCKED || s.status === SheetStatus.COMPLETED);
                    }
                });

                return (
                    <div className="space-y-6">
                        {/* ROLE BASED OVERVIEWS */}
                        {isStagingView ? (
                            <StagingOverview stats={stats} onNavigate={handleSwitchToOverview} />
                        ) : (
                            <LoadingOverview stats={stats} onNavigate={handleSwitchToOverview} />
                        )}

                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                            <div className="relative w-full md:w-96 flex">
                                {statusFilter && (
                                    <button onClick={() => setStatusFilter(null)} className="mr-2 text-red-500 hover:text-red-700 whitespace-nowrap text-xs font-bold flex items-center gap-1">
                                        <XCircle size={16} /> Clear "{statusFilter}"
                                    </button>
                                )}
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pl-8 pointer-events-none"></div>
                                <input
                                    type="text"
                                    placeholder="Search by Sheet ID or Supervisor..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {isStagingView && (currentUser.role === Role.ADMIN || currentUser.role === Role.STAGING_SUPERVISOR) && (
                                <button
                                    onClick={handleCreateSheet}
                                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium shadow-lg shadow-blue-500/30 transition-all"
                                >
                                    <PlusCircle size={20} /> New Staging Sheet
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Sheet ID</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Shift</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Dock/Dest</th>
                                        <th className="p-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSheets.map(sheet => (
                                        <tr key={sheet.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => handleViewSheet(sheet, currentPage)}>
                                            <td className="p-4 font-mono font-medium text-blue-600">{sheet.id}</td>
                                            <td className="p-4 text-slate-600">{sheet.date}</td>
                                            <td className="p-4 text-slate-600">{sheet.shift}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                                                ${sheet.status === SheetStatus.DRAFT ? 'bg-slate-100 text-slate-600' :
                                                        sheet.status === SheetStatus.LOCKED ? 'bg-orange-100 text-orange-600' :
                                                            'bg-green-100 text-green-600'}`}>
                                                    {sheet.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600 font-medium">{sheet.loadingDockNo || sheet.destination || '-'}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="View/Edit">
                                                        {sheet.status === SheetStatus.DRAFT ? <Edit3 size={18} /> :
                                                            (sheet.status === SheetStatus.LOCKED && !isStagingView) ? <Lock size={18} /> : <Eye size={18} />}
                                                    </button>
                                                    {/* Add Printer Icon for Completed Loading Sheets */}
                                                    {!isStagingView && sheet.status === SheetStatus.COMPLETED && (
                                                        <button
                                                            className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                                                            title="Print Preview"
                                                            onClick={(e) => handlePrintSheet(e, sheet)}
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSheets.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No sheets found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            case 'audit':
                return <AdminDashboard viewMode="analytics" onViewSheet={(s) => handleViewSheet(s)} />; // Simplified reused view for audit demo

            default:
                return <div>Page Not Found</div>;
        }
    };

    return (
        <Layout currentPage={currentPage} onNavigate={handleNavigate}>
            {renderContent()}
        </Layout>
    );
};

export default App;
