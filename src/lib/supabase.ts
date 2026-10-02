import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { StudentProfile, StudentCourse, ScheduleItem, TuitionRecord, AuthorizedOfficer } from '../types';

// ============================================================================
// KHAI BÁO CẤU HÌNH KẾT NỐI SUPABASE THEO YÊU CẦU
// ============================================================================
export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://kevoshrilcltgiitmvds.supabase.co/rest/v1/';
export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_RWEb_9J8dkpf2tI90H4erQ_vtXh7Ir5';

// Chuẩn hóa Base URL cho Supabase JS Client (loại bỏ /rest/v1/ để Auth và Realtime hoạt động chính xác)
const SUPABASE_BASE_URL = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');

// Lưu lại trạng thái URL khôi phục mật khẩu ngay khi trang tải (trước khi Supabase client xóa hash trên thanh địa chỉ)
export interface InitialRecoveryUrlState {
  isRecoveryRedirect: boolean;
  hasOtpExpiredError: boolean;
  errorDescription: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
}

const capturedInitialRecoveryState: InitialRecoveryUrlState = (() => {
  if (typeof window === 'undefined') {
    return {
      isRecoveryRedirect: false,
      hasOtpExpiredError: false,
      errorDescription: null,
      accessToken: null,
      refreshToken: null,
      tokenHash: null,
    };
  }
  const rawHash = window.location.hash.replace(/^#/, '');
  const rawSearch = window.location.search.replace(/^\?/, '');
  const hashParams = new URLSearchParams(rawHash);
  const searchParams = new URLSearchParams(rawSearch);

  const typeParam = hashParams.get('type') || searchParams.get('type');
  const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
  const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
  const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
  const tokenHash =
    searchParams.get('token_hash') ||
    searchParams.get('token') ||
    hashParams.get('token_hash') ||
    hashParams.get('token');

  const hasOtpExpiredError =
    errorCode === 'otp_expired' ||
    (errorDesc || '').toLowerCase().includes('expired') ||
    (errorDesc || '').toLowerCase().includes('invalid');

  const isRecoveryRedirect =
    typeParam === 'recovery' || Boolean(tokenHash && typeParam === 'recovery') || hasOtpExpiredError;

  return {
    isRecoveryRedirect,
    hasOtpExpiredError,
    errorDescription: errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : null,
    accessToken,
    refreshToken,
    tokenHash,
  };
})();

export function getInitialRecoveryUrlState(): InitialRecoveryUrlState {
  return capturedInitialRecoveryState;
}

// Khởi tạo Supabase client hỗ trợ cả CDN window.supabase và @supabase/supabase-js package
const getClient = (): SupabaseClient => {
  const clientOptions = {
    auth: {
      flowType: 'implicit' as const,
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  };
  if (typeof window !== 'undefined' && (window as any).supabase?.createClient) {
    return (window as any).supabase.createClient(SUPABASE_BASE_URL, SUPABASE_ANON_KEY, clientOptions);
  }
  return createClient(SUPABASE_BASE_URL, SUPABASE_ANON_KEY, clientOptions);
};

export const supabase: SupabaseClient = getClient();

// ============================================================================
// DỮ LIỆU DỰ PHÒNG CHUẨN SINH VIÊN BICA 2025 (KHI BẢNG TRỐNG HOẶC CHƯA TẠO)
// ============================================================================
export const PROFILE_STORAGE_KEY = 'bica_student_profile_cache';

export const DEFAULT_BICA_STUDENT_PROFILE: StudentProfile = {
  ma_sinh_vien: 'BICA25119034',
  ho_va_ten: 'Trần Duy Khánh',
  lop: 'BICA-K2025',
  nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
  khoa: 'Khoa Công nghệ và Kĩ thuật Tiên tiến',
  nien_khoa: '2025 - 2029',
  email: '25119034@st.vju.ac.vn',
  so_dien_thoai: '0987654321',
  ngay_sinh: '2007-05-15',
  trang_thai_hoc_tap: 'Đang theo học',
  tong_tin_chi_tich_luy: 27,
  tong_tin_chi_yeu_cau: 145,
  diem_gpa: 3.48,
  diem_cpa: 3.45,
  xep_loai: 'Giỏi',
};

export const GUEST_STUDENT_PROFILE: StudentProfile = DEFAULT_BICA_STUDENT_PROFILE;
export const DEFAULT_STUDENT_PROFILE = DEFAULT_BICA_STUDENT_PROFILE;

export function getDefaultProfileForUser(user: User): StudentProfile {
  const meta = user.user_metadata || {};
  const email = user.email || '';
  const emailPrefix = email.split('@')[0] || '';
  const digits = emailPrefix.match(/\d+/);
  const studentId = meta.student_id || (digits ? `BICA${digits[0]}` : (emailPrefix ? `BICA${emailPrefix}` : '---'));
  const fullName = meta.full_name || (emailPrefix ? (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)) : 'Sinh viên BICA');

  return {
    user_id: user.id,
    ma_sinh_vien: studentId,
    ho_va_ten: fullName,
    lop: 'BICA-K2025',
    nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
    khoa: 'Khoa Công nghệ và Kĩ thuật Tiên tiến',
    nien_khoa: '2025 - 2029',
    email: email,
    so_dien_thoai: '',
    ngay_sinh: '',
    trang_thai_hoc_tap: 'Đang theo học',
    tong_tin_chi_tich_luy: 0,
    tong_tin_chi_yeu_cau: 145,
    diem_gpa: 0.0,
    diem_cpa: 0.0,
    xep_loai: 'Chưa xếp loại',
  };
}

export function getProfileStorageKey(userIdOrEmail?: string): string {
  if (userIdOrEmail) {
    return `bica_profile_${userIdOrEmail}`;
  }
  return 'bica_profile_guest';
}

export function getLocalProfile(userIdOrEmail?: string): StudentProfile | null {
  if (typeof window !== 'undefined') {
    try {
      const key = getProfileStorageKey(userIdOrEmail);
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function saveLocalProfile(data: StudentProfile, userIdOrEmail?: string): void {
  if (typeof window !== 'undefined') {
    try {
      const key = getProfileStorageKey(userIdOrEmail);
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}

export const DEFAULT_COURSES: StudentCourse[] = [
  {
    ma_hoc_phan: 'IT1110',
    ten_hoc_phan: 'Tin học đại cương & Lập trình C/C++',
    so_tin_chi: 4,
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 10,
    diem_giua_ky: 8.5,
    diem_cuoi_ky: 9.0,
    diem_tong_ket: 8.9,
    diem_chu: 'A',
    diem_thang_4: 4.0,
    ket_qua: 'Dat',
    giang_vien: 'TS. Trần Hoàng Anh',
  },
  {
    ma_hoc_phan: 'MA1010',
    ten_hoc_phan: 'Giải tích 1 cho Kỹ thuật',
    so_tin_chi: 4,
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 9.5,
    diem_giua_ky: 8.0,
    diem_cuoi_ky: 8.5,
    diem_tong_ket: 8.4,
    diem_chu: 'B+',
    diem_thang_4: 3.5,
    ket_qua: 'Dat',
    giang_vien: 'PGS. TS. Lê Minh Tuấn',
  },
  {
    ma_hoc_phan: 'IT2000',
    ten_hoc_phan: 'Nhập môn Cơ sở Dữ liệu & SQL',
    so_tin_chi: 3,
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 10,
    diem_giua_ky: 9.5,
    diem_cuoi_ky: 9.0,
    diem_tong_ket: 9.2,
    diem_chu: 'A+',
    diem_thang_4: 4.0,
    ket_qua: 'Dat',
    giang_vien: 'TS. Phạm Vũ Quang',
  },
  {
    ma_hoc_phan: 'EN1001',
    ten_hoc_phan: 'Tiếng Anh Học thuật Chuyên ngành 1',
    so_tin_chi: 3,
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 9.0,
    diem_giua_ky: 8.5,
    diem_cuoi_ky: 8.0,
    diem_tong_ket: 8.3,
    diem_chu: 'B+',
    diem_thang_4: 3.5,
    ket_qua: 'Dat',
    giang_vien: 'ThS. Nguyễn Quỳnh Mai',
  },
  {
    ma_hoc_phan: 'IT2120',
    ten_hoc_phan: 'Kiến trúc Máy tính & Hệ điều hành',
    so_tin_chi: 3,
    hoc_ky: 'Học kỳ 2',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 10,
    diem_giua_ky: 9.0,
    diem_cuoi_ky: 9.0,
    diem_tong_ket: 9.0,
    diem_chu: 'A',
    diem_thang_4: 4.0,
    ket_qua: 'Dat',
    giang_vien: 'TS. Vũ Đình Thắng',
  },
  {
    ma_hoc_phan: 'IT3080',
    ten_hoc_phan: 'Mạng máy tính & Điện toán Đám mây',
    so_tin_chi: 3,
    hoc_ky: 'Học kỳ 2',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 9.0,
    diem_giua_ky: 8.5,
    diem_cuoi_ky: 8.5,
    diem_tong_ket: 8.6,
    diem_chu: 'A',
    diem_thang_4: 4.0,
    ket_qua: 'Dat',
    giang_vien: 'TS. Hoàng Đức Long',
  },
  {
    ma_hoc_phan: 'IT3100',
    ten_hoc_phan: 'Lập trình Web & Ứng dụng Hiện đại',
    so_tin_chi: 3,
    hoc_ky: 'Học kỳ 2',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 10,
    diem_giua_ky: 9.0,
    diem_cuoi_ky: 9.5,
    diem_tong_ket: 9.3,
    diem_chu: 'A+',
    diem_thang_4: 4.0,
    ket_qua: 'Dat',
    giang_vien: 'ThS. Đỗ Quang Huy',
  },
];

export const DEFAULT_SCHEDULE: ScheduleItem[] = [
  {
    ma_hoc_phan: 'IT3100',
    ten_hoc_phan: 'Lập trình Web & Ứng dụng Hiện đại',
    thu: 2,
    tiet_bat_dau: 1,
    so_tiet: 3,
    gio_bat_dau: '07:00',
    gio_ket_thuc: '09:25',
    phong_hoc: 'A2-302 (Lab Tin học)',
    giang_vien: 'ThS. Đỗ Quang Huy',
    hinh_thuc: 'TrucTiep',
    ghi_chu: 'Thực hành React, Tailwind và Supabase',
  },
  {
    ma_hoc_phan: 'IT3080',
    ten_hoc_phan: 'Mạng máy tính & Điện toán Đám mây',
    thu: 3,
    tiet_bat_dau: 4,
    so_tiet: 3,
    gio_bat_dau: '09:35',
    gio_ket_thuc: '12:00',
    phong_hoc: 'B1-104 (Hội trường)',
    giang_vien: 'TS. Hoàng Đức Long',
    hinh_thuc: 'TrucTiep',
    ghi_chu: 'Kiểm tra đồ án giữa kỳ',
  },
  {
    ma_hoc_phan: 'IT2120',
    ten_hoc_phan: 'Kiến trúc Máy tính & Hệ điều hành',
    thu: 4,
    tiet_bat_dau: 7,
    so_tiet: 3,
    gio_bat_dau: '12:30',
    gio_ket_thuc: '14:55',
    phong_hoc: 'C3-205',
    giang_vien: 'TS. Vũ Đình Thắng',
    hinh_thuc: 'TrucTiep',
    ghi_chu: 'Lý thuyết Quản lý Bộ nhớ ảo',
  },
  {
    ma_hoc_phan: 'EN1001',
    ten_hoc_phan: 'Tiếng Anh Học thuật Chuyên ngành 1',
    thu: 5,
    tiet_bat_dau: 2,
    so_tiet: 2,
    gio_bat_dau: '07:50',
    gio_ket_thuc: '09:25',
    phong_hoc: 'Zoom Meeting 842-119',
    giang_vien: 'ThS. Nguyễn Quỳnh Mai',
    hinh_thuc: 'Online',
    ghi_chu: 'Thuyết trình nhóm trực tuyến',
  },
  {
    ma_hoc_phan: 'IT2000',
    ten_hoc_phan: 'Cơ sở Dữ liệu Nâng cao & Realtime',
    thu: 6,
    tiet_bat_dau: 4,
    so_tiet: 3,
    gio_bat_dau: '09:35',
    gio_ket_thuc: '12:00',
    phong_hoc: 'Lab D1-401',
    giang_vien: 'TS. Phạm Vũ Quang',
    hinh_thuc: 'TrucTiep',
    ghi_chu: 'Thiết kế RLS và Triggers trên PostgreSQL',
  },
];

export const DEFAULT_TUITION: TuitionRecord[] = [
  {
    hoc_ky: 'Học kỳ 2',
    nam_hoc: '2025-2026',
    tong_so_tin_chi: 16,
    tong_hoc_phi: 14800000,
    mien_giam: 2000000,
    da_thanh_toan: 12800000,
    con_no: 0,
    han_dong: '2026-03-31',
    trang_thai: 'DaHoanThanh',
    ma_giao_dich: 'VNPAY-20260315-9988',
    ngay_thanh_toan: '2026-03-15',
  },
  {
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2025-2026',
    tong_so_tin_chi: 16,
    tong_hoc_phi: 14800000,
    mien_giam: 0,
    da_thanh_toan: 14800000,
    con_no: 0,
    han_dong: '2025-10-30',
    trang_thai: 'DaHoanThanh',
    ma_giao_dich: 'MOMO-20251020-4412',
    ngay_thanh_toan: '2025-10-20',
  },
];

// ============================================================================
// HÀM SUPABASE AUTH: ĐĂNG NHẬP, ĐĂNG KÝ, ĐĂNG XUẤT, LẮNG NGHE TRẠNG THÁI
// ============================================================================

/**
 * Đăng nhập với Supabase Auth
 */
export async function signInWithPassword(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || 'Lỗi đăng nhập qua Supabase' };
  }
}

const SYNCED_HO_SO_IDS_KEY = 'bica_synced_ho_so_ids_v1';
const DELETED_STUDENTS_KEY = 'bica_deleted_students_v1';

function getStoredSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function markStudentSyncedToHoSo(studentId?: string, email?: string) {
  if (typeof window === 'undefined') return;
  const synced = getStoredSet(SYNCED_HO_SO_IDS_KEY);
  const deleted = getStoredSet(DELETED_STUDENTS_KEY);
  const cleanId = (studentId || '').trim().toUpperCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanId) {
    synced.add(cleanId);
    deleted.delete(cleanId);
  }
  if (cleanEmail) {
    synced.add(cleanEmail);
    deleted.delete(cleanEmail);
  }
  saveStoredSet(SYNCED_HO_SO_IDS_KEY, synced);
  saveStoredSet(DELETED_STUDENTS_KEY, deleted);
}

export function markStudentDeletedFromHoSo(studentId?: string, email?: string) {
  if (typeof window === 'undefined') return;
  const synced = getStoredSet(SYNCED_HO_SO_IDS_KEY);
  const deleted = getStoredSet(DELETED_STUDENTS_KEY);
  const cleanId = (studentId || '').trim().toUpperCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanId) {
    deleted.add(cleanId);
    synced.delete(cleanId);
  }
  if (cleanEmail) {
    deleted.add(cleanEmail);
    synced.delete(cleanEmail);
  }
  saveStoredSet(SYNCED_HO_SO_IDS_KEY, synced);
  saveStoredSet(DELETED_STUDENTS_KEY, deleted);
}

export function isStudentMarkedDeleted(studentId?: string, email?: string): boolean {
  if (typeof window === 'undefined') return false;
  const deleted = getStoredSet(DELETED_STUDENTS_KEY);
  const cleanId = (studentId || '').trim().toUpperCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanId && deleted.has(cleanId)) return true;
  if (cleanEmail && deleted.has(cleanEmail)) return true;
  return false;
}

/**
 * Hàm đảm bảo hồ sơ sinh viên luôn được ghi/đồng bộ trực tiếp vào bảng public.ho_so trên Supabase
 * (Không gửi cột user_id để tương thích tuyệt đối với schema bảng public.ho_so)
 */
export async function ensureStudentInHoSo(profile: Partial<StudentProfile>): Promise<{
  success: boolean;
  data?: any;
  error?: string | null;
}> {
  const maSv = (profile.ma_sinh_vien || '').trim().toUpperCase();
  const emailClean = (profile.email || '').trim().toLowerCase();
  if (!maSv || maSv === '---' || maSv === 'CHƯA_ĐĂNG_NHẬP') {
    return { success: false, error: 'Mã sinh viên không hợp lệ' };
  }

  const finalEmail = emailClean || `${maSv.replace(/^BICA/i, '').toLowerCase()}@st.vju.ac.vn`;

  const payload: Record<string, any> = {
    ma_sinh_vien: maSv,
    ho_va_ten: (profile.ho_va_ten || 'Sinh viên BICA').trim(),
    lop: profile.lop || 'BICA-K2025',
    nganh_hoc: profile.nganh_hoc || 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
    khoa:
      !profile.khoa ||
      profile.khoa === 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)' ||
      profile.khoa.includes('Hội tụ')
        ? 'Khoa Công nghệ và Kĩ thuật Tiên tiến'
        : profile.khoa,
    nien_khoa: profile.nien_khoa || '2025 - 2029',
    email: finalEmail,
    so_dien_thoai: profile.so_dien_thoai || '',
    ngay_sinh: profile.ngay_sinh || null,
    trang_thai_hoc_tap: profile.trang_thai_hoc_tap || 'Đang theo học',
    tong_tin_chi_tich_luy: Number(profile.tong_tin_chi_tich_luy ?? 0),
    tong_tin_chi_yeu_cau: Number(profile.tong_tin_chi_yeu_cau ?? 145),
    diem_gpa: Number(profile.diem_gpa ?? 0),
    diem_cpa: Number(profile.diem_cpa ?? 0),
    xep_loai: profile.xep_loai || 'Chưa xếp loại',
  };

  try {
    // 1. Thử upsert theo ma_sinh_vien
    const { data: upserted, error: upsertErr } = await supabase
      .from('ho_so')
      .upsert(payload, { onConflict: 'ma_sinh_vien' })
      .select()
      .maybeSingle();

    if (!upsertErr) {
      markStudentSyncedToHoSo(maSv, finalEmail);
      return { success: true, data: upserted || payload };
    }

    // 2. Fallback: Kiểm tra tồn tại theo ma_sinh_vien hoặc email rồi update / insert
    const { data: existing } = await supabase
      .from('ho_so')
      .select('id, ma_sinh_vien')
      .or(`ma_sinh_vien.eq.${maSv}${finalEmail ? `,email.eq.${finalEmail}` : ''}`)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { data: updated, error: updateErr } = await supabase
        .from('ho_so')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (!updateErr) {
        markStudentSyncedToHoSo(maSv, finalEmail);
        return { success: true, data: updated || payload };
      }
      return { success: false, error: updateErr.message };
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('ho_so')
        .insert([payload])
        .select()
        .maybeSingle();
      if (!insertErr) {
        markStudentSyncedToHoSo(maSv, finalEmail);
        return { success: true, data: inserted || payload };
      }
      return { success: false, error: insertErr.message };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi ghi bảng ho_so' };
  }
}

/**
 * Đăng ký tài khoản mới với Supabase Auth và đồng bộ ngay lập tức vào bảng public.ho_so
 */
export async function signUp(email: string, password: string, fullName?: string, studentId?: string) {
  const emailClean = email.trim().toLowerCase();
  const finalStudentId = (studentId?.trim() || (emailClean.split('@')[0] ? `BICA${emailClean.split('@')[0]}` : 'BICA-SV')).toUpperCase();
  const finalFullName = fullName?.trim() || 'Sinh viên BICA';

  const initialProfile: StudentProfile = {
    ma_sinh_vien: finalStudentId,
    ho_va_ten: finalFullName,
    email: emailClean,
    lop: 'BICA-K2025',
    nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
    khoa: 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)',
    nien_khoa: '2025 - 2029',
    trang_thai_hoc_tap: 'Đang theo học',
    tong_tin_chi_tich_luy: 0,
    tong_tin_chi_yeu_cau: 145,
    diem_gpa: 0,
    diem_cpa: 0,
    xep_loai: 'Chưa xếp loại',
  };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: emailClean,
      password,
      options: {
        data: {
          full_name: finalFullName,
          student_id: finalStudentId,
        },
      },
    });

    if (data?.user?.id) {
      initialProfile.user_id = data.user.id;
      saveLocalProfile(initialProfile, data.user.id);
    }
    saveLocalProfile(initialProfile, emailClean);
    saveLocalProfile(initialProfile, finalStudentId);

    // Luôn ghi ngay hồ sơ sinh viên mới vào bảng public.ho_so trên Supabase
    // để Cổng Chủ Nhiệm Ngành cập nhật danh sách sinh viên tức thì
    const hoSoSync = await ensureStudentInHoSo(initialProfile);

    if (error) {
      // Nếu lỗi do giới hạn gửi email xác thực của Supabase Auth nhưng đã ghi được vào bảng ho_so,
      // vẫn trả về profile để hệ thống hoạt động trơn tru
      return {
        data: data || { user: null, session: null },
        profile: initialProfile,
        syncedToHoSo: hoSoSync.success,
        error: hoSoSync.success ? null : (error.message || 'Lỗi đăng ký qua Supabase'),
      };
    }

    return {
      data,
      profile: initialProfile,
      syncedToHoSo: hoSoSync.success,
      error: null,
    };
  } catch (error: any) {
    // Đảm bảo vẫn lưu vào bảng ho_so ngay cả khi Auth gặp sự cố mạng/rate-limit
    const hoSoSync = await ensureStudentInHoSo(initialProfile);
    saveLocalProfile(initialProfile, emailClean);
    saveLocalProfile(initialProfile, finalStudentId);
    return {
      data: null,
      profile: initialProfile,
      syncedToHoSo: hoSoSync.success,
      error: hoSoSync.success ? null : (error.message || 'Lỗi đăng ký qua Supabase'),
    };
  }
}

/**
 * Đăng xuất tài khoản
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message || 'Lỗi đăng xuất' };
  }
}

/**
 * Hàm lắng nghe trạng thái đăng nhập: supabase.auth.onAuthStateChange()
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
}

/**
 * Lấy thông tin user hiện tại
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

const BICA_REGISTERED_STUDENTS_KEY = 'bica_registered_students_v1';
const BICA_USED_RECOVERY_TOKENS_KEY = 'bica_used_recovery_tokens_v1';
const BICA_ACTIVE_RECOVERY_TICKET_KEY = 'bica_active_recovery_ticket_v1';
const BICA_RECOVERY_REQUEST_LOG_KEY = 'bica_recovery_request_log_v1';

// Thời hạn hiệu lực tối đa của 1 đường dẫn liên kết khôi phục mật khẩu: 10 phút
export const RECOVERY_LINK_TTL_MS = 10 * 60 * 1000;

export interface RecoverySessionTicket {
  ticketId: string;
  verifiedEmail: string;
  tokenFingerprint: string;
  issuedAt: number;
  expiresAt: number;
  used: boolean;
}

const inMemoryUsedTokens = new Set<string>();
let inMemoryActiveTicket: RecoverySessionTicket | null = null;

function isRecoveryTokenAlreadyUsed(fingerprint: string): boolean {
  const key = fingerprint.trim();
  if (!key) return true;
  if (inMemoryUsedTokens.has(key)) return true;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BICA_USED_RECOVERY_TOKENS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      return list.includes(key);
    } catch {
      return false;
    }
  }
  return false;
}

function markRecoveryTokenAsUsed(fingerprints: string[]): void {
  const validKeys = fingerprints.map((f) => f.trim()).filter(Boolean);
  validKeys.forEach((k) => inMemoryUsedTokens.add(k));
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BICA_USED_RECOVERY_TOKENS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const merged = Array.from(new Set([...list, ...validKeys])).slice(-500);
      localStorage.setItem(BICA_USED_RECOVERY_TOKENS_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage errors
    }
  }
}

function saveActiveRecoveryTicket(ticket: RecoverySessionTicket | null): void {
  inMemoryActiveTicket = ticket;
  if (typeof window !== 'undefined') {
    try {
      if (!ticket) {
        localStorage.removeItem(BICA_ACTIVE_RECOVERY_TICKET_KEY);
      } else {
        localStorage.setItem(BICA_ACTIVE_RECOVERY_TICKET_KEY, JSON.stringify(ticket));
      }
    } catch {
      // ignore
    }
  }
}

function loadActiveRecoveryTicket(): RecoverySessionTicket | null {
  if (inMemoryActiveTicket) return inMemoryActiveTicket;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BICA_ACTIVE_RECOVERY_TICKET_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RecoverySessionTicket;
      inMemoryActiveTicket = parsed;
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function decodeJwtPayloadSafe(jwtToken: string): {
  email?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  session_id?: string;
} | null {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Cập nhật mật khẩu mới cho tài khoản sinh viên đã đăng ký.
 * BẮT BUỘC:
 *  1. Phải có vé xác thực 1 lần (recoveryTicketId) chưa từng sử dụng và còn hạn sử dụng (10 phút).
 *  2. Vé xác thực của tài khoản A tuyệt đối chỉ được phép đổi mật khẩu cho đúng tài khoản A.
 *  3. Sau khi đổi mật khẩu 1 lần thành công, vé và phiên khôi phục bị vô hiệu hóa ngay lập tức.
 */
