import React, { useState, useRef, useMemo } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Award,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Mail,
  Shield,
  ShieldCheck,
  Lock,
  Search,
  Filter,
  Eye,
  EyeOff,
  Key,
  Users,
  UserCheck,
  X,
  Calendar,
  ChevronRight,
  ExternalLink,
  Trash2,
  Check,
  MessageSquare,
  HelpCircle,
  FileCheck2,
  RefreshCw,
  Maximize2
} from 'lucide-react';
import type { StudentProfile, MinhChungRenLuyen, TeacherAccount } from '../types';
import {
  submitMinhChung,
  reviewMinhChung,
  purgeMinhChungImages,
  purgeAllGradedMinhChungImages,
  deleteMinhChungRecord,
  getEvaluatorSession,
  saveEvaluatorSession,
  clearEvaluatorSession,
  authenticateEvaluator,
  getAuthorizedOfficers,
  type EvaluatorSession
} from '../lib/supabase';
import { AdminOfficerManagement } from './AdminOfficerManagement';

interface StudyPortalTabProps {
  profile: StudentProfile;
  user?: SupabaseUser | null;
  activeTeacher?: TeacherAccount | null;
  allEvidence: MinhChungRenLuyen[];
  onEvidenceChanged: () => void;
  isSupabaseLive?: boolean;
}

