import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { StudentProfile, StudentCourse, ScheduleItem, TuitionRecord } from '../types';

// ============================================================================
// KHAI BÁO CẤU HÌNH KẾT NỐI SUPABASE THEO YÊU CẦU
// ============================================================================
export const SUPABASE_URL = 'https://kevoshrilcltgiitmvds.supabase.co/rest/v1/';
export const SUPABASE_ANON_KEY = 'sb_publishable_RWEb_9J8dkpf2tI90H4erQ_vtXh7Ir5';

// Chuẩn hóa Base URL cho Supabase JS Client (loại bỏ /rest/v1/ để Auth và Realtime hoạt động chính xác)
const SUPABASE_BASE_URL = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');

// Khởi tạo Supabase client hỗ trợ cả CDN window.supabase và @supabase/supabase-js package
const getClient = (): SupabaseClient => {
  if (typeof window !== 'undefined' && (window as any).supabase?.createClient) {
    return (window as any).supabase.createClient(SUPABASE_BASE_URL, SUPABASE_ANON_KEY);
  }
  return createClient(SUPABASE_BASE_URL, SUPABASE_ANON_KEY);
};

export const supabase: SupabaseClient = getClient();

// ============================================================================
// DỮ LIỆU DỰ PHÒNG CHUẨN SINH VIÊN BICA 2025 (KHI BẢNG TRỐNG HOẶC CHƯA TẠO)
// ============================================================================
export const PROFILE_STORAGE_KEY = 'bica_student_profile_cache';

export const GUEST_STUDENT_PROFILE: StudentProfile = {
  ma_sinh_vien: '---',
  ho_va_ten: 'Chưa đăng nhập',
  lop: 'BICA-K2025',
  nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
  khoa: 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)',
  nien_khoa: '2025 - 2029',
  email: 'Chưa đăng nhập',
  so_dien_thoai: '---',
  ngay_sinh: '---',
  trang_thai_hoc_tap: 'Chưa đăng nhập',
  tong_tin_chi_tich_luy: 0,
  tong_tin_chi_yeu_cau: 145,
  diem_gpa: 0.0,
  diem_cpa: 0.0,
  xep_loai: 'Chưa xếp loại',
};

export const DEFAULT_STUDENT_PROFILE = GUEST_STUDENT_PROFILE;

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
    khoa: 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)',
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

/**
 * Đăng ký tài khoản mới với Supabase Auth
 */
export async function signUp(email: string, password: string, fullName?: string, studentId?: string) {
  try {
    const finalStudentId = studentId?.trim() || (email.split('@')[0] ? `BICA${email.split('@')[0]}` : 'BICA-SV');
    const finalFullName = fullName?.trim() || 'Sinh viên BICA';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: finalFullName,
          student_id: finalStudentId,
        },
      },
    });
    if (error) throw error;

    // Nếu tạo user thành công, lập tức tạo hồ sơ riêng cho tài khoản này
    if (data.user) {
      const initialProfile: StudentProfile = {
        user_id: data.user.id,
        ma_sinh_vien: finalStudentId,
        ho_va_ten: finalFullName,
        email: email,
        lop: 'BICA-K2025',
        nganh_hoc: 'Công nghệ Thông tin & Truyền thông Ứng dụng',
        khoa: 'Viện Công nghệ Tiên tiến',
        nien_khoa: '2025 - 2029',
        trang_thai_hoc_tap: 'Đang theo học',
        tong_tin_chi_tich_luy: 0,
        tong_tin_chi_yeu_cau: 145,
        diem_gpa: 0,
        diem_cpa: 0,
        xep_loai: 'Chưa xếp loại',
      };
      saveLocalProfile(initialProfile, data.user.id);

      try {
        await supabase.from('ho_so').upsert({
          user_id: data.user.id,
          ma_sinh_vien: finalStudentId,
          ho_va_ten: finalFullName,
          email: email,
          lop: 'BICA-K2025',
          nganh_hoc: 'Công nghệ Thông tin & Truyền thông Ứng dụng',
          khoa: 'Viện Công nghệ Tiên tiến',
          nien_khoa: '2025 - 2029',
          trang_thai_hoc_tap: 'Đang theo học',
          tong_tin_chi_tich_luy: 0,
          tong_tin_chi_yeu_cau: 145,
          diem_gpa: 0,
          diem_cpa: 0,
          xep_loai: 'Chưa xếp loại',
        }, { onConflict: 'ma_sinh_vien' });
      } catch {
        // ignore
      }
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || 'Lỗi đăng ký qua Supabase' };
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

// ============================================================================
// CÁC HÀM LẤY DỮ LIỆU TỪ BẢNG SUPABASE THAY CHO MOCK DATA
// ============================================================================

/**
 * Lấy thông tin sinh viên từ bảng "hồ sơ" (ho_so / profiles / sinh_vien)
 * Tự động phân lập theo từng tài khoản đăng nhập (Account-specific)
 */
