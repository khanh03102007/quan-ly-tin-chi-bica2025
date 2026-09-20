import React from 'react';
import {
  GraduationCap,
  Database,
  User as UserIcon,
  LogOut,
  LogIn,
  RefreshCw,
  Sparkles,
  Wifi
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { StudentProfile } from '../types';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: User | null;
  profile: StudentProfile;
  isSupabaseLive: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  user,
  profile,
  isSupabaseLive,
  onOpenAuth,
  onSignOut,
  onRefreshData,
  isRefreshing,
}) => {
  const tabs = [
    { id: 'profile', label: 'Hồ Sơ & Tổng Quan' },
    { id: 'courses', label: 'Điểm Số & Tín Chỉ' },
    { id: 'what-if', label: 'Điểm số & What-if', badge: 'Dự Báo' },
    { id: 'schedule', label: 'Thời Khóa Biểu' },
    { id: 'tuition', label: 'Hồ Sơ Học Phí' },
    { id: 'support', label: 'Hỗ Trợ Sự Cố' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-2">
          {/* Logo & Institution */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  BICA 2025 PORTAL
                </span>
                <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-md border border-blue-200">
                  Khóa 2025
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Hệ Thống Theo Dõi Tín Chỉ & Quản Lý Đào Tạo Sinh Viên
              </p>
            </div>
          </div>

          {/* Right Actions: Supabase Status, Sync, and Auth */}
          <div className="flex items-center space-x-3">
            {/* Supabase connection indicator */}
            <div
              className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                user && isSupabaseLive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title="Trạng thái tài khoản và kết nối"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    user && isSupabaseLive
                      ? 'bg-emerald-500 animate-pulse'
                      : user
                      ? 'bg-blue-500'
                      : 'bg-amber-400'
                  }`}
                />
                {user ? (isSupabaseLive ? 'Supabase Trực Tiếp' : 'Đã đăng nhập') : 'Chế độ khách'}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              id="btn-refresh-data"
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Làm mới dữ liệu từ Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Auth / User info */}
            {user ? (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 pl-3 pr-2 py-1 rounded-lg">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800 leading-none">
                    {profile.ho_va_ten || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {profile.ma_sinh_vien}
                  </span>
                </div>
                <button
                  id="btn-signout"
                  onClick={onSignOut}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-open-auth"
                onClick={onOpenAuth}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập / Đăng Ký</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-100 pt-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 flex items-center space-x-1.5 ${
                  isActive
                    ? tab.id === 'what-if'
                      ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                      : 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-purple-200 text-purple-800'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
