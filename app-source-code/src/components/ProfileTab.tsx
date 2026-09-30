import React, { useState, useEffect } from 'react';
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
  Calculator
} from 'lucide-react';
import type { StudentProfile } from '../types';
import { saveStudentProfile, SUPABASE_SQL_SCHEMA } from '../lib/supabase';

interface ProfileTabProps {
  profile: StudentProfile;
  isSupabaseLive: boolean;
  user?: SupabaseUser | null;
  onProfileUpdated: () => void;
  onNavigateToSupabase?: () => void;
  onOpenAuth?: () => void;
  onNavigateToWhatIf?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  isSupabaseLive,
  user,
  onProfileUpdated,
  onNavigateToSupabase,
  onOpenAuth,
  onNavigateToWhatIf,
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

  // Cập nhật form state khi profile hoặc user thay đổi
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const credits = profile.tong_tin_chi_tich_luy ?? 0;
  const totalCredits = profile.tong_tin_chi_yeu_cau ?? 145;
  const gpa = profile.diem_gpa ?? 0;
  const cpa = profile.diem_cpa ?? 0;
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

    try {
      const res = await saveStudentProfile(formData, user);

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
      {/* Top Welcome / Live Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-md ring-4 ring-white/10 shrink-0">
              {user ? (
                profile.ho_va_ten?.charAt(0) || 'S'
              ) : (
                <User className="w-8 h-8 text-blue-100" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {user ? (profile.ho_va_ten || 'Sinh viên BICA') : 'Chưa đăng nhập'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  user
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                }`}>
                  {user ? (profile.trang_thai_hoc_tap || 'Đang theo học') : 'Tài khoản Khách'}
                </span>
                {user?.email && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30">
                    {user.email}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 mt-0.5">
                MSSV: <span className="font-mono font-semibold text-white">{user ? (profile.ma_sinh_vien || '---') : '---'}</span> • Lớp: <span className="text-white">{user ? (profile.lop || 'BICA-K2025') : 'BICA-K2025'}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {profile.nganh_hoc || 'Kỹ thuật Thông minh và Tự động hóa (BICA)'} — Trường ĐH Việt Nhật ({profile.nien_khoa || '2025 - 2029'})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl text-xs">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>{user && isSupabaseLive ? 'Đồng bộ Supabase Live' : 'Bảo mật tài khoản'}</span>
            </div>
            {user ? (
              <button
                id="btn-edit-profile"
                onClick={() => {
                  setFormData(profile);
                  setIsEditing(!isEditing);
                }}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Đóng form sửa' : 'Chỉnh sửa hồ sơ'}</span>
              </button>
            ) : (
              <button
                id="btn-login-profile-top"
                onClick={onOpenAuth}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập / Đăng Ký</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Thông báo chế độ khách khi chưa đăng nhập */}
      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-amber-950">
                Bạn đang xem trang ở chế độ Khách (Chưa đăng nhập)
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
              <label className="font-semibold text-slate-700 block mb-1">Mã sinh viên (MSSV)</label>
              <input
                type="text"
                required
                value={formData.ma_sinh_vien}
                onChange={(e) => setFormData({ ...formData, ma_sinh_vien: e.target.value })}
                placeholder="VD: 25119001 hoặc BICA25119001"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-semibold text-slate-800"
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
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tín chỉ tích lũy</label>
              <input
                type="number"
                value={formData.tong_tin_chi_tich_luy}
                onChange={(e) => setFormData({ ...formData, tong_tin_chi_tich_luy: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm GPA hệ 4</label>
              <input
                type="number"
                step="0.01"
                value={formData.diem_gpa}
                onChange={(e) => setFormData({ ...formData, diem_gpa: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Xếp loại học lực</label>
              <select
                value={formData.xep_loai}
                onChange={(e) => setFormData({ ...formData, xep_loai: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="Xuất sắc">Xuất sắc</option>
                <option value="Giỏi">Giỏi</option>
                <option value="Khá">Khá</option>
                <option value="Trung bình">Trung bình</option>
              </select>
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
              {user ? credits : 0}
            </span>
            <span className="text-sm font-medium text-slate-500">
              / {totalCredits} TC
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${user ? completionPercent : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {user ? `Hoàn thành ${completionPercent}% chương trình cử nhân BICA` : 'Vui lòng đăng nhập để xem tiến độ'}
            </p>
          </div>
        </div>

        {/* Card 2: GPA */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Điểm GPA Học Kỳ
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {user && gpa > 0 ? gpa.toFixed(2) : '---'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Hệ 4.0
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-medium">
            {user && gpa > 0 ? `Tương đương ~${(gpa * 2.5).toFixed(1)}/10 thang điểm VN` : 'Chưa có dữ liệu điểm'}
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
              {user && cpa > 0 ? cpa.toFixed(2) : '---'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
              CPA
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-medium">
            {user && cpa > 0 ? 'Điểm trung bình chung tích lũy' : 'Chưa có dữ liệu điểm'}
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
              {user ? (profile.xep_loai || 'Chưa xếp loại') : 'Chưa xếp loại'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-medium">
            {user ? 'Dựa trên kết quả học tập thực tế' : 'Đăng nhập để cập nhật xếp loại'}
          </p>
        </div>
      </div>

      {/* Quick Access to What-if Tool */}
      {onNavigateToWhatIf && (
        <div className="bg-linear-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Cỗ Máy Dự Báo GPA & Mô Phỏng Mục Tiêu Tốt Nghiệp</h4>
              <p className="text-xs text-slate-600">
                Tính toán điểm thi cuối kỳ tối thiểu cần đạt, dự báo CPA ra trường và điều chỉnh điểm số trực tiếp.
              </p>
            </div>
          </div>
          <button
            id="btn-nav-whatif-banner"
            onClick={onNavigateToWhatIf}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0"
          >
            <span>Mở Cỗ Máy What-if</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
              <span className="font-semibold text-slate-800 mt-0.5">{user ? profile.ho_va_ten : 'Chưa đăng nhập'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Mã số sinh viên (MSSV)</span>
              <span className="font-semibold font-mono text-blue-600 mt-0.5">{user ? profile.ma_sinh_vien : '---'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Lớp sinh hoạt</span>
              <span className="font-semibold text-slate-800 mt-0.5">{user ? profile.lop : 'BICA-K2025'}</span>
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
              <span className="font-semibold text-slate-800 mt-0.5">{profile.khoa || 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)'}</span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Email trường</span>
              <span className="font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user ? (profile.email || user.email) : 'Chưa đăng nhập'}
              </span>
            </div>

            <div className="flex flex-col py-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500">Số điện thoại liên hệ</span>
              <span className="font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {user ? (profile.so_dien_thoai || 'Chưa cập nhật') : '---'}
              </span>
            </div>
          </div>

          {!user && (
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
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Phân Bổ Tín Chỉ Khóa 2025</span>
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600">Kiến thức giáo dục đại cương</span>
                <span className="font-semibold text-slate-900">18 / 36 TC</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600">Kiến thức cơ sở ngành CNTT</span>
                <span className="font-semibold text-slate-900">14 / 45 TC</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '31%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600">Chuyên ngành BICA ứng dụng</span>
                <span className="font-semibold text-slate-900">0 / 44 TC</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600">Khóa luận & Đồ án tốt nghiệp</span>
                <span className="font-semibold text-slate-900">0 / 20 TC</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-slate-300 h-2 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
          </div>

          <div className="mt-6 p-3.5 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800">
            <p className="font-semibold">Mục tiêu học tập:</p>
            <p className="mt-0.5 text-blue-700">
              Duy trì CPA &gt;= 3.6 để đạt bằng Cử nhân Xuất sắc và hoàn thành đủ 145 tín chỉ theo đúng lộ trình 2025-2029.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
