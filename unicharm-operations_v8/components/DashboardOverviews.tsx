
import React from 'react';
import { Clipboard, Truck, Check, Users as UserIcon } from 'lucide-react';

interface OverviewProps {
    stats: {
        draft: number;
        createdToday: number;
        stagingStaff: number;
        locked: number;
        completedToday: number;
        loadingStaff: number;
    };
    onNavigate: (filter: string) => void;
}

export const StagingOverview: React.FC<OverviewProps> = ({ stats, onNavigate }) => {
    return (
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Clipboard size={18} /></div>
                <h3 className="font-bold text-slate-700">Staging Overview</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div
                    onClick={() => onNavigate('DRAFT')}
                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                    <p className="text-[10px] uppercase font-bold text-slate-400">Drafts</p>
                    <p className="text-xl font-bold text-slate-800">{stats.draft}</p>
                </div>
                <div
                    onClick={() => onNavigate('TODAY_CREATED')}
                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                    <p className="text-[10px] uppercase font-bold text-slate-400">New Today</p>
                    <p className="text-xl font-bold text-slate-800">{stats.createdToday}</p>
                </div>
                <div
                    onClick={() => onNavigate('STAFF_STAGING')}
                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                    <p className="text-[10px] uppercase font-bold text-slate-400">Staff</p>
                    <p className="text-xl font-bold text-slate-800">{stats.stagingStaff}</p>
                </div>
            </div>
        </div>
    );
};

export const LoadingOverview: React.FC<OverviewProps> = ({ stats, onNavigate }) => {
    return (
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Truck size={18} /></div>
                <h3 className="font-bold text-slate-700">Loading Overview</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div
                    onClick={() => onNavigate('LOCKED')}
                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                    <p className="text-[10px] uppercase font-bold text-slate-400">Active</p>
                    <p className="text-xl font-bold text-slate-800">{stats.locked}</p>
                </div>
                <div
                    onClick={() => onNavigate('TODAY_COMPLETED')}
                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                    <p className="text-[10px] uppercase font-bold text-slate-400">Done Today</p>
                    <p className="text-xl font-bold text-slate-800">{stats.completedToday}</p>
                </div>
                <div
                    onClick={() => onNavigate('STAFF_LOADING')}
                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all active:scale-95"
                >
                    <p className="text-[10px] uppercase font-bold text-slate-400">Staff</p>
                    <p className="text-xl font-bold text-slate-800">{stats.loadingStaff}</p>
                </div>
            </div>
        </div>
    );
};