export async function fetchStudentProfile(
  currentUser?: User | null,
  studentId?: string
): Promise<{
  data: StudentProfile;
  isFromSupabase: boolean;
  isGuest?: boolean;
  isNewAccount?: boolean;
  error?: string | null;
}> {
  // 1. Trường hợp chưa đăng nhập hoặc đang nạp:
  // TUYỆT ĐỐI KHÔNG truy vấn hồ sơ của sinh viên khác trên Supabase khi người dùng chưa đăng nhập!
  if (!currentUser) {
    return {
      data: GUEST_STUDENT_PROFILE,
      isFromSupabase: false,
      isGuest: true,
      error: null,
    };
  }

  const userKey = currentUser.id || currentUser.email || 'user';

  try {
    // 2. Thử truy vấn bảng 'ho_so' của riêng tài khoản này
    // Ưu tiên 2.1: Truy vấn theo user_id nếu có
    if (currentUser.id) {
      const { data: uData, error: uError } = await supabase
        .from('ho_so')
        .select('*')
        .eq('user_id', currentUser.id)
        .limit(1)
        .maybeSingle();

      if (!uError && uData) {
        const mapped = mapProfileRow(uData, currentUser);
        saveLocalProfile(mapped, userKey);
        return { data: mapped, isFromSupabase: true };
      }
    }

    // Ưu tiên 2.2: Truy vấn theo email của tài khoản
    if (currentUser.email) {
      const { data: eData, error: eError } = await supabase
        .from('ho_so')
        .select('*')
        .eq('email', currentUser.email)
        .limit(1)
        .maybeSingle();

      if (!eError && eData) {
        const mapped = mapProfileRow(eData, currentUser);
        saveLocalProfile(mapped, userKey);
        return { data: mapped, isFromSupabase: true };
      }
    }

    // Ưu tiên 2.3: Nếu có truyền studentId cụ thể hoặc trong user_metadata
    const targetStudentId = studentId || currentUser.user_metadata?.student_id;
    if (targetStudentId && targetStudentId !== 'CHƯA_ĐĂNG_NHẬP') {
      const { data: sData, error: sError } = await supabase
        .from('ho_so')
        .select('*')
        .eq('ma_sinh_vien', targetStudentId)
        .limit(1)
        .maybeSingle();

      if (!sError && sData) {
        const mapped = mapProfileRow(sData, currentUser);
        saveLocalProfile(mapped, userKey);
        return { data: mapped, isFromSupabase: true };
      }
    }

    // 3. Nếu chưa có trên Supabase: Đây là TÀI KHOẢN MỚI chưa lưu hồ sơ lên DB.
    // Kiểm tra bộ nhớ cục bộ riêng của tài khoản này
    const localUser = getLocalProfile(userKey);
    if (localUser && localUser.email === currentUser.email) {
      return {
        data: localUser,
        isFromSupabase: false,
        isNewAccount: true,
      };
    }

    // Khởi tạo hồ sơ cá nhân riêng biệt tương ứng với thông tin tài khoản vừa đăng nhập
    const defaultPersonal = getDefaultProfileForUser(currentUser);
    saveLocalProfile(defaultPersonal, userKey);

    return {
      data: defaultPersonal,
      isFromSupabase: false,
      isNewAccount: true,
      error: null,
    };
  } catch (err: any) {
    const fallback = getLocalProfile(userKey) || getDefaultProfileForUser(currentUser);
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
    khoa: data.khoa || 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)',
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

/**
 * Lấy danh sách điểm số & tín chỉ từ bảng các khóa học của sinh viên
 * (khoa_hoc_sinh_vien / student_courses / diem_so)
 */
export async function fetchCoursesAndGrades(
  studentId?: string,
  currentUser?: User | null
): Promise<{ data: StudentCourse[]; isFromSupabase: boolean; error?: string | null }> {
  // Khi chưa đăng nhập, luôn trả về mảng rỗng để bảo mật và không lộ điểm của sinh viên khác
  if (!currentUser) {
    return {
      data: [],
      isFromSupabase: false,
      error: null,
    };
  }

  try {
    // Thử bảng 'khoa_hoc_sinh_vien'
    let query = supabase.from('khoa_hoc_sinh_vien').select('*').order('nam_hoc', { ascending: false });
    
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

/**
 * Lấy thông tin học phí từ bảng hồ sơ học phí (ho_so_hoc_phi / tuition / hoc_phi)
 */
export async function fetchTuition(
  studentId?: string,
  currentUser?: User | null
): Promise<{ data: TuitionRecord[]; isFromSupabase: boolean; error?: string | null }> {
  // Khi chưa đăng nhập, không trả về hồ sơ học phí của người khác
  if (!currentUser) {
    return {
      data: [],
      isFromSupabase: false,
      error: null,
    };
  }

  try {
    let query = supabase.from('ho_so_hoc_phi').select('*').order('nam_hoc', { ascending: false });
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
          })),
          isFromSupabase: true,
        };
      }
      return {
        data: DEFAULT_TUITION,
        isFromSupabase: true,
      };
    }

    return {
      data: DEFAULT_TUITION,
      isFromSupabase: false,
      error: error?.message || null,
    };
  } catch (err: any) {
    return {
      data: DEFAULT_TUITION,
      isFromSupabase: false,
      error: err.message,
    };
  }
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
  const userKey = currentUser?.id || currentUser?.email || 'guest';
  // 1. Luôn lưu vào LocalStorage của chính tài khoản này
  saveLocalProfile(formData, userKey);

  try {
    const payload: any = {
      ma_sinh_vien: formData.ma_sinh_vien,
      ho_va_ten: formData.ho_va_ten,
      lop: formData.lop,
      nganh_hoc: formData.nganh_hoc,
      khoa: formData.khoa,
      nien_khoa: formData.nien_khoa,
      email: currentUser?.email || formData.email,
      so_dien_thoai: formData.so_dien_thoai || '',
      ngay_sinh: formData.ngay_sinh || null,
      trang_thai_hoc_tap: formData.trang_thai_hoc_tap || 'Đang theo học',
      tong_tin_chi_tich_luy: Number(formData.tong_tin_chi_tich_luy || 0),
      tong_tin_chi_yeu_cau: Number(formData.tong_tin_chi_yeu_cau || 145),
      diem_gpa: Number(formData.diem_gpa || 0),
      diem_cpa: Number(formData.diem_cpa || 0),
      xep_loai: formData.xep_loai || 'Chưa xếp loại',
    };

    if (currentUser?.id) {
      payload.user_id = currentUser.id;
    }

    // Thử upsert có user_id
    let { error } = await supabase.from('ho_so').upsert(payload, {
      onConflict: payload.user_id ? 'user_id' : 'ma_sinh_vien',
    });

    // Nếu lỗi do cột user_id chưa có trong schema Supabase hoặc chưa có constraint onConflict user_id
    if (error && (error.message?.includes('user_id') || error.code === '42703' || error.code === '42P10')) {
      delete payload.user_id;
      const retry = await supabase.from('ho_so').upsert(payload, {
        onConflict: 'ma_sinh_vien',
      });
      error = retry.error;
    }

    if (error) {
      const isMissingTable =
        error.message?.includes('schema cache') ||
        error.message?.includes('not find the table') ||
        error.message?.includes('relation "public.ho_so" does not exist') ||
        error.code === 'PGRST205' ||
        error.code === '42P01';

      return {
        success: false,
        savedLocally: true,
        isMissingTable,
        error: isMissingTable
          ? "Chưa tìm thấy bảng 'public.ho_so' trong Supabase của bạn."
          : error.message,
      };
    }

    return {
      success: true,
      savedLocally: true,
      isMissingTable: false,
    };
  } catch (err: any) {
    return {
      success: false,
      savedLocally: true,
      isMissingTable: false,
      error: err.message,
    };
  }
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
  try {
    let query = supabase.from('khoa_hoc_sinh_vien').delete();

    if (courseId) {
      query = query.eq('id', courseId);
    } else if (courseCode) {
      query = query.eq('ma_hoc_phan', courseCode);
      if (studentId) {
        query = query.eq('ma_sinh_vien', studentId);
      }
      if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }
    } else {
      return { success: false, error: 'Thiếu định danh học phần cần xóa' };
    }

    const { error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi khi xóa học phần' };
  }
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
  try {
    if (courseIds.length > 0) {
      const { error } = await supabase
        .from('khoa_hoc_sinh_vien')
        .delete()
        .in('id', courseIds);
      if (error) throw error;
      return { success: true, count: courseIds.length };
    }

    if (courseCodes.length > 0) {
      let query = supabase
        .from('khoa_hoc_sinh_vien')
        .delete()
        .in('ma_hoc_phan', courseCodes);

      if (studentId) {
        query = query.eq('ma_sinh_vien', studentId);
      }
      if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      }

      const { error } = await query;
      if (error) throw error;
      return { success: true, count: courseCodes.length };
    }

    return { success: false, count: 0, error: 'Không có môn học nào được chọn để xóa' };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Lỗi khi xóa nhiều học phần' };
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
    const items = courses.map(c => ({
      ma_sinh_vien: studentId,
      user_id: currentUser?.id,
      ma_hoc_phan: c.ma_hoc_phan,
      ten_hoc_phan: c.ten_hoc_phan,
      so_tin_chi: c.so_tin_chi,
      hoc_ky: c.hoc_ky_goi_y ? `Học kỳ ${c.hoc_ky_goi_y}` : 'Học kỳ 1',
      nam_hoc: academicYear,
      diem_chuyen_can: c.diem_chuyen_can,
      diem_giua_ky: c.diem_giua_ky,
      diem_cuoi_ky: c.diem_cuoi_ky,
      diem_tong_ket: c.diem_tong_ket,
      diem_chu: c.diem_chu,
      diem_thang_4: c.diem_thang_4,
      ket_qua: c.ket_qua || 'DangHoc',
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
`;