export const StudyPortalTab: React.FC<StudyPortalTabProps> = ({
  profile,
  user,
  activeTeacher,
  allEvidence,
  onEvidenceChanged,
  isSupabaseLive = false,
}) => {
  // Main view mode: 'student' (Góc Sinh Viên) or 'admin' (Khu Vực Thẩm Định Cấp Quyền)
  const [activeView, setActiveView] = useState<'student' | 'admin'>('student');

  // Evaluator session (Admin / Authorized Reviewer)
  // Bắt buộc phải đăng nhập tài khoản riêng của Admin hoặc Cán bộ lớp (như Cổng Chủ nhiệm ngành)
  // Tuyệt đối không tự động lấy tài khoản activeTeacher.
  const [evaluator, setEvaluator] = useState<EvaluatorSession | null>(() => {
    const session = getEvaluatorSession();
    // Nếu session cũ là phiên TS. Phạm Tiến Thành từng bị tự động gán từ trước, xóa bỏ để bắt buộc đăng nhập
    if (session && session.email?.toLowerCase().includes('phamtienthanh') && !session.isSuperAdmin) {
      clearEvaluatorSession();
      return null;
    }
    return session;
  });

  // Evaluator sub-tab: 'evidence' (thẩm định minh chứng) or 'officers' (phân quyền cán bộ lớp)
  const [adminSubTab, setAdminSubTab] = useState<'evidence' | 'officers'>('evidence');

  // Evaluator Login Form state
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminAccessCode, setAdminAccessCode] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  // Evidence Submission Form state
  const [tieuDe, setTieuDe] = useState('');
  const [danhMuc, setDanhMuc] = useState<MinhChungRenLuyen['danh_muc']>('hoc_tap');
  const [ngayDienRa, setNgayDienRa] = useState(() => new Date().toISOString().split('T')[0]);
  const [diemDeXuat, setDiemDeXuat] = useState(10);
  const [moTa, setMoTa] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image lightbox preview
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Admin filter & search state
  const [adminFilter, setAdminFilter] = useState<'all' | 'cho_duyet' | 'da_duyet' | 'can_bo_sung'>('all');
  const [adminSearch, setAdminSearch] = useState('');

  // Admin Review Modal state
  const [reviewingItem, setReviewingItem] = useState<MinhChungRenLuyen | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'da_duyet' | 'tu_choi' | 'can_bo_sung'>('da_duyet');
  const [reviewPoints, setReviewPoints] = useState<number>(10);
  const [reviewComment, setReviewComment] = useState('');
  const [autoPurgeAfterReview, setAutoPurgeAfterReview] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [purgingItemId, setPurgingItemId] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [isBulkPurging, setIsBulkPurging] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);

  // Quyền xóa dữ liệu ảnh minh chứng sau khi chấm xong dành cho Admin Web (Super Admin / Toàn quyền)
  const canPurgeEvidenceImages = Boolean(
    evaluator?.isSuperAdmin || evaluator?.quyen_han === 'toan_quyen'
  );

  // Danh sách các hồ sơ ĐÃ CHẤM XONG nhưng vẫn còn lưu dữ liệu ảnh
  const gradedItemsWithImages = useMemo(() => {
    return allEvidence.filter(
      (item) =>
        item.trang_thai !== 'cho_duyet' &&
        Array.isArray(item.anh_minh_chung_urls) &&
        item.anh_minh_chung_urls.length > 0
    );
  }, [allEvidence]);

  // Filtered evidence for current student
  const studentEvidenceList = useMemo(() => {
    return allEvidence.filter(
      (item) => item.ma_sinh_vien.toUpperCase() === profile.ma_sinh_vien.toUpperCase()
    );
  }, [allEvidence, profile.ma_sinh_vien]);

  // Statistics for current student
  const studentStats = useMemo(() => {
    const totalApprovedPoints = studentEvidenceList
      .filter((item) => item.trang_thai === 'da_duyet')
      .reduce((sum, item) => sum + (item.diem_duyet ?? item.diem_de_xuat), 0);

    const pendingCount = studentEvidenceList.filter((item) => item.trang_thai === 'cho_duyet').length;
    const approvedCount = studentEvidenceList.filter((item) => item.trang_thai === 'da_duyet').length;

    return {
      totalApprovedPoints,
      pendingCount,
      approvedCount,
      totalSubmitted: studentEvidenceList.length
    };
  }, [studentEvidenceList]);

  // Filtered evidence for Admin
  const adminEvidenceList = useMemo(() => {
    return allEvidence.filter((item) => {
      const matchFilter = adminFilter === 'all' ? true : item.trang_thai === adminFilter;
      const matchSearch =
        adminSearch.trim() === '' ||
        item.ho_va_ten.toLowerCase().includes(adminSearch.toLowerCase()) ||
        item.ma_sinh_vien.toLowerCase().includes(adminSearch.toLowerCase()) ||
        item.tieu_de.toLowerCase().includes(adminSearch.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [allEvidence, adminFilter, adminSearch]);

  // Danh mục rèn luyện cấu hình gợi ý điểm
  const danhMucConfigs: Record<
    MinhChungRenLuyen['danh_muc'],
    { label: string; maxPoints: number; defaultPoints: number; badgeColor: string; description: string }
  > = {
    hoc_tap: {
      label: 'Ý Thức Học Tập & Hội Thảo',
      maxPoints: 20,
      defaultPoints: 10,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      description: 'Tham gia hội thảo khoa học, tọa đàm chuyên đề BICA, seminar công nghệ, học tập nghiêm túc.'
    },
    nghien_cuu: {
      label: 'NCKH & Đổi Mới Sáng Tạo',
      maxPoints: 25,
      defaultPoints: 20,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Tham gia đề tài NCKH, thi Robocon, sáng tạo kỹ thuật, hackathon, viết bài báo khoa học.'
    },
    tinh_nguyen: {
      label: 'Tình Nguyện & Hoạt Động Xã Hội',
      maxPoints: 25,
      defaultPoints: 15,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: 'Mùa Hè Xanh, tiếp sức mùa thi, hiến máu tình nguyện, vệ sinh phòng Lab và khuôn viên VJU.'
    },
    phong_trao: {
      label: 'Văn Thể Mỹ & Hoạt Động Đoàn Hội',
      maxPoints: 20,
      defaultPoints: 10,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      description: 'Giải bóng đá VJU Cup, hội diễn văn nghệ, ngày hội việc làm, sinh hoạt chi đoàn.'
    },
    ky_nang_chung_chi: {
      label: 'Kỹ Năng Mềm & Chứng Chỉ Quốc Tế',
      maxPoints: 10,
      defaultPoints: 10,
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      description: 'Chứng chỉ ngoại ngữ (JLPT, IELTS, TOEIC), chứng chỉ tin học quốc tế, kỹ năng mềm.'
    },
    khac: {
      label: 'Khen Thưởng & Minh Chứng Khác',
      maxPoints: 10,
      defaultPoints: 5,
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      description: 'Thư khen của Hiệu trưởng/Ban Giám hiệu, giải thưởng cuộc thi bên ngoài.'
    }
  };

  // Helper nén ảnh client-side bằng canvas để không làm nặng bộ nhớ
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setSubmitError('Chỉ chấp nhận tệp định dạng hình ảnh (PNG, JPG, JPEG, WEBP).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize nếu ảnh quá lớn (giới hạn max 1200px)
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // nén chất lượng 80%
            setUploadedPhotos((prev) => [...prev, dataUrl]);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Xử lý nộp minh chứng mới
  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!tieuDe.trim()) {
      setSubmitError('Vui lòng nhập tên hoạt động hoặc tên minh chứng.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      setSubmitError('Vui lòng tải lên ít nhất 1 hình ảnh minh chứng (giấy chứng nhận, ảnh tham gia hoạt động).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitMinhChung({
        ma_sinh_vien: profile.ma_sinh_vien || 'BICA25119034',
        ho_va_ten: profile.ho_va_ten || 'Sinh viên BICA 2025',
        lop: profile.lop || 'BICA-K2025',
        email: profile.email || user?.email || 'sinhvien@st.vju.ac.vn',
        tieu_de: tieuDe.trim(),
        danh_muc: danhMuc,
        mo_ta: moTa.trim(),
        ngay_dien_ra: ngayDienRa,
        diem_de_xuat: Number(diemDeXuat) || 10,
        anh_minh_chung_urls: uploadedPhotos
      });

      if (res.success) {
        setSubmitSuccess('Đã gửi nộp minh chứng thành công! Hồ sơ đã được chuyển đến Admin Web và Ban thẩm định để xét duyệt.');
        // Reset form
        setTieuDe('');
        setMoTa('');
        setUploadedPhotos([]);
        onEvidenceChanged();
      } else {
        setSubmitError('Không thể gửi minh chứng. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Có lỗi xảy ra khi nộp minh chứng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý xác thực quyền Admin Web và Cán bộ lớp được cấp quyền qua Server API
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);

    const result = await authenticateEvaluator(adminEmailInput, adminAccessCode);
    if (result.success && result.session) {
      setEvaluator(result.session);
      setAdminEmailInput('');
      setAdminAccessCode('');
      setAdminAuthError(null);
    } else {
      setAdminAuthError(
        result.error ||
          'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin đăng nhập hoặc liên hệ Quản trị viên.'
      );
    }
  };

  const handleLogoutEvaluator = () => {
    setEvaluator(null);
    clearEvaluatorSession();
  };

  // Mở modal chấm điểm duyệt
  const openReviewModal = (item: MinhChungRenLuyen) => {
    setReviewingItem(item);
    setReviewStatus(item.trang_thai === 'cho_duyet' ? 'da_duyet' : item.trang_thai);
    setReviewPoints(item.diem_duyet ?? item.diem_de_xuat);
    setReviewComment(item.nhan_xet_admin || '');
    setAutoPurgeAfterReview(false);
  };

  // Lưu kết quả duyệt
  const handleSaveReview = async () => {
    if (!reviewingItem) return;
    setIsReviewing(true);

    const shouldPurge = canPurgeEvidenceImages && autoPurgeAfterReview;

    await reviewMinhChung({
      id: reviewingItem.id,
      trang_thai: reviewStatus,
      diem_duyet: reviewStatus === 'da_duyet' ? Number(reviewPoints) : 0,
      nhan_xet_admin: reviewComment.trim(),
      nguoi_duyet: evaluator?.name || 'Admin Web',
      xoa_anh_sau_cham: shouldPurge,
    });

    if (shouldPurge) {
      setAdminActionMessage(
        `✅ Đã chấm điểm và xóa dữ liệu ảnh minh chứng của sinh viên ${reviewingItem.ho_va_ten} (${reviewingItem.ma_sinh_vien}) để tối ưu dung lượng hệ thống!`
      );
    } else {
      setAdminActionMessage(
        `✅ Đã cập nhật kết quả thẩm định minh chứng cho sinh viên ${reviewingItem.ho_va_ten} (${reviewingItem.ma_sinh_vien}).`
      );
    }

    setIsReviewing(false);
    setReviewingItem(null);
    onEvidenceChanged();
  };

  // Xóa dữ liệu ảnh của 1 hồ sơ đã chấm xong
  const handlePurgeSingleItemImages = async (item: MinhChungRenLuyen) => {
    if (!canPurgeEvidenceImages) return;
    if (item.trang_thai === 'cho_duyet') {
      setAdminActionMessage('⚠️ Vui lòng chấm duyệt hồ sơ minh chứng này trước khi xóa dữ liệu ảnh.');
      return;
    }
    setPurgingItemId(item.id);
    try {
      await purgeMinhChungImages(item.id);
      setAdminActionMessage(
        `✅ Đã xóa dữ liệu ảnh minh chứng của hồ sơ "${item.tieu_de}" (${item.ho_va_ten}). Điểm đã chấm vẫn được giữ nguyên!`
      );
      onEvidenceChanged();
    } finally {
      setPurgingItemId(null);
    }
  };

  // Dọn dẹp hàng loạt toàn bộ dữ liệu ảnh của các hồ sơ đã chấm xong
  const handlePurgeAllGradedImages = async () => {
    if (!canPurgeEvidenceImages || gradedItemsWithImages.length === 0) return;
    setIsBulkPurging(true);
    try {
      const ids = gradedItemsWithImages.map((i) => i.id);
      const res = await purgeAllGradedMinhChungImages(ids);
      if (res.success) {
        setAdminActionMessage(
          `✅ Đã xóa sạch dữ liệu ảnh của ${res.count} hồ sơ đã chấm xong để giải phóng dung lượng web! Điểm rèn luyện của sinh viên vẫn được bảo lưu đầy đủ.`
        );
        onEvidenceChanged();
      }
    } finally {
      setIsBulkPurging(false);
    }
  };

  // Xóa hoàn toàn một hồ sơ minh chứng của sinh viên
  const handleDeleteEvidenceRecord = async (item: MinhChungRenLuyen, fromAdmin = false) => {
    if (!item.id) return;
    setDeletingRecordId(item.id);
    try {
      const res = await deleteMinhChungRecord(item.id);
      if (res.success) {
        if (fromAdmin) {
          setAdminActionMessage(
            `🗑️ Đã xóa hồ sơ minh chứng "${item.tieu_de}" của sinh viên ${item.ho_va_ten} (${item.ma_sinh_vien}) khỏi hệ thống.`
          );
        } else {
          setSubmitSuccess(`Đã xóa hồ sơ minh chứng "${item.tieu_de}" thành công.`);
        }
        onEvidenceChanged();
      }
    } finally {
      setDeletingRecordId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Lightbox Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 bg-slate-900/90 flex items-center justify-between text-white border-b border-slate-800">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                Ảnh Minh Chứng Điểm Rèn Luyện (Đã Được Bảo Mật)
              </span>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/40 max-h-[80vh] overflow-auto">
              <img
                src={previewImageUrl}
                alt="Minh chứng"
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center space-x-2 bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded text-xs font-mono mb-2.5 border border-slate-700">
                <Award className="w-3.5 h-3.5 text-blue-400" />
                <span>PHÂN HỆ QUẢN LÝ ĐIỂM RÈN LUYỆN (ĐRL)</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Nộp Hồ Sơ Minh Chứng & Đánh Giá Rèn Luyện Sinh Viên
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Tải minh chứng giấy chứng nhận hoạt động ngoại khóa, tình nguyện, nghiên cứu khoa học. Hội đồng thẩm định và Cố vấn học tập sẽ duyệt điểm trực tiếp.
              </p>
            </div>

            {/* Thống kê điểm rèn luyện dự kiến của sinh viên */}
            <div className="bg-slate-800/80 rounded-lg p-3.5 sm:p-4 border border-slate-700 min-w-[200px] text-center shrink-0">
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Điểm Rèn Luyện Đã Duyệt</div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-0.5">
                {studentStats.totalApprovedPoints} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
              <div className="mt-1.5 text-[11px] text-slate-300 flex items-center justify-center gap-2">
                <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                  {studentStats.approvedCount} đã duyệt
                </span>
                <span className="bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
                  {studentStats.pendingCount} chờ duyệt
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher: Góc Sinh Viên vs Khu Vực Thẩm Định Cấp Quyền */}
        <div className="flex border-t border-slate-200 bg-slate-50/70 p-2 gap-2">
          <button
            onClick={() => setActiveView('student')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeView === 'student'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Góc Sinh Viên (Nộp Minh Chứng Cá Nhân)</span>
            <span className="bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 rounded-full font-bold">
              {studentEvidenceList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('admin')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeView === 'admin'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Khu Vực Thẩm Định Minh Chứng (Admin & Cán Bộ Cấp Quyền)</span>
            {evaluator ? (
              <span className="bg-emerald-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                Đã Mở Khóa
              </span>
            ) : (
              <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Bảo Mật 🔒
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHẾ ĐỘ 1: GÓC SINH VIÊN (NỘP MINH CHỨNG & THEO DÕI KẾT QUẢ CÁ NHÂN) */}
      {/* ========================================================================= */}
      {activeView === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Form tải ảnh nộp minh chứng */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Nộp Minh Chứng Hoạt Động</h2>
                  <p className="text-xs text-slate-500">Tải ảnh chụp minh chứng để xin cộng điểm rèn luyện</p>
                </div>
              </div>

              {submitSuccess && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-xs text-emerald-800 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {submitError && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-800 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitEvidence} className="space-y-4">
                {/* Thông tin sinh viên nộp */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sinh viên nộp:</span>
                    <span className="font-semibold text-slate-800">{profile.ho_va_ten || 'Sinh viên BICA'} ({profile.ma_sinh_vien || '25119034'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lớp khóa học:</span>
                    <span className="font-semibold text-slate-800">{profile.lop || 'BICA-K2025'}</span>
                  </div>
                </div>

                {/* Tên hoạt động / minh chứng */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên Hoạt Động / Bằng Khen / Chứng Chỉ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={tieuDe}
                    onChange={(e) => setTieuDe(e.target.value)}
                    placeholder="VD: Giấy chứng nhận tham gia Hội thảo AI VJU 2026..."
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Danh mục rèn luyện */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Danh Mục Rèn Luyện <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={danhMuc}
                    onChange={(e) => {
                      const newCat = e.target.value as MinhChungRenLuyen['danh_muc'];
                      setDanhMuc(newCat);
                      setDiemDeXuat(danhMucConfigs[newCat].defaultPoints);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(danhMucConfigs).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label} (Tối đa {config.maxPoints}đ)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {danhMucConfigs[danhMuc].description}
                  </p>
                </div>

                {/* Ngày diễn ra & Điểm đề xuất */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày Diễn Ra
                    </label>
                    <input
                      type="date"
                      required
                      value={ngayDienRa}
                      onChange={(e) => setNgayDienRa(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Điểm Đề Xuất (Tối đa {danhMucConfigs[danhMuc].maxPoints})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={danhMucConfigs[danhMuc].maxPoints}
                      value={diemDeXuat}
                      onChange={(e) => setDiemDeXuat(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Mô tả chi tiết */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mô Tả / Nội Dung Hoạt Động
                  </label>
                  <textarea
                    rows={2}
                    value={moTa}
                    onChange={(e) => setMoTa(e.target.value)}
                    placeholder="Mô tả tóm tắt vai trò, đóng góp hoặc kết quả đạt được..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Tải hình ảnh minh chứng */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Ảnh Minh Chứng Thực Tế <span className="text-red-500">*</span></span>
                    <span className="text-[11px] text-slate-400 font-normal">Chấp nhận JPG, PNG, WEBP</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  {/* Vùng kéo thả / bấm chọn ảnh */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-2xl p-5 text-center cursor-pointer transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      Bấm vào đây để chọn ảnh từ máy hoặc kéo thả ảnh vào
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Giấy khen, chứng nhận có dấu đỏ, ảnh điểm danh hoặc ảnh tham gia
                    </div>
                  </div>

                  {/* Danh sách ảnh đã chọn xem trước */}
                  {uploadedPhotos.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Đã tải lên {uploadedPhotos.length} ảnh minh chứng:
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {uploadedPhotos.map((photo, index) => (
                          <div
                            key={index}
                            className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"
                          >
                            <img
                              src={photo}
                              alt={`Minh chứng ${index + 1}`}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImageUrl(photo);
                                }}
                                className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg text-xs"
                                title="Xem phóng to"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePhoto(index);
                                }}
                                className="p-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700"
                                title="Xóa ảnh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Thông báo bảo mật ảnh */}
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Bảo mật thông tin:</strong> Hình ảnh minh chứng cá nhân của em chỉ được gửi về cho Admin Web và Ban thẩm định có thẩm quyền. Sinh viên khác không thể xem hoặc tải ảnh của em.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang xử lý & lưu trữ...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Gửi Nộp Minh Chứng Điểm Rèn Luyện</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Cột phải: Danh sách các minh chứng cá nhân của sinh viên */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Lịch Sử Minh Chứng Của Em</h2>
                    <p className="text-xs text-slate-500">
                      Mã SV: {profile.ma_sinh_vien} • {studentEvidenceList.length} minh chứng đã nộp
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500">Điểm ĐRL tích lũy:</span>
                  <div className="text-lg font-bold text-blue-600">
                    {studentStats.totalApprovedPoints} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                  </div>
                </div>
              </div>

              {studentEvidenceList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">Em chưa nộp minh chứng rèn luyện nào</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Hãy sử dụng biểu mẫu bên trái để tải ảnh giấy chứng nhận hoặc hoạt động ngoại khóa để được cộng điểm rèn luyện học kỳ nhé!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentEvidenceList.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-all bg-slate-50/50 hover:bg-white space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900">{item.tieu_de}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${danhMucConfigs[item.danh_muc]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                              {danhMucConfigs[item.danh_muc]?.label || 'Hoạt động'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.ngay_dien_ra}
                            </span>
                            <span>•</span>
                            <span>Đề xuất: <strong className="text-slate-700">+{item.diem_de_xuat}đ</strong></span>
                            {item.diem_duyet !== undefined && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-bold">Thực duyệt: +{item.diem_duyet}đ</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Badge & Delete Record Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.trang_thai === 'cho_duyet' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                              <Clock className="w-3 h-3" />
                              Chờ Thẩm Định
                            </span>
                          )}
                          {item.trang_thai === 'da_duyet' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã Duyệt (+{item.diem_duyet ?? item.diem_de_xuat}đ)
                            </span>
                          )}
                          {item.trang_thai === 'can_bo_sung' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              Cần Bổ Sung Ảnh
                            </span>
                          )}
                          {item.trang_thai === 'tu_choi' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                              <X className="w-3 h-3" />
                              Từ Chối
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={deletingRecordId === item.id}
                            onClick={() => handleDeleteEvidenceRecord(item, false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Xóa hồ sơ minh chứng này"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{deletingRecordId === item.id ? 'Đang xóa...' : 'Xóa hồ sơ'}</span>
                          </button>
                        </div>
                      </div>

                      {item.mo_ta && (
                        <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                          {item.mo_ta}
                        </p>
                      )}

                      {/* Ảnh minh chứng của chính sinh viên */}
                      {item.anh_minh_chung_urls && item.anh_minh_chung_urls.length > 0 ? (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            Ảnh minh chứng đã nộp ({item.anh_minh_chung_urls.length} ảnh):
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {item.anh_minh_chung_urls.map((img, idx) => (
                              <div
                                key={idx}
                                onClick={() => setPreviewImageUrl(img)}
                                className="w-20 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity bg-slate-100 relative group"
                              >
                                <img src={img} alt="Thumb" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                  <Eye className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        item.trang_thai !== 'cho_duyet' && (
                          <div className="p-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Dữ liệu ảnh minh chứng đã được Admin Web dọn dẹp sau khi chấm xong để tối ưu dung lượng hệ thống. Kết quả điểm rèn luyện được bảo lưu vĩnh viễn.
                            </span>
                          </div>
                        )
                      )}

                      {/* Nhận xét phản hồi từ Admin */}
                      {item.nhan_xet_admin && (
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                          <div className="font-semibold flex items-center gap-1 text-[11px] text-blue-800">
                            <MessageSquare className="w-3 h-3" />
                            Phản hồi từ Ban Thẩm Định ({item.nguoi_duyet || 'Admin Web'}):
                          </div>
                          <p className="text-slate-700">{item.nhan_xet_admin}</p>
                          {item.ngay_duyet && (
                            <div className="text-[10px] text-slate-400">Thời gian duyệt: {item.ngay_duyet}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHẾ ĐỘ 2: KHU VỰC THẨM ĐỊNH MINH CHỨNG (DÀNH CHO ADMIN WEB CẤP QUYỀN) */}
      {/* ========================================================================= */}
      {activeView === 'admin' && (
        <div>
          {!evaluator ? (
            /* Chưa xác thực quyền Admin / Cán bộ lớp: Hiển thị giao diện đăng nhập chuẩn xác thực */
            <div className="max-w-4xl mx-auto py-6 sm:py-8 px-2 sm:px-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Banner đầu trang chuẩn phong cách Cổng Quản Trị VJU */}
                <div className="bg-slate-900 text-white p-6 sm:p-7 border-b border-slate-800">
                  <div className="inline-flex items-center space-x-2 bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded text-xs font-mono mb-3 border border-slate-700">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>PHÂN HỆ THẨM ĐỊNH MINH CHỨNG & BẢO MẬT ĐIỂM RÈN LUYỆN</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Cổng Thẩm Định Hồ Sơ Minh Chứng & Phân Quyền Cán Bộ
                  </h1>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
                    Dành riêng cho Quản trị viên hệ thống (Admin Web) và Hội đồng thẩm định / Cán bộ lớp được cấp quyền. Bảo mật toàn diện dữ liệu ảnh chứng nhận cá nhân theo quy định an toàn dữ liệu VJU.
                  </p>
                </div>

                {/* Form đăng nhập thẩm định viên */}
                <div className="p-6 sm:p-8">
                  <form onSubmit={handleAdminAuth} className="max-w-md mx-auto space-y-5">
                    <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">Xác Thực Cán Bộ Thẩm Định</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Nhập email tài khoản được cấp quyền và mật khẩu xác thực để truy cập
                      </p>
                    </div>

                    {adminAuthError && (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-xs text-red-700">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{adminAuthError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email / Tài khoản cán bộ thẩm định (*)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          autoComplete="off"
                          value={adminEmailInput}
                          onChange={(e) => setAdminEmailInput(e.target.value)}
                          placeholder="Nhập email tài khoản được cấp quyền..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Mật khẩu phân quyền truy cập (*)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(prev => !prev)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                        >
                          {showAdminPassword ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Ẩn</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Hiện</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={adminAccessCode}
                          onChange={(e) => setAdminAccessCode(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="btn-evaluator-login"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Đăng Nhập Cổng Thẩm Định Minh Chứng</span>
                    </button>

                    {/* Ghi chú an toàn dữ liệu */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Dữ liệu hình ảnh minh chứng và hồ sơ rèn luyện sinh viên được bảo vệ nghiêm ngặt. Mọi thao tác phê duyệt hoặc từ chối đều được lưu vết định danh cán bộ thẩm định.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            /* Đã mở khóa: Khu vực duyệt của Admin */
            <div className="space-y-6">
              {/* Header Cán Bộ Đang Đăng Nhập */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-slate-900">{evaluator.name}</h2>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] px-2 py-0.5 rounded-full font-semibold">
                        {evaluator.role}
                      </span>
                      {evaluator.isSuperAdmin && (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Super Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {evaluator.isSuperAdmin
                        ? 'Đặc quyền Quản trị viên: Toàn quyền xem ảnh gốc, chấm duyệt điểm và phân quyền cán bộ lớp.'
                        : 'Đã được cấp quyền xem ảnh minh chứng và thẩm định điểm rèn luyện sinh viên BICA 2025.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={onEvidenceChanged}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Làm Mới</span>
                  </button>
                  <button
                    onClick={handleLogoutEvaluator}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl border border-red-200 transition-colors cursor-pointer"
                  >
                    Khóa Quyền
                  </button>
                </div>
              </div>

              {/* Sub-Tabs: Thẩm Định Minh Chứng vs Phân Quyền Cán Bộ Lớp */}
              <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAdminSubTab('evidence')}
                  className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer whitespace-nowrap ${
                    adminSubTab === 'evidence'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Danh Sách Thẩm Định Minh Chứng</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    adminSubTab === 'evidence' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {allEvidence.length}
                  </span>
                  {allEvidence.filter(e => e.trang_thai === 'cho_duyet').length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {allEvidence.filter(e => e.trang_thai === 'cho_duyet').length} chờ duyệt
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAdminSubTab('officers')}
                  className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer whitespace-nowrap ${
                    adminSubTab === 'officers'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Phân Quyền Cán Bộ Lớp & Hội Đồng</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    adminSubTab === 'officers' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {getAuthorizedOfficers().length}
                  </span>
                </button>
              </div>

              {/* Nội dung Tab: Thẩm định minh chứng vs Phân quyền cán bộ */}
              {adminSubTab === 'evidence' ? (
                <div className="space-y-6">
                  {adminActionMessage && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between gap-3 shadow-2xs">
                      <span>{adminActionMessage}</span>
                      <button
                        type="button"
                        onClick={() => setAdminActionMessage(null)}
                        className="text-emerald-600 hover:text-emerald-900 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Bộ lọc và tìm kiếm */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Tìm theo tên SV, mã SV, hoạt động..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setAdminFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      adminFilter === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất Cả ({allEvidence.length})
                  </button>
                  <button
                    onClick={() => setAdminFilter('cho_duyet')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      adminFilter === 'cho_duyet'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Chờ Duyệt ({allEvidence.filter((e) => e.trang_thai === 'cho_duyet').length})
                  </button>
                  <button
                    onClick={() => setAdminFilter('da_duyet')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      adminFilter === 'da_duyet'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Đã Duyệt ({allEvidence.filter((e) => e.trang_thai === 'da_duyet').length})
                  </button>
                  <button
                    onClick={() => setAdminFilter('can_bo_sung')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      adminFilter === 'can_bo_sung'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cần Bổ Sung ({allEvidence.filter((e) => e.trang_thai === 'can_bo_sung').length})
                  </button>
                </div>
              </div>

              {/* Danh sách minh chứng duyệt (Hiển thị đầy đủ hình ảnh) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-700">
                  <div>
                    <span>Hồ Sơ Minh Chứng Của Sinh Viên ({adminEvidenceList.length})</span>
                    <span className="text-[11px] text-slate-500 font-normal block sm:inline sm:ml-2">
                      • Click vào ảnh để phóng to kiểm tra dấu mộc & tính xác thực
                    </span>
                  </div>
                  {canPurgeEvidenceImages && gradedItemsWithImages.length > 0 && (
                    <button
                      type="button"
                      disabled={isBulkPurging}
                      onClick={handlePurgeAllGradedImages}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="Xóa dữ liệu ảnh của tất cả các hồ sơ đã chấm xong để giải phóng dung lượng web"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {isBulkPurging
                          ? 'Đang dọn dẹp ảnh...'
                          : `Xóa ảnh đã chấm xong (${gradedItemsWithImages.length} hồ sơ)`}
                      </span>
                    </button>
                  )}
                </div>

                {adminEvidenceList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    Không tìm thấy minh chứng nào phù hợp với bộ lọc.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {adminEvidenceList.map((item) => (
                      <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{item.ho_va_ten}</span>
                              <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-mono font-semibold">
                                {item.ma_sinh_vien}
                              </span>
                              <span className="text-xs text-slate-500">({item.lop})</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${danhMucConfigs[item.danh_muc]?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                                {danhMucConfigs[item.danh_muc]?.label}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-slate-800 mt-1">{item.tieu_de}</div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                              <span>Ngày: {item.ngay_dien_ra}</span>
                              <span>•</span>
                              <span>Điểm đề xuất: <strong className="text-blue-700">+{item.diem_de_xuat}đ</strong></span>
                              {item.diem_duyet !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-bold">Đã duyệt: +{item.diem_duyet}đ</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {item.trang_thai === 'cho_duyet' && (
                              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                Chờ Thẩm Định
                              </span>
                            )}
                            {item.trang_thai === 'da_duyet' && (
                              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Đã Duyệt (+{item.diem_duyet ?? item.diem_de_xuat}đ)
                              </span>
                            )}
                            {item.trang_thai === 'can_bo_sung' && (
                              <span className="text-xs font-semibold bg-orange-100 text-orange-800 px-3 py-1 rounded-full border border-orange-200 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Cần Bổ Sung
                              </span>
                            )}
                            {item.trang_thai === 'tu_choi' && (
                              <span className="text-xs font-semibold bg-red-100 text-red-800 px-3 py-1 rounded-full border border-red-200 flex items-center gap-1">
                                <X className="w-3.5 h-3.5" />
                                Từ Chối
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => openReviewModal(item)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                              Thẩm Định / Chấm Điểm
                            </button>

                            <button
                              type="button"
                              disabled={deletingRecordId === item.id}
                              onClick={() => handleDeleteEvidenceRecord(item, true)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
                              title="Xóa hoàn toàn hồ sơ minh chứng này khỏi hệ thống"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{deletingRecordId === item.id ? 'Đang xóa...' : 'Xóa hồ sơ'}</span>
                            </button>
                          </div>
                        </div>

                        {item.mo_ta && (
                          <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                            <strong>Nội dung hoạt động:</strong> {item.mo_ta}
                          </div>
                        )}

                        {/* VÙNG XEM ẢNH MINH CHỨNG (CHỈ ADMIN MỚI THẤY KHU VỰC NÀY) */}
                        <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-900 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-indigo-600" />
                              Ảnh minh chứng do {item.ho_va_ten} tải lên ({item.anh_minh_chung_urls?.length || 0} ảnh):
                            </span>
                            <div className="flex items-center gap-2">
                              {canPurgeEvidenceImages &&
                                item.trang_thai !== 'cho_duyet' &&
                                item.anh_minh_chung_urls &&
                                item.anh_minh_chung_urls.length > 0 && (
                                  <button
                                    type="button"
                                    disabled={purgingItemId === item.id}
                                    onClick={() => handlePurgeSingleItemImages(item)}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                                    title="Xóa dữ liệu ảnh minh chứng sau khi đã chấm xong để tránh quá tải web"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>
                                      {purgingItemId === item.id
                                        ? 'Đang xóa ảnh...'
                                        : 'Xóa dữ liệu ảnh (Đã chấm xong)'}
                                    </span>
                                  </button>
                                )}
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                                Bảo mật Admin
                              </span>
                            </div>
                          </div>

                          {item.anh_minh_chung_urls && item.anh_minh_chung_urls.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                              {item.anh_minh_chung_urls.map((imgUrl, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  onClick={() => setPreviewImageUrl(imgUrl)}
                                  className="group relative aspect-video rounded-xl overflow-hidden border border-slate-300 bg-slate-200 cursor-pointer shadow-xs hover:border-indigo-500 transition-all"
                                >
                                  <img
                                    src={imgUrl}
                                    alt="Minh chứng"
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs">
                                    <Maximize2 className="w-4 h-4" />
                                    <span className="text-[10px] font-semibold">Phóng to</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-2.5 bg-white/80 border border-indigo-200/70 rounded-xl text-[11px] text-slate-600 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  Đã xóa dữ liệu ảnh minh chứng sau khi chấm điểm xong để giảm tải dung lượng hệ thống. Điểm số và kết quả thẩm định vẫn được lưu trữ đầy đủ.
                                </span>
                              </span>
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                                Đã giải phóng bộ nhớ
                              </span>
                            </div>
                          )}
                        </div>

                        {item.nhan_xet_admin && (
                          <div className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-xl flex items-center justify-between">
                            <span>
                              <strong>Đánh giá:</strong> {item.nhan_xet_admin} (bởi {item.nguoi_duyet})
                            </span>
                            <span className="text-[10px] text-slate-400">{item.ngay_duyet}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </div>
              ) : (
                <AdminOfficerManagement
                  evaluator={evaluator}
                  onOfficersChanged={onEvidenceChanged}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THẨM ĐỊNH & CHẤM ĐIỂM MINH CHỨNG */}
      {/* ========================================================================= */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm sm:text-base">HỘI ĐỒNG THẨM ĐỊNH MINH CHỨNG RÈN LUYỆN</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sinh viên: {reviewingItem.ho_va_ten} ({reviewingItem.ma_sinh_vien})
                </p>
              </div>
              <button
                onClick={() => setReviewingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung modal */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div><strong>Hoạt động:</strong> {reviewingItem.tieu_de}</div>
                <div><strong>Danh mục:</strong> {danhMucConfigs[reviewingItem.danh_muc]?.label}</div>
                <div><strong>Điểm đề xuất ban đầu:</strong> +{reviewingItem.diem_de_xuat}đ</div>
              </div>

              {/* Lựa chọn trạng thái */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kết Quả Đánh Giá
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('da_duyet')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                      reviewStatus === 'da_duyet'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt Đạt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('can_bo_sung')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                      reviewStatus === 'can_bo_sung'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Yêu Cầu Thêm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('tu_choi')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                      reviewStatus === 'tu_choi'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Từ Chối</span>
                  </button>
                </div>
              </div>

              {/* Điểm thực duyệt */}
              {reviewStatus === 'da_duyet' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số Điểm Thực Duyệt (Tối đa {danhMucConfigs[reviewingItem.danh_muc]?.maxPoints}đ)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={danhMucConfigs[reviewingItem.danh_muc]?.maxPoints || 25}
                    value={reviewPoints}
                    onChange={(e) => setReviewPoints(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-emerald-700"
                  />
                </div>
              )}

              {/* Nhận xét phản hồi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhận Xét & Lời Nhắn Phản Hồi Về Cho Sinh Viên
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Nhập lý do duyệt, lưu ý hoặc hướng dẫn bổ sung giấy tờ..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Tùy chọn cho Admin Web xóa luôn dữ liệu ảnh minh chứng sau khi chấm xong */}
              {canPurgeEvidenceImages &&
                reviewingItem.anh_minh_chung_urls &&
                reviewingItem.anh_minh_chung_urls.length > 0 && (
                  <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoPurgeAfterReview}
                      onChange={(e) => setAutoPurgeAfterReview(e.target.checked)}
                      className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-rose-900 block">
                        Xóa luôn dữ liệu ảnh minh chứng sau khi chấm xong
                      </span>
                      <span className="text-[11px] text-rose-700 leading-relaxed">
                        Giải phóng ngay {reviewingItem.anh_minh_chung_urls.length} ảnh minh chứng khỏi bộ nhớ để web không bị quá tải dữ liệu (Điểm số và lịch sử duyệt của sinh viên vẫn được giữ nguyên).
                      </span>
                    </div>
                  </label>
                )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={isReviewing}
                  onClick={handleSaveReview}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  {isReviewing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Xác Nhận Đánh Giá</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
