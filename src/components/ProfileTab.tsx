import React, { useState, useEffect, useMemo } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  User,
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  Mail,
  Phone,
  CheckCircle2,
  Edit3,
  Save,
  X,
  Database,
  Building,
  Layers,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  LogIn,
  ShieldCheck,
  UserCheck,
  Calculator,
  Bell,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lock,
  Trash2
} from 'lucide-react';
import type { StudentProfile, StudentCourse } from '../types';
import {
  saveStudentProfile,
  SUPABASE_SQL_SCHEMA,
  computeAcademicMetricsFromCourses,
  deleteStudentReminder
} from '../lib/supabase';
import { calculateKnowledgeBlockStats } from '../data/bicaCurriculum';

interface ProfileTabProps {
  profile: StudentProfile;
  isSupabaseLive: boolean;
  user?: SupabaseUser | null;
  courses?: StudentCourse[];
  onProfileUpdated: () => void;
  onNavigateToSupabase?: () => void;
  onOpenAuth?: () => void;
  onNavigateToWhatIf?: () => void;
  onNavigateToTeacher?: () => void;
  onNavigateToStudyPortal?: () => void;
  onNavigateToCourses?: (blockFilter?: string) => void;
  reminders?: any[];
  onRefreshReminders?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  isSupabaseLive,
  user,
  courses = [],
  onProfileUpdated,
  onNavigateToSupabase,
  onOpenAuth,
  onNavigateToWhatIf,
  onNavigateToTeacher,
  onNavigateToStudyPortal,
  onNavigateToCourses,
  reminders = [],
  onRefreshReminders,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<StudentProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  const isAuthenticated = Boolean(
    user ||
      (profile?.ma_sinh_vien &&
        profile.ma_sinh_vien !== '---' &&
        profile.ma_sinh_vien !== 'CHƯA_ĐĂNG_NHẬP')
  );

  // Cập nhật form state khi profile hoặc user thay đổi
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  // Thống kê phân bổ 6 khối kiến thức chuẩn Khóa 2025 liên kết trực tiếp với dữ liệu tín chỉ
  const blockStats = useMemo(() => calculateKnowledgeBlockStats(courses), [courses]);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  // Tự động tính toán và đồng bộ Tín chỉ tích lũy, GPA từng học kỳ, CPA tích lũy và Xếp loại học lực từ Bảng điểm & Tín chỉ
  const academicMetrics = useMemo(
    () => computeAcademicMetricsFromCourses(courses),
    [courses]
  );

  const [selectedSemester, setSelectedSemester] = useState<string>(
    academicMetrics.latestSemesterLabel || 'Kỳ 2 năm 2025-2026'
  );
  const [isSemesterDropdownOpen, setIsSemesterDropdownOpen] = useState(false);
  const [deletingReminderId, setDeletingReminderId] = useState<string | null>(null);

  const handleDeleteReminder = async (reminderId: string) => {
    if (!reminderId) return;
    setDeletingReminderId(reminderId);
    try {
      await deleteStudentReminder(reminderId);
      if (onRefreshReminders) {
        onRefreshReminders();
      }
    } finally {
      setDeletingReminderId(null);
    }
  };

  // Khi dữ liệu môn học thay đổi, nếu học kỳ đang chọn chưa có điểm mà có học kỳ khác đã có điểm thì ưu tiên chọn kỳ mới nhất có điểm
  useEffect(() => {
    if (!academicMetrics.semesterList.includes(selectedSemester)) {
      setSelectedSemester(academicMetrics.latestSemesterLabel);
    }
  }, [academicMetrics, selectedSemester]);

  const currentSemesterSummary =
    academicMetrics.bySemester[selectedSemester] ||
    academicMetrics.bySemester[academicMetrics.latestSemesterLabel] || {
      semesterLabel: selectedSemester,
      gpa4: 0,
      gpa10: 0,
      gradedCredits: 0,
      passedCredits: 0,
      totalCredits: 0,
      courseCount: 0,
    };