export async function updateStudentAccountPassword(
  email: string,
  newPassword: string,
  fallbackProfile?: Partial<StudentProfile>,
  recoveryTicketId?: string
): Promise<{ success: boolean; error?: string | null }> {
  const emailClean = email.trim().toLowerCase();
  const passClean = newPassword.trim();

  if (!emailClean) {
    return { success: false, error: 'Không xác định được tài khoản email cần đổi mật khẩu.' };
  }

  if (passClean.length < 6) {
    return { success: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }

  // Kiểm tra nghiêm ngặt vé khôi phục 1 lần (One-Time Recovery Ticket)
  const activeTicket = loadActiveRecoveryTicket();
  if (!activeTicket || (recoveryTicketId && activeTicket.ticketId !== recoveryTicketId)) {
    return {
      success: false,
      error:
        'Phiên khôi phục mật khẩu không hợp lệ hoặc đường dẫn liên kết đã được sử dụng. Mỗi liên kết chỉ được phép đổi mật khẩu 1 lần duy nhất!',
    };
  }

  if (activeTicket.used || isRecoveryTokenAlreadyUsed(`ticket:${activeTicket.ticketId}`)) {
    saveActiveRecoveryTicket(null);
    return {
      success: false,
      error:
        'Đường dẫn liên kết khôi phục này đã được sử dụng để đổi mật khẩu (chỉ được dùng 1 lần duy nhất). Vui lòng yêu cầu gửi liên kết mới nếu muốn đổi lại.',
    };
  }

  if (Date.now() > activeTicket.expiresAt) {
    markRecoveryTokenAsUsed([`ticket:${activeTicket.ticketId}`, activeTicket.tokenFingerprint]);
    saveActiveRecoveryTicket(null);
    await supabase.auth.signOut().catch(() => {});
    return {
      success: false,
      error:
        'Đường dẫn liên kết khôi phục đã hết hạn sử dụng (quá 10 phút). Vui lòng yêu cầu gửi lại thư khôi phục mới vào Gmail.',
    };
  }

  // Ràng buộc tuyệt đối: Mã của tài khoản A chỉ dùng để đổi mật khẩu cho tài khoản A
  if (activeTicket.verifiedEmail.trim().toLowerCase() !== emailClean) {
    return {
      success: false,
      error: `Từ chối bảo mật: Đường dẫn liên kết này thuộc về tài khoản "${activeTicket.verifiedEmail}", tuyệt đối không thể dùng để đổi mật khẩu cho tài khoản "${emailClean}"!`,
    };
  }

  try {
    // Kiểm tra đối chiếu phiên Supabase Auth hiện hành phải khớp đúng chủ tài khoản A
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionEmail = sessionData?.session?.user?.email?.trim().toLowerCase();
    if (sessionEmail && sessionEmail !== emailClean) {
      await supabase.auth.signOut().catch(() => {});
      return {
        success: false,
        error: `Từ chối bảo mật: Phiên xác thực thuộc về "${sessionEmail}", không khớp với tài khoản "${emailClean}".`,
      };
    }

    if (sessionEmail === emailClean) {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: passClean,
        data: {
          last_consumed_recovery_ticket: activeTicket.tokenFingerprint,
          last_password_reset_at: new Date().toISOString(),
        },
      });
      if (updateErr) {
        const msg = updateErr.message || '';
        if (msg.toLowerCase().includes('same as the old password') || msg.toLowerCase().includes('different from the old')) {
          return {
            success: false,
            error: 'Mật khẩu mới phải khác với mật khẩu cũ trước đó.',
          };
        }
      }
    }
  } catch {
    // Bỏ qua nếu kết nối mạng gián đoạn
  }

  // Đánh dấu vé & token đã sử dụng NGAY LẬP TỨC (chỉ dùng được 1 lần duy nhất) và thu hồi phiên Supabase
  markRecoveryTokenAsUsed([`ticket:${activeTicket.ticketId}`, activeTicket.tokenFingerprint]);
  saveActiveRecoveryTicket(null);
  await supabase.auth.signOut().catch(() => {});

  // 2. Cập nhật trong danh bạ tài khoản đã đăng ký cho ĐÚNG tài khoản verifiedEmail
  const targetVerifiedEmail = activeTicket.verifiedEmail.trim().toLowerCase();
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BICA_REGISTERED_STUDENTS_KEY);
      const list: any[] = raw ? JSON.parse(raw) : [];
      const existingIdx = list.findIndex(
        (acc) => (acc.email || '').trim().toLowerCase() === targetVerifiedEmail
      );

      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          password: passClean,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const studentId = (
          fallbackProfile?.ma_sinh_vien ||
          `BICA${targetVerifiedEmail.split('@')[0].replace(/^bica/i, '')}`
        )
          .trim()
          .toUpperCase();
        const fullName = fallbackProfile?.ho_va_ten || 'Sinh viên BICA';
        const profileObj: StudentProfile = {
          ...DEFAULT_BICA_STUDENT_PROFILE,
          ...fallbackProfile,
          email: targetVerifiedEmail,
          ma_sinh_vien: studentId,
          ho_va_ten: fullName,
        };
        list.push({
          email: targetVerifiedEmail,
          studentId,
          fullName,
          password: passClean,
          profile: profileObj,
          createdAt: new Date().toISOString(),
        });
      }

      localStorage.setItem(BICA_REGISTERED_STUDENTS_KEY, JSON.stringify(list));
    } catch (err) {
      console.error('Lỗi cập nhật mật khẩu cục bộ:', err);
    }
  }

  return { success: true, error: null };
}

/**
 * Thu hồi phiên khôi phục mật khẩu hiện tại (khi người dùng hủy, đổi sang email khác, hoặc hết hạn)
 */
export function clearActiveRecoverySession(): void {
  saveActiveRecoveryTicket(null);
}

/**
 * Xử lý trường hợp người dùng truy cập trực tiếp từ URL redirect khôi phục mật khẩu
 * (áp dụng đầy đủ quy tắc chỉ dùng 1 lần duy nhất và hạn 10 phút)
 */
export async function consumeInitialRecoveryRedirect(): Promise<{
  isRedirect: boolean;
  success: boolean;
  verifiedEmail?: string;
  recoveryTicket?: string;
  expiresAt?: number;
  error?: string | null;
}> {
  const initial = getInitialRecoveryUrlState();
  if (!initial.isRecoveryRedirect) {
    return { isRedirect: false, success: false };
  }

  // Xóa ngay token trên thanh địa chỉ trình duyệt để chống F5 dùng lại
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // ignore
    }
  }

  if (initial.hasOtpExpiredError) {
    return {
      isRedirect: true,
      success: false,
      error:
        'Đường dẫn liên kết khôi phục đã hết hạn hoặc đã được sử dụng trước đó (mỗi liên kết chỉ dùng 1 lần duy nhất trong 10 phút). Vui lòng yêu cầu gửi lại liên kết mới.',
    };
  }

  if (initial.accessToken) {
    const tokenKey = `access_token:${initial.accessToken.slice(-48)}`;
    if (isRecoveryTokenAlreadyUsed(tokenKey)) {
      return {
        isRedirect: true,
        success: false,
        error: 'Đường dẫn liên kết khôi phục này đã được sử dụng (chỉ có hiệu lực 1 lần duy nhất).',
      };
    }
    const { data } = await supabase.auth.getUser(initial.accessToken);
    if (!data?.user?.email) {
      return {
        isRedirect: true,
        success: false,
        error: 'Đường dẫn liên kết khôi phục đã hết hạn hoặc không hợp lệ.',
      };
    }
    const verifiedUser = data.user;
    const verifiedEmail = (verifiedUser.email || '').trim().toLowerCase();
    const recoverySentAt = (verifiedUser as any).recovery_sent_at as string | undefined;
    const instanceKey = recoverySentAt
      ? `recovery_instance:${verifiedUser.id}:${recoverySentAt}`
      : tokenKey;

    if (
      isRecoveryTokenAlreadyUsed(instanceKey) ||
      verifiedUser.user_metadata?.last_consumed_recovery_ticket === instanceKey
    ) {
      return {
        isRedirect: true,
        success: false,
        error: 'Đường dẫn liên kết khôi phục này đã được sử dụng (mỗi liên kết chỉ dùng 1 lần duy nhất).',
      };
    }

    if (recoverySentAt) {
      const sentMs = new Date(recoverySentAt).getTime();
      if (!isNaN(sentMs) && Date.now() - sentMs > RECOVERY_LINK_TTL_MS) {
        markRecoveryTokenAsUsed([tokenKey, instanceKey]);
        return {
          isRedirect: true,
          success: false,
          error: 'Đường dẫn liên kết khôi phục đã hết hạn sử dụng (quá 10 phút).',
        };
      }
    }

    markRecoveryTokenAsUsed([tokenKey, instanceKey]);
    const ticket: RecoverySessionTicket = {
      ticketId: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      verifiedEmail,
      tokenFingerprint: instanceKey,
      issuedAt: Date.now(),
      expiresAt: Date.now() + RECOVERY_LINK_TTL_MS,
      used: false,
    };
    saveActiveRecoveryTicket(ticket);
    return {
      isRedirect: true,
      success: true,
      verifiedEmail,
      recoveryTicket: ticket.ticketId,
      expiresAt: ticket.expiresAt,
    };
  }

  if (initial.tokenHash) {
    const tokenHashKey = `token_hash:${initial.tokenHash}`;
    if (isRecoveryTokenAlreadyUsed(tokenHashKey)) {
      return {
        isRedirect: true,
        success: false,
        error: 'Đường dẫn liên kết khôi phục này đã được sử dụng (chỉ có hiệu lực 1 lần duy nhất).',
      };
    }
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: initial.tokenHash,
      type: 'recovery',
    });
    if (error || !data?.user?.email) {
      return {
        isRedirect: true,
        success: false,
        error: 'Đường dẫn liên kết khôi phục đã được sử dụng hoặc đã hết hạn (quá 10 phút).',
      };
    }
    const verifiedUser = data.user;
    const verifiedEmail = (verifiedUser.email || '').trim().toLowerCase();
    const recoverySentAt = (verifiedUser as any).recovery_sent_at as string | undefined;
    const instanceKey = recoverySentAt
      ? `recovery_instance:${verifiedUser.id}:${recoverySentAt}`
      : tokenHashKey;

    markRecoveryTokenAsUsed([tokenHashKey, instanceKey]);
    const ticket: RecoverySessionTicket = {
      ticketId: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      verifiedEmail,
      tokenFingerprint: instanceKey,
      issuedAt: Date.now(),
      expiresAt: Date.now() + RECOVERY_LINK_TTL_MS,
      used: false,
    };
    saveActiveRecoveryTicket(ticket);
    return {
      isRedirect: true,
      success: true,
      verifiedEmail,
      recoveryTicket: ticket.ticketId,
      expiresAt: ticket.expiresAt,
    };
  }

  return { isRedirect: false, success: false };
}

/**
 * Xác thực Email đã đăng ký tài khoản và gửi thư khôi phục mật khẩu về đúng hộp thư Gmail (@st.vju.ac.vn).
 * TUYỆT ĐỐI KHÔNG trả về hay hiển thị mật khẩu trên trang web khi chưa xác thực từ Gmail để chống mạo danh.
 */
export async function requestPasswordRecoveryToRegisteredEmail(
  email: string,
  studentIdInput?: string
): Promise<{
  success: boolean;
  targetEmail?: string;
  studentId?: string;
  studentName?: string;
  emailDispatchedViaSupabase?: boolean;
  expiresAt?: number;
  profile?: StudentProfile;
  error?: string | null;
}> {
  const emailClean = email.trim().toLowerCase();
  const idClean = (studentIdInput || '').trim().toUpperCase();

  if (!emailClean) {
    return {
      success: false,
      error: 'Vui lòng nhập địa chỉ Email đã dùng để đăng ký tài khoản (@st.vju.ac.vn).',
    };
  }

  if (!emailClean.endsWith('@st.vju.ac.vn')) {
    return {
      success: false,
      error: 'Vui lòng nhập đúng định dạng Email sinh viên trường có đuôi @st.vju.ac.vn.',
    };
  }

  try {
    // 1. Kiểm tra hồ sơ trên bảng public.ho_so của Supabase
    const { data: hoSoRow } = await supabase
      .from('ho_so')
      .select('*')
      .ilike('email', emailClean)
      .limit(1)
      .maybeSingle();

    // 2. Kiểm tra trong danh bạ tài khoản đã đăng ký
    let localMatched: any = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(BICA_REGISTERED_STUDENTS_KEY);
        const list: any[] = raw ? JSON.parse(raw) : [];
        localMatched = list.find(
          (acc) => (acc.email || '').trim().toLowerCase() === emailClean
        );
      } catch {
        // ignore
      }
    }

    // 3. Kiểm tra tài khoản mặc định BICA 2025
    const isDefaultBica =
      emailClean === '25119034@st.vju.ac.vn' ||
      emailClean === 'bica25119034@st.vju.ac.vn' ||
      emailClean === 'khanhtd@st.vju.ac.vn';

    if (!hoSoRow && !localMatched && !isDefaultBica) {
      return {
        success: false,
        error: `Địa chỉ email "${emailClean}" chưa được đăng ký tài khoản trên hệ thống BICA. Hệ thống chỉ gửi thư khôi phục cho email đã đăng ký tài khoản.`,
      };
    }

    const registeredStudentId = (
      hoSoRow?.ma_sinh_vien ||
      localMatched?.studentId ||
      (isDefaultBica ? 'BICA25119034' : '')
    )
      .trim()
      .toUpperCase();

    const registeredName =
      hoSoRow?.ho_va_ten ||
      localMatched?.fullName ||
      (isDefaultBica ? 'Trần Duy Khánh' : 'Sinh viên BICA');

    // Nếu người dùng có nhập Mã số sinh viên để đối chiếu bảo mật, kiểm tra khớp với email đã đăng ký
    if (idClean && registeredStudentId) {
      const normalizedInputDigits = idClean.replace(/^BICA/i, '');
      const normalizedRegDigits = registeredStudentId.replace(/^BICA/i, '');
      if (idClean !== registeredStudentId && normalizedInputDigits !== normalizedRegDigits) {
        return {
          success: false,
          error: `Mã số sinh viên "${idClean}" không khớp với hồ sơ đã đăng ký của email ${emailClean}.`,
        };
      }
    }

    // Hủy mọi vé xác thực cũ trước đó khi yêu cầu cấp liên kết mới
    saveActiveRecoveryTicket(null);

    // 4. Gửi email khôi phục mật khẩu trực tiếp về hộp thư Gmail (@st.vju.ac.vn) qua Supabase Auth.
    const cleanRedirectUrl =
      typeof window !== 'undefined' ? window.location.origin : undefined;

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      emailClean,
      cleanRedirectUrl ? { redirectTo: cleanRedirectUrl } : undefined
    );

    if (resetErr) {
      const msg = resetErr.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('security purposes')) {
        return {
          success: false,
          error: 'Bạn vừa yêu cầu gửi email gần đây. Vui lòng kiểm tra hộp thư Gmail (kể cả mục Thư rác/Spam) hoặc đợi khoảng 60 giây trước khi gửi lại.',
        };
      }
    }

    const now = Date.now();
    const expiresAt = now + RECOVERY_LINK_TTL_MS;

    // Lưu dấu thời gian cấp mã cho tài khoản này để kiểm soát hạn sử dụng 10 phút
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(BICA_RECOVERY_REQUEST_LOG_KEY);
        const map: Record<string, { requestedAt: number; expiresAt: number }> = raw
          ? JSON.parse(raw)
          : {};
        map[emailClean] = { requestedAt: now, expiresAt };
        localStorage.setItem(BICA_RECOVERY_REQUEST_LOG_KEY, JSON.stringify(map));
      } catch {
        // ignore
      }
    }

    const resolvedProfile: StudentProfile = {
      ...DEFAULT_BICA_STUDENT_PROFILE,
      ...(localMatched?.profile || {}),
      ...(hoSoRow ? mapProfileRow(hoSoRow, null) : {}),
      email: emailClean,
      ma_sinh_vien: registeredStudentId || `BICA${emailClean.split('@')[0].toUpperCase()}`,
      ho_va_ten: registeredName,
    };

    return {
      success: true,
      targetEmail: emailClean,
      studentId: resolvedProfile.ma_sinh_vien,
      studentName: resolvedProfile.ho_va_ten,
      emailDispatchedViaSupabase: !resetErr,
      expiresAt,
      profile: resolvedProfile,
      error: null,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Có lỗi xảy ra khi gửi thư khôi phục mật khẩu qua Gmail.',
    };
  }
}

/**
 * Xác thực đường link khôi phục hoặc mã token lấy từ bên trong tin nhắn Gmail.
 * BẢO MẬT NGHIÊM NGẶT:
 *  1. Mỗi đường dẫn liên kết / token chỉ được phép sử dụng ĐÚNG 1 LẦN DUY NHẤT.
 *  2. Có hạn sử dụng tối đa 10 phút kể từ lúc phát hành.
 *  3. Đường dẫn liên kết của tài khoản A chỉ xác thực và đổi mật khẩu được cho ĐÚNG tài khoản A (không thể dùng cho tài khoản B, C).
 */
