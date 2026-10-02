import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Users,
  Search,
  AlertTriangle,
  Award,
  Send,
  BellRing,
  BookOpen,
  GraduationCap,
  TrendingDown,
  CheckCircle2,
  Lock,
  LogOut,
  Mail,
  UserCheck,
  Building,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  Eye,
  Filter,
  Upload,
  FileSpreadsheet,
  Layers,
  Trash2,
  UserPlus,
  Loader2,
  Edit3,
  Download,
  ArrowUpDown,
  Database,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { TeacherAccount, StudentReminder } from '../types';
import {
  AUTHORIZED_TEACHERS,
  verifyPortalRoleWithServer,
  sendTeacherReminder,
  getLocalReminders,
  deleteStudentAccountFromSupabase,
  ensureStudentInHoSo,
  updateStudentProfileByTeacher
} from '../lib/supabase';
import { TeacherGradeUploadModal } from './TeacherGradeUploadModal';
import { StudentCreditDistributionModal } from './StudentCreditDistributionModal';

interface TeacherPortalTabProps {
  activeTeacher: TeacherAccount | null;
  onTeacherLogin: (teacher: TeacherAccount) => void;
  onTeacherLogout: () => void;
  allStudents: any[];
  onRefreshData: () => void;
  isRefreshing: boolean;
  onSelectStudentToInspect?: (studentId: string) => void;
}