  const credits = academicMetrics.accumulatedCredits;
  const totalCredits = profile.tong_tin_chi_yeu_cau ?? 145;
  const gpa = currentSemesterSummary.gpa4;
  const cpa = academicMetrics.cpa;
  const syncedAcademicRank = academicMetrics.academicRank;
  const completionPercent = Math.min(
    100,
    Math.round((credits / (totalCredits || 145)) * 100)
  );

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    // Khóa cứng mã sinh viên gốc và các chỉ số học vụ: Không cho phép đổi MSSV sang tài khoản sinh viên khác hoặc tự sửa điểm GPA/CPA
    const lockedStudentId =
      profile.ma_sinh_vien && profile.ma_sinh_vien !== '---' && profile.ma_sinh_vien !== 'CHƯA_ĐĂNG_NHẬP'
        ? profile.ma_sinh_vien
        : formData.ma_sinh_vien;
    const syncedPayload: StudentProfile = {
      ...formData,
      ma_sinh_vien: lockedStudentId,
      tong_tin_chi_tich_luy: academicMetrics.accumulatedCredits,
      diem_gpa: academicMetrics.latestSemesterGpa,
      diem_cpa: academicMetrics.cpa,
      xep_loai: academicMetrics.academicRank,
    };

    try {
      const res = await saveStudentProfile(syncedPayload, user);

      if (res.success) {
        setSaveStatus({
          type: 'success',
          message: 'Đã lưu và đồng bộ hồ sơ sinh viên lên Supabase thành công!',
        });
        setIsEditing(false);
        onProfileUpdated();
      } else if (res.isMissingTable) {
        setSaveStatus({
          type: 'warning',
          message: 'Hồ sơ đã được lưu cục bộ cho tài khoản của bạn!',
          details: "Dự án Supabase của bạn hiện chưa có bảng 'public.ho_so'. Hãy copy mã SQL bên dưới và dán vào Supabase Studio (SQL Editor) để kích hoạt đồng bộ đám mây.",
        });
        setIsEditing(false);
        onProfileUpdated();
      } else {
        setSaveStatus({
          type: 'error',
          message: `Lỗi lưu lên Supabase: ${res.error}`,
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: `Lỗi: ${err.message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Identity Card - Clean Academic Portal Style */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xl font-bold font-mono shrink-0 border border-slate-700">
              {isAuthenticated ? (
                profile.ho_va_ten?.charAt(0) || 'S'
              ) : (
                <User className="w-7 h-7 text-slate-300" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {isAuthenticated ? (profile.ho_va_ten || 'Sinh viên BICA') : 'Chưa đăng nhập'}
                </h1>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  isAuthenticated
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {isAuthenticated ? (profile.trang_thai_hoc_tap || 'Đang học') : 'Chưa đăng nhập'}
                </span>
                {(user?.email || profile?.email) && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                    {user?.email || profile.email}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span>MSSV: <strong className="font-mono text-slate-900">{isAuthenticated ? (profile.ma_sinh_vien || '---') : '---'}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Lớp: <strong className="text-slate-900">{isAuthenticated ? (profile.lop || 'BICA-K2025') : 'BICA-K2025'}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Niên khóa: <strong className="text-slate-900">{profile.nien_khoa || '2025 - 2029'}</strong></span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {profile.nganh_hoc || 'Kỹ thuật Điều khiển Thông minh và Tự động hóa (BICA)'} — Khoa Công nghệ và Kĩ thuật Tiên tiến, VJU
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-xs text-slate-700">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>{isAuthenticated && isSupabaseLive ? 'CSDL Máy chủ Kết nối' : 'Phiên bảo mật'}</span>
            </div>
            {isAuthenticated ? (
              <button
                id="btn-edit-profile"
                onClick={() => {
                  setFormData(profile);
                  setIsEditing(!isEditing);
                }}
                className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium px-3.5 py-1.5 rounded-md transition-colors shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>{isEditing ? 'Đóng form' : 'Sửa hồ sơ'}</span>
              </button>
            ) : (
              <button
                id="btn-login-profile-top"
                onClick={onOpenAuth}
                className="inline-flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition-colors shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập cổng</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Thông báo khi chưa đăng nhập */}
      {!isAuthenticated && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-amber-950">
                Bạn chưa đăng nhập vào hệ thống
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Dữ liệu cá nhân, bảng điểm và thời khóa biểu riêng sẽ chỉ hiển thị sau khi bạn đăng nhập tài khoản sinh viên.
              </p>
            </div>
          </div>
          <button
            id="btn-login-banner-cta"
            onClick={onOpenAuth}
            className="inline-flex items-center justify-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shrink-0 shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng Nhập Ngay</span>
          </button>
        </div>
      )}

      {saveStatus && (
        <div className={`p-4 rounded-2xl text-xs border ${
          saveStatus.type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : saveStatus.type === 'warning'
            ? 'bg-amber-50 text-amber-900 border-amber-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2.5">
              {saveStatus.type === 'warning' && (
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              {saveStatus.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              )}
              {saveStatus.type === 'error' && (
                <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">{saveStatus.message}</p>
                {saveStatus.details && (
                  <p className="mt-1 text-slate-600 leading-relaxed font-normal">{saveStatus.details}</p>
                )}
                {saveStatus.type === 'warning' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-colors"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'Đã Sao Chép SQL!' : 'Sao Chép Mã SQL Tạo Bảng'}</span>
                    </button>
                    {onNavigateToSupabase && (
                      <button
                        type="button"
                        onClick={onNavigateToSupabase}
                        className="inline-flex items-center space-x-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        <span>Mở Tab Supabase Console</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Form Modal/Drawer if editing */}
      {isEditing && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-base">Cập Nhật Thông Tin Hồ Sơ Sinh Viên Lên Supabase</h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mã sinh viên (MSSV - Khóa định danh)</label>
              <input
                type="text"
                required
                readOnly={Boolean(profile.ma_sinh_vien && profile.ma_sinh_vien !== '---')}
                value={formData.ma_sinh_vien}
                onChange={(e) => setFormData({ ...formData, ma_sinh_vien: e.target.value })}
                placeholder="VD: 25119001 hoặc BICA25119001"
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-semibold text-slate-700 cursor-not-allowed"
                title="Mã số sinh viên được khóa bảo mật theo tài khoản đăng nhập"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Họ và tên</label>
              <input
                type="text"
                required
                value={formData.ho_va_ten}
                onChange={(e) => setFormData({ ...formData, ho_va_ten: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Lớp sinh hoạt</label>
              <input
                type="text"
                value={formData.lop}
                onChange={(e) => setFormData({ ...formData, lop: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Ngành học</label>
              <input
                type="text"
                value={formData.nganh_hoc}
                onChange={(e) => setFormData({ ...formData, nganh_hoc: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Số điện thoại</label>
              <input
                type="text"
                value={formData.so_dien_thoai || ''}
                onChange={(e) => setFormData({ ...formData, so_dien_thoai: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              id="btn-save-profile-supabase"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu lên Supabase...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 4 Academic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tín chỉ tích lũy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tín Chỉ Tích Lũy
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {isAuthenticated ? credits : 0}
            </span>
            <span className="text-sm font-medium text-slate-500">
              / {totalCredits} TC
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${isAuthenticated ? completionPercent : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {isAuthenticated ? `Hoàn thành ${completionPercent}% chương trình cử nhân BICA` : 'Vui lòng đăng nhập để xem tiến độ'}
            </p>
          </div>
        </div>

        {/* Card 2: GPA Học Kỳ (Có thanh cuộn chọn học kỳ giống mẫu ảnh) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Điểm GPA Học Kỳ
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>

          {/* Thanh cuộn chọn học kỳ chuẩn mẫu ảnh (VD: Kỳ 2 năm 2025-2026 / Kỳ 1 năm 2025-2026) */}
          <div className="relative mb-2.5">
            <button
              type="button"
              onClick={() => setIsSemesterDropdownOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#1e222d] border border-slate-300 dark:border-[#363d4e] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-blue-400 transition-colors cursor-pointer shadow-2xs"
            >
              <span className="truncate">{selectedSemester}</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-150 shrink-0 ml-1.5 ${
                  isSemesterDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isSemesterDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-[#363d4e] rounded-xl shadow-lg z-30 max-h-44 overflow-y-auto py-1">
                {academicMetrics.semesterList.map((semLabel) => {
                  const semData = academicMetrics.bySemester[semLabel];
                  const isSelected = semLabel === selectedSemester;
                  return (
                    <button
                      key={semLabel}
                      type="button"
                      onClick={() => {
                        setSelectedSemester(semLabel);
                        setIsSemesterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/90 dark:bg-blue-950/50 text-slate-900 dark:text-white font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
                      }`}
                    >
                      <span>{semLabel}</span>
                      {semData?.gradedCredits > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {semData.gpa4.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {isAuthenticated && currentSemesterSummary.gradedCredits > 0 ? gpa.toFixed(2) : '---'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Hệ 4.0
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            {isAuthenticated && currentSemesterSummary.gradedCredits > 0
              ? `Hệ 10: ~${currentSemesterSummary.gpa10.toFixed(1)}/10 (${currentSemesterSummary.gradedCredits} TC có điểm)`
              : `Chưa có môn chấm điểm ở ${selectedSemester}`}
          </p>
        </div>

        {/* Card 3: CPA */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Điểm CPA Tích Lũy
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {isAuthenticated && academicMetrics.hasGradedCourses ? cpa.toFixed(2) : '---'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
              CPA
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-medium">
            {isAuthenticated && academicMetrics.hasGradedCourses
              ? 'Tự động đồng bộ từ toàn bộ học phần đã có điểm'
              : 'Chưa có dữ liệu điểm tích lũy'}
          </p>
        </div>

        {/* Card 4: Xếp loại */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Xếp Loại Học Lực
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {isAuthenticated ? syncedAcademicRank : 'Chưa xếp loại'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-medium">
            {isAuthenticated ? 'Tự động xếp loại theo CPA bảng điểm thực tế' : 'Đăng nhập để cập nhật xếp loại'}
          </p>
        </div>
      </div>

      {/* Lời nhắc nhở & Cảnh báo từ Chủ nhiệm ngành */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Lời Nhắc & Cảnh Báo Học Vụ Từ Chủ Nhiệm Ngành</span>
                {reminders.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {reminders.length} thông báo
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Chỉ đạo, nhắc nhở và rút kinh nghiệm học tập gửi đích thân sinh viên ({profile.ma_sinh_vien || 'BICA25119034'})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onRefreshReminders && (
              <button
                type="button"
                onClick={onRefreshReminders}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
                title="Làm mới lời nhắc"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cập nhật</span>
              </button>
            )}
          </div>
        </div>

        {reminders.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-xs">
            Hiện tại em không có cảnh báo hay nhắc nhở nào từ Chủ nhiệm ngành. Tiếp tục duy trì phong độ học tập tốt nhé!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reminders.map((rem: any) => {
              const isWarning = rem.loai_thong_bao === 'canh_bao';
              const isReward = rem.loai_thong_bao === 'khen_thuong';
              return (
                <div
                  key={rem.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isWarning
                      ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                      : isReward
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-blue-50/70 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">
                        {isWarning ? '⚠️' : isReward ? '🏆' : '📌'}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm leading-snug">
                        {rem.tieu_de}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono opacity-70 whitespace-nowrap">
                      {rem.ngay_tao || 'Gần đây'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed opacity-90">
                    {rem.noi_dung}
                  </p>

                  <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between gap-2 text-[11px] font-medium">
                    <div className="opacity-80 truncate">
                      <span>Người gửi: <strong className="font-semibold">{rem.nguoi_gui}</strong></span>
                      {rem.chuc_danh && <span className="ml-1">({rem.chuc_danh})</span>}
                    </div>
                    <button
                      type="button"
                      disabled={deletingReminderId === rem.id}
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200/80 hover:border-red-200 text-[11px] font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
                      title="Xóa lời nhắc này sau khi đã đọc xong"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{deletingReminderId === rem.id ? 'Đang xóa...' : 'Đã đọc & Xóa'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Access to Academic Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {onNavigateToWhatIf && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Dự Báo Điểm Học Vụ (What-If)</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mô phỏng điểm thi cuối kỳ, CPA mục tiêu ra trường
                </p>
              </div>
            </div>
            <button
              id="btn-nav-whatif-banner"
              onClick={onNavigateToWhatIf}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium rounded-md transition-colors shrink-0 shadow-2xs"
            >
              <span>Truy cập</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        )}

        {onNavigateToStudyPortal && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-indigo-700 text-white flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Minh Chứng Điểm Rèn Luyện (ĐRL)</h4>
                  <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded font-semibold">SV02</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nộp minh chứng hoạt động ngoại khóa, nghiên cứu khoa học
                </p>
              </div>
            </div>
            <button
              id="btn-nav-study-portal-banner"
              onClick={onNavigateToStudyPortal}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium rounded-md transition-colors shrink-0 shadow-2xs"
            >
              <span>Nộp hồ sơ</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        )}
      </div>

      {/* Detailed Student Information & Curriculum breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Details */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs lg:col-span-2">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
            <User className="w-4 h-4 text-blue-600" />
            <span>Thông Tin Chi Tiết Sinh Viên (Bảng ho_so)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Họ và tên</span>
              <span className="font-semibold text-slate-800 mt-0.5">{isAuthenticated ? profile.ho_va_ten : 'Chưa đăng nhập'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Mã số sinh viên (MSSV)</span>
              <span className="font-semibold font-mono text-blue-600 mt-0.5">{isAuthenticated ? profile.ma_sinh_vien : '---'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Lớp sinh hoạt</span>
              <span className="font-semibold text-slate-800 mt-0.5">{isAuthenticated ? profile.lop : 'BICA-K2025'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Khóa tuyển sinh</span>
              <span className="font-semibold text-slate-800 mt-0.5">{profile.nien_khoa || '2025 - 2029'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Ngành đào tạo</span>
              <span className="font-semibold text-slate-800 mt-0.5">{profile.nganh_hoc || 'Kỹ thuật Thông minh và Tự động hóa (BICA)'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Khoa / Viện phụ trách</span>
              <span className="font-semibold text-slate-800 mt-0.5">
                {(!profile.khoa ||
                  profile.khoa === 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)' ||
                  profile.khoa.includes('Hội tụ'))
                  ? 'Khoa Công nghệ và Kĩ thuật Tiên tiến'
                  : profile.khoa}
              </span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Email trường</span>
              <span className="font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {isAuthenticated ? (profile.email || user?.email) : 'Chưa đăng nhập'}
              </span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Số điện thoại liên hệ</span>
              <span className="font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {isAuthenticated ? (profile.so_dien_thoai || 'Chưa cập nhật') : '---'}
              </span>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="mt-4 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-blue-950 font-medium">
                Vui lòng đăng nhập bằng tài khoản sinh viên của bạn để xem và chỉnh sửa hồ sơ cá nhân.
              </span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center space-x-1 font-semibold text-blue-700 hover:text-blue-900 shrink-0"
              >
                <span>Đăng nhập ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Credit Breakdown & Graduation Progress */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Phân Bổ Tín Chỉ Khóa 2025</span>
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                145 TC Chuẩn
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Thống kê liên kết trực tiếp với dữ liệu điểm số & đăng ký tín chỉ của sinh viên
            </p>

            {/* Tổng quan tiến độ chung */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-4">
              <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                <span className="text-slate-700">Tổng tiến độ tích lũy:</span>
                <span className="font-bold text-blue-700 font-mono">
                  {credits} / {totalCredits} TC ({completionPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            {/* 6 Khối kiến thức chuẩn Khóa 2025 theo đúng danh mục ảnh mẫu */}
            <div className="space-y-3.5">
              {blockStats.map((stat) => {
                const isExpanded = expandedBlockId === stat.block.id;
                return (
                  <div
                    key={stat.block.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-[#313847] hover:border-slate-200 dark:hover:border-[#435169] bg-slate-50/60 dark:bg-[#212631] transition-all shadow-2xs"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedBlockId(isExpanded ? null : stat.block.id)}
                      title="Nhấn để xem chi tiết môn học trong khối này"
                    >
                      <div className="flex justify-between items-start text-xs font-semibold mb-1.5 gap-2">
                        <span className="text-slate-800 dark:text-[#eef0f4] leading-tight">
                          {stat.block.name}
                        </span>
                        <div className="flex items-center space-x-1 shrink-0 text-right">
                          <span className="font-bold text-indigo-700 dark:text-[#84b0e2] font-mono bg-indigo-50 dark:bg-[#1a2230] px-1.5 py-0.5 rounded border border-indigo-100 dark:border-[#2e3d54]">
                            {stat.totalPassedCredits} / {stat.block.targetCredits} TC
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Thanh phần trăm */}
                      <div className="w-full bg-slate-200 dark:bg-[#14171f] rounded-full h-2 mb-1.5 overflow-hidden border border-transparent dark:border-[#292f3d]">
                        <div
                          className={`${stat.block.barColor} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${stat.completionPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9ba3b2]">
                        <span>
                          Đạt <strong className="text-slate-800 dark:text-[#eaecef] font-semibold">{stat.completionPercent}%</strong> yêu cầu
                        </span>
                        {stat.totalInProgressCredits > 0 ? (
                          <span className="text-blue-600 dark:text-[#84b0e2] font-medium">
                            +{stat.totalInProgressCredits} TC đang học
                          </span>
                        ) : stat.registeredCourses.length > 0 ? (
                          <span className="text-emerald-700 dark:text-[#78c4a4] font-medium">
                            {stat.registeredCourses.length} môn đã đăng ký
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-[#828b9c]">Chưa có môn</span>
                        )}
                      </div>
                    </div>

                    {/* Danh sách môn học bung ra khi click */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                        <p className="text-[11px] text-slate-500 italic mb-1.5">
                          {stat.block.description}
                        </p>
                        {stat.registeredCourses.length === 0 ? (
                          <div className="p-2 bg-slate-50 rounded-lg text-slate-500 text-[11px] text-center">
                            Chưa đăng ký môn học nào thuộc khối này.{' '}
                            {onNavigateToCourses && (
                              <button
                                type="button"
                                onClick={() => onNavigateToCourses(stat.block.name)}
                                className="text-blue-600 hover:underline font-semibold"
                              >
                                Đăng ký ngay
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {stat.registeredCourses.map((c, idx) => (
                              <div
                                key={c.id || idx}
                                className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-slate-50 text-[11px]"
                              >
                                <div className="truncate mr-2">
                                  <span className="font-mono font-semibold text-slate-700 mr-1.5">
                                    {c.ma_hoc_phan}
                                  </span>
                                  <span className="text-slate-800">{c.ten_hoc_phan}</span>
                                </div>
                                <div className="flex items-center space-x-1.5 shrink-0 font-mono">
                                  <span className="text-slate-500">{c.so_tin_chi} TC</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                      c.ket_qua === 'Dat'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : c.ket_qua === 'DangHoc'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {c.diem_chu || (c.ket_qua === 'Dat' ? 'Đạt' : c.ket_qua === 'DangHoc' ? 'Đang học' : 'K.Đạt')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {onNavigateToCourses && (
              <button
                type="button"
                onClick={() => onNavigateToCourses()}
                className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Xem & Đăng Ký Tín Chỉ Theo Khung BICA</span>
              </button>
            )}

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-800">
              <p className="font-semibold">Mục tiêu tốt nghiệp BICA 2025:</p>
              <p className="mt-0.5 text-blue-700 leading-relaxed">
                Hoàn thành tối thiểu 145 tín chỉ theo đúng phân bổ 6 khối kiến thức. CPA ≥ 3.6 để đạt hạng Xuất sắc.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