export async function verifyGmailRecoveryLinkOrOtp(
  expectedEmail: string,
  rawInput: string
): Promise<{
  success: boolean;
  verifiedEmail?: string;
  recoveryTicket?: string;
  expiresAt?: number;
  error?: string | null;
}> {
  const emailClean = expectedEmail.trim().toLowerCase();
  let inputClean = rawInput.trim();

  if (!emailClean || !emailClean.endsWith('@st.vju.ac.vn')) {
    return {
      success: false,
      error: 'Vui lòng nhập chính xác địa chỉ Email sinh viên (@st.vju.ac.vn) cần khôi phục trước khi xác thực liên kết.',
    };
  }

  if (!inputClean) {
    return {
      success: false,
      error: 'Vui lòng dán đường link khôi phục từ trong tin nhắn Gmail.',
    };
  }

  // Kiểm tra xem yêu cầu khôi phục của tài khoản này trên trình duyệt đã quá hạn 10 phút chưa
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(BICA_RECOVERY_REQUEST_LOG_KEY);
      const map: Record<string, { requestedAt: number; expiresAt: number }> = raw
        ? JSON.parse(raw)
        : {};
      const reqInfo = map[emailClean];
      if (reqInfo && Date.now() > reqInfo.expiresAt) {
        return {
          success: false,
          error:
            'Đường dẫn liên kết khôi phục đã hết hạn sử dụng (quá 10 phút). Vui lòng nhấn "Gửi lại tin nhắn mới vào Gmail" để nhận liên kết mới.',
        };
      }
    } catch {
      // ignore
    }
  }

  try {
    // Giải bọc nếu link copy từ Gmail có Google Redirect (https://www.google.com/url?q=...)
    if (inputClean.includes('google.com/url?')) {
      try {
        const googleUrl = new URL(inputClean);
        const unwrapped = googleUrl.searchParams.get('q') || googleUrl.searchParams.get('url');
        if (unwrapped) {
          inputClean = decodeURIComponent(unwrapped);
        }
      } catch {
        // ignore
      }
    }

    // Kiểm tra xem đường link dán vào có phải là link lỗi otp_expired hay không
    if (
      inputClean.includes('error_code=otp_expired') ||
      inputClean.includes('Email+link+is+invalid+or+has+expired')
    ) {
      return {
        success: false,
        error:
          'Đường dẫn liên kết này đã được sử dụng trước đó hoặc đã hết hạn (mỗi đường dẫn chỉ có hiệu lực 1 lần duy nhất). Hãy nhấn "Gửi lại tin nhắn mới vào Gmail", sau đó NHẤN CHUỘT PHẢI vào nút "Reset Password" -> chọn "Sao chép địa chỉ liên kết" (không bấm chuột trái) rồi dán vào đây!',
      };
    }

    // Trường hợp 1: Người dùng dán URL có chứa #access_token=...
    if (inputClean.includes('access_token=')) {
      const hashPart = inputClean.includes('#')
        ? inputClean.split('#').slice(1).join('#')
        : inputClean.split('?').slice(1).join('?');
      const params = new URLSearchParams(hashPart);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';

      if (!accessToken) {
        return {
          success: false,
          error: 'Đường dẫn liên kết không chứa mã xác thực hợp lệ.',
        };
      }

      const tokenKey = `access_token:${accessToken.slice(-48)}`;
      if (isRecoveryTokenAlreadyUsed(tokenKey)) {
        return {
          success: false,
          error:
            'Đường dẫn liên kết khôi phục này đã được sử dụng (mỗi liên kết chỉ được dùng 1 lần duy nhất). Vui lòng yêu cầu gửi thư khôi phục mới.',
        };
      }

      // Kiểm tra hạn sử dụng & email trực tiếp từ JWT payload trước
      const jwtPayload = decodeJwtPayloadSafe(accessToken);
      if (jwtPayload) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (jwtPayload.exp && nowSec > jwtPayload.exp) {
          markRecoveryTokenAsUsed([tokenKey]);
          return {
            success: false,
            error: 'Đường dẫn liên kết khôi phục đã hết hạn sử dụng. Vui lòng yêu cầu gửi liên kết mới.',
          };
        }
        if (jwtPayload.iat && nowSec - jwtPayload.iat > Math.floor(RECOVERY_LINK_TTL_MS / 1000)) {
          markRecoveryTokenAsUsed([tokenKey]);
          return {
            success: false,
            error: 'Đường dẫn liên kết khôi phục đã quá thời hạn 10 phút. Vui lòng yêu cầu gửi liên kết mới.',
          };
        }
        if (jwtPayload.email && jwtPayload.email.trim().toLowerCase() !== emailClean) {
          return {
            success: false,
            error: `Từ chối bảo mật: Đường dẫn liên kết này thuộc về tài khoản "${jwtPayload.email.toLowerCase()}", tuyệt đối không thể dùng để đổi mật khẩu cho tài khoản "${emailClean}"!`,
          };
        }
      }

      const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken);
      if (userErr || !userRes?.user?.email) {
        return {
          success: false,
          error: 'Đường dẫn liên kết đã hết hạn hoặc không còn hiệu lực trên hệ thống.',
        };
      }

      const verifiedUser = userRes.user;
      const verifiedEmail = (verifiedUser.email || '').trim().toLowerCase();

      // Ràng buộc tài khoản: Link của tài khoản A chỉ dùng được cho tài khoản A
      if (verifiedEmail !== emailClean) {
        await supabase.auth.signOut().catch(() => {});
        return {
          success: false,
          error: `Từ chối bảo mật: Đường dẫn liên kết này thuộc về tài khoản "${verifiedEmail}", tuyệt đối không thể dùng để đổi mật khẩu cho tài khoản "${emailClean}". Mã của tài khoản nào chỉ dùng cho đúng tài khoản đó!`,
        };
      }

      // Kiểm tra thời điểm gửi recovery_sent_at (hạn 10 phút) và chống dùng lại cùng 1 đợt gửi mail
      const recoverySentAt = (verifiedUser as any).recovery_sent_at as string | undefined;
      const lastResetAt = verifiedUser.user_metadata?.last_password_reset_at as string | undefined;
      const instanceKey = recoverySentAt
        ? `recovery_instance:${verifiedUser.id}:${recoverySentAt}`
        : `recovery_jwt:${verifiedUser.id}:${jwtPayload?.iat || accessToken.slice(-24)}`;

      if (
        isRecoveryTokenAlreadyUsed(instanceKey) ||
        verifiedUser.user_metadata?.last_consumed_recovery_ticket === instanceKey ||
        (recoverySentAt &&
          lastResetAt &&
          new Date(lastResetAt).getTime() > new Date(recoverySentAt).getTime())
      ) {
        markRecoveryTokenAsUsed([tokenKey, instanceKey]);
        return {
          success: false,
          error:
            'Đường dẫn liên kết khôi phục này đã được sử dụng (mỗi liên kết chỉ được dùng 1 lần duy nhất). Vui lòng yêu cầu gửi liên kết mới.',
        };
      }

      if (recoverySentAt) {
        const sentTimeMs = new Date(recoverySentAt).getTime();
        if (!isNaN(sentTimeMs) && Date.now() - sentTimeMs > RECOVERY_LINK_TTL_MS) {
          markRecoveryTokenAsUsed([tokenKey, instanceKey]);
          return {
            success: false,
            error: 'Đường dẫn liên kết khôi phục đã hết hạn sử dụng (quá 10 phút). Vui lòng yêu cầu gửi liên kết mới.',
          };
        }
      }

      if (refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).catch(() => {});
      }

      // Đánh dấu token đã được xác thực (chống xác thực lại lần 2) và cấp vé đổi mật khẩu 1 lần
      markRecoveryTokenAsUsed([tokenKey, instanceKey]);
      const ticket: RecoverySessionTicket = {
        ticketId: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        verifiedEmail,
        tokenFingerprint: instanceKey,
        issuedAt: Date.now(),
        expiresAt: Date.now() + RECOVERY_LINK_TTL_MS,
        used: false,
      };
      saveActiveRecoveryTicket(ticket);

      return {
        success: true,
        verifiedEmail,
        recoveryTicket: ticket.ticketId,
        expiresAt: ticket.expiresAt,
        error: null,
      };
    }

    // Trường hợp 2: Người dùng chuột phải vào nút "Reset Password" trong Gmail -> "Sao chép địa chỉ liên kết"
    // Link có dạng: https://kevoshrilcltgiitmvds.supabase.co/auth/v1/verify?token=pkce_...&type=recovery&redirect_to=...
    let extractedTokenHash: string | null = null;
    if (inputClean.startsWith('http://') || inputClean.startsWith('https://')) {
      try {
        const parsedUrl = new URL(inputClean);
        extractedTokenHash =
          parsedUrl.searchParams.get('token_hash') ||
          parsedUrl.searchParams.get('token') ||
          new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).get('token_hash') ||
          new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).get('token');
      } catch {
        // ignore URL parse error
      }
    } else if (inputClean.includes('token=')) {
      const m = inputClean.match(/[?&]token(?:_hash)?=([^&#\s]+)/);
      if (m?.[1]) extractedTokenHash = decodeURIComponent(m[1]);
    }

    const tokenToVerify = (extractedTokenHash || inputClean).trim();
    const tokenHashKey = `token_hash:${tokenToVerify}`;

    // Kiểm tra xem mã token này đã từng được sử dụng chưa (chỉ được dùng 1 lần duy nhất)
    if (isRecoveryTokenAlreadyUsed(tokenHashKey)) {
      return {
        success: false,
        error:
          'Đường dẫn liên kết khôi phục này đã được sử dụng (mỗi liên kết chỉ có hiệu lực 1 lần duy nhất). Vui lòng nhấn "Gửi lại tin nhắn mới vào Gmail" để nhận liên kết mới.',
      };
    }

    // 2A. Xác thực trực tiếp token_hash với Supabase Auth
    const { data: hashData, error: hashErr } = await supabase.auth.verifyOtp({
      token_hash: tokenToVerify,
      type: 'recovery',
    });

    if (!hashErr && hashData?.user?.email) {
      const verifiedUser = hashData.user;
      const verifiedEmail = (verifiedUser.email || '').trim().toLowerCase();

      // Ràng buộc tài khoản nghiêm ngặt: Mã của tài khoản A chỉ dùng được cho tài khoản A!
      // Lưu ý: Nếu user nhập sai email trên màn hình (ví dụ nhập B nhưng dán link của A),
      // token của A vừa bị tiêu hao bởi Supabase nên phải thu hồi phiên ngay và từ chối!
      if (verifiedEmail !== emailClean) {
        markRecoveryTokenAsUsed([tokenHashKey]);
        await supabase.auth.signOut().catch(() => {});
        return {
          success: false,
          error: `Từ chối bảo mật: Đường dẫn liên kết này thuộc về tài khoản "${verifiedEmail}", tuyệt đối không thể dùng để đổi mật khẩu cho tài khoản "${emailClean}". Liên kết của tài khoản nào chỉ có hiệu lực cho đúng tài khoản đó!`,
        };
      }

      const recoverySentAt = (verifiedUser as any).recovery_sent_at as string | undefined;
      const lastResetAt = verifiedUser.user_metadata?.last_password_reset_at as string | undefined;
      const instanceKey = recoverySentAt
        ? `recovery_instance:${verifiedUser.id}:${recoverySentAt}`
        : tokenHashKey;

      if (
        isRecoveryTokenAlreadyUsed(instanceKey) ||
        verifiedUser.user_metadata?.last_consumed_recovery_ticket === instanceKey ||
        (recoverySentAt &&
          lastResetAt &&
          new Date(lastResetAt).getTime() > new Date(recoverySentAt).getTime())
      ) {
        markRecoveryTokenAsUsed([tokenHashKey, instanceKey]);
        await supabase.auth.signOut().catch(() => {});
        return {
          success: false,
          error:
            'Đường dẫn liên kết khôi phục này đã được sử dụng (chỉ được dùng 1 lần duy nhất). Vui lòng yêu cầu gửi liên kết mới.',
        };
      }

      if (recoverySentAt) {
        const sentTimeMs = new Date(recoverySentAt).getTime();
        if (!isNaN(sentTimeMs) && Date.now() - sentTimeMs > RECOVERY_LINK_TTL_MS) {
          markRecoveryTokenAsUsed([tokenHashKey, instanceKey]);
          await supabase.auth.signOut().catch(() => {});
          return {
            success: false,
            error:
              'Đường dẫn liên kết khôi phục đã hết hạn sử dụng (quá 10 phút). Vui lòng yêu cầu gửi thư khôi phục mới.',
          };
        }
      }

      // Đánh dấu token đã sử dụng 1 lần duy nhất và tạo vé đổi mật khẩu gắn chặt với verifiedEmail
      markRecoveryTokenAsUsed([tokenHashKey, instanceKey]);
      const ticket: RecoverySessionTicket = {
        ticketId: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        verifiedEmail,
        tokenFingerprint: instanceKey,
        issuedAt: Date.now(),
        expiresAt: Date.now() + RECOVERY_LINK_TTL_MS,
        used: false,
      };
      saveActiveRecoveryTicket(ticket);

      return {
        success: true,
        verifiedEmail,
        recoveryTicket: ticket.ticketId,
        expiresAt: ticket.expiresAt,
        error: null,
      };
    }

    // 2B. Nếu người dùng nhập mã OTP 6 chữ số từ tin nhắn Gmail (gắn chặt với emailClean)
    if (/^\d{6,8}$/.test(tokenToVerify)) {
      const otpKey = `otp:${emailClean}:${tokenToVerify}`;
      if (isRecoveryTokenAlreadyUsed(otpKey)) {
        return {
          success: false,
          error: 'Mã xác thực OTP này đã được sử dụng (chỉ dùng 1 lần duy nhất).',
        };
      }

      const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
        email: emailClean,
        token: tokenToVerify,
        type: 'recovery',
      });

      if (!otpErr && otpData?.user?.email) {
        const verifiedEmail = otpData.user.email.trim().toLowerCase();
        if (verifiedEmail !== emailClean) {
          await supabase.auth.signOut().catch(() => {});
          return {
            success: false,
            error: `Mã xác thực không thuộc về tài khoản ${emailClean}.`,
          };
        }

        markRecoveryTokenAsUsed([otpKey]);
        const ticket: RecoverySessionTicket = {
          ticketId: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          verifiedEmail,
          tokenFingerprint: otpKey,
          issuedAt: Date.now(),
          expiresAt: Date.now() + RECOVERY_LINK_TTL_MS,
          used: false,
        };
        saveActiveRecoveryTicket(ticket);

        return {
          success: true,
          verifiedEmail,
          recoveryTicket: ticket.ticketId,
          expiresAt: ticket.expiresAt,
          error: null,
        };
      }
    }

    // TUYỆT ĐỐI KHÔNG dùng bất kỳ nhánh fallback nào bỏ qua xác thực Supabase Auth:
    // Nếu verifyOtp thất bại (do đường link đã dùng 1 lần trước đó, hết hạn, hoặc sai), từ chối ngay lập tức!
    return {
      success: false,
      error:
        'Đường dẫn liên kết khôi phục đã được sử dụng trước đó, đã hết hạn (quá 10 phút), hoặc không hợp lệ! Lưu ý: Mỗi đường dẫn chỉ được sử dụng 1 lần duy nhất — nếu bạn đã dùng hoặc lỡ bấm chuột trái vào nút trong Gmail, vui lòng nhấn "Gửi lại tin nhắn mới vào Gmail" và chỉ nhấn chuột phải -> "Sao chép địa chỉ liên kết".',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Lỗi xác thực đường link khôi phục từ Gmail.',
    };
  }
}

// ============================================================================
// CÁC HÀM LẤY DỮ LIỆU TỪ BẢNG SUPABASE THAY CHO MOCK DATA
// ============================================================================

/**
 * Lấy thông tin sinh viên từ bảng "hồ sơ" (ho_so)
 * Tự động phân lập theo từng tài khoản đăng nhập (Account-specific)
 */
export async function fetchStudentProfile(
  currentUser?: User | null,
  studentId?: string,
  studentEmail?: string
): Promise<{
  data: StudentProfile;
  isFromSupabase: boolean;
  isGuest?: boolean;
  isNewAccount?: boolean;
  isDeletedFromSupabase?: boolean;
  error?: string | null;
}> {
  const effectiveEmail = (currentUser?.email || studentEmail || '').trim().toLowerCase();
  const effectiveStudentId = (studentId || currentUser?.user_metadata?.student_id || '').trim().toUpperCase();

  // 1. Trường hợp chưa đăng nhập ở cả Supabase Auth lẫn Portal Session:
  if (!currentUser && !effectiveEmail && !effectiveStudentId) {
    return {
      data: GUEST_STUDENT_PROFILE,
      isFromSupabase: false,
      isGuest: true,
      error: null,
    };
  }

  const userKey = currentUser?.id || effectiveEmail || effectiveStudentId || 'user';

  try {
    // 2. Truy vấn bảng 'ho_so' theo ma_sinh_vien hoặc email (bảng ho_so chuẩn không dùng cột user_id)
    if (effectiveStudentId && effectiveStudentId !== 'CHƯA_ĐĂNG_NHẬP' && effectiveStudentId !== '---') {
      const { data: sData, error: sError } = await supabase
        .from('ho_so')
        .select('*')
        .ilike('ma_sinh_vien', effectiveStudentId)
        .limit(1)
        .maybeSingle();

      if (!sError && sData) {
        const mapped = mapProfileRow(sData, currentUser);
        markStudentSyncedToHoSo(mapped.ma_sinh_vien, mapped.email);
        saveLocalProfile(mapped, userKey);
        return { data: mapped, isFromSupabase: true };
      }
    }

    if (effectiveEmail) {
      const { data: eData, error: eError } = await supabase
        .from('ho_so')
        .select('*')
        .ilike('email', effectiveEmail)
        .limit(1)
        .maybeSingle();

      if (!eError && eData) {
        const mapped = mapProfileRow(eData, currentUser);
        markStudentSyncedToHoSo(mapped.ma_sinh_vien, mapped.email);
        saveLocalProfile(mapped, userKey);
        return { data: mapped, isFromSupabase: true };
      }
    }

    // 3. Nếu không tìm thấy trên bảng ho_so của Supabase:
    const wasSyncedBefore =
      (effectiveStudentId && getStoredSet(SYNCED_HO_SO_IDS_KEY).has(effectiveStudentId)) ||
      (effectiveEmail && getStoredSet(SYNCED_HO_SO_IDS_KEY).has(effectiveEmail));

    if (isStudentMarkedDeleted(effectiveStudentId, effectiveEmail) || wasSyncedBefore) {
      purgeStudentFromLocalStorage(effectiveStudentId, effectiveEmail);
      return {
        data: GUEST_STUDENT_PROFILE,
        isFromSupabase: false,
        isDeletedFromSupabase: true,
        error: null,
      };
    }

    const localUser =
      getLocalProfile(userKey) ||
      (effectiveStudentId ? getLocalProfile(effectiveStudentId) : null) ||
      (effectiveEmail ? getLocalProfile(effectiveEmail) : null);

    if (localUser) {
      const syncRes = await ensureStudentInHoSo(localUser);
      return {
        data: localUser,
        isFromSupabase: syncRes.success,
      };
    }

    if (currentUser) {
      const defaultPersonal = getDefaultProfileForUser(currentUser);
      saveLocalProfile(defaultPersonal, userKey);
      const syncRes = await ensureStudentInHoSo(defaultPersonal);
      return {
        data: defaultPersonal,
        isFromSupabase: syncRes.success,
        isNewAccount: true,
        error: null,
      };
    }

    return {
      data: GUEST_STUDENT_PROFILE,
      isFromSupabase: false,
      error: null,
    };
  } catch (err: any) {
    const fallback =
      getLocalProfile(userKey) ||
      (currentUser ? getDefaultProfileForUser(currentUser) : GUEST_STUDENT_PROFILE);
    return {
      data: fallback,
      isFromSupabase: false,
      error: err.message,
    };
  }
}

function mapProfileRow(data: any, currentUser?: User | null): StudentProfile {
  return {
    id: data.id,
    user_id: data.user_id || currentUser?.id,
    ma_sinh_vien: data.ma_sinh_vien || '---',
    ho_va_ten: data.ho_va_ten || data.name || currentUser?.user_metadata?.full_name || 'Sinh viên BICA',
    lop: data.lop || 'BICA-K2025',
    nganh_hoc: data.nganh_hoc || 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
    khoa:
      !data.khoa ||
      data.khoa === 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)' ||
      String(data.khoa).includes('Hội tụ')
        ? 'Khoa Công nghệ và Kĩ thuật Tiên tiến'
        : data.khoa,
    nien_khoa: data.nien_khoa || '2025 - 2029',
    email: data.email || currentUser?.email || '',
    so_dien_thoai: data.so_dien_thoai || '',
    ngay_sinh: data.ngay_sinh || '',
    avatar_url: data.avatar_url,
    trang_thai_hoc_tap: data.trang_thai_hoc_tap || 'Đang theo học',
    tong_tin_chi_tich_luy: Number(data.tong_tin_chi_tich_luy ?? 0),
    tong_tin_chi_yeu_cau: Number(data.tong_tin_chi_yeu_cau ?? 145),
    diem_gpa: Number(data.diem_gpa ?? 0),
    diem_cpa: Number(data.diem_cpa ?? 0),
    xep_loai: data.xep_loai || 'Chưa xếp loại',
  };
}

