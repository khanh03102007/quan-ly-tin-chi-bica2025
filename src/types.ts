export interface StudentProfile {
  id?: string;
  user_id?: string;
  ma_sinh_vien: string;
  ho_va_ten: string;
  lop: string;
  nganh_hoc: string;
  khoa: string;
  nien_khoa: string;
  email: string;
  so_dien_thoai?: string;
  ngay_sinh?: string;
  avatar_url?: string;
  trang_thai_hoc_tap?: string;
  tong_tin_chi_tich_luy?: number;
  tong_tin_chi_yeu_cau?: number;
  diem_gpa?: number;
  diem_cpa?: number;
  xep_loai?: string;
}

export interface StudentCourse {
  id?: string;
  user_id?: string;
  ma_sinh_vien?: string;
  ma_hoc_phan: string;
  ten_hoc_phan: string;
  so_tin_chi: number;
  hoc_ky: string;
  nam_hoc: string;
  diem_chuyen_can?: number;
  diem_giua_ky?: number;
  diem_cuoi_ky?: number;
  diem_tong_ket?: number;
  diem_chu?: string;
  diem_thang_4?: number;
  ket_qua?: 'Dat' | 'KhongDat' | 'DangHoc';
  giang_vien?: string;
}

export interface ScheduleItem {
  id?: string;
  ma_sinh_vien?: string;
  ma_hoc_phan: string;
  ten_hoc_phan: string;
  thu: number; // 2 -> Thứ 2, ..., 7 -> Thứ 7, 8 -> Chủ nhật
  tiet_bat_dau: number;
  so_tiet: number;
  gio_bat_dau: string;
  gio_ket_thuc: string;
  phong_hoc: string;
  giang_vien: string;
  hinh_thuc: 'TrucTiep' | 'Online';
  ghi_chu?: string;
}

export interface TuitionRecord {
  id?: string;
  ma_sinh_vien?: string;
  hoc_ky: string;
  nam_hoc: string;
  tong_so_tin_chi: number;
  tong_hoc_phi: number;
  mien_giam?: number;
  da_thanh_toan: number;
  con_no: number;
  han_dong: string;
  trang_thai: 'DaHoanThanh' | 'ChuaThanhToan' | 'QuaHan' | 'ThanhToanMotPhan';
  ma_giao_dich?: string;
  ngay_thanh_toan?: string;
}

export interface StudentReminder {
  id: string;
  ma_sinh_vien: string;
  tieu_de: string;
  noi_dung: string;
  loai_thong_bao: 'nhac_nho' | 'canh_bao' | 'khen_thuong';
  nguoi_gui: string;
  chuc_danh?: string;
  ngay_tao: string;
  da_doc: boolean;
}

export interface TeacherAccount {
  email: string;
  ho_va_ten: string;
  ma_giang_vien: string;
  khoa_vien: string;
  vai_tro: 'giang_vien' | 'co_van_hoc_tap' | 'truong_nganh';
}

export interface SupabaseConfigStatus {
  url: string;
  connected: boolean;
  checking: boolean;
  error?: string | null;
  tableCounts: {
    ho_so: number;
    khoa_hoc: number;
    lich_trinh: number;
    hoc_phi: number;
  };
}

export interface MinhChungRenLuyen {
  id: string;
  ma_sinh_vien: string;
  ho_va_ten: string;
  lop: string;
  email: string;
  tieu_de: string;
  danh_muc: 'hoc_tap' | 'tinh_nguyen' | 'phong_trao' | 'nghien_cuu' | 'ky_nang_chung_chi' | 'khac';
  mo_ta?: string;
  ngay_dien_ra: string;
  diem_de_xuat: number;
  diem_duyet?: number;
  anh_minh_chung_urls: string[]; // Chứa các ảnh minh chứng (base64 hoặc URL)
  da_xoa_anh?: boolean; // Đánh dấu Admin đã xóa dữ liệu ảnh sau khi chấm xong để tối ưu dung lượng
  trang_thai: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'can_bo_sung';
  nhan_xet_admin?: string;
  nguoi_duyet?: string;
  ngay_duyet?: string;
  created_at: string;
}

export interface AuthorizedOfficer {
  id: string;
  ho_va_ten: string;
  ma_sinh_vien: string;
  email: string;
  chuc_vu: string; // e.g. 'Lớp trưởng BICA K2025', 'Bí thư Chi đoàn', 'Lớp phó học tập', 'Cán bộ rèn luyện'
  mat_khau: string; // Mật khẩu đăng nhập thẩm định
  quyen_han: 'toan_quyen' | 'cham_diem' | 'chi_xem';
  trang_thai: 'active' | 'suspended';
  ngay_cap: string;
  nguoi_cap: string;
  ghi_chu?: string;
}


