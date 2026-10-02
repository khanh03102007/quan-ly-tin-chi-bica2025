import React from 'react';
import {
  GraduationCap,
  Database,
  User as UserIcon,
  LogOut,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Globe,
  DoorOpen,
  Sun,
  Moon
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { StudentProfile } from '../types';
import { AnimatedBicaLogo } from './AnimatedBicaLogo';

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
  unreadRemindersCount?: number;
  isTeacherActive?: boolean;
  portalSession?: {
    role: 'student' | 'teacher';
    name: string;
    studentId?: string;
    email: string;
  } | null;
  onGatewayLogout?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
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
  unreadRemindersCount = 0,
  isTeacherActive = false,
  portalSession = null,
  onGatewayLogout,
  isDarkMode = false,
  onToggleTheme,
}) => {
  const tabs = [
    { id: 'profile', label: 'Hồ Sơ Sinh Viên', unread: unreadRemindersCount },
    { id: 'courses', label: 'Bảng Điểm & Tín Chỉ' },
    { id: 'what-if', label: 'Dự Báo GPA (What-If)' },
    { id: 'schedule', label: 'Thời Khóa Biểu' },
    { id: 'study-portal', label: 'Minh Chứng & Rèn Luyện' },
    { id: 'tuition', label: 'Học Phí & Công Nợ' },
    { id: 'teacher', label: 'Cổng Cố Vấn / Khoa', teacherBadge: isTeacherActive ? 'Đã kích hoạt' : undefined },
    { id: 'support', label: 'Hỗ Trợ Học Vụ' },
  ];

  return (
    <header className="bg-white dark:bg-[#1b1c21] border-b border-slate-200 dark:border-[#2a2d36] sticky top-0 z-40 shadow-xs">
      {/* Top Institutional Micro-bar */}
      <div className="bg-slate-900 dark:bg-[#101114] text-slate-300 dark:text-[#b4b9c4] text-[11px] font-medium border-b border-slate-800 dark:border-[#22242c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <span className="text-white dark:text-[#eaecef] font-semibold tracking-wide">
              ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC VIỆT NHẬT (VJU)
            </span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-slate-400 dark:text-[#8b92a0] hidden md:inline">
              CHƯƠNG TRÌNH KỸ THUẬT ĐIỀU KHIỂN THÔNG MINH & TỰ ĐỘNG HÓA (BICA)
            </span>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <span className="hidden sm:inline-flex items-center space-x-1 font-mono text-[10px] text-slate-400 dark:text-[#a8b0bd] bg-slate-800/80 dark:bg-[#1c1e24] px-2 py-0.5 rounded border border-slate-700/60 dark:border-[#2d3039]">
              <Globe className="w-3 h-3 text-blue-400 dark:text-[#7ca2d1]" />
              <span>sv02.bica-vju.com</span>
            </span>
            <span className="text-slate-400 dark:text-[#9ea4b0]">Niên khóa: 2025 - 2029</span>
          </div>
        </div>
      </div>

      {/* Main Brand & Action Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Identity */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('profile')}>
            <div className="w-11 h-11 rounded-xl bg-slate-950 dark:bg-[#23252c] border border-cyan-500/40 dark:border-[#343844] flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative">
              <AnimatedBicaLogo size="sm" showText={false} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 dark:text-[#eaecef] text-base sm:text-lg tracking-tight">
                  CỔNG THÔNG TIN HỌC VỤ BICA
                </span>
                <span className="bg-cyan-50 dark:bg-[#242e3d] text-cyan-800 dark:text-[#88aedb] text-[11px] font-bold px-2 py-0.5 rounded border border-cyan-200 dark:border-[#34455c] font-mono">
                  K2025
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#828896] font-medium hidden sm:block">
                Điều Khiển Thông Minh & Tự Động Hóa — Đại Học Việt Nhật
              </p>
            </div>
          </div>

          {/* Right System Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Database status pill */}
            <div
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                (user || portalSession) && isSupabaseLive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title="Trạng thái đồng bộ cơ sở dữ liệu học vụ"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px]">
                {portalSession || user ? (isSupabaseLive ? 'CSDL Trực Tuyến' : 'Đã Xác Thực') : 'Chưa đăng nhập'}
              </span>
            </div>

            {/* Sync refresh button */}
            <button
              id="btn-refresh-data"
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors border border-slate-200"
              title="Làm mới dữ liệu từ máy chủ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Dark Mode toggle button */}
            {onToggleTheme && (
              <button
                id="btn-toggle-dark-mode"
                type="button"
                onClick={onToggleTheme}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all border border-slate-200 dark:border-[#343844] bg-white dark:bg-[#23252c] hover:bg-slate-100 dark:hover:bg-[#2c2f38] text-slate-700 dark:text-[#e6e8ec] flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title={isDarkMode ? 'Chuyển sang Chế độ Sáng (Light Mode)' : 'Chuyển sang Chế độ Tối (Dark Mode)'}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#d6b472]" />
                    <span className="hidden sm:inline font-semibold">Chế độ Sáng</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline font-semibold">Chế độ Tối</span>
                  </>
                )}
              </button>
            )}

            {/* Authentication & User session */}
            {portalSession ? (
              <div className="flex items-center space-x-2.5">
                {portalSession.role === 'teacher' ? (
                  <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-200 pl-3 pr-1.5 py-1 rounded-lg">
                    <div className="flex flex-col text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Chủ nhiệm ngành
                        </span>
                        <span className="text-xs font-bold text-indigo-950 leading-tight">
                          {portalSession.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-700 font-medium">
                        Cố vấn / Khoa BICA
                      </span>
                    </div>
                    {onGatewayLogout && (
                      <button
                        onClick={onGatewayLogout}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Đăng xuất / Khóa cổng để chuyển đổi vai trò"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 pl-3 pr-1.5 py-1 rounded-lg">
                    <div className="flex flex-col text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Sinh viên
                        </span>
                        <span className="text-xs font-bold text-slate-800 leading-tight">
                          {portalSession.name || profile.ho_va_ten}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {portalSession.studentId || profile.ma_sinh_vien} • {profile.lop || 'BICA-K2025'}
                      </span>
                    </div>
                    {onGatewayLogout && (
                      <button
                        onClick={onGatewayLogout}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Đăng xuất / Khóa cổng để chuyển đổi vai trò"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : user ? (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 pl-3 pr-1.5 py-1 rounded-md">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {profile.ho_va_ten || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {profile.ma_sinh_vien} • {profile.lop || 'BICA-K2025'}
                  </span>
                </div>
                <button
                  id="btn-signout"
                  onClick={onSignOut}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Đăng xuất khỏi phiên làm việc"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="btn-open-auth"
                onClick={onOpenAuth}
                className="inline-flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition-colors shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập SV</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Clean, Functional University Standard */}
        <nav className="flex space-x-1 border-t border-slate-200 dark:border-[#282b34] pt-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap border-b-2 flex items-center space-x-1.5 cursor-pointer ${
                  isActive
                    ? 'border-blue-700 dark:border-[#6892c7] text-blue-700 dark:text-[#eaecef] bg-blue-50/60 dark:bg-[#23262f] font-semibold'
                    : 'border-transparent text-slate-600 dark:text-[#9ea4b0] hover:text-slate-900 dark:hover:text-[#e6e8ec] hover:bg-slate-50 dark:hover:bg-[#23252c]'
                }`}
              >
                <span>{tab.label}</span>
                {'unread' in tab && Number(tab.unread) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white font-mono">
                    {tab.unread}
                  </span>
                )}
                {'teacherBadge' in tab && tab.teacherBadge && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {tab.teacherBadge}
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