export const TeacherPortalTab: React.FC<TeacherPortalTabProps> = ({
  activeTeacher,
  onTeacherLogin,
  onTeacherLogout,
  allStudents,
  onRefreshData,
  isRefreshing,
}) => {
  // Login form state - để trống để bảo mật tuyệt đối tài khoản Giảng viên
  const [emailInput, setEmailInput] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Search, Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'warning' | 'excellent' | 'debt'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name_asc' | 'msv_asc' | 'gpa_desc' | 'gpa_asc' | 'credits_desc'>('newest');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() =>
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Chỉnh sửa thông tin sinh viên trực tiếp bởi Chủ nhiệm ngành
  const [studentToEdit, setStudentToEdit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    ma_sinh_vien: '',
    ho_va_ten: '',
    email: '',
    lop: 'BICA-K2025',
    so_dien_thoai: '',
    trang_thai_hoc_tap: 'Đang theo học',
    tong_tin_chi_tich_luy: 0,
    diem_gpa: 0,
    xep_loai: 'Chưa xếp loại',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Send reminder modal state
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderContent, setReminderContent] = useState('');
  const [reminderType, setReminderType] = useState<'nhac_nho' | 'canh_bao' | 'khen_thuong'>('canh_bao');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Inspect detail modal
  const [inspectingStudent, setInspectingStudent] = useState<any | null>(null);

  // Xem phân bổ 6 khối tín chỉ của từng sinh viên
  const [viewingCreditDistributionStudent, setViewingCreditDistributionStudent] = useState<any | null>(null);

  // Upload/Quét điểm sinh viên modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetStudentId, setUploadTargetStudentId] = useState<string | undefined>(undefined);

  // Xóa tài khoản sinh viên khỏi Supabase & Cổng Chủ Nhiệm Ngành
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Thêm nhanh hồ sơ sinh viên mới vào Supabase
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('BICA-K2025');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  const onRefreshDataRef = useRef(onRefreshData);
  useEffect(() => {
    onRefreshDataRef.current = onRefreshData;
  }, [onRefreshData]);

  // Tự động đồng bộ danh sách tất cả thành viên đã đăng ký tài khoản từ Supabase ngay khi mở Cổng Chủ Nhiệm Ngành,
  // khi chuyển tab quay lại, hoặc định kỳ mỗi 5 giây để cập nhật tức thì khi có SV mới tạo tài khoản hoặc bị xóa trên Supabase
  useEffect(() => {
    const triggerSync = () => {
      onRefreshDataRef.current();
      setLastSyncedTime(
        new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    triggerSync();

    const intervalId = setInterval(() => {
      triggerSync();
    }, 5000);

    const handleFocusOrStorage = () => {
      if (document.visibilityState === 'hidden') return;
      triggerSync();
    };

    window.addEventListener('focus', handleFocusOrStorage);
    window.addEventListener('storage', handleFocusOrStorage);
    document.addEventListener('visibilitychange', handleFocusOrStorage);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusOrStorage);
      window.removeEventListener('storage', handleFocusOrStorage);
      document.removeEventListener('visibilitychange', handleFocusOrStorage);
    };
  }, [activeTeacher]);

  const handleOpenEditStudent = (st: any) => {
    setEditError(null);
    setStudentToEdit(st);
    setEditForm({
      ma_sinh_vien: st.ma_sinh_vien || '',
      ho_va_ten: st.ho_va_ten || '',
      email: st.email || '',
      lop: st.lop || 'BICA-K2025',
      so_dien_thoai: st.so_dien_thoai || '',
      trang_thai_hoc_tap: st.trang_thai_hoc_tap || 'Đang theo học',
      tong_tin_chi_tich_luy: Number(st.registered_credits || st.tong_tin_chi_tich_luy || 0),
      diem_gpa: Number(st.calculated_gpa || st.diem_gpa || 0),
      xep_loai: st.xep_loai || 'Chưa xếp loại',
    });
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEdit) return;
    setEditError(null);
    setIsSavingEdit(true);
    try {
      const res = await updateStudentProfileByTeacher(studentToEdit.ma_sinh_vien, {
        ma_sinh_vien: editForm.ma_sinh_vien.trim().toUpperCase(),
        ho_va_ten: editForm.ho_va_ten.trim(),
        email: editForm.email.trim().toLowerCase(),
        lop: editForm.lop.trim() || 'BICA-K2025',
        so_dien_thoai: editForm.so_dien_thoai.trim(),
        trang_thai_hoc_tap: editForm.trang_thai_hoc_tap,
        tong_tin_chi_tich_luy: Number(editForm.tong_tin_chi_tich_luy || 0),
        diem_gpa: Number(editForm.diem_gpa || 0),
        xep_loai: editForm.xep_loai,
      });
      if (!res.success) {
        setEditError(res.error || 'Không thể cập nhật hồ sơ sinh viên.');
        return;
      }
      setStudentToEdit(null);
      onRefreshData();
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportStudentsCsv = () => {
    if (!allStudents || allStudents.length === 0) return;
    // Chống lỗ hổng CSV Formula Injection (khi mở bằng Microsoft Excel) & escape dấu ngoặc kép
    const safeCsvCell = (rawVal: any): string => {
      let str = String(rawVal ?? '').replace(/"/g, '""').trim();
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const headers = [
      'STT',
      'Mã Sinh Viên',
      'Họ và Tên',
      'Lớp',
      'Email Tài Khoản',
      'Số Điện Thoại',
      'Tín Chỉ Tích Lũy',
      'Số Học Phần',
      'Điểm GPA (Hệ 4)',
      'Xếp Loại',
      'Trạng Thái Học Tập',
      'Công Nợ Học Phí (VNĐ)',
      'Ngày Đăng Ký Tài Khoản',
    ];
    const rows = filteredStudents.map((st, idx) => {
      const gpa = Number(st.calculated_gpa || st.diem_gpa || 0).toFixed(2);
      const credits = st.registered_credits || st.tong_tin_chi_tich_luy || 0;
      const debt = Number(st.tuition_debt || 0);
      const createdDate = st.created_at
        ? new Date(st.created_at).toLocaleDateString('vi-VN')
        : 'Đã kích hoạt';
      return [
        idx + 1,
        safeCsvCell(st.ma_sinh_vien || ''),
        safeCsvCell(st.ho_va_ten || ''),
        safeCsvCell(st.lop || 'BICA-K2025'),
        safeCsvCell(st.email || ''),
        safeCsvCell(st.so_dien_thoai || ''),
        credits,
        st.courses_count || 0,
        gpa,
        safeCsvCell(st.xep_loai || 'Bình thường'),
        safeCsvCell(st.trang_thai_hoc_tap || 'Đang theo học'),
        debt,
        safeCsvCell(createdDate),
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Danh_Sach_Sinh_Vien_BICA_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      await deleteStudentAccountFromSupabase(
        studentToDelete.ma_sinh_vien,
        studentToDelete.email
      );
      if (inspectingStudent?.ma_sinh_vien === studentToDelete.ma_sinh_vien) {
        setInspectingStudent(null);
      }
      setStudentToDelete(null);
      onRefreshData();
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleAddNewStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStudentError(null);
    const cleanId = newStudentId.trim().toUpperCase();
    const cleanName = newStudentName.trim();
    const cleanEmail = (
      newStudentEmail.trim() || `${cleanId.toLowerCase()}@st.vju.ac.vn`
    ).toLowerCase();

    if (!cleanId || !cleanName) {
      setAddStudentError('Vui lòng nhập đầy đủ Mã số sinh viên và Họ tên.');
      return;
    }

    setIsAddingStudent(true);
    try {
      const res = await ensureStudentInHoSo({
        ma_sinh_vien: cleanId,
        ho_va_ten: cleanName,
        email: cleanEmail,
        lop: newStudentClass.trim() || 'BICA-K2025',
        nganh_hoc: 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
        khoa: 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)',
        nien_khoa: '2025 - 2029',
        trang_thai_hoc_tap: 'Đang theo học',
        tong_tin_chi_tich_luy: 0,
        tong_tin_chi_yeu_cau: 145,
        diem_gpa: 0,
        diem_cpa: 0,
        xep_loai: 'Chưa xếp loại',
      });

      if (!res.success) {
        setAddStudentError(res.error || 'Không thể lưu sinh viên lên Supabase.');
        return;
      }

      setIsAddStudentModalOpen(false);
      setNewStudentId('');
      setNewStudentName('');
      setNewStudentEmail('');
      onRefreshData();
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Pre-load quick message templates
  const applyTemplate = (type: 'canh_bao_gpa' | 'canh_bao_tin_chi' | 'khen_thuong' | 'nhac_nho_hoc_phi') => {
    if (!selectedStudent) return;
    if (type === 'canh_bao_gpa') {
      setReminderType('canh_bao');
      setReminderTitle(`Cảnh báo học vụ: GPA hiện tại (${selectedStudent.calculated_gpa || selectedStudent.diem_gpa || 0})`);
      setReminderContent(`Chào em ${selectedStudent.ho_va_ten}, thầy theo dõi thấy điểm tích lũy của em đang ở ngưỡng cần lưu ý. Em cần chủ động gặp Cố vấn học tập và sắp xếp nhóm học phụ đạo để cải thiện kết quả học kỳ này.`);
    } else if (type === 'canh_bao_tin_chi') {
      setReminderType('nhac_nho');
      setReminderTitle(`Nhắc nhở số tín chỉ đăng ký (${selectedStudent.registered_credits || 0} tín chỉ)`);
      setReminderContent(`Chào em ${selectedStudent.ho_va_ten}, số lượng tín chỉ đăng ký học kỳ này của em cần được phân bổ đều giữa các học phần tiên quyết. Chú ý lịch thực hành tại phòng Lab để không bị cấm thi.`);
    } else if (type === 'khen_thuong') {
      setReminderType('khen_thuong');
      setReminderTitle(`Biểu dương thành tích học tập xuất sắc`);
      setReminderContent(`Chúc mừng em ${selectedStudent.ho_va_ten} đã duy trì kết quả học tập rất ấn tượng (GPA: ${selectedStudent.calculated_gpa || selectedStudent.diem_gpa}). Khoa khuyến khích em đăng ký tham gia các đề tài nghiên cứu khoa học sinh viên cùng các thầy cô.`);
    } else if (type === 'nhac_nho_hoc_phi') {
      setReminderType('canh_bao');
      setReminderTitle(`Nhắc nhở hoàn thành học phí học kỳ`);
      setReminderContent(`Hệ thống ghi nhận em còn khoản nợ học phí chưa thanh toán. Đề nghị em kiểm tra lại cổng đào tạo và hoàn tất trước hạn quy định để không bị khóa lịch thi cuối kỳ.`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailClean = emailInput.toLowerCase().trim();
    const passClean = accessCode.trim();

    const verifyRes = await verifyPortalRoleWithServer('teacher', emailClean, passClean);
    if (!verifyRes.success || !verifyRes.teacher) {
      setLoginError(
        verifyRes.error || 'Mật khẩu phân quyền hoặc email không chính xác. Vui lòng thử lại.'
      );
      return;
    }

    onTeacherLogin(verifyRes.teacher);
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !reminderTitle.trim() || !reminderContent.trim()) return;

    setSending(true);
    setSendSuccess(null);

    const res = await sendTeacherReminder({
      ma_sinh_vien: selectedStudent.ma_sinh_vien,
      tieu_de: reminderTitle.trim(),
      noi_dung: reminderContent.trim(),
      loai_thong_bao: reminderType,
      nguoi_gui: activeTeacher?.ho_va_ten || 'TS. Phạm Tiến Thành',
      chuc_danh: 'Chủ nhiệm ngành BICA',
    });

    setSending(false);
    if (res.success) {
      setSendSuccess(`Đã gửi thông báo trực tiếp đến sinh viên ${selectedStudent.ho_va_ten} (${selectedStudent.ma_sinh_vien})!`);
      setTimeout(() => {
        setSelectedStudent(null);
        setSendSuccess(null);
        setReminderTitle('');
        setReminderContent('');
      }, 1500);
    }
  };

  // Filter & Sort students
  const filteredStudents = useMemo(() => {
    const list = allStudents.filter((st) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        st.ho_va_ten?.toLowerCase().includes(q) ||
        st.ma_sinh_vien?.toLowerCase().includes(q) ||
        st.email?.toLowerCase().includes(q) ||
        st.lop?.toLowerCase().includes(q) ||
        st.so_dien_thoai?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      const gpa = Number(st.calculated_gpa || st.diem_gpa || 0);
      const debt = Number(st.tuition_debt || 0);

      if (filterType === 'warning') return gpa < 2.5;
      if (filterType === 'excellent') return gpa >= 3.6;
      if (filterType === 'debt') return debt > 0;

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name_asc') {
        return String(a.ho_va_ten || '').localeCompare(String(b.ho_va_ten || ''), 'vi');
      }
      if (sortBy === 'msv_asc') {
        return String(a.ma_sinh_vien || '').localeCompare(String(b.ma_sinh_vien || ''), 'vi');
      }
      if (sortBy === 'gpa_desc') {
        return Number(b.calculated_gpa || b.diem_gpa || 0) - Number(a.calculated_gpa || a.diem_gpa || 0);
      }
      if (sortBy === 'gpa_asc') {
        return Number(a.calculated_gpa || a.diem_gpa || 0) - Number(b.calculated_gpa || b.diem_gpa || 0);
      }
      if (sortBy === 'credits_desc') {
        return (
          Number(b.registered_credits || b.tong_tin_chi_tich_luy || 0) -
          Number(a.registered_credits || a.tong_tin_chi_tich_luy || 0)
        );
      }
      // newest
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [allStudents, searchQuery, filterType, sortBy]);

  // Thống kê nhanh & Phân bổ CPA cho biểu đồ cột
  const stats = useMemo(() => {
    const total = allStudents.length;
    const warningCount = allStudents.filter(
      (s) => Number(s.calculated_gpa || s.diem_cpa || s.diem_gpa || 0) < 2.5
    ).length;
    const excellentCount = allStudents.filter(
      (s) => Number(s.calculated_gpa || s.diem_cpa || s.diem_gpa || 0) >= 3.6
    ).length;
    const debtCount = allStudents.filter((s) => Number(s.tuition_debt || 0) > 0).length;

    const totalCpa = allStudents.reduce(
      (sum, s) => sum + Number(s.calculated_gpa || s.diem_cpa || s.diem_gpa || 0),
      0
    );
    const avgCpa = total > 0 ? Math.round((totalCpa / total) * 100) / 100 : 0;

    return { total, warningCount, excellentCount, debtCount, avgCpa };
  }, [allStudents]);

  const cpaDistributionData = useMemo(() => {
    const buckets = [
      {
        range: '< 2.00',
        label: 'Yếu / Kém (< 2.0)',
        shortLabel: 'Yếu (< 2.0)',
        count: 0,
        color: '#ef4444',
      },
      {
        range: '2.00 - 2.49',
        label: 'Trung bình (2.0 - 2.49)',
        shortLabel: 'TB (2.0-2.49)',
        count: 0,
        color: '#f59e0b',
      },
      {
        range: '2.50 - 3.19',
        label: 'Khá (2.5 - 3.19)',
        shortLabel: 'Khá (2.5-3.19)',
        count: 0,
        color: '#3b82f6',
      },
      {
        range: '3.20 - 3.59',
        label: 'Giỏi (3.2 - 3.59)',
        shortLabel: 'Giỏi (3.2-3.59)',
        count: 0,
        color: '#6366f1',
      },
      {
        range: '3.60 - 4.00',
        label: 'Xuất sắc (3.6 - 4.0)',
        shortLabel: 'Xuất sắc (≥ 3.6)',
        count: 0,
        color: '#10b981',
      },
    ];

    allStudents.forEach((s) => {
      const cpa = Number(s.calculated_gpa || s.diem_cpa || s.diem_gpa || 0);
      if (cpa < 2.0) {
        buckets[0].count += 1;
      } else if (cpa < 2.5) {
        buckets[1].count += 1;
      } else if (cpa < 3.2) {
        buckets[2].count += 1;
      } else if (cpa < 3.6) {
        buckets[3].count += 1;
      } else {
        buckets[4].count += 1;
      }
    });

    const total = Math.max(1, allStudents.length);
    return buckets.map((b) => ({
      ...b,
      percent: Math.round((b.count / total) * 100),
    }));
  }, [allStudents]);

  // Nếu chưa đăng nhập tài khoản Giảng viên
  if (!activeTeacher) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Banner */}
          <div className="bg-slate-900 text-white p-6 sm:p-7 border-b border-slate-800">
            <div className="inline-flex items-center space-x-2 bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded text-xs font-mono mb-3 border border-slate-700">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>PHÂN HỆ QUẢN LÝ ĐÀO TẠO & GIẢNG VIÊN</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Cổng Quản Trị Học Vụ & Giám Sát Sinh Viên BICA (Tự Động Hóa)
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Dành cho Chủ nhiệm ngành và Cố vấn học tập (TS. Phạm Tiến Thành). Theo dõi tiến độ tích lũy tín chỉ, bảng điểm học phần và phát hành thông báo học vụ.
            </p>
          </div>

          {/* Form đăng nhập */}
          <div className="p-6 sm:p-8">
            <form onSubmit={handleLogin} className="max-w-md mx-auto space-y-5">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Xác Thực Chủ Nhiệm Ngành</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Nhập email Chủ nhiệm ngành được cấp quyền và mã truy cập hệ thống
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Chủ nhiệm ngành (*.vju.ac.vn)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Nhập email trường (@vju.ac.vn)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mật khẩu phân quyền truy cập
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-teacher-login"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center space-x-2"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Đăng Nhập Cổng Chủ Nhiệm Ngành</span>
              </button>

              {/* Ghi chú bảo mật */}
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <p className="text-[11px] text-slate-500">
                  🔒 Cổng bảo mật nội bộ dành riêng cho Chủ nhiệm ngành BICA. Mọi truy cập trái phép đều bị từ chối và ghi nhật ký.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Khi đã đăng nhập Giảng viên
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Card của Giảng viên */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-13 h-13 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">{activeTeacher.ho_va_ten}</h1>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {activeTeacher.vai_tro === 'co_van_hoc_tap'
                  ? 'Cố vấn học tập BICA'
                  : activeTeacher.vai_tro === 'truong_nganh'
                  ? 'Chủ nhiệm ngành'
                  : 'Giảng viên'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>{activeTeacher.email}</span>
              <span>•</span>
              <span>Mã GV: {activeTeacher.ma_giang_vien}</span>
              <span>•</span>
              <span>{activeTeacher.khoa_vien}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setAddStudentError(null);
              setIsAddStudentModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Sinh Viên</span>
          </button>
          <button
            onClick={() => {
              setUploadTargetStudentId(undefined);
              setIsUploadModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-md shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nạp bảng điểm lớp</span>
          </button>
          <button
            onClick={handleExportStudentsCsv}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors border border-slate-300 shadow-2xs cursor-pointer"
            title="Tải xuống danh sách toàn bộ thành viên đã đăng ký (File CSV/Excel)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Xuất DS (CSV)</span>
          </button>
          <button
            onClick={() => {
              onRefreshData();
              setLastSyncedTime(
                new Date().toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              );
            }}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors border border-slate-300 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ CSDL</span>
          </button>
          <button
            onClick={onTeacherLogout}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 text-xs font-medium rounded-md border border-red-200 transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Thẻ chỉ số tổng quan lớp BICA 2025 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tổng số sinh viên</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Khóa K2025 BICA (VJU)</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Cần cảnh báo học vụ</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600">{stats.warningCount}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">GPA dưới 2.5 / Thiếu tín chỉ</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Sinh viên Xuất sắc</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">{stats.excellentCount}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">GPA từ 3.60 trở lên</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Chưa hoàn tất học phí</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{stats.debtCount}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Cần nhắc nhở hạn thi</div>
        </div>
      </div>

      {/* Biểu đồ cột phân bổ điểm CPA của toàn lớp */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Biểu Đồ Phân Bổ Điểm CPA Toàn Lớp (Hệ 4.0)
              </h2>
              <p className="text-xs text-slate-500">
                Thống kê chất lượng học tập của {stats.total} sinh viên theo ngưỡng xếp loại học lực chuẩn ĐHQGHN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                CPA Trung Bình Lớp
              </span>
              <span className="text-base font-extrabold font-mono text-indigo-700">
                {stats.avgCpa.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium"> / 4.00</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cpaDistributionData}
                margin={{ top: 12, right: 16, left: -16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs space-y-1">
                        <div className="font-bold text-slate-100">{item.label}</div>
                        <div className="flex items-center justify-between gap-4 text-slate-300">
                          <span>Số lượng sinh viên:</span>
                          <span className="font-mono font-bold text-white">{item.count} SV</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300">
                          <span>Tỷ lệ chiếm:</span>
                          <span className="font-mono font-bold text-emerald-400">{item.percent}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={54}>
                  {cpaDistributionData.map((entry, idx) => (
                    <Cell key={`cpa-cell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-4 space-y-2">
            {cpaDistributionData.map((tier) => (
              <div
                key={tier.range}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                  <div>
                    <div className="font-semibold text-slate-800">{tier.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Mức CPA: {tier.range}</div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-slate-900 text-sm">{tier.count}</span>
                  <span className="text-[11px] text-slate-500 ml-1">SV ({tier.percent}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bộ lọc & Danh sách tất cả thành viên đã đăng ký tài khoản */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Thanh trạng thái tự động tải danh sách thành viên */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Danh Sách Thành Viên Đã Đăng Ký Tài Khoản ({allStudents.length} học sinh)
                </h2>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Tự động tải & đồng bộ Supabase</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Mọi tài khoản sinh viên đăng ký mới đều được tự động tải lên bảng danh sách này để Chủ nhiệm ngành quan sát và quản lý.
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 shrink-0 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Cập nhật lúc: {lastSyncedTime}</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo Họ tên, Mã SV (BICA25...), Email, Lớp..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center space-x-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Sắp xếp: Mới đăng ký nhất</option>
                <option value="name_asc">Sắp xếp: Họ và Tên (A → Z)</option>
                <option value="msv_asc">Sắp xếp: Mã Sinh Viên</option>
                <option value="gpa_desc">Sắp xếp: GPA (Cao → Thấp)</option>
                <option value="gpa_asc">Sắp xếp: GPA (Thấp → Cao)</option>
                <option value="credits_desc">Sắp xếp: Tín chỉ (Nhiều → Ít)</option>
              </select>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất Cả ({stats.total})
            </button>
            <button
              onClick={() => setFilterType('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer ${
                filterType === 'warning'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Cần Nhắc Nhở ({stats.warningCount})</span>
            </button>
            <button
              onClick={() => setFilterType('excellent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer ${
                filterType === 'excellent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Xuất Sắc ({stats.excellentCount})</span>
            </button>
            <button
              onClick={() => setFilterType('debt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterType === 'debt'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Còn Nợ Phí ({stats.debtCount})
            </button>
          </div>
        </div>

        {/* Bảng danh sách thành viên đã đăng ký */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-2.5 text-center w-10">STT</th>
                <th className="py-3 px-3">Mã SV & Thành Viên</th>
                <th className="py-3 px-3">Tài Khoản Email & Ngày ĐK</th>
                <th className="py-3 px-3 text-center">Tiến Độ Tín Chỉ</th>
                <th className="py-3 px-3 text-center">GPA Thang 4</th>
                <th className="py-3 px-3">Học Lực & Học Phí</th>
                <th className="py-3 px-3 text-right">Quản Lý Học Sinh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Không tìm thấy thành viên nào khớp với tiêu chí tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, index) => {
                  const gpa = Number(st.calculated_gpa || st.diem_gpa || 0);
                  const credits = Number(st.registered_credits || st.tong_tin_chi_tich_luy || 0);
                  const creditPercent = Math.min(100, Math.round((credits / 145) * 100));
                  const isWarning = gpa < 2.5;
                  const isExcellent = gpa >= 3.6;
                  const debt = Number(st.tuition_debt || 0);
                  const initials = String(st.ho_va_ten || 'SV')
                    .trim()
                    .split(/\s+/)
                    .slice(-2)
                    .map((w: string) => w.charAt(0).toUpperCase())
                    .join('');
                  const regDateStr = st.created_at
                    ? new Date(st.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : 'Đã kích hoạt';

                  return (
                    <tr key={st.ma_sinh_vien} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-2.5 text-center font-mono text-slate-400 font-semibold">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">
                              {st.ho_va_ten}
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {st.ma_sinh_vien}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {st.lop || 'BICA-K2025'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700 font-mono text-[11px] font-medium">
                          {st.email}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-500">
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã ĐK ({regDateStr})</span>
                          </span>
                          {st.so_dien_thoai && <span>• SĐT: {st.so_dien_thoai}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center w-28">
                          <div className="flex items-baseline justify-between w-full text-[11px]">
                            <span className="font-bold text-slate-800">{credits}</span>
                            <span className="text-[10px] text-slate-400">
                              / 145 TC ({creditPercent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200/60">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${creditPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${
                            isWarning
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isExcellent
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {gpa.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col space-y-1">
                          <div>
                            {isWarning ? (
                              <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Cần Lưu Ý</span>
                              </span>
                            ) : isExcellent ? (
                              <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                                <Award className="w-3 h-3 text-emerald-600" />
                                <span>Xuất Sắc</span>
                              </span>
                            ) : (
                              <span className="text-slate-700 font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                                {st.xep_loai || 'Đang theo học'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px]">
                            {debt > 0 ? (
                              <span className="text-rose-600 font-semibold">
                                Nợ phí: {debt.toLocaleString('vi-VN')} đ
                              </span>
                            ) : (
                              <span className="text-slate-400">Học phí: Đã hoàn tất</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end flex-wrap gap-1.5">
                          <button
                            onClick={() => handleOpenEditStudent(st)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                            title="Chỉnh sửa và quản lý hồ sơ của học sinh này"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa HS</span>
                          </button>
                          <button
                            onClick={() => setViewingCreditDistributionStudent(st)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                            title="Xem phân bổ 6 khối kiến thức tín chỉ của sinh viên này"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Phân Bổ TC</span>
                          </button>
                          <button
                            onClick={() => setInspectingStudent(st)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors inline-flex items-center space-x-1 cursor-pointer"
                            title="Xem chi tiết môn học và điểm quá trình"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Soi Điểm</span>
                          </button>
                          <button
                            onClick={() => {
                              setUploadTargetStudentId(st.ma_sinh_vien);
                              setIsUploadModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                            title="Nạp hoặc quét điểm cho sinh viên này (AI, Excel, Word, PDF)"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Nạp Điểm</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStudent(st);
                              applyTemplate('canh_bao_gpa');
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center space-x-1 shadow-xs cursor-pointer"
                            title="Gửi lời nhắc hoặc cảnh báo học vụ đích thân sinh viên này"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Cảnh Báo</span>
                          </button>
                          <button
                            onClick={() => setStudentToDelete(st)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                            title="Xóa tài khoản sinh viên này khỏi Supabase và danh sách lớp"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Gửi Lời Nhắc / Cảnh Báo đích danh sinh viên */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-950 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center space-x-2">
                  <BellRing className="w-5 h-5 text-amber-400" />
                  <span>Gửi Cảnh Báo / Nhắc Nhở Học Vụ Đích Danh</span>
                </h3>
                <p className="text-xs text-indigo-200 mt-1">
                  Đến: <span className="font-semibold text-white">{selectedStudent.ho_va_ten}</span> ({selectedStudent.ma_sinh_vien})
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-indigo-300 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendReminder} className="p-6 space-y-4">
              {sendSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{sendSuccess}</span>
                </div>
              )}

              {/* Mẫu soạn thảo nhanh */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mẫu Soạn Thảo Nhanh Của Cố Vấn:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyTemplate('canh_bao_gpa')}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium"
                  >
                    ⚠️ Cảnh Báo GPA Thấp
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('canh_bao_tin_chi')}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium"
                  >
                    📌 Nhắc Lịch Học & Thực Hành
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('khen_thuong')}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium"
                  >
                    🏆 Khen Thưởng / Động Viên
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('nhac_nho_hoc_phi')}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-medium"
                  >
                    💰 Nhắc Nợ Học Phí
                  </button>
                </div>
              </div>

              {/* Loại thông báo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mức Độ Thông Báo:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer ${
                    reminderType === 'canh_bao' ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="rtype"
                      className="hidden"
                      checked={reminderType === 'canh_bao'}
                      onChange={() => setReminderType('canh_bao')}
                    />
                    <span>⚠️ Cảnh Báo</span>
                  </label>
                  <label className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer ${
                    reminderType === 'nhac_nho' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="rtype"
                      className="hidden"
                      checked={reminderType === 'nhac_nho'}
                      onChange={() => setReminderType('nhac_nho')}
                    />
                    <span>ℹ️ Nhắc Nhở</span>
                  </label>
                  <label className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer ${
                    reminderType === 'khen_thuong' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="rtype"
                      className="hidden"
                      checked={reminderType === 'khen_thuong'}
                      onChange={() => setReminderType('khen_thuong')}
                    />
                    <span>🏆 Biểu Dương</span>
                  </label>
                </div>
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu Đề Lời Nhắc (*)
                </label>
                <input
                  type="text"
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="Ví dụ: Cảnh báo vắng học và điểm chuyên cần môn..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Nội dung */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội Dung Nhắc Nhở / Rút Kinh Nghiệm Học Tập (*)
                </label>
                <textarea
                  required
                  rows={4}
                  value={reminderContent}
                  onChange={(e) => setReminderContent(e.target.value)}
                  placeholder="Nhập lời dặn dò, hướng dẫn cụ thể để sinh viên rút kinh nghiệm..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Đang Gửi...' : 'Gửi Đến Sinh Viên'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Soi Chi Tiết Điểm & Học Phần Của Sinh Viên */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 text-white p-5 sticky top-0 z-10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  Chi Tiết Hồ Sơ Học Tập: {inspectingStudent.ho_va_ten}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Mã SV: {inspectingStudent.ma_sinh_vien} • Email: {inspectingStudent.email}
                </p>
              </div>
              <button
                onClick={() => setInspectingStudent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Thống kê học kỳ */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-xs text-slate-500">Tín chỉ tích lũy</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {inspectingStudent.registered_credits || inspectingStudent.tong_tin_chi_tich_luy || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Điểm GPA tích lũy</div>
                  <div className="text-lg font-bold text-blue-600 mt-1">
                    {(Number(inspectingStudent.calculated_gpa || inspectingStudent.diem_gpa || 0)).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Tình trạng nợ phí</div>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    {inspectingStudent.tuition_debt ? `${inspectingStudent.tuition_debt.toLocaleString('vi-VN')} đ` : '0 đ'}
                  </div>
                </div>
              </div>

              {/* Danh sách học phần */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Danh Sách Môn Học Đã Đăng Ký
                </h4>
                {inspectingStudent.courses && inspectingStudent.courses.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Mã HP</th>
                          <th className="py-2.5 px-3">Tên Môn Học</th>
                          <th className="py-2.5 px-3 text-center">Tín</th>
                          <th className="py-2.5 px-3 text-center">Tổng Kết Hệ 10</th>
                          <th className="py-2.5 px-3 text-center">Tổng Kết Hệ 4</th>
                          <th className="py-2.5 px-3 text-center">Điểm Chữ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingStudent.courses.map((c: any) => (
                          <tr key={c.id || c.ma_hoc_phan}>
                            <td className="py-2 px-3 font-mono text-slate-600">{c.ma_hoc_phan}</td>
                            <td className="py-2 px-3 font-medium text-slate-900">{c.ten_hoc_phan}</td>
                            <td className="py-2 px-3 text-center">{c.so_tin_chi}</td>
                            <td className="py-2 px-3 text-center font-bold font-mono text-slate-900">
                              {c.diem_tong_ket ?? '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-bold font-mono text-blue-700">
                              {c.diem_thang_4 !== undefined && c.diem_thang_4 !== null ? Number(c.diem_thang_4).toFixed(1) : '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-bold font-mono text-emerald-700">
                              {c.diem_chu || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    Chưa có danh sách môn học chi tiết trên hệ thống.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    const st = inspectingStudent;
                    setInspectingStudent(null);
                    setViewingCreditDistributionStudent(st);
                  }}
                  className="px-4 py-2 bg-blue-700 text-white rounded-xl text-xs font-semibold hover:bg-blue-800 flex items-center space-x-1.5 shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Xem Phân Bổ Tín Chỉ 6 Khối</span>
                </button>
                <button
                  onClick={() => {
                    const st = inspectingStudent;
                    setInspectingStudent(null);
                    setUploadTargetStudentId(st.ma_sinh_vien);
                    setIsUploadModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 flex items-center space-x-1.5 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Nạp / Quét Bảng Điểm Cho Sinh Viên Này</span>
                </button>
                <button
                  onClick={() => {
                    const st = inspectingStudent;
                    setInspectingStudent(null);
                    setSelectedStudent(st);
                    applyTemplate('canh_bao_gpa');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Nhắc Nhở Ngay Cho Sinh Viên Này</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xem Chi Tiết Phân Bổ Tín Chỉ 6 Khối Kiến Thức Từng Cá Nhân Sinh Viên */}
      <StudentCreditDistributionModal
        isOpen={Boolean(viewingCreditDistributionStudent)}
        onClose={() => setViewingCreditDistributionStudent(null)}
        student={viewingCreditDistributionStudent}
        allStudents={filteredStudents}
        onSelectStudent={(st) => setViewingCreditDistributionStudent(st)}
        onOpenReminderModal={(st, note) => {
          setViewingCreditDistributionStudent(null);
          setSelectedStudent(st);
          if (note) {
            setReminderType('nhac_nho');
            setReminderTitle(`Nhắc nhở tiến độ tín chỉ đào tạo Khóa 2025`);
            setReminderContent(note);
          } else {
            applyTemplate('canh_bao_tin_chi');
          }
        }}
        onOpenUploadModal={(studentId) => {
          setViewingCreditDistributionStudent(null);
          setUploadTargetStudentId(studentId);
          setIsUploadModalOpen(true);
        }}
        teacherName={activeTeacher?.ho_va_ten || 'TS. Phạm Tiến Thành (Chủ nhiệm ngành BICA)'}
      />

      {/* Modal: Nạp Điểm Đích Danh Cho Sinh Viên (AI Scan, Excel, Word, PDF, Thủ Công) */}
      <TeacherGradeUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        students={allStudents}
        preSelectedStudentId={uploadTargetStudentId}
        teacherName={activeTeacher?.ho_va_ten || 'TS. Phạm Tiến Thành (Chủ nhiệm ngành BICA)'}
        onSuccess={() => {
          onRefreshData();
        }}
      />

      {/* Modal: Xác nhận xóa tài khoản sinh viên khỏi Supabase */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-rose-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-base">Xóa Tài Khoản Sinh Viên</h3>
              </div>
              <button
                onClick={() => setStudentToDelete(null)}
                className="text-rose-100 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Thầy có chắc chắn muốn xóa tài khoản sinh viên{' '}
                <strong className="text-slate-900">{studentToDelete.ho_va_ten}</strong> (Mã SV:{' '}
                <span className="font-mono font-bold text-rose-700">
                  {studentToDelete.ma_sinh_vien}
                </span>
                ) khỏi danh sách ngành và cơ sở dữ liệu Supabase không?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                Thao tác này sẽ xóa toàn bộ hồ sơ (<code>ho_so</code>), bảng điểm học phần (
                <code>khoa_hoc_sinh_vien</code>), lịch trình, học phí và bộ nhớ đệm của tài khoản này.
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingStudent}
                  onClick={() => setStudentToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeletingStudent}
                  onClick={handleConfirmDeleteStudent}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingStudent ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xóa khỏi Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xác Nhận Xóa Vĩnh Viễn</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm nhanh sinh viên mới vào danh sách ngành (Supabase ho_so) */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-bold text-base">Thêm Hồ Sơ Sinh Viên Mới</h3>
              </div>
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                className="text-blue-100 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddNewStudentSubmit} className="p-6 space-y-4">
              {addStudentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {addStudentError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã số sinh viên (MSSV) (*)
                </label>
                <input
                  type="text"
                  required
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="VD: BICA25119045 hoặc 25119045"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên sinh viên (*)
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email trường (@st.vju.ac.vn)
                </label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="VD: 25119045@st.vju.ac.vn"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lớp khóa học
                </label>
                <input
                  type="text"
                  value={newStudentClass}
                  onChange={(e) => setNewStudentClass(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAddingStudent ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Lưu Vào Danh Sách</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa & Quản lý thông tin học sinh trực tiếp bởi Chủ nhiệm ngành */}
      {studentToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">Quản Lý & Chỉnh Sửa Hồ Sơ Học Sinh</h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    Cập nhật trực tiếp lên cơ sở dữ liệu Supabase (bảng ho_so)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStudentToEdit(null)}
                className="text-amber-100 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã số sinh viên (MSSV) (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.ma_sinh_vien}
                    onChange={(e) => setEditForm({ ...editForm, ma_sinh_vien: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lớp khóa học
                  </label>
                  <input
                    type="text"
                    value={editForm.lop}
                    onChange={(e) => setEditForm({ ...editForm, lop: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh (*)
                </label>
                <input
                  type="text"
                  required
                  value={editForm.ho_va_ten}
                  onChange={(e) => setEditForm({ ...editForm, ho_va_ten: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email tài khoản (@st.vju.ac.vn)
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={editForm.so_dien_thoai}
                    onChange={(e) => setEditForm({ ...editForm, so_dien_thoai: e.target.value })}
                    placeholder="VD: 0987654321"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tín chỉ tích lũy
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={editForm.tong_tin_chi_tich_luy}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tong_tin_chi_tich_luy: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Điểm GPA (Hệ 4)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={4}
                    value={editForm.diem_gpa}
                    onChange={(e) =>
                      setEditForm({ ...editForm, diem_gpa: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Xếp loại học lực
                  </label>
                  <select
                    value={editForm.xep_loai}
                    onChange={(e) => setEditForm({ ...editForm, xep_loai: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Xuất sắc">Xuất sắc</option>
                    <option value="Giỏi">Giỏi</option>
                    <option value="Khá">Khá</option>
                    <option value="Trung bình">Trung bình</option>
                    <option value="Yếu - Cảnh báo">Yếu - Cảnh báo</option>
                    <option value="Chưa xếp loại">Chưa xếp loại</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trạng thái học tập
                </label>
                <select
                  value={editForm.trang_thai_hoc_tap}
                  onChange={(e) => setEditForm({ ...editForm, trang_thai_hoc_tap: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Đang theo học">Đang theo học</option>
                  <option value="Cần theo dõi">Cần theo dõi học vụ</option>
                  <option value="Bảo lưu">Bảo lưu kết quả</option>
                  <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setStudentToEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu lên Supabase...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lưu Thay Đổi Hồ Sơ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