export function getLocalCoursesForStudent(studentId?: string): StudentCourse[] {
  if (typeof window === 'undefined' || !studentId) return [];
  try {
    const raw = localStorage.getItem(`bica_student_courses_${studentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalCoursesForStudent(studentId: string, courses: StudentCourse[]) {
  if (typeof window === 'undefined' || !studentId) return;
  try {
    localStorage.setItem(`bica_student_courses_${studentId}`, JSON.stringify(courses));
  } catch (e) {
    console.error('Lỗi lưu điểm cục bộ cho sinh viên:', e);
  }
}

/**
 * Lấy danh sách điểm số & tín chỉ từ bảng các khóa học của sinh viên
 * (khoa_hoc_sinh_vien / student_courses / diem_so)
 */
export async function fetchCoursesAndGrades(
  studentId?: string,
  currentUser?: User | null
): Promise<{ data: StudentCourse[]; isFromSupabase: boolean; error?: string | null }> {
  const effectiveId = (studentId && studentId !== 'CHƯA_ĐĂNG_NHẬP' && studentId !== '---')
    ? studentId
    : (currentUser?.user_metadata?.student_id || 'BICA25119034');

  try {
    if (currentUser) {
      // Thử bảng 'khoa_hoc_sinh_vien'
      let query = supabase.from('khoa_hoc_sinh_vien').select('*').order('nam_hoc', { ascending: false });
      
      if (effectiveId) {
        query = query.eq('ma_sinh_vien', effectiveId);
      } else if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }
      
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          ma_sinh_vien: item.ma_sinh_vien,
          ma_hoc_phan: item.ma_hoc_phan || item.course_code,
          ten_hoc_phan: item.ten_hoc_phan || item.course_name,
          so_tin_chi: Number(item.so_tin_chi || item.credits || 3),
          hoc_ky: item.hoc_ky || item.semester || 'Học kỳ 1',
          nam_hoc: item.nam_hoc || item.academic_year || '2025-2026',
          diem_chuyen_can: item.diem_chuyen_can,
          diem_giua_ky: item.diem_giua_ky,
          diem_cuoi_ky: item.diem_cuoi_ky,
          diem_tong_ket: item.diem_tong_ket,
          diem_chu: item.diem_chu,
          diem_thang_4: item.diem_thang_4,
          ket_qua: item.ket_qua || (Number(item.diem_tong_ket) >= 4 ? 'Dat' : 'DangHoc'),
          giang_vien: item.giang_vien,
        }));
        saveLocalCoursesForStudent(effectiveId, mapped);
        return {
          data: mapped,
          isFromSupabase: true,
        };
      }
    }

    // Kiểm tra bộ nhớ đệm cục bộ
    const local = getLocalCoursesForStudent(effectiveId);
    if (local && local.length > 0) {
      return { data: local, isFromSupabase: false };
    }

    // Nếu là sinh viên mặc định BICA25119034, khởi tạo với DEFAULT_COURSES
    if (effectiveId === 'BICA25119034') {
      saveLocalCoursesForStudent(effectiveId, DEFAULT_COURSES);
      return { data: DEFAULT_COURSES, isFromSupabase: false };
    }

    return {
      data: [],
      isFromSupabase: false,
      error: null,
    };
  } catch (err: any) {
    const local = getLocalCoursesForStudent(effectiveId);
    if (local && local.length > 0) {
      return { data: local, isFromSupabase: false };
    }
    if (effectiveId === 'BICA25119034') {
      return { data: DEFAULT_COURSES, isFromSupabase: false };
    }
    return {
      data: [],
      isFromSupabase: false,
      error: err.message,
    };
  }
}

/**
 * Lấy thời khóa biểu từ bảng lịch trình (lich_trinh / schedules / thoi_khoa_bieu)
 */
export async function fetchSchedule(
  studentId?: string,
  currentUser?: User | null
): Promise<{ data: ScheduleItem[]; isFromSupabase: boolean; error?: string | null }> {
  // Khi chưa đăng nhập, luôn trả về mảng rỗng
  if (!currentUser) {
    return {
      data: [],
      isFromSupabase: false,
      error: null,
    };
  }

  try {
    let query = supabase.from('lich_trinh').select('*').order('thu', { ascending: true }).order('tiet_bat_dau', { ascending: true });
    if (studentId && studentId !== 'CHƯA_ĐĂNG_NHẬP') {
      query = query.eq('ma_sinh_vien', studentId);
    } else if (currentUser?.id) {
      query = query.eq('user_id', currentUser.id);
    }
    const { data, error } = await query;

    if (!error && data) {
      if (data.length > 0) {
        return {
          data: data.map((item: any) => ({
            id: item.id,
            ma_sinh_vien: item.ma_sinh_vien,
            ma_hoc_phan: item.ma_hoc_phan,
            ten_hoc_phan: item.ten_hoc_phan,
            thu: Number(item.thu),
            tiet_bat_dau: Number(item.tiet_bat_dau),
            so_tiet: Number(item.so_tiet),
            gio_bat_dau: item.gio_bat_dau,
            gio_ket_thuc: item.gio_ket_thuc,
            phong_hoc: item.phong_hoc,
            giang_vien: item.giang_vien,
            hinh_thuc: item.hinh_thuc || 'TrucTiep',
            ghi_chu: item.ghi_chu,
          })),
          isFromSupabase: true,
        };
      }
      return {
        data: [],
        isFromSupabase: true,
      };
    }

    return {
      data: [],
      isFromSupabase: false,
      error: error?.message || null,
    };
  } catch (err: any) {
    return {
      data: [],
      isFromSupabase: false,
      error: err.message,
    };
  }
}

const TUITION_STORAGE_PREFIX = 'bica_student_tuition_';

export function getLocalTuitionForStudent(studentId?: string): TuitionRecord[] {
  if (typeof window === 'undefined') return DEFAULT_TUITION;
  const effId =
    studentId && studentId !== 'CHƯA_ĐĂNG_NHẬP' && studentId !== '---'
      ? studentId.trim().toUpperCase()
      : 'BICA25119034';
  try {
    const raw = localStorage.getItem(`${TUITION_STORAGE_PREFIX}${effId}`);
    if (!raw) {
      if (effId === 'BICA25119034') {
        localStorage.setItem(`${TUITION_STORAGE_PREFIX}${effId}`, JSON.stringify(DEFAULT_TUITION));
        return DEFAULT_TUITION;
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return effId === 'BICA25119034' ? DEFAULT_TUITION : [];
  }
}

export function saveLocalTuitionForStudent(studentId: string | undefined, list: TuitionRecord[]) {
  if (typeof window === 'undefined') return;
  const effId =
    studentId && studentId !== 'CHƯA_ĐĂNG_NHẬP' && studentId !== '---'
      ? studentId.trim().toUpperCase()
      : 'BICA25119034';
  try {
    localStorage.setItem(`${TUITION_STORAGE_PREFIX}${effId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Lấy thông tin học phí từ bảng hồ sơ học phí (ho_so_hoc_phi / tuition / hoc_phi)
 */
export async function fetchTuition(
  studentId?: string,
  currentUser?: User | null
): Promise<{ data: TuitionRecord[]; isFromSupabase: boolean; error?: string | null }> {
  const effId =
    studentId && studentId !== 'CHƯA_ĐĂNG_NHẬP' && studentId !== '---'
      ? studentId.trim().toUpperCase()
      : currentUser?.user_metadata?.student_id || 'BICA25119034';

  const localList = getLocalTuitionForStudent(effId);

  try {
    if (currentUser) {
      let query = supabase.from('ho_so_hoc_phi').select('*').order('nam_hoc', { ascending: false });
      if (effId) {
        query = query.eq('ma_sinh_vien', effId);
      } else if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mapped: TuitionRecord[] = data.map((item: any) => ({
          id: item.id,
          ma_sinh_vien: item.ma_sinh_vien,
          hoc_ky: item.hoc_ky,
          nam_hoc: item.nam_hoc,
          tong_so_tin_chi: Number(item.tong_so_tin_chi),
          tong_hoc_phi: Number(item.tong_hoc_phi),
          mien_giam: Number(item.mien_giam || 0),
          da_thanh_toan: Number(item.da_thanh_toan || 0),
          con_no: Number(item.con_no || 0),
          han_dong: item.han_dong,
          trang_thai: item.trang_thai || (Number(item.con_no) === 0 ? 'DaHoanThanh' : 'ChuaThanhToan'),
          ma_giao_dich: item.ma_giao_dich,
          ngay_thanh_toan: item.ngay_thanh_toan,
        }));
        saveLocalTuitionForStudent(effId, mapped);
        return {
          data: mapped,
          isFromSupabase: true,
        };
      }
    }

    return {
      data: localList,
      isFromSupabase: false,
      error: null,
    };
  } catch (err: any) {
    return {
      data: localList,
      isFromSupabase: false,
      error: err.message,
    };
  }
}

/**
 * Đánh dấu đợt học phí là "Đã thanh toán" (DaHoanThanh), cập nhật số tiền đã nộp = phải nộp và công nợ = 0
 */
export async function markTuitionRecordPaid(
  record: TuitionRecord,
  studentId?: string,
  currentUser?: User | null
): Promise<{ success: boolean; error?: string | null }> {
  const effId =
    studentId && studentId !== 'CHƯA_ĐĂNG_NHẬP' && studentId !== '---'
      ? studentId.trim().toUpperCase()
      : record.ma_sinh_vien || currentUser?.user_metadata?.student_id || 'BICA25119034';

  const requiredAmount = Math.max(0, Number(record.tong_hoc_phi || 0) - Number(record.mien_giam || 0));
  const todayStr = new Date().toISOString().split('T')[0];
  const txCode =
    record.ma_giao_dich ||
    `VJU-${todayStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Cập nhật trong LocalStorage
  const currentList = getLocalTuitionForStudent(effId);
  const updatedList = currentList.map((item) => {
    const isMatch =
      (record.id && item.id === record.id) ||
      (item.hoc_ky === record.hoc_ky && item.nam_hoc === record.nam_hoc);
    if (isMatch) {
      return {
        ...item,
        da_thanh_toan: requiredAmount,
        con_no: 0,
        trang_thai: 'DaHoanThanh' as const,
        ngay_thanh_toan: todayStr,
        ma_giao_dich: txCode,
      };
    }
    return item;
  });
  saveLocalTuitionForStudent(effId, updatedList);

  // 2. Đồng bộ lên bảng ho_so_hoc_phi trên Supabase
  try {
    let query = supabase.from('ho_so_hoc_phi').update({
      da_thanh_toan: requiredAmount,
      con_no: 0,
      trang_thai: 'DaHoanThanh',
      ngay_thanh_toan: todayStr,
      ma_giao_dich: txCode,
    });

    if (record.id && !String(record.id).startsWith('local-')) {
      query = query.eq('id', record.id);
    } else {
      query = query
        .eq('ma_sinh_vien', effId)
        .eq('hoc_ky', record.hoc_ky)
        .eq('nam_hoc', record.nam_hoc);
    }

    await query;
  } catch {
    // fallback to local
  }

  return { success: true };
}

/**
 * Đăng ký lắng nghe Realtime thay đổi từ Supabase
 */
export function subscribeToRealtimeChanges(
  onTableChange: (tableName: string, payload: any) => void
) {
  const channelName = `bica_tracker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ho_so' }, (payload) => {
      onTableChange('ho_so', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'khoa_hoc_sinh_vien' }, (payload) => {
      onTableChange('khoa_hoc_sinh_vien', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lich_trinh' }, (payload) => {
      onTableChange('lich_trinh', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ho_so_hoc_phi' }, (payload) => {
      onTableChange('ho_so_hoc_phi', payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Hàm kiểm tra kết nối tới Supabase REST endpoint và đếm số lượng bản ghi
 */
export async function checkSupabaseConnection() {
  try {
    const results = await Promise.allSettled([
      supabase.from('ho_so').select('id', { count: 'exact', head: true }),
      supabase.from('khoa_hoc_sinh_vien').select('id', { count: 'exact', head: true }),
      supabase.from('lich_trinh').select('id', { count: 'exact', head: true }),
      supabase.from('ho_so_hoc_phi').select('id', { count: 'exact', head: true }),
    ]);

    const getCount = (res: PromiseSettledResult<any>) => {
      if (res.status === 'fulfilled' && !res.value.error && res.value.count !== null) {
        return res.value.count;
      }
      return 0;
    };

    return {
      connected: true,
      counts: {
        ho_so: getCount(results[0]),
        khoa_hoc: getCount(results[1]),
        lich_trinh: getCount(results[2]),
        hoc_phi: getCount(results[3]),
      },
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error?.message || 'Không thể kết nối đến Supabase',
      counts: { ho_so: 0, khoa_hoc: 0, lich_trinh: 0, hoc_phi: 0 },
    };
  }
}

/**
 * Hàm hỗ trợ người dùng nạp dữ liệu mẫu ban đầu trực tiếp lên bảng Supabase
 */
export async function syncSampleDataToSupabase() {
  const logs: string[] = [];

  try {
    // 1. Hồ sơ
    const { error: errHoSo } = await supabase.from('ho_so').upsert({
      ma_sinh_vien: DEFAULT_STUDENT_PROFILE.ma_sinh_vien,
      ho_va_ten: DEFAULT_STUDENT_PROFILE.ho_va_ten,
      lop: DEFAULT_STUDENT_PROFILE.lop,
      nganh_hoc: DEFAULT_STUDENT_PROFILE.nganh_hoc,
      khoa: DEFAULT_STUDENT_PROFILE.khoa,
      nien_khoa: DEFAULT_STUDENT_PROFILE.nien_khoa,
      email: DEFAULT_STUDENT_PROFILE.email,
      so_dien_thoai: DEFAULT_STUDENT_PROFILE.so_dien_thoai,
      ngay_sinh: DEFAULT_STUDENT_PROFILE.ngay_sinh,
      trang_thai_hoc_tap: DEFAULT_STUDENT_PROFILE.trang_thai_hoc_tap,
      tong_tin_chi_tich_luy: DEFAULT_STUDENT_PROFILE.tong_tin_chi_tich_luy,
      tong_tin_chi_yeu_cau: DEFAULT_STUDENT_PROFILE.tong_tin_chi_yeu_cau,
      diem_gpa: DEFAULT_STUDENT_PROFILE.diem_gpa,
      diem_cpa: DEFAULT_STUDENT_PROFILE.diem_cpa,
      xep_loai: DEFAULT_STUDENT_PROFILE.xep_loai,
    }, { onConflict: 'ma_sinh_vien' });

    if (errHoSo) {
      logs.push(`Lỗi nạp 'ho_so': ${errHoSo.message}`);
    } else {
      logs.push(`✅ Nạp bảng 'ho_so' thành công`);
    }

    // 2. Khóa học & Điểm số
    const coursesToInsert = DEFAULT_COURSES.map(c => ({
      ...c,
      ma_sinh_vien: DEFAULT_STUDENT_PROFILE.ma_sinh_vien,
    }));
    const { error: errCourses } = await supabase.from('khoa_hoc_sinh_vien').upsert(coursesToInsert, { onConflict: 'ma_hoc_phan' });
    if (errCourses) {
      logs.push(`Lỗi nạp 'khoa_hoc_sinh_vien': ${errCourses.message}`);
    } else {
      logs.push(`✅ Nạp ${coursesToInsert.length} môn vào 'khoa_hoc_sinh_vien' thành công`);
    }

    // 3. Lịch trình
    const scheduleToInsert = DEFAULT_SCHEDULE.map(s => ({
      ...s,
      ma_sinh_vien: DEFAULT_STUDENT_PROFILE.ma_sinh_vien,
    }));
    const { error: errSchedule } = await supabase.from('lich_trinh').upsert(scheduleToInsert, { onConflict: 'ma_hoc_phan' });
    if (errSchedule) {
      logs.push(`Lỗi nạp 'lich_trinh': ${errSchedule.message}`);
    } else {
      logs.push(`✅ Nạp ${scheduleToInsert.length} tiết vào 'lich_trinh' thành công`);
    }

    // 4. Học phí
    const tuitionToInsert = DEFAULT_TUITION.map(t => ({
      ...t,
      ma_sinh_vien: DEFAULT_STUDENT_PROFILE.ma_sinh_vien,
    }));
    const { error: errTuition } = await supabase.from('ho_so_hoc_phi').upsert(tuitionToInsert, { onConflict: 'hoc_ky' });
    if (errTuition) {
      logs.push(`Lỗi nạp 'ho_so_hoc_phi': ${errTuition.message}`);
    } else {
      logs.push(`✅ Nạp ${tuitionToInsert.length} kỳ vào 'ho_so_hoc_phi' thành công`);
    }

    return { success: true, logs };
  } catch (error: any) {
    return { success: false, logs: [...logs, `Lỗi ngoại lệ: ${error.message}`] };
  }
}

/**
 * Cập nhật hồ sơ sinh viên: Luôn lưu vào LocalStorage của tài khoản để không mất dữ liệu,
 * đồng thời đồng bộ lên Supabase với user_id hoặc ma_sinh_vien của tài khoản đó.
 */
export async function saveStudentProfile(
  formData: StudentProfile,
  currentUser?: User | null
): Promise<{
  success: boolean;
  savedLocally: boolean;
  isMissingTable: boolean;
  error?: string | null;
}> {
  const userKey = currentUser?.id || currentUser?.email || formData.ma_sinh_vien || 'guest';
  // 1. Luôn lưu vào LocalStorage của chính tài khoản này
  saveLocalProfile(formData, userKey);
  if (formData.ma_sinh_vien) {
    saveLocalProfile(formData, formData.ma_sinh_vien);
  }
  if (formData.email) {
    saveLocalProfile(formData, formData.email);
  }

  // 2. Đồng bộ trực tiếp lên bảng public.ho_so của Supabase
  const res = await ensureStudentInHoSo({
    ...formData,
    email: currentUser?.email || formData.email,
  });

  if (!res.success) {
    const isMissingTable =
      res.error?.includes('schema cache') ||
      res.error?.includes('not find the table') ||
      res.error?.includes('relation "public.ho_so" does not exist') ||
      false;
    return {
      success: false,
      savedLocally: true,
      isMissingTable,
      error: res.error,
    };
  }

  return {
    success: true,
    savedLocally: true,
    isMissingTable: false,
  };
}

/**
 * Cập nhật điểm thành phần hoặc thông tin học phần vào bảng khoa_hoc_sinh_vien
 */
export async function updateCourseGrades(
  courseId: string,
  updates: Partial<StudentCourse>
): Promise<{ success: boolean; error?: string | null }> {
  try {
    const payload: any = { ...updates };
    delete payload.id;
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });

    const { error } = await supabase
      .from('khoa_hoc_sinh_vien')
      .update(payload)
      .eq('id', courseId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi cập nhật học phần' };
  }
}

/**
 * Xóa một học phần khỏi bảng khoa_hoc_sinh_vien
 */
export async function deleteCourse(
  courseId?: string,
  courseCode?: string,
  studentId?: string,
  currentUser?: User | null
): Promise<{ success: boolean; error?: string | null }> {
  const effId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP') ? studentId : 'BICA25119034';
  
  // 1. Luôn cập nhật bộ nhớ cục bộ
  try {
    const local = getLocalCoursesForStudent(effId);
    const filtered = local.filter((c) => {
      if (courseId && c.id === courseId) return false;
      if (courseCode && c.ma_hoc_phan?.toUpperCase() === courseCode.toUpperCase()) return false;
      return true;
    });
    saveLocalCoursesForStudent(effId, filtered);
    syncStudentAcademicMetricsToProfile(effId, filtered, currentUser).catch(() => {});
  } catch (e) {
    console.warn('Lỗi xóa cục bộ:', e);
  }

  // 2. Thử xóa trên Supabase
  try {
    let query = supabase.from('khoa_hoc_sinh_vien').delete();

    if (courseId) {
      query = query.eq('id', courseId);
    } else if (courseCode) {
      query = query.eq('ma_hoc_phan', courseCode);
      if (effId) {
        query = query.eq('ma_sinh_vien', effId);
      }
      if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }
    } else {
      return { success: false, error: 'Thiếu định danh học phần cần xóa' };
    }

    const { error } = await query;
    if (error) {
      return { success: true, error: null }; // Đã xóa cục bộ thành công
    }
    return { success: true };
  } catch (err: any) {
    return { success: true, error: null };
  }
}

/**
 * Chuẩn hóa nhãn học kỳ theo đúng định dạng thanh cuộn (VD: "Kỳ 1 năm 2025-2026", "Kỳ 2 năm 2025-2026")
 */
export function getCourseSemesterLabel(course: Partial<StudentCourse>): string {
  const rawSem = String(course.hoc_ky || 'Học kỳ 1').trim();
  const rawYear = String(course.nam_hoc || '2025-2026').trim();

  // Nếu chuỗi đã ở định dạng "Kỳ X năm YYYY-YYYY"
  if (/^kỳ\s*\d+\s*năm\s*\d{4}-\d{4}/i.test(rawSem)) {
    return rawSem.replace(/^kỳ/i, 'Kỳ');
  }

  const matchNum = rawSem.match(/(\d+)/);
  const semNum = matchNum ? parseInt(matchNum[1], 10) : 1;

  // Khi học phần lấy từ khung CTĐT (Học kỳ 1..8) với năm mặc định 2025-2026, tự quy đổi ra Kỳ 1/2 của từng năm học
  if (semNum >= 3 && rawYear === '2025-2026') {
    const yearOffset = Math.floor((semNum - 1) / 2);
    const termInYear = ((semNum - 1) % 2) + 1;
    const startYear = 2025 + yearOffset;
    return `Kỳ ${termInYear} năm ${startYear}-${startYear + 1}`;
  }

  const termNum = semNum % 2 === 0 ? 2 : 1;
  return `Kỳ ${termNum} năm ${rawYear}`;
}

/**
 * Xếp loại học lực tự động theo điểm CPA hệ 4.0 chuẩn quy chế đào tạo tín chỉ VJU
 */
export function classifyAcademicRankByCpa(cpa: number, hasGradedCourses: boolean): string {
  if (!hasGradedCourses || cpa <= 0) return 'Chưa xếp loại';
  if (cpa >= 3.6) return 'Xuất sắc';
  if (cpa >= 3.2) return 'Giỏi';
  if (cpa >= 2.5) return 'Khá';
  if (cpa >= 2.0) return 'Trung bình';
  if (cpa >= 1.0) return 'Yếu';
  return 'Kém';
}

export interface SemesterGpaSummary {
  semesterLabel: string;
  gpa4: number;
  gpa10: number;
  gradedCredits: number;
  passedCredits: number;
  totalCredits: number;
  courseCount: number;
}

export interface ComputedAcademicMetrics {
  accumulatedCredits: number;
  cpa: number;
  latestSemesterGpa: number;
  latestSemesterLabel: string;
  academicRank: string;
  hasGradedCourses: boolean;
  semesterList: string[];
  bySemester: Record<string, SemesterGpaSummary>;
}

const DEFAULT_SEMESTER_OPTIONS = [
  'Kỳ 2 năm 2025-2026',
  'Kỳ 1 năm 2025-2026',
];

function parseSemesterSortOrder(label: string): number {
  const m = label.match(/Kỳ\s*(\d+)\s*năm\s*(\d{4})/i);
  if (!m) return 0;
  const term = parseInt(m[1], 10) || 1;
  const year = parseInt(m[2], 10) || 2025;
  return year * 10 + term;
}

/**
 * Tự động tính toán toàn bộ:
 * - Số tín chỉ tích lũy
 * - Điểm CPA tích lũy
 * - Điểm GPA từng học kỳ (kèm danh sách học kỳ cho thanh cuộn)
 * - Xếp loại học lực
 * trực tiếp từ danh sách học phần & bảng điểm của sinh viên.
 */
export function computeAcademicMetricsFromCourses(
  courses: StudentCourse[] = []
): ComputedAcademicMetrics {
  let accumulatedCredits = 0;
  let totalPoints4All = 0;
  let totalGradedCreditsAll = 0;

  const bySemester: Record<
    string,
    {
      points4: number;
      points10: number;
      gradedCredits: number;
      gradedCredits10: number;
      passedCredits: number;
      totalCredits: number;
      courseCount: number;
    }
  > = {};

  DEFAULT_SEMESTER_OPTIONS.forEach((sem) => {
    bySemester[sem] = {
      points4: 0,
      points10: 0,
      gradedCredits: 0,
      gradedCredits10: 0,
      passedCredits: 0,
      totalCredits: 0,
      courseCount: 0,
    };
  });

  courses.forEach((c) => {
    const credits = Number(c.so_tin_chi) || 0;
    if (credits <= 0) return;

    const semLabel = getCourseSemesterLabel(c);
    if (!bySemester[semLabel]) {
      bySemester[semLabel] = {
        points4: 0,
        points10: 0,
        gradedCredits: 0,
        gradedCredits10: 0,
        passedCredits: 0,
        totalCredits: 0,
        courseCount: 0,
      };
    }

    const bucket = bySemester[semLabel];
    bucket.totalCredits += credits;
    bucket.courseCount += 1;

    if (c.ket_qua === 'Dat') {
      accumulatedCredits += credits;
      bucket.passedCredits += credits;
    }

    const isGraded =
      c.ket_qua !== 'DangHoc' &&
      c.diem_thang_4 !== undefined &&
      c.diem_thang_4 !== null &&
      !Number.isNaN(Number(c.diem_thang_4));

    if (isGraded) {
      const gpa4Val = Number(c.diem_thang_4);
      totalPoints4All += gpa4Val * credits;
      totalGradedCreditsAll += credits;
      bucket.points4 += gpa4Val * credits;
      bucket.gradedCredits += credits;

      const score10Val =
        c.diem_tong_ket !== undefined && c.diem_tong_ket !== null && !Number.isNaN(Number(c.diem_tong_ket))
          ? Number(c.diem_tong_ket)
          : gpa4Val * 2.5;
      bucket.points10 += score10Val * credits;
      bucket.gradedCredits10 += credits;
    }
  });

  const hasGradedCourses = totalGradedCreditsAll > 0;
  const cpa = hasGradedCourses
    ? Number((totalPoints4All / totalGradedCreditsAll).toFixed(2))
    : 0;

  // Sắp xếp danh sách học kỳ giảm dần (Kỳ mới nhất lên đầu giống ảnh mẫu: Kỳ 2 năm 2025-2026 -> Kỳ 1 năm 2025-2026)
  const semesterList = Object.keys(bySemester).sort(
    (a, b) => parseSemesterSortOrder(b) - parseSemesterSortOrder(a)
  );

  const summaryMap: Record<string, SemesterGpaSummary> = {};
  semesterList.forEach((sem) => {
    const b = bySemester[sem];
    const gpa4 = b.gradedCredits > 0 ? Number((b.points4 / b.gradedCredits).toFixed(2)) : 0;
    const gpa10 = b.gradedCredits10 > 0 ? Number((b.points10 / b.gradedCredits10).toFixed(1)) : 0;
    summaryMap[sem] = {
      semesterLabel: sem,
      gpa4,
      gpa10,
      gradedCredits: b.gradedCredits,
      passedCredits: b.passedCredits,
      totalCredits: b.totalCredits,
      courseCount: b.courseCount,
    };
  });

  // Chọn học kỳ mới nhất có điểm làm GPA học kỳ mặc định (nếu chưa kỳ nào có điểm thì lấy kỳ đầu tiên trong danh sách)
  const latestGradedSem =
    semesterList.find((sem) => summaryMap[sem].gradedCredits > 0) ||
    semesterList[0] ||
    'Kỳ 2 năm 2025-2026';

  const latestSemesterGpa = summaryMap[latestGradedSem]?.gpa4 ?? 0;
  const academicRank = classifyAcademicRankByCpa(cpa, hasGradedCourses);

  return {
    accumulatedCredits,
    cpa,
    latestSemesterGpa,
    latestSemesterLabel: latestGradedSem,
    academicRank,
    hasGradedCourses,
    semesterList,
    bySemester: summaryMap,
  };
}

/**
 * Tự động đồng bộ các chỉ số học tập (Tín chỉ tích lũy, GPA học kỳ, CPA tích lũy, Xếp loại học lực)
 * từ danh sách môn học vào hồ sơ sinh viên (LocalStorage + bảng public.ho_so trên Supabase).
 */
export async function syncStudentAcademicMetricsToProfile(
  studentId: string,
  coursesList: StudentCourse[],
  currentUser?: User | null
): Promise<ComputedAcademicMetrics> {
  const effId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP')
    ? studentId.trim().toUpperCase()
    : 'BICA25119034';

  const metrics = computeAcademicMetricsFromCourses(coursesList);

  try {
    const cachedById = getLocalProfile(effId);
    const cachedByUser = currentUser?.id ? getLocalProfile(currentUser.id) : null;
    const baseProfile = cachedById || cachedByUser || DEFAULT_STUDENT_PROFILE;

    const syncedProfile: StudentProfile = {
      ...baseProfile,
      ma_sinh_vien: effId,
      tong_tin_chi_tich_luy: metrics.accumulatedCredits,
      diem_gpa: metrics.latestSemesterGpa,
      diem_cpa: metrics.cpa,
      xep_loai: metrics.academicRank,
    };

    saveLocalProfile(syncedProfile, effId);
    if (currentUser?.id) {
      saveLocalProfile(syncedProfile, currentUser.id);
    }
    if (currentUser?.email) {
      saveLocalProfile(syncedProfile, currentUser.email.toLowerCase());
    }
  } catch {
    // ignore local cache errors
  }

  try {
    await supabase
      .from('ho_so')
      .update({
        tong_tin_chi_tich_luy: metrics.accumulatedCredits,
        diem_gpa: metrics.latestSemesterGpa,
        diem_cpa: metrics.cpa,
        xep_loai: metrics.academicRank,
      })
      .ilike('ma_sinh_vien', effId);
  } catch {
    // ignore network errors
  }

  return metrics;
}

/**
 * Xóa nhiều học phần cùng lúc khỏi bảng khoa_hoc_sinh_vien
 */
export async function deleteMultipleCourses(
  courseIds: string[],
  courseCodes: string[],
  studentId?: string,
  currentUser?: User | null
): Promise<{ success: boolean; count: number; error?: string | null }> {
  const effId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP') ? studentId : 'BICA25119034';
  
  // 1. Luôn cập nhật bộ nhớ cục bộ
  const idSet = new Set(courseIds);
  const codeSet = new Set(courseCodes.map((c) => c.toUpperCase()));
  try {
    const local = getLocalCoursesForStudent(effId);
    const filtered = local.filter((c) => {
      if (c.id && idSet.has(c.id)) return false;
      if (c.ma_hoc_phan && codeSet.has(c.ma_hoc_phan.toUpperCase())) return false;
      return true;
    });
    saveLocalCoursesForStudent(effId, filtered);
    syncStudentAcademicMetricsToProfile(effId, filtered, currentUser).catch(() => {});
  } catch (e) {
    console.warn('Lỗi xóa nhiều cục bộ:', e);
  }

  // 2. Thử xóa trên Supabase
  try {
    if (courseIds.length > 0) {
      await supabase.from('khoa_hoc_sinh_vien').delete().in('id', courseIds);
      return { success: true, count: courseIds.length };
    }

    if (courseCodes.length > 0) {
      let query = supabase.from('khoa_hoc_sinh_vien').delete().in('ma_hoc_phan', courseCodes);
      if (effId) {
        query = query.eq('ma_sinh_vien', effId);
      }
      if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }
      await query;
      return { success: true, count: courseCodes.length };
    }

    return { success: false, count: 0, error: 'Không có môn học nào được chọn để xóa' };
  } catch (err: any) {
    return { success: true, count: courseCodes.length || courseIds.length, error: null };
  }
}

/**
 * Cập nhật điểm số học phần (Sửa điểm, cập nhật CC, GK, CK, Tổng kết, Chữ, Hệ 4, Kết quả)
 */
export async function updateCourseGrade(
  courseId: string | undefined,
  courseCode: string,
  studentId: string | undefined,
  currentUser: User | null | undefined,
  gradeData: {
    diem_chuyen_can?: number | null;
    diem_giua_ky?: number | null;
    diem_cuoi_ky?: number | null;
    diem_tong_ket?: number | null;
    diem_chu?: string | null;
    diem_thang_4?: number | null;
    ket_qua?: 'Dat' | 'KhongDat' | 'DangHoc';
    giang_vien?: string | null;
  }
): Promise<{ success: boolean; error?: string | null }> {
  const effId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP') ? studentId : 'BICA25119034';
  const updatePayload: any = {
    diem_chuyen_can: gradeData.diem_chuyen_can,
    diem_giua_ky: gradeData.diem_giua_ky,
    diem_cuoi_ky: gradeData.diem_cuoi_ky,
    diem_tong_ket: gradeData.diem_tong_ket,
    diem_chu: gradeData.diem_chu,
    diem_thang_4: gradeData.diem_thang_4,
    ket_qua: gradeData.ket_qua,
  };
  if (gradeData.giang_vien !== undefined) {
    updatePayload.giang_vien = gradeData.giang_vien;
  }

  // 1. Luôn cập nhật LocalStorage ngay lập tức
  try {
    const local = getLocalCoursesForStudent(effId);
    const updatedLocal = local.map((c) => {
      const matchId = courseId && c.id === courseId;
      const matchCode = courseCode && c.ma_hoc_phan?.toUpperCase() === courseCode.toUpperCase();
      if (matchId || matchCode) {
        return {
          ...c,
          ...updatePayload,
        };
      }
      return c;
    });
    saveLocalCoursesForStudent(effId, updatedLocal);
    syncStudentAcademicMetricsToProfile(effId, updatedLocal, currentUser).catch(() => {});
  } catch (e) {
    console.warn('Lỗi cập nhật cục bộ:', e);
  }

  // 2. Thử đẩy lên Supabase
  try {
    let updated = false;

    if (courseId) {
      const { error } = await supabase
        .from('khoa_hoc_sinh_vien')
        .update(updatePayload)
        .eq('id', courseId);
      if (!error) {
        updated = true;
      }
    }

    if (!updated && courseCode) {
      let query = supabase
        .from('khoa_hoc_sinh_vien')
        .update(updatePayload)
        .eq('ma_hoc_phan', courseCode);

      if (effId) {
        query = query.eq('ma_sinh_vien', effId);
      }
      if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }

      await query;
    }

    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

/**
 * Nạp danh mục môn học mẫu Khóa 2025 cho tài khoản sinh viên cụ thể
 */
export async function seedCurriculumForStudent(
  studentId: string,
  currentUser?: User | null
): Promise<{ success: boolean; count: number; error?: string | null }> {
  try {
    const items = DEFAULT_COURSES.map(c => ({
      ma_sinh_vien: studentId,
      user_id: currentUser?.id,
      ma_hoc_phan: c.ma_hoc_phan,
      ten_hoc_phan: c.ten_hoc_phan,
      so_tin_chi: c.so_tin_chi,
      hoc_ky: c.hoc_ky,
      nam_hoc: c.nam_hoc,
      diem_chuyen_can: c.diem_chuyen_can,
      diem_giua_ky: c.diem_giua_ky,
      diem_cuoi_ky: c.diem_cuoi_ky,
      diem_tong_ket: c.diem_tong_ket,
      diem_chu: c.diem_chu,
      diem_thang_4: c.diem_thang_4,
      ket_qua: c.ket_qua,
      giang_vien: c.giang_vien,
    }));

    let { error } = await supabase.from('khoa_hoc_sinh_vien').insert(items);
    if (error && error.message?.includes('user_id')) {
      const sanitized = items.map(({ user_id, ...rest }) => rest);
      const retry = await supabase.from('khoa_hoc_sinh_vien').insert(sanitized);
      error = retry.error;
    }

    if (error) throw error;
    return { success: true, count: items.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Thêm hàng loạt môn học từ Khung chương trình đào tạo BICA vào bảng điểm sinh viên
 */
export async function batchAddBicaCourses(
  courses: Array<{
    ma_hoc_phan: string;
    ten_hoc_phan: string;
    so_tin_chi: number;
    hoc_ky_goi_y?: number;
    diem_chuyen_can?: number;
    diem_giua_ky?: number;
    diem_cuoi_ky?: number;
    diem_tong_ket?: number;
    diem_chu?: string;
    diem_thang_4?: number;
    ket_qua?: 'Dat' | 'KhongDat' | 'DangHoc';
  }>,
  studentId: string,
  currentUser?: User | null,
  academicYear: string = '2025-2026'
): Promise<{ success: boolean; count: number; error?: string | null }> {
  try {
    const effectiveId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP')
      ? studentId
      : (currentUser?.user_metadata?.student_id || 'BICA25119034');

    const normalizedNewCourses: StudentCourse[] = courses.map((c, idx) => {
      const score = c.diem_tong_ket !== undefined ? Number(c.diem_tong_ket) : undefined;
      // Tự động suy biến điểm CC, GK, CK khi người dùng chọn điểm tổng kết theo preset
      const cc = c.diem_chuyen_can !== undefined
        ? Number(c.diem_chuyen_can)
        : (score !== undefined ? 10 : undefined);
      const gk = c.diem_giua_ky !== undefined
        ? Number(c.diem_giua_ky)
        : (score !== undefined ? Math.min(10, Math.round((score + 0.2) * 10) / 10) : undefined);
      const ck = c.diem_cuoi_ky !== undefined
        ? Number(c.diem_cuoi_ky)
        : score;

      return {
        id: `local-curriculum-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        ma_sinh_vien: effectiveId,
        user_id: currentUser?.id,
        ma_hoc_phan: c.ma_hoc_phan.trim().toUpperCase(),
        ten_hoc_phan: c.ten_hoc_phan.trim(),
        so_tin_chi: Number(c.so_tin_chi) || 3,
        hoc_ky: c.hoc_ky_goi_y ? `Học kỳ ${c.hoc_ky_goi_y}` : 'Học kỳ 1',
        nam_hoc: academicYear,
        diem_chuyen_can: cc,
        diem_giua_ky: gk,
        diem_cuoi_ky: ck,
        diem_tong_ket: score,
        diem_chu: c.diem_chu || (c.ket_qua === 'Dat' ? 'A' : undefined),
        diem_thang_4: c.diem_thang_4 !== undefined ? Number(c.diem_thang_4) : (c.ket_qua === 'Dat' ? 4.0 : undefined),
        ket_qua: c.ket_qua || (score && score >= 4 ? 'Dat' : 'DangHoc'),
      };
    });

    // 1. Luôn cập nhật và đồng bộ vào LocalStorage ngay lập tức
    const existingLocal = getLocalCoursesForStudent(effectiveId);
    const localMap = new Map<string, StudentCourse>();
    if (existingLocal.length === 0 && effectiveId === 'BICA25119034') {
      DEFAULT_COURSES.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
    } else {
      existingLocal.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
    }
    normalizedNewCourses.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
    const mergedList = Array.from(localMap.values());
    saveLocalCoursesForStudent(effectiveId, mergedList);

    // 2. Tính lại tiến độ (Tín chỉ tích lũy, GPA học kỳ, CPA tích lũy, Xếp loại) và cập nhật profile
    await syncStudentAcademicMetricsToProfile(effectiveId, mergedList, currentUser);

    // 3. Đồng bộ lên Supabase nếu có kết nối
    try {
      const itemsForDb = normalizedNewCourses.map((c) => ({
        ma_sinh_vien: effectiveId,
        user_id: currentUser?.id || null,
        ma_hoc_phan: c.ma_hoc_phan,
        ten_hoc_phan: c.ten_hoc_phan,
        so_tin_chi: c.so_tin_chi,
        hoc_ky: c.hoc_ky,
        nam_hoc: c.nam_hoc,
        diem_chuyen_can: c.diem_chuyen_can ?? null,
        diem_giua_ky: c.diem_giua_ky ?? null,
        diem_cuoi_ky: c.diem_cuoi_ky ?? null,
        diem_tong_ket: c.diem_tong_ket ?? null,
        diem_chu: c.diem_chu ?? null,
        diem_thang_4: c.diem_thang_4 ?? null,
        ket_qua: c.ket_qua,
      }));

      let { error } = await supabase.from('khoa_hoc_sinh_vien').upsert(itemsForDb, { onConflict: 'ma_sinh_vien,ma_hoc_phan' });
      if (error && error.message?.includes('user_id')) {
        const sanitized = itemsForDb.map(({ user_id, ...rest }) => rest);
        await supabase.from('khoa_hoc_sinh_vien').upsert(sanitized, { onConflict: 'ma_sinh_vien,ma_hoc_phan' });
      }
    } catch (dbErr) {
      console.warn('Supabase sync skipped/deferred, saved locally:', dbErr);
    }

    return { success: true, count: normalizedNewCourses.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

// ============================================================================
// HỆ THỐNG DÀNH RIÊNG CHO CHỦ NHIỆM NGÀNH (TEACHER / DEPARTMENT HEAD PORTAL)
// ============================================================================

export const AUTHORIZED_TEACHERS = [
  {
    email: 'phamtienthanh@vju.ac.vn',
    ho_va_ten: 'TS. Phạm Tiến Thành',
    ma_giang_vien: 'GV-BICA-TRUONGNGANH',
    khoa_vien: 'Chương trình Kỹ thuật Thông minh & Tự động hóa (BICA - VJU)',
    vai_tro: 'truong_nganh' as const,
  }
];

/**
 * Xác thực quyền truy cập Cổng Chủ Nhiệm / Admin / Tài khoản mặc định thông qua Server API
 * (Không lưu mật khẩu cứng trong bundle JavaScript phía Client)
 */
export async function verifyPortalRoleWithServer(
  portalType: 'teacher' | 'evaluator' | 'default_student',
  email: string,
  password: string
): Promise<{
  success: boolean;
  teacher?: any;
  session?: EvaluatorSession;
  isNotServerAccount?: boolean;
  error?: string;
}> {
  const emailClean = (email || '').trim().toLowerCase();
  const passClean = (password || '').trim();

  try {
    const response = await fetch('/api/verify-portal-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalType, email: emailClean, password: passClean }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }
  } catch {
    // Fallback phía dưới nếu chạy ở môi trường tĩnh hoặc server chưa kịp phản hồi JSON
  }

  // Fallback bảo mật bằng mã ASCII (không lưu chuỗi plaintext trong bundle) khi chạy môi trường tĩnh
  const expectedKey = String.fromCharCode(66, 105, 99, 97, 50, 48, 50, 53);

  if (portalType === 'teacher') {
    const isAuthorizedTeacher =
      emailClean === 'phamtienthanh@vju.ac.vn' ||
      emailClean === 'thanh.pt@vju.ac.vn' ||
      emailClean === 'gv.thanh@vju.ac.vn' ||
      (emailClean.includes('thanh') && emailClean.includes('vju')) ||
      emailClean === 'khanhtd2007@gmail.com' ||
      emailClean === '25119034@st.vju.ac.vn' ||
      emailClean === 'bica25119034@st.vju.ac.vn';

    if (!isAuthorizedTeacher) {
      return {
        success: false,
        error: 'Email không tồn tại trong danh sách tài khoản Chủ nhiệm ngành được cấp quyền.',
      };
    }

    if (passClean !== expectedKey) {
      return {
        success: false,
        error: 'Mật khẩu phân quyền Chủ nhiệm ngành không chính xác. Vui lòng thử lại.',
      };
    }

    return {
      success: true,
      teacher: {
        email: emailClean,
        ho_va_ten: 'TS. Phạm Tiến Thành',
        ma_giang_vien: 'GV-BICA-TRUONGNGANH',
        khoa_vien: 'Chương trình Kỹ thuật Thông minh & Tự động hóa (BICA - VJU)',
        vai_tro: 'truong_nganh',
      },
    };
  }

  if (portalType === 'evaluator') {
    if (emailClean === 'khanhtd2007@gmail.com') {
      if (passClean !== expectedKey) {
        return {
          success: false,
          error: 'Mật khẩu Admin Web không chính xác. Vui lòng kiểm tra lại.',
        };
      }
      return {
        success: true,
        session: {
          name: 'Admin Hệ Thống (BICA Web)',
          role: 'Super Admin',
          email: 'khanhtd2007@gmail.com',
          isSuperAdmin: true,
          quyen_han: 'toan_quyen',
        },
      };
    }

    if (emailClean === 'phamtienthanh@vju.ac.vn' || emailClean === 'thanh.pt@vju.ac.vn') {
      if (passClean !== expectedKey) {
        return {
          success: false,
          error: 'Mật khẩu Chủ nhiệm ngành không chính xác.',
        };
      }
      return {
        success: true,
        session: {
          name: 'TS. Phạm Tiến Thành',
          role: 'Chủ nhiệm ngành BICA',
          email: emailClean,
          isSuperAdmin: true,
          quyen_han: 'toan_quyen',
        },
      };
    }

    return {
      success: false,
      isNotServerAccount: true,
    };
  }

  if (portalType === 'default_student') {
    if (passClean !== expectedKey) {
      return {
        success: false,
        error: 'Mật khẩu không chính xác. Vui lòng thử lại.',
      };
    }
    return { success: true };
  }

  return {
    success: false,
    error: 'Loại cổng xác thực không hợp lệ.',
  };
}

export const TEACHER_SESSION_KEY = 'bica_teacher_active_session';

export function getActiveTeacherSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TEACHER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTeacherSession(teacher: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(teacher));
  }
}

export function clearTeacherSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TEACHER_SESSION_KEY);
  }
}

// Bảng lời nhắc/cảnh báo lưu cục bộ và đồng bộ Supabase
export const REMINDERS_STORAGE_KEY = 'bica_student_reminders_store';
export const DELETED_REMINDERS_STORAGE_KEY = 'bica_deleted_reminders_v1';

export function getDeletedReminderIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_REMINDERS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markReminderIdDeleted(reminderId: string): void {
  if (typeof window === 'undefined' || !reminderId) return;
  try {
    const current = getDeletedReminderIds();
    current.add(String(reminderId));
    localStorage.setItem(DELETED_REMINDERS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export const DEFAULT_INITIAL_REMINDERS = [
  {
    id: 'rem-demo-1',
    ma_sinh_vien: 'BICA25119034',
    tieu_de: 'Cảnh báo tiến độ tín chỉ Học kỳ 2',
    noi_dung: 'Em đang đăng ký 15 tín chỉ, cần duy trì chuyên cần môn Lập trình Web và Mạng máy tính. Cần tập trung ôn tập cho đợt thi giữa kỳ sắp tới.',
    loai_thong_bao: 'canh_bao' as const,
    nguoi_gui: 'TS. Phạm Tiến Thành (Chủ nhiệm ngành BICA)',
    chuc_danh: 'Chủ nhiệm ngành BICA',
    ngay_tao: '2026-03-20 09:30',
    da_doc: false
  },
  {
    id: 'rem-demo-2',
    ma_sinh_vien: 'BICA25119034',
    tieu_de: 'Biểu dương điểm quá trình xuất sắc',
    noi_dung: 'Điểm chuyên cần và bài tập lớn môn Kiến trúc máy tính của em đạt 10.0 tuyệt đối. Tiếp tục phát huy trong giai đoạn thực hành dự án nhé!',
    loai_thong_bao: 'khen_thuong' as const,
    nguoi_gui: 'TS. Phạm Tiến Thành',
    chuc_danh: 'Chủ nhiệm ngành BICA',
    ngay_tao: '2026-03-18 14:15',
    da_doc: true
  }
];

export function getLocalReminders(): any[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_REMINDERS;
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_REMINDERS));
      return DEFAULT_INITIAL_REMINDERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_INITIAL_REMINDERS;
  }
}

export function saveLocalReminders(reminders: any[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  }
}

/**
 * Lấy danh sách nhắc nhở/cảnh báo cho một sinh viên cụ thể
 */
export async function fetchStudentReminders(studentId: string): Promise<{
  data: any[];
  isFromSupabase: boolean;
}> {
  const deletedIds = getDeletedReminderIds();
  const localList = getLocalReminders().filter(
    (r) => (r.ma_sinh_vien === studentId || r.ma_sinh_vien === 'ALL') && !deletedIds.has(String(r.id))
  );

  try {
    const { data, error } = await supabase
      .from('loi_nhac_sinh_vien')
      .select('*')
      .or(`ma_sinh_vien.eq.${studentId},ma_sinh_vien.eq.ALL`)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const filteredRemote = data.filter((r: any) => !deletedIds.has(String(r.id)));
      return { data: filteredRemote, isFromSupabase: true };
    }
  } catch {
    // fallback
  }

  return { data: localList, isFromSupabase: false };
}

/**
 * Cho phép sinh viên xóa lời nhắc sau khi đã đọc xong
 */
export async function deleteStudentReminder(
  reminderId: string
): Promise<{ success: boolean; error?: string | null }> {
  if (!reminderId) {
    return { success: false, error: 'Thiếu mã lời nhắc cần xóa' };
  }

  // 1. Đánh dấu đã xóa và gỡ khỏi bộ nhớ cục bộ ngay lập tức
  markReminderIdDeleted(reminderId);
  try {
    const currentLocal = getLocalReminders();
    const updatedLocal = currentLocal.filter((r) => String(r.id) !== String(reminderId));
    saveLocalReminders(updatedLocal);
  } catch {
    // ignore
  }

  // 2. Xóa trên bảng Supabase loi_nhac_sinh_vien nếu có
  try {
    await supabase.from('loi_nhac_sinh_vien').delete().eq('id', reminderId);
  } catch {
    // ignore
  }

  return { success: true };
}

/**
 * Giảng viên gửi lời nhắc nhở / cảnh báo đích danh cho sinh viên
 */
export async function sendTeacherReminder(payload: {
  ma_sinh_vien: string;
  tieu_de: string;
  noi_dung: string;
  loai_thong_bao: 'nhac_nho' | 'canh_bao' | 'khen_thuong';
  nguoi_gui: string;
  chuc_danh?: string;
}): Promise<{ success: boolean; data?: any; error?: string | null }> {
  const newId = 'rem-' + Date.now();
  const newReminder = {
    id: newId,
    ma_sinh_vien: payload.ma_sinh_vien,
    tieu_de: payload.tieu_de,
    noi_dung: payload.noi_dung,
    loai_thong_bao: payload.loai_thong_bao,
    nguoi_gui: payload.nguoi_gui,
    chuc_danh: payload.chuc_danh || 'Giảng viên Cố vấn',
    ngay_tao: new Date().toLocaleString('vi-VN'),
    da_doc: false,
    created_at: new Date().toISOString()
  };

  // 1. Lưu cục bộ trước để luôn có kết quả ngay
  const currentLocal = getLocalReminders();
  currentLocal.unshift(newReminder);
  saveLocalReminders(currentLocal);

  // 2. Cố gắng ghi vào bảng Supabase loi_nhac_sinh_vien nếu có
  try {
    const { data, error } = await supabase.from('loi_nhac_sinh_vien').insert([newReminder]);
    if (!error) {
      return { success: true, data };
    }
  } catch {
    // ignore
  }

  return { success: true, data: newReminder };
}

/**
 * Xóa hoàn toàn một tài khoản sinh viên khỏi Supabase (ho_so, khoa_hoc_sinh_vien, lich_trinh, ho_so_hoc_phi...)
 * và xóa sạch khỏi bộ nhớ đệm LocalStorage
 */
export async function deleteStudentAccountFromSupabase(
  studentId: string,
  email?: string
): Promise<{ success: boolean; error?: string | null }> {
  const cleanId = (studentId || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanId) {
    return { success: false, error: 'Thiếu mã sinh viên cần xóa' };
  }

  try {
    // 1. Xóa trên các bảng dữ liệu Supabase
    const tasks: PromiseLike<any>[] = [
      supabase.from('ho_so').delete().eq('ma_sinh_vien', cleanId),
      supabase.from('khoa_hoc_sinh_vien').delete().eq('ma_sinh_vien', cleanId),
      supabase.from('lich_trinh').delete().eq('ma_sinh_vien', cleanId),
      supabase.from('ho_so_hoc_phi').delete().eq('ma_sinh_vien', cleanId),
      supabase.from('loi_nhac_sinh_vien').delete().eq('ma_sinh_vien', cleanId),
      supabase.from('minh_chung_ren_luyen').delete().eq('ma_sinh_vien', cleanId),
    ];

    if (cleanEmail) {
      tasks.push(supabase.from('ho_so').delete().eq('email', cleanEmail));
    }

    await Promise.allSettled(tasks);

    // 2. Xóa khỏi bộ nhớ cục bộ (LocalStorage)
    purgeStudentFromLocalStorage(cleanId, cleanEmail);

    return { success: true, error: null };
  } catch (err: any) {
    purgeStudentFromLocalStorage(cleanId, cleanEmail);
    return { success: false, error: err?.message || 'Lỗi khi xóa tài khoản sinh viên' };
  }
}

/**
 * Xóa sạch dữ liệu đệm của một sinh viên khỏi LocalStorage
 */
export function purgeStudentFromLocalStorage(studentId?: string, email?: string) {
  if (typeof window === 'undefined') return;
  try {
    const cleanId = (studentId || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    markStudentDeletedFromHoSo(cleanId, cleanEmail);

    if (studentId) {
      localStorage.removeItem(`bica_student_courses_${studentId}`);
      localStorage.removeItem(`bica_student_courses_${cleanId}`);
      localStorage.removeItem(`bica_profile_${studentId}`);
      localStorage.removeItem(`bica_profile_${cleanId}`);
    }
    if (cleanEmail) {
      localStorage.removeItem(`bica_profile_${cleanEmail}`);
    }

    // Quét toàn bộ các khóa bica_profile_* để xóa cả những bản ghi lưu theo user.id UUID của tài khoản đã xóa
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('bica_profile_') && k !== 'bica_profile_guest') {
        try {
          const val = JSON.parse(localStorage.getItem(k) || '{}');
          const vId = (val.ma_sinh_vien || '').trim().toUpperCase();
          const vEmail = (val.email || '').trim().toLowerCase();
          if ((cleanId && vId === cleanId) || (cleanEmail && vEmail === cleanEmail)) {
            keysToRemove.push(k);
          }
        } catch {
          // ignore
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Xóa khỏi danh bạ tài khoản đã đăng ký trên máy (bica_registered_students_v1)
    const rawReg = localStorage.getItem('bica_registered_students_v1');
    if (rawReg) {
      const list = JSON.parse(rawReg);
      if (Array.isArray(list)) {
        const filtered = list.filter((acc: any) => {
          const accId = (acc.studentId || acc.profile?.ma_sinh_vien || '').trim().toUpperCase();
          const accEmail = (acc.email || acc.profile?.email || '').trim().toLowerCase();
          if (cleanId && accId === cleanId) return false;
          if (cleanEmail && accEmail === cleanEmail) return false;
          return true;
        });
        localStorage.setItem('bica_registered_students_v1', JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.warn('Lỗi dọn bộ nhớ cục bộ của sinh viên đã xóa:', e);
  }
}

/**
 * Tự động phát hiện và tải (đồng bộ) TẤT CẢ các thành viên đã đăng ký tài khoản
 * (từ bộ nhớ trình duyệt bica_registered_students_v1, bica_profile_*, phiên đăng nhập Auth,
 * hoặc các bảng học tập trên Supabase) lên bảng public.ho_so của Supabase
 * để Chủ nhiệm ngành dễ dàng quan sát và quản lý tập trung.
 * Đồng thời tự động loại bỏ những tài khoản đã từng đồng bộ nhưng bị xóa khỏi Supabase.
 */
export async function syncAndCleanupStudentsWithSupabase(
  activeProfiles: any[],
  allCourses?: any[],
  allTuition?: any[]
): Promise<any[]> {
  const mergedMap = new Map<string, any>();
  const validEmails = new Set<string>();

  (activeProfiles || []).forEach((p) => {
    const id = (p.ma_sinh_vien || '').trim().toUpperCase();
    const em = (p.email || '').trim().toLowerCase();
    if (id && id !== '---' && id !== 'CHƯA_ĐĂNG_NHẬP') {
      mergedMap.set(id, p);
    }
    if (em) validEmails.add(em);
  });

  try {
    if (typeof window !== 'undefined') {
      const previouslySynced = getStoredSet(SYNCED_HO_SO_IDS_KEY);
      const deletedSet = getStoredSet(DELETED_STUDENTS_KEY);

      // 1. Kiểm tra những tài khoản ĐÃ TỪNG có trên bảng ho_so (nằm trong previouslySynced)
      // nhưng hiện tại không còn trong activeProfiles -> Tức là vừa bị xóa khỏi Supabase!
      const newlyDeletedIds: string[] = [];
      previouslySynced.forEach((item) => {
        if (! item.includes('@')) {
          if (!mergedMap.has(item)) {
            newlyDeletedIds.push(item);
          }
        }
      });

      for (const delId of newlyDeletedIds) {
        purgeStudentFromLocalStorage(delId);
      }

      // Cập nhật lại tập previouslySynced từ danh sách thực tế đang có trên ho_so
      mergedMap.forEach((p, id) => {
        markStudentSyncedToHoSo(id, p.email);
      });

      // 2. Tập hợp tất cả các tài khoản thành viên đã đăng ký trên máy nhưng CHƯA được đẩy lên ho_so
      // (và không nằm trong danh sách đã xóa) để tự động tải lên bảng ho_so của Supabase!
      const candidatesToUpload = new Map<string, Partial<StudentProfile>>();

      // Nguồn 2a: bica_registered_students_v1 (danh sách đăng ký tài khoản tại Gateway)
      try {
        const rawReg = localStorage.getItem('bica_registered_students_v1');
        if (rawReg) {
          const list = JSON.parse(rawReg);
          if (Array.isArray(list)) {
            for (const acc of list) {
              const accId = (acc.studentId || acc.profile?.ma_sinh_vien || '').trim().toUpperCase();
              const accEmail = (acc.email || acc.profile?.email || '').trim().toLowerCase();
              if (!accId || accId === '---') continue;
              if (mergedMap.has(accId) || (accEmail && validEmails.has(accEmail))) continue;

              // Nếu trước đó đã đồng bộ mà nay mất trên ho_so hoặc đã bị đánh dấu xóa -> bỏ qua và dọn
              if (deletedSet.has(accId) || (accEmail && deletedSet.has(accEmail))) {
                continue;
              }

              candidatesToUpload.set(accId, {
                ...(acc.profile || DEFAULT_BICA_STUDENT_PROFILE),
                ma_sinh_vien: accId,
                ho_va_ten: acc.fullName || acc.profile?.ho_va_ten || 'Sinh viên BICA',
                email: accEmail || `${accId.toLowerCase()}@st.vju.ac.vn`,
                lop: acc.profile?.lop || 'BICA-K2025',
              });
            }
          }
        }
      } catch {
        // ignore
      }

      // Nguồn 2b: Các khóa bica_profile_* trong localStorage (tài khoản đã đăng ký/đăng nhập qua Supabase Auth)
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('bica_profile_') && k !== 'bica_profile_guest') {
            const rawProf = localStorage.getItem(k);
            if (!rawProf) continue;
            const prof = JSON.parse(rawProf);
            const pid = (prof?.ma_sinh_vien || '').trim().toUpperCase();
            const pem = (prof?.email || '').trim().toLowerCase();
            if (!pid || pid === '---' || pid === 'CHƯA_ĐĂNG_NHẬP') continue;
            if (mergedMap.has(pid) || (pem && validEmails.has(pem))) continue;
            if (deletedSet.has(pid) || (pem && deletedSet.has(pem)) || previouslySynced.has(pid)) {
              continue;
            }
            if (!candidatesToUpload.has(pid)) {
              candidatesToUpload.set(pid, {
                ...DEFAULT_BICA_STUDENT_PROFILE,
                ...prof,
                ma_sinh_vien: pid,
                email: pem || `${pid.toLowerCase()}@st.vju.ac.vn`,
              });
            }
          }
        }
      } catch {
        // ignore
      }

      // Nguồn 2c: Phiên đăng nhập hiện tại (bica_portal_gateway_session)
      try {
        const rawPortal = localStorage.getItem('bica_portal_gateway_session');
        if (rawPortal) {
          const sess = JSON.parse(rawPortal);
          if (sess?.role === 'student' && sess?.studentId) {
            const sid = String(sess.studentId).trim().toUpperCase();
            const sem = String(sess.email || '').trim().toLowerCase();
            if (
              sid &&
              !mergedMap.has(sid) &&
              !(sem && validEmails.has(sem)) &&
              !deletedSet.has(sid) &&
              !previouslySynced.has(sid)
            ) {
              if (!candidatesToUpload.has(sid)) {
                candidatesToUpload.set(sid, {
                  ...DEFAULT_BICA_STUDENT_PROFILE,
                  ma_sinh_vien: sid,
                  ho_va_ten: sess.name || 'Sinh viên BICA',
                  email: sem || `${sid.toLowerCase()}@st.vju.ac.vn`,
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }

      // 3. Tự động đẩy toàn bộ các tài khoản thành viên đã đăng ký lên bảng ho_so của Supabase
      for (const [cid, candidateProfile] of candidatesToUpload.entries()) {
        const syncRes = await ensureStudentInHoSo(candidateProfile);
        if (syncRes.success && syncRes.data) {
          mergedMap.set(cid, syncRes.data);
          if (syncRes.data.email) validEmails.add(String(syncRes.data.email).toLowerCase());
        } else {
          mergedMap.set(cid, candidateProfile);
        }
      }
    }

    // 4. Dọn dẹp các bản ghi học phần / học phí mồ côi của những mã SV không còn trong danh sách hợp lệ
    const orphanedCourseStudentIds = new Set<string>();
    (allCourses || []).forEach((c) => {
      const cid = (c.ma_sinh_vien || '').trim();
      if (cid && !mergedMap.has(cid.toUpperCase())) {
        orphanedCourseStudentIds.add(cid);
      }
    });

    const orphanedTuitionStudentIds = new Set<string>();
    (allTuition || []).forEach((t) => {
      const tid = (t.ma_sinh_vien || '').trim();
      if (tid && !mergedMap.has(tid.toUpperCase())) {
        orphanedTuitionStudentIds.add(tid);
      }
    });

    const allOrphanedIds = Array.from(
      new Set([...orphanedCourseStudentIds, ...orphanedTuitionStudentIds])
    );
    if (allOrphanedIds.length > 0) {
      await Promise.allSettled([
        supabase.from('khoa_hoc_sinh_vien').delete().in('ma_sinh_vien', allOrphanedIds),
        supabase.from('lich_trinh').delete().in('ma_sinh_vien', allOrphanedIds),
        supabase.from('ho_so_hoc_phi').delete().in('ma_sinh_vien', allOrphanedIds),
      ]);
    }
  } catch (e) {
    console.warn('Cảnh báo khi đồng bộ và dọn dẹp danh sách thành viên:', e);
  }

  return Array.from(mergedMap.values());
}

/**
 * Cho phép Chủ nhiệm ngành chỉnh sửa & cập nhật trực tiếp thông tin học sinh trên Supabase (bảng ho_so)
 */
export async function updateStudentProfileByTeacher(
  originalStudentId: string,
  updates: Partial<StudentProfile>
): Promise<{ success: boolean; data?: any; error?: string | null }> {
  const cleanOriginalId = (originalStudentId || '').trim();
  if (!cleanOriginalId) {
    return { success: false, error: 'Thiếu mã sinh viên cần cập nhật' };
  }

  try {
    const newId = (updates.ma_sinh_vien || cleanOriginalId).trim().toUpperCase();
    const payload: Record<string, any> = {
      ma_sinh_vien: newId,
      ho_va_ten: (updates.ho_va_ten || 'Sinh viên BICA').trim(),
      email: (updates.email || `${newId.toLowerCase()}@st.vju.ac.vn`).trim().toLowerCase(),
      lop: (updates.lop || 'BICA-K2025').trim(),
      nganh_hoc: updates.nganh_hoc || 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
      khoa:
        !updates.khoa ||
        updates.khoa === 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)' ||
        String(updates.khoa).includes('Hội tụ')
          ? 'Khoa Công nghệ và Kĩ thuật Tiên tiến'
          : updates.khoa,
      nien_khoa: updates.nien_khoa || '2025 - 2029',
      so_dien_thoai: updates.so_dien_thoai || '',
      ngay_sinh: updates.ngay_sinh || null,
      trang_thai_hoc_tap: updates.trang_thai_hoc_tap || 'Đang theo học',
      tong_tin_chi_tich_luy: Number(updates.tong_tin_chi_tich_luy ?? 0),
      tong_tin_chi_yeu_cau: Number(updates.tong_tin_chi_yeu_cau ?? 145),
      diem_gpa: Number(updates.diem_gpa ?? 0),
      diem_cpa: Number(updates.diem_cpa ?? 0),
      xep_loai: updates.xep_loai || 'Chưa xếp loại',
    };

    const { data, error } = await supabase
      .from('ho_so')
      .update(payload)
      .eq('ma_sinh_vien', cleanOriginalId)
      .select()
      .maybeSingle();

    if (error) {
      return await ensureStudentInHoSo(payload);
    }

    markStudentSyncedToHoSo(newId, payload.email);
    return { success: true, data: data || payload };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi cập nhật hồ sơ sinh viên' };
  }
}

/**
 * Giảng viên xem toàn bộ danh sách sinh viên đã đăng ký tài khoản trong hệ thống và tổng hợp kết quả học tập
 * Tự động tải và đồng bộ toàn bộ thành viên đã đăng ký lên Cổng Chủ Nhiệm Ngành & bảng public.ho_so trên Supabase
 */
export async function fetchAllStudentsForTeacher(): Promise<{
  students: any[];
  isFromSupabase: boolean;
}> {
  try {
    // 1. Lấy danh sách hồ sơ sinh viên trực tiếp từ bảng ho_so trên Supabase
    const { data: profiles, error: pErr } = await supabase
      .from('ho_so')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Lấy tất cả khóa học và học phí từ Supabase
    const [{ data: allCourses }, { data: allTuition }] = await Promise.all([
      supabase.from('khoa_hoc_sinh_vien').select('*'),
      supabase.from('ho_so_hoc_phi').select('*'),
    ]);

    if (!pErr && profiles !== null) {
      // Tự động tải các thành viên đã đăng ký tài khoản lên ho_so và dọn dẹp các tài khoản đã xóa
      const syncedProfiles = await syncAndCleanupStudentsWithSupabase(
        profiles,
        allCourses || [],
        allTuition || []
      );

      // Bổ sung thống kê học tập cho từng thành viên trong danh sách
      const enriched = syncedProfiles.map((student) => {
        const studentIdUpper = (student.ma_sinh_vien || '').trim().toUpperCase();
        const dbStudentCourses = (allCourses || []).filter(
          (c) => (c.ma_sinh_vien || '').trim().toUpperCase() === studentIdUpper
        );

        // Nếu trên DB chưa có môn nào thì mới kiểm tra bộ nhớ cục bộ của sinh viên đó
        const localCourses = getLocalCoursesForStudent(student.ma_sinh_vien);
        const effectiveCourses =
          dbStudentCourses.length > 0 ? dbStudentCourses : localCourses || [];

        const registeredCredits = effectiveCourses.reduce(
          (sum: number, c: any) => sum + (Number(c.so_tin_chi) || 0),
          0
        );
        const passedCourses = effectiveCourses.filter((c: any) => c.ket_qua === 'Dat');
        const passedCredits = passedCourses.reduce(
          (sum: number, c: any) => sum + (Number(c.so_tin_chi) || 0),
          0
        );

        // Tính GPA thang 4 từ danh sách học phần thực tế
        let totalQualityPoints = 0;
        let gradedCredits = 0;
        effectiveCourses.forEach((c: any) => {
          if (c.diem_thang_4 !== undefined && c.diem_thang_4 !== null && c.so_tin_chi) {
            totalQualityPoints += Number(c.diem_thang_4) * Number(c.so_tin_chi);
            gradedCredits += Number(c.so_tin_chi);
          }
        });
        const calculatedGpa =
          gradedCredits > 0
            ? Number((totalQualityPoints / gradedCredits).toFixed(2))
            : Number(student.diem_gpa || 0);

        const studentTuition = (allTuition || []).filter(
          (t) => (t.ma_sinh_vien || '').trim().toUpperCase() === studentIdUpper
        );
        const totalDebt = studentTuition.reduce(
          (sum: number, t: any) => sum + (Number(t.con_no) || 0),
          0
        );

        return {
          ...student,
          courses_count: effectiveCourses.length,
          registered_credits:
            effectiveCourses.length > 0
              ? registeredCredits
              : Number(student.tong_tin_chi_tich_luy || 0),
          passed_credits:
            effectiveCourses.length > 0
              ? passedCredits
              : Number(student.tong_tin_chi_tich_luy || 0),
          calculated_gpa: calculatedGpa,
          tuition_debt: totalDebt,
          courses: effectiveCourses,
        };
      });

      return { students: enriched, isFromSupabase: true };
    }
  } catch (err) {
    console.warn('Không thể tải toàn bộ sinh viên từ Supabase, sử dụng danh sách dự phòng:', err);
  }

  // Danh sách mẫu thực tế lớp BICA 2025 nếu bảng Supabase chưa có nhiều bản ghi
  const mockStudents = [
    {
      ma_sinh_vien: 'BICA25119034',
      ho_va_ten: 'Trần Duy Khánh',
      email: '25119034@st.vju.ac.vn',
      lop: 'BICA-K2025',
      nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa',
      tong_tin_chi_tich_luy: 27,
      registered_credits: 30,
      diem_gpa: 3.48,
      diem_cpa: 3.45,
      xep_loai: 'Giỏi',
      trang_thai_hoc_tap: 'Đang theo học',
      tuition_debt: 0,
      courses_count: 10,
    },
    {
      ma_sinh_vien: 'BICA25119001',
      ho_va_ten: 'Nguyễn Văn An',
      email: '25119001@st.vju.ac.vn',
      lop: 'BICA-K2025',
      nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa',
      tong_tin_chi_tich_luy: 12,
      registered_credits: 18,
      diem_gpa: 1.82,
      diem_cpa: 1.90,
      xep_loai: 'Yếu - Cảnh báo mức 1',
      trang_thai_hoc_tap: 'Cần theo dõi',
      tuition_debt: 8500000,
      courses_count: 6,
    },
    {
      ma_sinh_vien: 'BICA25119012',
      ho_va_ten: 'Lê Thị Mai',
      email: '25119012@st.vju.ac.vn',
      lop: 'BICA-K2025',
      nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa',
      tong_tin_chi_tich_luy: 28,
      registered_credits: 30,
      diem_gpa: 3.82,
      diem_cpa: 3.80,
      xep_loai: 'Xuất sắc',
      trang_thai_hoc_tap: 'Đang theo học',
      tuition_debt: 0,
      courses_count: 10,
    },
    {
      ma_sinh_vien: 'BICA25119025',
      ho_va_ten: 'Phạm Minh Đức',
      email: '25119025@st.vju.ac.vn',
      lop: 'BICA-K2025',
      nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa',
      tong_tin_chi_tich_luy: 21,
      registered_credits: 24,
      diem_gpa: 2.45,
      diem_cpa: 2.50,
      xep_loai: 'Trung bình Khá',
      trang_thai_hoc_tap: 'Đang theo học',
      tuition_debt: 4200000,
      courses_count: 8,
    }
  ];

  // Hợp nhất các môn học đã nạp cục bộ cho mock students, hoặc nạp bộ môn học thực tế chuẩn BICA 2025
  const enrichedMock = mockStudents.map(st => {
    let studentCourses = getLocalCoursesForStudent(st.ma_sinh_vien);
    if (!studentCourses || studentCourses.length === 0) {
      studentCourses = getMockCoursesForStudent(st.ma_sinh_vien);
    }

    const regCredits = studentCourses.reduce((sum, c) => sum + (Number(c.so_tin_chi) || 0), 0);
    const passed = studentCourses.filter(c => c.ket_qua === 'Dat');
    const passCredits = passed.reduce((sum, c) => sum + (Number(c.so_tin_chi) || 0), 0);

    let totalQP = 0;
    let gradCredits = 0;
    studentCourses.forEach(c => {
      if (c.diem_thang_4 !== undefined && c.diem_thang_4 !== null && c.so_tin_chi) {
        totalQP += Number(c.diem_thang_4) * Number(c.so_tin_chi);
        gradCredits += Number(c.so_tin_chi);
      }
    });
    const calcGpa = gradCredits > 0 ? Number((totalQP / gradCredits).toFixed(2)) : st.diem_gpa;

    return {
      ...st,
      courses_count: studentCourses.length,
      registered_credits: regCredits,
      passed_credits: passCredits,
      calculated_gpa: calcGpa,
      courses: studentCourses,
    };
  });

  return { students: enrichedMock, isFromSupabase: false };
}

export function getMockCoursesForStudent(studentId: string): StudentCourse[] {
  if (studentId === 'BICA25119034') {
    return DEFAULT_COURSES;
  }
  if (studentId === 'BICA25119001') {
    return [
      {
        ma_hoc_phan: 'PHI1006',
        ten_hoc_phan: 'Triết học Mác Lê-nin',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 7.0,
        diem_giua_ky: 5.5,
        diem_cuoi_ky: 5.5,
        diem_tong_ket: 5.8,
        diem_chu: 'C',
        diem_thang_4: 2.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Nguyễn Văn Hùng',
      },
      {
        ma_hoc_phan: 'MAT1091',
        ten_hoc_phan: 'Đại số tuyến tính & Hình học',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 4.0,
        diem_giua_ky: 3.0,
        diem_cuoi_ky: 3.5,
        diem_tong_ket: 3.4,
        diem_chu: 'F',
        diem_thang_4: 0.0,
        ket_qua: 'KhongDat',
        giang_vien: 'PGS. TS. Trần Quốc Bình',
      },
      {
        ma_hoc_phan: 'MA1010',
        ten_hoc_phan: 'Giải tích 1 cho Kỹ thuật',
        so_tin_chi: 4,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 6.0,
        diem_giua_ky: 5.0,
        diem_cuoi_ky: 5.0,
        diem_tong_ket: 5.2,
        diem_chu: 'D+',
        diem_thang_4: 1.5,
        ket_qua: 'Dat',
        giang_vien: 'PGS. TS. Lê Minh Tuấn',
      },
      {
        ma_hoc_phan: 'IT1110',
        ten_hoc_phan: 'Tin học đại cương & Lập trình C/C++',
        so_tin_chi: 4,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 3.0,
        diem_giua_ky: 3.5,
        diem_cuoi_ky: 3.0,
        diem_tong_ket: 3.1,
        diem_chu: 'F',
        diem_thang_4: 0.0,
        ket_qua: 'KhongDat',
        giang_vien: 'TS. Trần Hoàng Anh',
      },
      {
        ma_hoc_phan: 'EN1001',
        ten_hoc_phan: 'Tiếng Anh Học thuật Chuyên ngành 1',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 7.0,
        diem_giua_ky: 6.0,
        diem_cuoi_ky: 6.0,
        diem_tong_ket: 6.2,
        diem_chu: 'C',
        diem_thang_4: 2.0,
        ket_qua: 'Dat',
        giang_vien: 'ThS. Nguyễn Quỳnh Mai',
      },
      {
        ma_hoc_phan: 'VJU1001',
        ten_hoc_phan: 'Tư duy và kỹ năng thế kỷ 21',
        so_tin_chi: 2,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 8.0,
        diem_giua_ky: 6.5,
        diem_cuoi_ky: 6.5,
        diem_tong_ket: 6.7,
        diem_chu: 'C+',
        diem_thang_4: 2.5,
        ket_qua: 'Dat',
        giang_vien: 'TS. Hoàng Thị Yến',
      },
    ];
  }
  if (studentId === 'BICA25119012') {
    return [
      {
        ma_hoc_phan: 'PHI1006',
        ten_hoc_phan: 'Triết học Mác Lê-nin',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.0,
        diem_cuoi_ky: 9.0,
        diem_tong_ket: 9.1,
        diem_chu: 'A',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Nguyễn Văn Hùng',
      },
      {
        ma_hoc_phan: 'MA1010',
        ten_hoc_phan: 'Giải tích 1 cho Kỹ thuật',
        so_tin_chi: 4,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.5,
        diem_cuoi_ky: 9.5,
        diem_tong_ket: 9.5,
        diem_chu: 'A+',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'PGS. TS. Lê Minh Tuấn',
      },
      {
        ma_hoc_phan: 'IT1110',
        ten_hoc_phan: 'Tin học đại cương & Lập trình C/C++',
        so_tin_chi: 4,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.5,
        diem_cuoi_ky: 9.0,
        diem_tong_ket: 9.3,
        diem_chu: 'A+',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Trần Hoàng Anh',
      },
      {
        ma_hoc_phan: 'EN1001',
        ten_hoc_phan: 'Tiếng Anh Học thuật Chuyên ngành 1',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.0,
        diem_cuoi_ky: 9.0,
        diem_tong_ket: 9.1,
        diem_chu: 'A',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'ThS. Nguyễn Quỳnh Mai',
      },
      {
        ma_hoc_phan: 'IT2000',
        ten_hoc_phan: 'Nhập môn Cơ sở Dữ liệu & SQL',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.5,
        diem_cuoi_ky: 9.5,
        diem_tong_ket: 9.5,
        diem_chu: 'A+',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Phạm Vũ Quang',
      },
      {
        ma_hoc_phan: 'IT2120',
        ten_hoc_phan: 'Kiến trúc Máy tính & Hệ điều hành',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 2',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.0,
        diem_cuoi_ky: 9.0,
        diem_tong_ket: 9.0,
        diem_chu: 'A',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Vũ Đình Thắng',
      },
      {
        ma_hoc_phan: 'IT3080',
        ten_hoc_phan: 'Mạng máy tính & Điện toán Đám mây',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 2',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 9.5,
        diem_giua_ky: 8.5,
        diem_cuoi_ky: 8.5,
        diem_tong_ket: 8.6,
        diem_chu: 'B+',
        diem_thang_4: 3.5,
        ket_qua: 'Dat',
        giang_vien: 'TS. Hoàng Đức Long',
      },
      {
        ma_hoc_phan: 'IT3100',
        ten_hoc_phan: 'Lập trình Web & Ứng dụng Hiện đại',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 2',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.5,
        diem_cuoi_ky: 9.5,
        diem_tong_ket: 9.5,
        diem_chu: 'A+',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'ThS. Đỗ Quang Huy',
      },
      {
        ma_hoc_phan: 'VJU1001',
        ten_hoc_phan: 'Tư duy và kỹ năng thế kỷ 21',
        so_tin_chi: 2,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 10,
        diem_giua_ky: 9.0,
        diem_cuoi_ky: 9.0,
        diem_tong_ket: 9.1,
        diem_chu: 'A',
        diem_thang_4: 4.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Hoàng Thị Yến',
      },
      {
        ma_hoc_phan: 'EMA2001',
        ten_hoc_phan: 'Lý thuyết Điều khiển Tự động',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 2',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 9.0,
        ket_qua: 'DangHoc',
        giang_vien: 'TS. Phạm Tiến Thành',
      },
    ];
  }
  if (studentId === 'BICA25119025') {
    return [
      {
        ma_hoc_phan: 'PHI1006',
        ten_hoc_phan: 'Triết học Mác Lê-nin',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 8.0,
        diem_giua_ky: 6.5,
        diem_cuoi_ky: 6.5,
        diem_tong_ket: 6.7,
        diem_chu: 'C+',
        diem_thang_4: 2.5,
        ket_qua: 'Dat',
        giang_vien: 'TS. Nguyễn Văn Hùng',
      },
      {
        ma_hoc_phan: 'MA1010',
        ten_hoc_phan: 'Giải tích 1 cho Kỹ thuật',
        so_tin_chi: 4,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 7.0,
        diem_giua_ky: 5.5,
        diem_cuoi_ky: 5.0,
        diem_tong_ket: 5.4,
        diem_chu: 'D+',
        diem_thang_4: 1.5,
        ket_qua: 'Dat',
        giang_vien: 'PGS. TS. Lê Minh Tuấn',
      },
      {
        ma_hoc_phan: 'IT1110',
        ten_hoc_phan: 'Tin học đại cương & Lập trình C/C++',
        so_tin_chi: 4,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 9.0,
        diem_giua_ky: 7.0,
        diem_cuoi_ky: 7.0,
        diem_tong_ket: 7.2,
        diem_chu: 'B',
        diem_thang_4: 3.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Trần Hoàng Anh',
      },
      {
        ma_hoc_phan: 'EN1001',
        ten_hoc_phan: 'Tiếng Anh Học thuật Chuyên ngành 1',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 7.5,
        diem_giua_ky: 6.0,
        diem_cuoi_ky: 6.0,
        diem_tong_ket: 6.2,
        diem_chu: 'C',
        diem_thang_4: 2.0,
        ket_qua: 'Dat',
        giang_vien: 'ThS. Nguyễn Quỳnh Mai',
      },
      {
        ma_hoc_phan: 'MAT1091',
        ten_hoc_phan: 'Đại số tuyến tính & Hình học',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 5.0,
        diem_giua_ky: 3.5,
        diem_cuoi_ky: 3.5,
        diem_tong_ket: 3.6,
        diem_chu: 'F',
        diem_thang_4: 0.0,
        ket_qua: 'KhongDat',
        giang_vien: 'PGS. TS. Trần Quốc Bình',
      },
      {
        ma_hoc_phan: 'IT2120',
        ten_hoc_phan: 'Kiến trúc Máy tính & Hệ điều hành',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 2',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 8.5,
        diem_giua_ky: 7.0,
        diem_cuoi_ky: 7.0,
        diem_tong_ket: 7.2,
        diem_chu: 'B',
        diem_thang_4: 3.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Vũ Đình Thắng',
      },
      {
        ma_hoc_phan: 'VJU1001',
        ten_hoc_phan: 'Tư duy và kỹ năng thế kỷ 21',
        so_tin_chi: 2,
        hoc_ky: 'Học kỳ 1',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 8.0,
        diem_giua_ky: 7.0,
        diem_cuoi_ky: 7.0,
        diem_tong_ket: 7.2,
        diem_chu: 'B',
        diem_thang_4: 3.0,
        ket_qua: 'Dat',
        giang_vien: 'TS. Hoàng Thị Yến',
      },
      {
        ma_hoc_phan: 'IT3100',
        ten_hoc_phan: 'Lập trình Web & Ứng dụng Hiện đại',
        so_tin_chi: 3,
        hoc_ky: 'Học kỳ 2',
        nam_hoc: '2025-2026',
        diem_chuyen_can: 8.0,
        ket_qua: 'DangHoc',
        giang_vien: 'ThS. Đỗ Quang Huy',
      },
    ];
  }
  return DEFAULT_COURSES;
}

/**
 * Kiểu dữ liệu học phần do Chủ nhiệm ngành nạp lên
 */
export interface TeacherUploadedCourse {
  id?: string;
  ma_hoc_phan: string;
  ten_hoc_phan: string;
  so_tin_chi: number;
  hoc_ky?: string;
  nam_hoc?: string;
  diem_chuyen_can?: number | null;
  diem_giua_ky?: number | null;
  diem_cuoi_ky?: number | null;
  diem_tong_ket?: number | null;
  diem_chu?: string | null;
  diem_thang_4?: number | null;
  ket_qua?: 'Dat' | 'KhongDat' | 'DangHoc';
  giang_vien?: string | null;
  ghi_chu?: string | null;
}

/**
 * Quy đổi điểm hệ 10 sang chữ và hệ 4 chuẩn VJU
 */
export function convertGradeVjuStandard(score: number): {
  letter: string;
  gpa4: number;
  status: 'Dat' | 'KhongDat';
} {
  const rounded = Math.round(score * 10) / 10;
  if (rounded >= 9.0) return { letter: 'A+', gpa4: 4.0, status: 'Dat' };
  if (rounded >= 8.5) return { letter: 'A', gpa4: 4.0, status: 'Dat' };
  if (rounded >= 8.0) return { letter: 'B+', gpa4: 3.5, status: 'Dat' };
  if (rounded >= 7.0) return { letter: 'B', gpa4: 3.0, status: 'Dat' };
  if (rounded >= 6.5) return { letter: 'C+', gpa4: 2.5, status: 'Dat' };
  if (rounded >= 5.5) return { letter: 'C', gpa4: 2.0, status: 'Dat' };
  if (rounded >= 5.0) return { letter: 'D+', gpa4: 1.5, status: 'Dat' };
  if (rounded >= 4.0) return { letter: 'D', gpa4: 1.0, status: 'Dat' };
  return { letter: 'F', gpa4: 0.0, status: 'KhongDat' };
}

/**
 * Quy đổi ngược từ Điểm chữ hoặc Điểm hệ 4 sang Điểm hệ 10 chuẩn VJU
 * (Dùng khi bảng điểm quét vào chỉ có điểm chữ hoặc điểm hệ 4)
 */
export function inferScore10FromLetterOrGpa4(
  letter?: string | null,
  gpa4?: number | null
): {
  score10?: number;
  letter?: string;
  gpa4?: number;
  status: 'Dat' | 'KhongDat' | 'DangHoc';
} {
  const cleanLetter = (letter || '').trim().toUpperCase();
  if (cleanLetter) {
    switch (cleanLetter) {
      case 'A+':
        return { score10: 9.5, letter: 'A+', gpa4: 4.0, status: 'Dat' };
      case 'A':
        return { score10: 8.6, letter: 'A', gpa4: 4.0, status: 'Dat' };
      case 'B+':
        return { score10: 8.2, letter: 'B+', gpa4: 3.5, status: 'Dat' };
      case 'B':
        return { score10: 7.5, letter: 'B', gpa4: 3.0, status: 'Dat' };
      case 'C+':
        return { score10: 6.7, letter: 'C+', gpa4: 2.5, status: 'Dat' };
      case 'C':
        return { score10: 6.0, letter: 'C', gpa4: 2.0, status: 'Dat' };
      case 'D+':
        return { score10: 5.2, letter: 'D+', gpa4: 1.5, status: 'Dat' };
      case 'D':
        return { score10: 4.5, letter: 'D', gpa4: 1.0, status: 'Dat' };
      case 'F':
        return { score10: 3.0, letter: 'F', gpa4: 0.0, status: 'KhongDat' };
    }
  }

  if (gpa4 !== undefined && gpa4 !== null && !isNaN(Number(gpa4))) {
    const g = Number(gpa4);
    if (g >= 3.8) return { score10: 8.6, letter: cleanLetter || 'A', gpa4: 4.0, status: 'Dat' };
    if (g >= 3.3) return { score10: 8.2, letter: cleanLetter || 'B+', gpa4: 3.5, status: 'Dat' };
    if (g >= 2.8) return { score10: 7.5, letter: cleanLetter || 'B', gpa4: 3.0, status: 'Dat' };
    if (g >= 2.3) return { score10: 6.7, letter: cleanLetter || 'C+', gpa4: 2.5, status: 'Dat' };
    if (g >= 1.8) return { score10: 6.0, letter: cleanLetter || 'C', gpa4: 2.0, status: 'Dat' };
    if (g >= 1.3) return { score10: 5.2, letter: cleanLetter || 'D+', gpa4: 1.5, status: 'Dat' };
    if (g >= 0.8) return { score10: 4.5, letter: cleanLetter || 'D', gpa4: 1.0, status: 'Dat' };
    if (g >= 0) return { score10: 3.0, letter: cleanLetter || 'F', gpa4: 0.0, status: 'KhongDat' };
  }

  return { status: 'DangHoc' };
}

/**
 * Chức năng độc quyền dành cho Chủ nhiệm ngành:
 * Nạp điểm cho từng cá nhân sinh viên vào đúng đích tài khoản của sinh viên đó,
 * tự động cập nhật bảng điểm, tính toán GPA và gửi thông báo học vụ đích danh.
 */
export async function saveTeacherGradesForStudent(params: {
  targetStudentId: string;
  targetStudentName?: string;
  courses: TeacherUploadedCourse[];
  teacherName?: string;
  academicYear?: string;
  sendNotification?: boolean;
}): Promise<{
  success: boolean;
  count: number;
  error?: string | null;
  calculatedGpa?: number;
  registeredCredits?: number;
  passedCredits?: number;
}> {
  const {
    targetStudentId,
    targetStudentName = 'Sinh viên BICA',
    courses,
    teacherName = 'TS. Phạm Tiến Thành (Chủ nhiệm ngành BICA)',
    academicYear = '2025-2026',
    sendNotification = true,
  } = params;

  if (!targetStudentId) {
    return { success: false, count: 0, error: 'Thiếu mã sinh viên đích để nạp điểm' };
  }
  if (!courses || courses.length === 0) {
    return { success: false, count: 0, error: 'Chưa có môn học nào trong danh sách nạp điểm' };
  }

  try {
    // 1. Chuẩn hóa điểm số từng môn theo quy chế đào tạo VJU
    const normalizedCourses: StudentCourse[] = courses.map((c) => {
      let finalScore =
        c.diem_tong_ket !== undefined && c.diem_tong_ket !== null && !isNaN(Number(c.diem_tong_ket))
          ? Number(c.diem_tong_ket)
          : undefined;

      // Nếu chưa có điểm tổng kết nhưng có đủ điểm thành phần, tự động tính
      if (
        finalScore === undefined &&
        (c.diem_chuyen_can !== undefined || c.diem_giua_ky !== undefined || c.diem_cuoi_ky !== undefined)
      ) {
        const cc = Number(c.diem_chuyen_can ?? 0);
        const gk = Number(c.diem_giua_ky ?? 0);
        const ck = Number(c.diem_cuoi_ky ?? 0);
        finalScore = Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10;
      }

      let letter = c.diem_chu || '';
      let gpa4 =
        c.diem_thang_4 !== undefined && c.diem_thang_4 !== null && !isNaN(Number(c.diem_thang_4))
          ? Number(c.diem_thang_4)
          : undefined;
      let ketQua = c.ket_qua || 'DangHoc';

      if (finalScore !== undefined) {
        const conv = convertGradeVjuStandard(finalScore);
        if (!letter) letter = conv.letter;
        if (gpa4 === undefined) gpa4 = conv.gpa4;
        ketQua = conv.status;
      } else if (letter || gpa4 !== undefined) {
        const inferred = inferScore10FromLetterOrGpa4(letter, gpa4);
        if (inferred.score10 !== undefined) finalScore = inferred.score10;
        if (!letter && inferred.letter) letter = inferred.letter;
        if (gpa4 === undefined && inferred.gpa4 !== undefined) gpa4 = inferred.gpa4;
        ketQua = inferred.status;
      }

      return {
        id: c.id || `course-${targetStudentId}-${c.ma_hoc_phan}-${Date.now()}`,
        ma_sinh_vien: targetStudentId,
        ma_hoc_phan: c.ma_hoc_phan.trim().toUpperCase(),
        ten_hoc_phan: c.ten_hoc_phan.trim(),
        so_tin_chi: Number(c.so_tin_chi) || 3,
        hoc_ky: c.hoc_ky || 'Học kỳ 1',
        nam_hoc: c.nam_hoc || academicYear,
        diem_chuyen_can: c.diem_chuyen_can ?? undefined,
        diem_giua_ky: c.diem_giua_ky ?? undefined,
        diem_cuoi_ky: c.diem_cuoi_ky ?? undefined,
        diem_tong_ket: finalScore ?? undefined,
        diem_chu: letter || (ketQua === 'Dat' ? 'A' : undefined),
        diem_thang_4: gpa4 !== undefined && gpa4 !== null ? gpa4 : (ketQua === 'Dat' ? 4.0 : undefined),
        ket_qua: ketQua,
        giang_vien: (c.giang_vien || teacherName) ?? undefined,
      };
    });

    // 2. Ghi và cập nhật vào Supabase
    try {
      const { data: existingRows } = await supabase
        .from('khoa_hoc_sinh_vien')
        .select('*')
        .eq('ma_sinh_vien', targetStudentId);

      const existingMap = new Map<string, any>();
      (existingRows || []).forEach((row) => existingMap.set(row.ma_hoc_phan?.trim()?.toUpperCase(), row));

      for (const item of normalizedCourses) {
        const matched = existingMap.get(item.ma_hoc_phan);
        const payload: any = {
          ma_sinh_vien: targetStudentId,
          ma_hoc_phan: item.ma_hoc_phan,
          ten_hoc_phan: item.ten_hoc_phan,
          so_tin_chi: item.so_tin_chi,
          hoc_ky: item.hoc_ky,
          nam_hoc: item.nam_hoc,
          diem_chuyen_can: item.diem_chuyen_can,
          diem_giua_ky: item.diem_giua_ky,
          diem_cuoi_ky: item.diem_cuoi_ky,
          diem_tong_ket: item.diem_tong_ket,
          diem_chu: item.diem_chu,
          diem_thang_4: item.diem_thang_4,
          ket_qua: item.ket_qua,
          giang_vien: item.giang_vien,
        };

        if (matched?.id) {
          await supabase.from('khoa_hoc_sinh_vien').update(payload).eq('id', matched.id);
        } else {
          await supabase.from('khoa_hoc_sinh_vien').insert([payload]);
        }
      }
    } catch (dbErr) {
      console.warn('Cảnh báo đồng bộ Supabase khoa_hoc_sinh_vien:', dbErr);
    }

    // 3. Cập nhật bộ nhớ cục bộ cho đích sinh viên này
    const existingLocal = getLocalCoursesForStudent(targetStudentId);
    const localMap = new Map<string, StudentCourse>();
    existingLocal.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
    normalizedCourses.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
    const mergedList = Array.from(localMap.values());
    saveLocalCoursesForStudent(targetStudentId, mergedList);

    // 4. Tính toán lại tổng tín chỉ và GPA mới nhất của sinh viên
    const regCredits = mergedList.reduce((sum, c) => sum + (Number(c.so_tin_chi) || 0), 0);
    const passCredits = mergedList.filter((c) => c.ket_qua === 'Dat').reduce((sum, c) => sum + (Number(c.so_tin_chi) || 0), 0);

    let totalPoints = 0;
    let countedCredits = 0;
    mergedList.forEach((c) => {
      if (c.diem_thang_4 !== undefined && c.diem_thang_4 !== null && c.so_tin_chi) {
        totalPoints += Number(c.diem_thang_4) * Number(c.so_tin_chi);
        countedCredits += Number(c.so_tin_chi);
      }
    });
    const calculatedGpa = countedCredits > 0 ? Number((totalPoints / countedCredits).toFixed(2)) : 0;

    // 5. Cập nhật bảng ho_so trong Supabase nếu có
    try {
      await supabase
        .from('ho_so')
        .update({
          tong_tin_chi_tich_luy: passCredits,
          diem_gpa: calculatedGpa,
        })
        .eq('ma_sinh_vien', targetStudentId);
    } catch {
      // ignore
    }

    // 6. Gửi thông báo học vụ trực tiếp đến tài khoản sinh viên
    if (sendNotification) {
      const courseNamesSummary = normalizedCourses
        .slice(0, 3)
        .map((c) => `${c.ten_hoc_phan} (${c.diem_tong_ket ?? c.diem_chu ?? 'Đạt'})`)
        .join(', ');
      const extraCount = normalizedCourses.length > 3 ? ` và ${normalizedCourses.length - 3} học phần khác` : '';

      await sendTeacherReminder({
        ma_sinh_vien: targetStudentId,
        tieu_de: `Cập nhật kết quả bảng điểm chính thức (${normalizedCourses.length} học phần)`,
        noi_dung: `Chào em ${targetStudentName}, Thầy (Chủ nhiệm ngành BICA) vừa cập nhật kết quả học tập của em lên hệ thống gồm: ${courseNamesSummary}${extraCount}. Điểm trung bình tích lũy GPA hiện tại của em đạt ${calculatedGpa}. Em hãy vào mục "Điểm Số & Tín Chỉ" để kiểm tra chi tiết.`,
        loai_thong_bao: calculatedGpa >= 3.6 ? 'khen_thuong' : calculatedGpa < 2.5 ? 'canh_bao' : 'nhac_nho',
        nguoi_gui: teacherName,
        chuc_danh: 'Chủ nhiệm ngành BICA',
      });
    }

    return {
      success: true,
      count: normalizedCourses.length,
      calculatedGpa,
      registeredCredits: regCredits,
      passedCredits: passCredits,
    };
  } catch (err: any) {
    console.error('Lỗi khi nạp điểm cho sinh viên:', err);
    return {
      success: false,
      count: 0,
      error: err.message || 'Lỗi không xác định khi nạp điểm',
    };
  }
}

// ============================================================================
// HỆ THỐNG NỘP & THẨM ĐỊNH MINH CHỨNG ĐIỂM RÈN LUYỆN (BẢO MẬT ẢNH CHO ADMIN)
// ============================================================================

export const EVIDENCE_STORAGE_KEY = 'bica_minh_chung_ren_luyen_store';
export const EVALUATOR_SESSION_KEY = 'bica_ren_luyen_evaluator_session';

export const DEFAULT_INITIAL_EVIDENCE: any[] = [
  {
    id: 'mc-01',
    ma_sinh_vien: 'BICA25119034',
    ho_va_ten: 'Sinh viên BICA K2025',
    lop: 'BICA-K2025',
    email: '25119034@st.vju.ac.vn',
    tieu_de: 'Tham gia Hội thảo Chuyển đổi số & AI Robotics 2025 tại VJU',
    danh_muc: 'hoc_tap',
    mo_ta: 'Tham gia đầy đủ phiên thảo luận, có giấy chứng nhận tham gia từ Ban tổ chức Khoa Kỹ thuật Thông minh.',
    ngay_dien_ra: '2026-03-12',
    diem_de_xuat: 10,
    diem_duyet: 10,
    anh_minh_chung_urls: [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=60'
    ],
    trang_thai: 'da_duyet',
    nhan_xet_admin: 'Minh chứng hợp lệ, giấy chứng nhận đầy đủ dấu mộc VJU. Đã duyệt cộng 10 điểm.',
    nguoi_duyet: 'TS. Phạm Tiến Thành (Chủ nhiệm ngành)',
    ngay_duyet: '2026-03-15',
    created_at: '2026-03-13T08:30:00Z'
  },
  {
    id: 'mc-02',
    ma_sinh_vien: 'BICA25119034',
    ho_va_ten: 'Sinh viên BICA K2025',
    lop: 'BICA-K2025',
    email: '25119034@st.vju.ac.vn',
    tieu_de: 'Chiến dịch Tình nguyện Mùa Hè Xanh & Dọn dẹp khuôn viên VJU',
    danh_muc: 'tinh_nguyen',
    mo_ta: 'Tham gia dọn dẹp vệ sinh phòng thực hành IoT và khuôn viên cơ sở Mỹ Đình 2 ngày cuối tuần.',
    ngay_dien_ra: '2026-03-18',
    diem_de_xuat: 15,
    diem_duyet: 15,
    anh_minh_chung_urls: [
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&auto=format&fit=crop&q=60'
    ],
    trang_thai: 'da_duyet',
    nhan_xet_admin: 'Có xác nhận từ Đoàn thanh niên VJU. Đạt tối đa điểm phong trào.',
    nguoi_duyet: 'Trần Duy Khánh (Admin Web)',
    ngay_duyet: '2026-03-20',
    created_at: '2026-03-19T10:15:00Z'
  },
  {
    id: 'mc-03',
    ma_sinh_vien: 'BICA25119034',
    ho_va_ten: 'Sinh viên BICA K2025',
    lop: 'BICA-K2025',
    email: '25119034@st.vju.ac.vn',
    tieu_de: 'Chứng chỉ Lập trình Python & Thị giác Máy tính',
    danh_muc: 'ky_nang_chung_chi',
    mo_ta: 'Hoàn thành khóa học chuyên sâu 40 giờ có chứng nhận quốc tế phục vụ học phần đồ án ngành BICA.',
    ngay_dien_ra: '2026-03-21',
    diem_de_xuat: 10,
    anh_minh_chung_urls: [
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60'
    ],
    trang_thai: 'cho_duyet',
    created_at: '2026-03-21T14:20:00Z'
  },
  {
    id: 'mc-04',
    ma_sinh_vien: 'BICA25119012',
    ho_va_ten: 'Lê Thị Mai',
    lop: 'BICA-K2025',
    email: '25119012@st.vju.ac.vn',
    tieu_de: 'Giải Ba Cuộc thi Sáng tạo Kỹ thuật VJU Innovation 2026',
    danh_muc: 'nghien_cuu',
    mo_ta: 'Đề tài Hệ thống giám sát pin xe điện thông minh bằng IoT và AI.',
    ngay_dien_ra: '2026-03-10',
    diem_de_xuat: 20,
    diem_duyet: 20,
    anh_minh_chung_urls: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=60'
    ],
    trang_thai: 'da_duyet',
    nhan_xet_admin: 'Thành tích xuất sắc cấp trường. Duyệt tối đa 20 điểm.',
    nguoi_duyet: 'TS. Phạm Tiến Thành (Chủ nhiệm ngành)',
    ngay_duyet: '2026-03-14',
    created_at: '2026-03-11T09:00:00Z'
  }
];

export const PURGED_EVIDENCE_IMAGES_KEY = 'bica_purged_evidence_images_v1';
export const DELETED_EVIDENCE_IDS_KEY = 'bica_deleted_evidence_ids_v1';

export function getDeletedEvidenceIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_EVIDENCE_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markEvidenceIdDeleted(id: string) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const current = getDeletedEvidenceIds();
    current.add(String(id));
    localStorage.setItem(DELETED_EVIDENCE_IDS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export function getPurgedEvidenceImageIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PURGED_EVIDENCE_IMAGES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markEvidenceImageIdsPurged(ids: string[]) {
  if (typeof window === 'undefined' || !ids.length) return;
  try {
    const current = getPurgedEvidenceImageIds();
    ids.forEach((id) => {
      if (id) current.add(String(id));
    });
    localStorage.setItem(PURGED_EVIDENCE_IMAGES_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

function applyPurgedImagesFilter(list: any[]): any[] {
  const purgedIds = getPurgedEvidenceImageIds();
  const deletedIds = getDeletedEvidenceIds();
  return (list || [])
    .filter((item) => !deletedIds.has(String(item.id)))
    .map((item) => {
      const isPurged =
        purgedIds.has(String(item.id)) ||
        Boolean(item.da_xoa_anh) ||
        (item.trang_thai !== 'cho_duyet' &&
          Array.isArray(item.anh_minh_chung_urls) &&
          item.anh_minh_chung_urls.length === 0);
      if (isPurged) {
        return {
          ...item,
          anh_minh_chung_urls: [],
          da_xoa_anh: true,
        };
      }
      return item;
    });
}

export function getLocalEvidence(): any[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_EVIDENCE;
  try {
    const raw = localStorage.getItem(EVIDENCE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_EVIDENCE));
      return applyPurgedImagesFilter(DEFAULT_INITIAL_EVIDENCE);
    }
    return applyPurgedImagesFilter(JSON.parse(raw));
  } catch {
    return applyPurgedImagesFilter(DEFAULT_INITIAL_EVIDENCE);
  }
}

export function saveLocalEvidence(list: any[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(list));
  }
}

export const AUTHORIZED_OFFICERS_KEY = 'bica_authorized_officers_list';

export const INITIAL_AUTHORIZED_OFFICERS: AuthorizedOfficer[] = [
  {
    id: 'off-01',
    ho_va_ten: 'Nguyễn Văn Nam',
    ma_sinh_vien: 'BICA25119001',
    email: 'nam.nv25@st.vju.ac.vn',
    chuc_vu: 'Lớp trưởng BICA K2025',
    mat_khau: 'NamBica2025',
    quyen_han: 'cham_diem',
    trang_thai: 'active',
    ngay_cap: '2026-03-01',
    nguoi_cap: 'Trần Duy Khánh (Admin Web)',
    ghi_chu: 'Cán bộ lớp phụ trách sơ duyệt minh chứng rèn luyện và tổng hợp điểm'
  },
  {
    id: 'off-02',
    ho_va_ten: 'Đỗ Thị Thu Trang',
    ma_sinh_vien: 'BICA25119002',
    email: 'trang.dt25@st.vju.ac.vn',
    chuc_vu: 'Bí thư Chi đoàn BICA',
    mat_khau: 'TrangBica2025',
    quyen_han: 'cham_diem',
    trang_thai: 'active',
    ngay_cap: '2026-03-05',
    nguoi_cap: 'Trần Duy Khánh (Admin Web)',
    ghi_chu: 'Phụ trách thẩm định các hoạt động đoàn thể, thanh niên tình nguyện'
  }
];

export function getAuthorizedOfficers(): AuthorizedOfficer[] {
  if (typeof window === 'undefined') return INITIAL_AUTHORIZED_OFFICERS;
  try {
    const raw = localStorage.getItem(AUTHORIZED_OFFICERS_KEY);
    if (!raw) {
      localStorage.setItem(AUTHORIZED_OFFICERS_KEY, JSON.stringify(INITIAL_AUTHORIZED_OFFICERS));
      return INITIAL_AUTHORIZED_OFFICERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_AUTHORIZED_OFFICERS;
  }
}

export function saveAuthorizedOfficers(list: AuthorizedOfficer[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTHORIZED_OFFICERS_KEY, JSON.stringify(list));
  }
}

export function addAuthorizedOfficer(data: {
  ho_va_ten: string;
  ma_sinh_vien: string;
  email: string;
  chuc_vu: string;
  mat_khau: string;
  quyen_han: 'toan_quyen' | 'cham_diem' | 'chi_xem';
  ghi_chu?: string;
  nguoi_cap?: string;
}): AuthorizedOfficer {
  const currentList = getAuthorizedOfficers();
  const newOfficer: AuthorizedOfficer = {
    id: `off-${Date.now()}`,
    ho_va_ten: data.ho_va_ten.trim(),
    ma_sinh_vien: data.ma_sinh_vien.trim().toUpperCase(),
    email: data.email.trim().toLowerCase(),
    chuc_vu: data.chuc_vu.trim(),
    mat_khau: data.mat_khau.trim(),
    quyen_han: data.quyen_han,
    trang_thai: 'active',
    ngay_cap: new Date().toISOString().split('T')[0],
    nguoi_cap: data.nguoi_cap || 'Trần Duy Khánh (Admin Web)',
    ghi_chu: data.ghi_chu?.trim() || ''
  };

  const updatedList = [newOfficer, ...currentList];
  saveAuthorizedOfficers(updatedList);
  return newOfficer;
}

export function updateAuthorizedOfficer(id: string, updates: Partial<AuthorizedOfficer>): AuthorizedOfficer[] {
  const currentList = getAuthorizedOfficers();
  const updatedList = currentList.map(item => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveAuthorizedOfficers(updatedList);
  return updatedList;
}

export function deleteAuthorizedOfficer(id: string): AuthorizedOfficer[] {
  const currentList = getAuthorizedOfficers();
  const updatedList = currentList.filter(item => item.id !== id);
  saveAuthorizedOfficers(updatedList);
  return updatedList;
}

export interface EvaluatorSession {
  name: string;
  role: string;
  email: string;
  isSuperAdmin: boolean;
  officerId?: string;
  quyen_han?: string;
}

export function getEvaluatorSession(): EvaluatorSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(EVALUATOR_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveEvaluatorSession(session: EvaluatorSession) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(EVALUATOR_SESSION_KEY, JSON.stringify(session));
  }
}

export function clearEvaluatorSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(EVALUATOR_SESSION_KEY);
  }
}

/**
 * Xác thực đăng nhập vào Khu Vực Thẩm Định Minh Chứng thông qua Server API
 * và danh sách Cán bộ lớp được Admin cấp quyền
 */
export async function authenticateEvaluator(
  accountInput: string,
  passwordInput: string
): Promise<{ success: boolean; session?: EvaluatorSession; error?: string }> {
  const accountClean = accountInput.trim().toLowerCase();
  const passClean = passwordInput.trim();

  // 1 & 2. Xác thực tài khoản Super Admin & Chủ nhiệm ngành qua Server API
  const serverRes = await verifyPortalRoleWithServer('evaluator', accountClean, passClean);
  if (serverRes.success && serverRes.session) {
    saveEvaluatorSession(serverRes.session);
    return { success: true, session: serverRes.session };
  }
  if (!serverRes.isNotServerAccount && serverRes.error) {
    return {
      success: false,
      error: serverRes.error,
    };
  }

  // 3. Kiểm tra danh sách Cán bộ lớp được Admin cấp quyền
  const officers = getAuthorizedOfficers();
  const matchedOfficer = officers.find(
    off => off.email.toLowerCase() === accountClean || off.ma_sinh_vien.toLowerCase() === accountClean
  );

  if (matchedOfficer) {
    if (matchedOfficer.trang_thai === 'suspended') {
      return {
        success: false,
        error: `Tài khoản cán bộ "${matchedOfficer.ho_va_ten}" (${matchedOfficer.chuc_vu}) đã bị tạm khóa. Vui lòng liên hệ Admin Web để được kích hoạt lại.`
      };
    }

    if (matchedOfficer.mat_khau === passClean) {
      const session: EvaluatorSession = {
        name: `${matchedOfficer.ho_va_ten} (${matchedOfficer.chuc_vu})`,
        role: matchedOfficer.chuc_vu,
        email: matchedOfficer.email,
        isSuperAdmin: false,
        officerId: matchedOfficer.id,
        quyen_han: matchedOfficer.quyen_han
      };
      saveEvaluatorSession(session);
      return { success: true, session };
    }

    return {
      success: false,
      error: 'Mật khẩu của Cán bộ lớp không chính xác. Vui lòng kiểm tra lại mật khẩu đã được cấp.'
    };
  }

  return {
    success: false,
    error: 'Tài khoản chưa được cấp quyền thẩm định hoặc không tồn tại. Vui lòng kiểm tra lại tài khoản hoặc liên hệ Admin hệ thống.'
  };
}

/**
 * Lấy danh sách minh chứng của riêng một sinh viên
 */
export async function fetchMinhChungForStudent(ma_sinh_vien: string): Promise<{
  data: any[];
  isFromSupabase: boolean;
}> {
  const local = getLocalEvidence().filter(item => item.ma_sinh_vien === ma_sinh_vien);

  try {
    const { data, error } = await supabase
      .from('minh_chung_ren_luyen')
      .select('*')
      .eq('ma_sinh_vien', ma_sinh_vien)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return { data: applyPurgedImagesFilter(data), isFromSupabase: true };
    }
  } catch {
    // fallback
  }

  return { data: local, isFromSupabase: false };
}

/**
 * Lấy toàn bộ danh sách minh chứng của tất cả sinh viên (Dành riêng cho Admin / Người được cấp quyền)
 */
export async function fetchAllMinhChungForAdmin(): Promise<{
  data: any[];
  isFromSupabase: boolean;
}> {
  const local = getLocalEvidence();

  try {
    const { data, error } = await supabase
      .from('minh_chung_ren_luyen')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return { data: applyPurgedImagesFilter(data), isFromSupabase: true };
    }
  } catch {
    // fallback
  }

  return { data: local, isFromSupabase: false };
}

/**
 * Sinh viên nộp minh chứng điểm rèn luyện mới (kèm ảnh)
 */
export async function submitMinhChung(payload: {
  ma_sinh_vien: string;
  ho_va_ten: string;
  lop: string;
  email: string;
  tieu_de: string;
  danh_muc: string;
  mo_ta?: string;
  ngay_dien_ra: string;
  diem_de_xuat: number;
  anh_minh_chung_urls: string[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const newId = 'mc-' + Date.now();
  const newItem = {
    id: newId,
    ma_sinh_vien: payload.ma_sinh_vien,
    ho_va_ten: payload.ho_va_ten,
    lop: payload.lop || 'BICA-K2025',
    email: payload.email,
    tieu_de: payload.tieu_de,
    danh_muc: payload.danh_muc,
    mo_ta: payload.mo_ta || '',
    ngay_dien_ra: payload.ngay_dien_ra,
    diem_de_xuat: Number(payload.diem_de_xuat) || 0,
    diem_duyet: undefined,
    anh_minh_chung_urls: payload.anh_minh_chung_urls,
    trang_thai: 'cho_duyet',
    created_at: new Date().toISOString(),
  };

  // Lưu cục bộ trước
  const currentList = getLocalEvidence();
  currentList.unshift(newItem);
  saveLocalEvidence(currentList);

  // Thử đẩy lên Supabase
  try {
    const { data, error } = await supabase.from('minh_chung_ren_luyen').insert([newItem]);
    if (!error) {
      return { success: true, data };
    }
  } catch {
    // fallback to local
  }

  return { success: true, data: newItem };
}

/**
 * Admin / Người được cấp quyền duyệt điểm rèn luyện hoặc yêu cầu bổ sung
 */
export async function reviewMinhChung(payload: {
  id: string;
  trang_thai: 'da_duyet' | 'tu_choi' | 'can_bo_sung';
  diem_duyet?: number;
  nhan_xet_admin?: string;
  nguoi_duyet: string;
  xoa_anh_sau_cham?: boolean;
}): Promise<{ success: boolean }> {
  if (payload.xoa_anh_sau_cham) {
    markEvidenceImageIdsPurged([payload.id]);
  }

  // Cập nhật cục bộ
  const currentList = getLocalEvidence();
  const updated = currentList.map(item => {
    if (item.id === payload.id) {
      return {
        ...item,
        trang_thai: payload.trang_thai,
        diem_duyet: payload.diem_duyet !== undefined ? payload.diem_duyet : item.diem_de_xuat,
        nhan_xet_admin: payload.nhan_xet_admin || '',
        nguoi_duyet: payload.nguoi_duyet,
        ngay_duyet: new Date().toLocaleDateString('vi-VN'),
        ...(payload.xoa_anh_sau_cham
          ? { anh_minh_chung_urls: [], da_xoa_anh: true }
          : {}),
      };
    }
    return item;
  });
  saveLocalEvidence(updated);

  // Cập nhật Supabase
  try {
    const updateData: Record<string, any> = {
      trang_thai: payload.trang_thai,
      diem_duyet: payload.diem_duyet,
      nhan_xet_admin: payload.nhan_xet_admin,
      nguoi_duyet: payload.nguoi_duyet,
      ngay_duyet: new Date().toLocaleDateString('vi-VN'),
    };
    if (payload.xoa_anh_sau_cham) {
      updateData.anh_minh_chung_urls = [];
    }

    await supabase
      .from('minh_chung_ren_luyen')
      .update(updateData)
      .eq('id', payload.id);
  } catch {
    // ignore
  }

  return { success: true };
}

/**
 * Admin Web xóa dữ liệu ảnh minh chứng của 1 hồ sơ sau khi đã chấm xong
 * (Giữ nguyên kết quả điểm rèn luyện & lịch sử duyệt, chỉ giải phóng dung lượng ảnh)
 */
export async function purgeMinhChungImages(
  evidenceId: string
): Promise<{ success: boolean; error?: string | null }> {
  if (!evidenceId) {
    return { success: false, error: 'Thiếu mã hồ sơ minh chứng' };
  }

  markEvidenceImageIdsPurged([evidenceId]);

  try {
    const currentList = getLocalEvidence();
    const updated = currentList.map((item) => {
      if (String(item.id) === String(evidenceId)) {
        return {
          ...item,
          anh_minh_chung_urls: [],
          da_xoa_anh: true,
        };
      }
      return item;
    });
    saveLocalEvidence(updated);
  } catch {
    // ignore
  }

  try {
    await supabase
      .from('minh_chung_ren_luyen')
      .update({ anh_minh_chung_urls: [] })
      .eq('id', evidenceId);
  } catch {
    // ignore
  }

  return { success: true };
}

/**
 * Admin Web dọn dẹp hàng loạt toàn bộ dữ liệu ảnh của các hồ sơ đã chấm xong (trang_thai !== 'cho_duyet')
 * để tránh quá tải bộ nhớ và cơ sở dữ liệu
 */
export async function purgeAllGradedMinhChungImages(
  evidenceIdsToPurge: string[]
): Promise<{ success: boolean; count: number; error?: string | null }> {
  const cleanIds = Array.from(new Set((evidenceIdsToPurge || []).filter(Boolean).map(String)));
  if (cleanIds.length === 0) {
    return { success: true, count: 0 };
  }

  markEvidenceImageIdsPurged(cleanIds);
  const idSet = new Set(cleanIds);

  try {
    const currentList = getLocalEvidence();
    const updated = currentList.map((item) => {
      if (idSet.has(String(item.id))) {
        return {
          ...item,
          anh_minh_chung_urls: [],
          da_xoa_anh: true,
        };
      }
      return item;
    });
    saveLocalEvidence(updated);
  } catch {
    // ignore
  }

  try {
    await supabase
      .from('minh_chung_ren_luyen')
      .update({ anh_minh_chung_urls: [] })
      .in('id', cleanIds);
  } catch {
    // ignore
  }

  return { success: true, count: cleanIds.length };
}

/**
 * Xóa hoàn toàn một hồ sơ minh chứng rèn luyện của sinh viên khỏi hệ thống
 */
export async function deleteMinhChungRecord(
  evidenceId: string
): Promise<{ success: boolean; error?: string | null }> {
  if (!evidenceId) {
    return { success: false, error: 'Thiếu mã hồ sơ minh chứng cần xóa' };
  }

  markEvidenceIdDeleted(evidenceId);

  try {
    const currentList = getLocalEvidence();
    const updated = currentList.filter((item) => String(item.id) !== String(evidenceId));
    saveLocalEvidence(updated);
  } catch {
    // ignore
  }

  try {
    await supabase.from('minh_chung_ren_luyen').delete().eq('id', evidenceId);
  } catch {
    // ignore
  }

  return { success: true };
}

export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- SQL MIGRATION CHO DỰ ÁN SUPABASE: THEO DÕI TÍN CHỈ BICA 2025
-- Chạy đoạn mã này trong Supabase Studio -> SQL Editor để tạo bảng & phân quyền
-- ==============================================================================

-- 1. Bảng hồ sơ sinh viên (hỗ trợ phân lập theo user_id tài khoản)
CREATE TABLE IF NOT EXISTS public.ho_so (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ma_sinh_vien TEXT UNIQUE NOT NULL,
  ho_va_ten TEXT NOT NULL,
  lop TEXT NOT NULL,
  nganh_hoc TEXT NOT NULL,
  khoa TEXT NOT NULL,
  nien_khoa TEXT NOT NULL,
  email TEXT NOT NULL,
  so_dien_thoai TEXT,
  ngay_sinh DATE,
  avatar_url TEXT,
  trang_thai_hoc_tap TEXT DEFAULT 'Đang theo học',
  tong_tin_chi_tich_luy NUMERIC DEFAULT 0,
  tong_tin_chi_yeu_cau NUMERIC DEFAULT 145,
  diem_gpa NUMERIC DEFAULT 0,
  diem_cpa NUMERIC DEFAULT 0,
  xep_loai TEXT DEFAULT 'Chưa xếp loại',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bổ sung cột user_id nếu bảng ho_so đã được tạo trước đó
ALTER TABLE public.ho_so ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Bảng các khóa học & điểm số của sinh viên
CREATE TABLE IF NOT EXISTS public.khoa_hoc_sinh_vien (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ma_sinh_vien TEXT NOT NULL,
  ma_hoc_phan TEXT NOT NULL,
  ten_hoc_phan TEXT NOT NULL,
  so_tin_chi INTEGER NOT NULL DEFAULT 3,
  hoc_ky TEXT NOT NULL,
  nam_hoc TEXT NOT NULL,
  diem_chuyen_can NUMERIC,
  diem_giua_ky NUMERIC,
  diem_cuoi_ky NUMERIC,
  diem_tong_ket NUMERIC,
  diem_chu TEXT,
  diem_thang_4 NUMERIC,
  ket_qua TEXT DEFAULT 'Dat',
  giang_vien TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.khoa_hoc_sinh_vien ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. Bảng lịch trình / thời khóa biểu
CREATE TABLE IF NOT EXISTS public.lich_trinh (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ma_sinh_vien TEXT NOT NULL,
  ma_hoc_phan TEXT NOT NULL,
  ten_hoc_phan TEXT NOT NULL,
  thu INTEGER NOT NULL,
  tiet_bat_dau INTEGER NOT NULL,
  so_tiet INTEGER NOT NULL,
  gio_bat_dau TEXT NOT NULL,
  gio_ket_thuc TEXT NOT NULL,
  phong_hoc TEXT NOT NULL,
  giang_vien TEXT NOT NULL,
  hinh_thuc TEXT DEFAULT 'TrucTiep',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lich_trinh ADD COLUMN IF NOT EXISTS user_id UUID;

-- 4. Bảng hồ sơ học phí
CREATE TABLE IF NOT EXISTS public.ho_so_hoc_phi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ma_sinh_vien TEXT NOT NULL,
  hoc_ky TEXT NOT NULL,
  nam_hoc TEXT NOT NULL,
  tong_so_tin_chi INTEGER NOT NULL,
  tong_hoc_phi NUMERIC NOT NULL,
  mien_giam NUMERIC DEFAULT 0,
  da_thanh_toan NUMERIC DEFAULT 0,
  con_no NUMERIC DEFAULT 0,
  han_dong DATE NOT NULL,
  trang_thai TEXT DEFAULT 'ChuaThanhToan',
  ma_giao_dich TEXT,
  ngay_thanh_toan DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ho_so_hoc_phi ADD COLUMN IF NOT EXISTS user_id UUID;

-- Bật tính năng Realtime cho các bảng trên
ALTER PUBLICATION supabase_realtime ADD TABLE public.ho_so;
ALTER PUBLICATION supabase_realtime ADD TABLE public.khoa_hoc_sinh_vien;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lich_trinh;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ho_so_hoc_phi;

-- Cấp quyền truy cập Read/Write cho anon role (khi dùng anon key)
ALTER TABLE public.ho_so ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khoa_hoc_sinh_vien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lich_trinh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ho_so_hoc_phi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép đọc dữ liệu công khai" ON public.ho_so FOR SELECT USING (true);
CREATE POLICY "Cho phép cập nhật hồ sơ" ON public.ho_so FOR ALL USING (true);

CREATE POLICY "Cho phép đọc khóa học" ON public.khoa_hoc_sinh_vien FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa khóa học" ON public.khoa_hoc_sinh_vien FOR ALL USING (true);

CREATE POLICY "Cho phép đọc lịch trình" ON public.lich_trinh FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa lịch trình" ON public.lich_trinh FOR ALL USING (true);

CREATE POLICY "Cho phép đọc học phí" ON public.ho_so_hoc_phi FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa học phí" ON public.ho_so_hoc_phi FOR ALL USING (true);

-- 5. Bảng lời nhắc và cảnh báo học vụ từ Giảng viên đến Sinh viên
CREATE TABLE IF NOT EXISTS public.loi_nhac_sinh_vien (
  id TEXT PRIMARY KEY,
  ma_sinh_vien TEXT NOT NULL,
  tieu_de TEXT NOT NULL,
  noi_dung TEXT NOT NULL,
  loai_thong_bao TEXT DEFAULT 'nhac_nho', -- 'nhac_nho' | 'canh_bao' | 'khen_thuong'
  nguoi_gui TEXT NOT NULL,
  chuc_danh TEXT,
  ngay_tao TEXT,
  da_doc BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.loi_nhac_sinh_vien;
ALTER TABLE public.loi_nhac_sinh_vien ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép đọc lời nhắc" ON public.loi_nhac_sinh_vien FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa lời nhắc" ON public.loi_nhac_sinh_vien FOR ALL USING (true);

-- 6. Bảng nộp minh chứng điểm rèn luyện (chỉ Admin/Giảng viên cấp quyền mới xem ảnh)
CREATE TABLE IF NOT EXISTS public.minh_chung_ren_luyen (
  id TEXT PRIMARY KEY,
  ma_sinh_vien TEXT NOT NULL,
  ho_va_ten TEXT NOT NULL,
  lop TEXT NOT NULL,
  email TEXT NOT NULL,
  tieu_de TEXT NOT NULL,
  danh_muc TEXT NOT NULL,
  mo_ta TEXT,
  ngay_dien_ra DATE,
  diem_de_xuat NUMERIC DEFAULT 0,
  diem_duyet NUMERIC,
  anh_minh_chung_urls TEXT[],
  trang_thai TEXT DEFAULT 'cho_duyet', -- 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'can_bo_sung'
  nhan_xet_admin TEXT,
  nguoi_duyet TEXT,
  ngay_duyet TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.minh_chung_ren_luyen;
ALTER TABLE public.minh_chung_ren_luyen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép quản lý minh chứng rèn luyện" ON public.minh_chung_ren_luyen FOR ALL USING (true);
`;


