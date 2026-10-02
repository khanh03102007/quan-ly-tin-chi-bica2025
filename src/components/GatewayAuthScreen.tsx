import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
  LogIn,
  User,
  IdCard,
  AlertTriangle,
  ArrowRight,
  Globe,
  CheckCircle2,
  Building,
  Loader2,
  Sun,
  Moon,
  Sparkles,
  Palette,
  Layers,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { AnimatedBicaLogo } from './AnimatedBicaLogo';
import celestialPhoenixImg from '../assets/images/bica_celestial_phoenix_1790526698614.jpg';
import {
  supabase,
  signInWithPassword,
  signUp,
  ensureStudentInHoSo,
  purgeStudentFromLocalStorage,
  isStudentMarkedDeleted,
  fetchAllStudentsForTeacher,
  AUTHORIZED_TEACHERS,
  DEFAULT_BICA_STUDENT_PROFILE,
  saveTeacherSession,
  verifyPortalRoleWithServer,
  requestPasswordRecoveryToRegisteredEmail,
  verifyGmailRecoveryLinkOrOtp,
  updateStudentAccountPassword,
  consumeInitialRecoveryRedirect,
  clearActiveRecoverySession,
  hashStudentPasswordSync,
  verifyStudentPasswordHash,
} from '../lib/supabase';
import type { TeacherAccount, StudentProfile } from '../types';

export interface GatewayAuthScreenProps {
  onStudentLoginSuccess: (profile: StudentProfile, user?: any) => void;
  onTeacherLoginSuccess: (teacher: TeacherAccount) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

// Khóa lưu danh bạ tài khoản sinh viên đã đăng ký trên máy (chỉ lưu mã băm Salted Hash, tuyệt đối không lưu mật khẩu plaintext)
const BICA_REGISTERED_STUDENTS_STORAGE_KEY = 'bica_registered_students_v1';

interface RegisteredLocalStudent {
  email: string;
  studentId: string;
  fullName: string;
  passwordHash?: string;
  password?: string;
  profile: StudentProfile;
  createdAt: string;
}

function getStoredRegisteredStudents(): RegisteredLocalStudent[] {
  try {
    const raw = localStorage.getItem(BICA_REGISTERED_STUDENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: RegisteredLocalStudent[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    let needsMigration = false;
    const migrated = parsed.map((item) => {
      if (item && typeof item.password === 'string' && item.password) {
        needsMigration = true;
        const hash = hashStudentPasswordSync(item.email, item.password);
        const { password, ...rest } = item;
        return { ...rest, passwordHash: hash };
      }
      return item;
    });
    if (needsMigration) {
      localStorage.setItem(BICA_REGISTERED_STUDENTS_STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

function saveRegisteredStudentToLocal(account: {
  email: string;
  studentId: string;
  fullName: string;
  password?: string;
  passwordHash?: string;
  profile: StudentProfile;
  createdAt: string;
}) {
  try {
    const current = getStoredRegisteredStudents();
    const filtered = current.filter(
      (a) =>
        a.email.toLowerCase() !== account.email.toLowerCase() &&
        a.studentId.toUpperCase() !== account.studentId.toUpperCase()
    );
    const passwordHash =
      account.passwordHash ||
      (account.password ? hashStudentPasswordSync(account.email, account.password) : '');
    filtered.push({
      email: account.email.trim().toLowerCase(),
      studentId: account.studentId.trim().toUpperCase(),
      fullName: account.fullName.trim(),
      passwordHash,
      profile: account.profile,
      createdAt: account.createdAt,
    });
    localStorage.setItem(BICA_REGISTERED_STUDENTS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Lỗi lưu tài khoản đăng ký cục bộ:', err);
  }
}

export const GatewayAuthScreen: React.FC<GatewayAuthScreenProps> = ({
  onStudentLoginSuccess,
  onTeacherLoginSuccess,
  isDarkMode = true,
  onToggleTheme,
}) => {
  // Mode: 'student' (Cổng Sinh Viên) | 'teacher' (Cổng Chủ Nhiệm Ngành)
  const [activePortal, setActivePortal] = useState<'student' | 'teacher'>('student');

  // Chế độ giao diện trang đăng nhập:
  // 'plain' (MẶC ĐỊNH - Giao diện 1: Nền Trơn Navy-Cyan đồng bộ logo mới, không có phượng hoàng)
  // 'phoenix' (Giao diện 2: Phượng Hoàng Linh Điểu & Tím Vũ Trụ)
  const GATEWAY_SKIN_STORAGE_KEY = 'bica_gateway_skin_v1';

  const [gatewaySkin, setGatewaySkin] = useState<'plain' | 'phoenix'>(() => {
    if (typeof window === 'undefined') return 'plain';
    try {
      const saved =
        localStorage.getItem(GATEWAY_SKIN_STORAGE_KEY) ||
        sessionStorage.getItem(GATEWAY_SKIN_STORAGE_KEY);
      if (saved === 'phoenix' || saved === 'giao_dien_2') return 'phoenix';
      if (saved === 'plain' || saved === 'giao_dien_1') return 'plain';
      return 'plain';
    } catch {
      return 'plain';
    }
  });

  const isPlainSkin = gatewaySkin === 'plain';

  useEffect(() => {
    try {
      localStorage.setItem(GATEWAY_SKIN_STORAGE_KEY, gatewaySkin);
      sessionStorage.setItem(GATEWAY_SKIN_STORAGE_KEY, gatewaySkin);
    } catch {
      // ignore storage errors
    }
  }, [gatewaySkin]);

  const handleToggleGatewaySkin = () => {
    setGatewaySkin((prev) => {
      const next = prev === 'plain' ? 'phoenix' : 'plain';
      try {
        localStorage.setItem(GATEWAY_SKIN_STORAGE_KEY, next);
        sessionStorage.setItem(GATEWAY_SKIN_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Chế độ xác thực sinh viên: 'login' (Đăng Nhập) | 'register' (Đăng Ký Tài Khoản) | 'forgot' (Quên Mật Khẩu)
  const [studentAuthMode, setStudentAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Student Login State (hoàn toàn để trống, không điền mẫu)
  const [studentInput, setStudentInput] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [isStudentLoading, setIsStudentLoading] = useState(false);

  // Student Forgot / Gmail Recovery State (TUYỆT ĐỐI KHÔNG hiển thị mật khẩu công khai trên web)
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStudentId, setForgotStudentId] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<{
    targetEmail: string;
    studentId: string;
    studentName: string;
    emailDispatchedViaSupabase: boolean;
    profile?: StudentProfile;
  } | null>(null);
  const [gmailLinkInput, setGmailLinkInput] = useState('');
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [isGmailVerified, setIsGmailVerified] = useState(false);
  const [verifiedTargetEmail, setVerifiedTargetEmail] = useState('');
  const [recoveryTicketId, setRecoveryTicketId] = useState<string | null>(null);
  const [recoveryExpiresAt, setRecoveryExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isPasswordResetCompleted, setIsPasswordResetCompleted] = useState(false);
  const [customNewPass, setCustomNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [showCustomNewPass, setShowCustomNewPass] = useState(false);
  const [isSavingCustomPass, setIsSavingCustomPass] = useState(false);
  const [customPassSuccess, setCustomPassSuccess] = useState<string | null>(null);

  // Student Register State (thêm tính năng đăng ký tài khoản)
  const [regFullName, setRegFullName] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [isRegLoading, setIsRegLoading] = useState(false);

  // Teacher Form State (để trống email, không điền mẫu)
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [isTeacherLoading, setIsTeacherLoading] = useState(false);

  // Kiểm tra nếu học sinh truy cập từ link khôi phục mật khẩu trong Gmail (Không tải danh sách toàn bộ SV khi chưa xác thực Chủ nhiệm ngành)
  useEffect(() => {
    consumeInitialRecoveryRedirect().then((res) => {
      if (!res.isRedirect) return;
      setActivePortal('student');
      setStudentAuthMode('forgot');
      if (res.success && res.verifiedEmail && res.recoveryTicket) {
        setForgotEmail(res.verifiedEmail);
        setVerifiedTargetEmail(res.verifiedEmail);
        setRecoveryTicketId(res.recoveryTicket);
        setRecoveryExpiresAt(res.expiresAt || Date.now() + 10 * 60 * 1000);
        setIsGmailVerified(true);
        setIsPasswordResetCompleted(false);
      } else if (res.error) {
        setForgotError(res.error);
      }
    });
  }, []);

  // Bộ đếm ngược hạn sử dụng 10 phút của đường dẫn liên kết / phiên khôi phục
  useEffect(() => {
    if (!recoveryExpiresAt || isPasswordResetCompleted) {
      setRemainingSeconds(null);
      return;
    }

    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((recoveryExpiresAt - Date.now()) / 1000));
      setRemainingSeconds(diffSec);
      if (diffSec <= 0) {
        clearActiveRecoverySession();
        setRecoveryTicketId(null);
        setIsGmailVerified(false);
        setRecoveryExpiresAt(null);
        setForgotError(
          'Đường dẫn liên kết khôi phục đã hết hạn sử dụng (quá 10 phút). Vui lòng nhấn "Gửi lại tin nhắn mới vào Gmail" để nhận liên kết mới.'
        );
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [recoveryExpiresAt, isPasswordResetCompleted]);

  // Bước 1: Xử lý Yêu Cầu Gửi Thư Khôi Phục Mật Khẩu Về Chính Đích Email Đã Đăng Ký
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setRecoveryResult(null);
    setIsGmailVerified(false);
    setIsPasswordResetCompleted(false);
    setRecoveryTicketId(null);
    setRecoveryExpiresAt(null);
    setCustomPassSuccess(null);

    const emailClean = forgotEmail.trim().toLowerCase();
    const idClean = forgotStudentId.trim().toUpperCase();

    if (!emailClean) {
      setForgotError('Vui lòng nhập địa chỉ Email đã đăng ký tài khoản (@st.vju.ac.vn).');
      return;
    }

    if (!emailClean.endsWith('@st.vju.ac.vn')) {
      setForgotError(
        'Hệ thống chỉ gửi thư khôi phục mật khẩu cho địa chỉ Email sinh viên trường có đuôi @st.vju.ac.vn đã đăng ký tài khoản.'
      );
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await requestPasswordRecoveryToRegisteredEmail(emailClean, idClean || undefined);
      if (!res.success || !res.targetEmail) {
        setForgotError(
          res.error ||
            'Không tìm thấy tài khoản nào được đăng ký với email này. Vui lòng kiểm tra lại.'
        );
        return;
      }

      setRecoveryResult({
        targetEmail: res.targetEmail,
        studentId: res.studentId || '',
        studentName: res.studentName || 'Sinh viên BICA',
        emailDispatchedViaSupabase: Boolean(res.emailDispatchedViaSupabase),
        profile: res.profile,
      });
      setVerifiedTargetEmail(res.targetEmail);
      setRecoveryExpiresAt(res.expiresAt || Date.now() + 10 * 60 * 1000);
      setGmailLinkInput('');
      setCustomNewPass('');
      setConfirmNewPass('');
    } catch (err: any) {
      setForgotError(err?.message || 'Lỗi kết nối khi yêu cầu gửi thư khôi phục mật khẩu.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Bước 2: Xác thực đường link khôi phục lấy từ bên trong tin nhắn Gmail
  // Bắt buộc kiểm tra: (1) Chỉ dùng 1 lần, (2) Còn hạn 10 phút, (3) Mã của tài khoản A chỉ dùng được cho đúng tài khoản A
  const handleVerifyGmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    const enteredEmail = forgotEmail.trim().toLowerCase();
    if (!enteredEmail || !enteredEmail.endsWith('@st.vju.ac.vn')) {
      setForgotError('Vui lòng nhập chính xác địa chỉ Email sinh viên (@st.vju.ac.vn) ở ô phía trên trước khi xác thực link.');
      return;
    }
    if (
      recoveryResult?.targetEmail &&
      recoveryResult.targetEmail.trim().toLowerCase() !== enteredEmail
    ) {
      setForgotError(
        `Từ chối bảo mật: Bạn vừa đổi email trên màn hình thành "${enteredEmail}" nhưng mã khôi phục trước đó được yêu cầu cho "${recoveryResult.targetEmail}". Mã của tài khoản nào chỉ dùng cho đúng tài khoản đó!`
      );
      return;
    }
    if (!gmailLinkInput.trim()) {
      setForgotError('Vui lòng dán đường link từ nút "Reset Password" trong tin nhắn Gmail vào ô bên dưới.');
      return;
    }

    setIsVerifyingLink(true);
    try {
      const res = await verifyGmailRecoveryLinkOrOtp(enteredEmail, gmailLinkInput);
      if (!res.success || !res.verifiedEmail || !res.recoveryTicket) {
        setForgotError(res.error || 'Đường link không hợp lệ, đã hết hạn hoặc đã được sử dụng.');
        return;
      }
      // Ràng buộc kép: Email xác thực từ token phải trùng khớp tuyệt đối với email sinh viên đang yêu cầu
      if (res.verifiedEmail.trim().toLowerCase() !== enteredEmail) {
        clearActiveRecoverySession();
        setForgotError(
          `Từ chối bảo mật: Đường dẫn liên kết này thuộc về tài khoản "${res.verifiedEmail}", tuyệt đối không thể dùng để đổi mật khẩu cho tài khoản "${enteredEmail}"!`
        );
        return;
      }

      setVerifiedTargetEmail(res.verifiedEmail);
      setRecoveryTicketId(res.recoveryTicket);
      setRecoveryExpiresAt(res.expiresAt || Date.now() + 10 * 60 * 1000);
      setIsGmailVerified(true);
      setIsPasswordResetCompleted(false);
      setGmailLinkInput('');
    } finally {
      setIsVerifyingLink(false);
    }
  };

  // Bước 3: Sau khi đã xác thực đúng chủ hộp thư Gmail, đặt mật khẩu mới 1 LẦN DUY NHẤT và vô hiệu hóa liên kết ngay
  const handleUpdateCustomPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordResetCompleted || !recoveryTicketId) {
      setForgotError(
        'Đường dẫn liên kết khôi phục này đã được sử dụng để đổi mật khẩu (mỗi liên kết chỉ có hiệu lực 1 lần duy nhất). Vui lòng yêu cầu gửi liên kết mới nếu muốn đổi lại.'
      );
      return;
    }

    const lockedAccountEmail = verifiedTargetEmail.trim().toLowerCase();
    if (!lockedAccountEmail || !isGmailVerified) {
      setForgotError('Vui lòng xác thực đường link từ tin nhắn Gmail trước khi đặt mật khẩu mới.');
      return;
    }

    const newPassClean = customNewPass.trim();
    const confirmClean = confirmNewPass.trim();
    if (newPassClean.length < 6) {
      setForgotError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (confirmClean && newPassClean !== confirmClean) {
      setForgotError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsSavingCustomPass(true);
    setForgotError(null);
    try {
      const res = await updateStudentAccountPassword(
        lockedAccountEmail,
        newPassClean,
        recoveryResult?.profile,
        recoveryTicketId
      );
      if (!res.success) {
        setForgotError(res.error || 'Không thể cập nhật mật khẩu mới.');
        return;
      }
      // Khóa ngay lập tức vé & ẩn biểu mẫu đổi mật khẩu để không thể bấm lưu lần 2 trên cùng 1 liên kết
      setRecoveryTicketId(null);
      setIsPasswordResetCompleted(true);
      setRecoveryExpiresAt(null);
      setCustomPassSuccess(
        `Đã đặt lại mật khẩu mới cho đúng tài khoản ${lockedAccountEmail} thành công! Đường dẫn liên kết vừa dùng đã được vô hiệu hóa vĩnh viễn (chỉ sử dụng 1 lần).`
      );
      setStudentInput(lockedAccountEmail);
      setStudentPassword(newPassClean);
      setCustomNewPass('');
      setConfirmNewPass('');
    } finally {
      setIsSavingCustomPass(false);
    }
  };

  // Xử lý Đăng Nhập Cổng Sinh Viên
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError(null);

    const inputClean = studentInput.trim().toLowerCase();
    const passClean = studentPassword.trim();

    if (!inputClean) {
      setStudentError('Vui lòng nhập Email sinh viên trường có đuôi @st.vju.ac.vn.');
      return;
    }

    // YÊU CẦU: Khi đăng nhập bắt buộc phải dùng mail trường có đuôi @st.vju.ac.vn đối với tài khoản sinh viên
    if (!inputClean.endsWith('@st.vju.ac.vn')) {
      setStudentError(
        'Đăng nhập sinh viên bắt buộc phải sử dụng email trường có đuôi @st.vju.ac.vn (Ví dụ: 25119034@st.vju.ac.vn).'
      );
      return;
    }

    if (!passClean) {
      setStudentError('Vui lòng nhập mật khẩu tài khoản sinh viên.');
      return;
    }

    setIsStudentLoading(true);

    try {
      // Kiểm tra hồ sơ trên bảng ho_so của Supabase trước
      const { data: hoSoRow, error: hoSoErr } = await supabase
        .from('ho_so')
        .select('*')
        .ilike('email', inputClean)
        .limit(1)
        .maybeSingle();

      // 1. Thử đăng nhập qua Supabase Auth
      const { data } = await signInWithPassword(inputClean, passClean);
      if (data?.user) {
        const studentIdFromMeta = (
          hoSoRow?.ma_sinh_vien ||
          data.user.user_metadata?.student_id ||
          inputClean.split('@')[0]
        )
          .trim()
          .toUpperCase();

        const prof: StudentProfile = {
          ...DEFAULT_BICA_STUDENT_PROFILE,
          email: inputClean,
          user_id: data.user.id,
          ma_sinh_vien: studentIdFromMeta,
          ho_va_ten:
            hoSoRow?.ho_va_ten ||
            data.user.user_metadata?.full_name ||
            'Sinh viên BICA',
          lop: hoSoRow?.lop || 'BICA-K2025',
          nganh_hoc:
            hoSoRow?.nganh_hoc || 'Kỹ thuật Thông minh và Tự động hóa (BICA)',
          khoa: hoSoRow?.khoa || 'Trường Đại học Việt Nhật (VJU - ĐHQGHN)',
          nien_khoa: hoSoRow?.nien_khoa || '2025 - 2029',
          tong_tin_chi_tich_luy: Number(hoSoRow?.tong_tin_chi_tich_luy ?? 0),
          diem_gpa: Number(hoSoRow?.diem_gpa ?? 0),
          diem_cpa: Number(hoSoRow?.diem_cpa ?? 0),
          xep_loai: hoSoRow?.xep_loai || 'Chưa xếp loại',
        };

        // Nếu tài khoản đã xác thực qua Supabase Auth nhưng chưa có trong bảng ho_so,
        // đồng bộ ngay vào bảng ho_so để Cổng Chủ Nhiệm Ngành hiển thị
        if (!hoSoRow) {
          await ensureStudentInHoSo(prof);
        }

        onStudentLoginSuccess(prof, data.user);
        return;
      }

      // 2. Kiểm tra với danh sách tài khoản đã đăng ký trên hệ thống (so khớp mã băm Salted Hash)
      const registeredList = getStoredRegisteredStudents();
      const matchedLocal = registeredList.find(
        (acc) =>
          acc.email.toLowerCase() === inputClean &&
          verifyStudentPasswordHash(acc.email, passClean, acc)
      );

      if (matchedLocal) {
        // Nếu tài khoản này đã bị xóa khỏi Supabase -> Xóa khỏi bộ nhớ cục bộ và từ chối đăng nhập!
        if (!hoSoErr && !hoSoRow && isStudentMarkedDeleted(matchedLocal.studentId, matchedLocal.email)) {
          purgeStudentFromLocalStorage(matchedLocal.studentId, matchedLocal.email);
          setStudentError(
            'Tài khoản sinh viên này đã bị xóa khỏi cơ sở dữ liệu Supabase. Vui lòng chuyển sang tab "Đăng Ký Tài Khoản" nếu cần tạo lại.'
          );
          return;
        }

        const mergedProfile: StudentProfile = hoSoRow
          ? {
              ...matchedLocal.profile,
              ma_sinh_vien: hoSoRow.ma_sinh_vien || matchedLocal.studentId,
              ho_va_ten: hoSoRow.ho_va_ten || matchedLocal.fullName,
              email: hoSoRow.email || matchedLocal.email,
              lop: hoSoRow.lop || matchedLocal.profile.lop,
              tong_tin_chi_tich_luy: Number(hoSoRow.tong_tin_chi_tich_luy ?? 0),
              diem_gpa: Number(hoSoRow.diem_gpa ?? 0),
              diem_cpa: Number(hoSoRow.diem_cpa ?? 0),
              xep_loai: hoSoRow.xep_loai || 'Chưa xếp loại',
            }
          : matchedLocal.profile;

        // Nếu tài khoản đã đăng ký nhưng chưa có trên bảng ho_so, tự động tải lên ho_so ngay lập tức
        if (!hoSoRow) {
          await ensureStudentInHoSo(mergedProfile);
        }

        onStudentLoginSuccess(mergedProfile, null);
        return;
      }

      // 3. Hỗ trợ tài khoản sinh viên BICA 2025 mặc định của trường (25119034@st.vju.ac.vn) - xác thực qua Server
      const hasLocalAccountForEmail = registeredList.some(
        (acc) => acc.email.toLowerCase() === inputClean
      );
      if (
        !hasLocalAccountForEmail &&
        (inputClean === '25119034@st.vju.ac.vn' ||
          inputClean === 'bica25119034@st.vju.ac.vn' ||
          inputClean === 'khanhtd@st.vju.ac.vn')
      ) {
        const verifyRes = await verifyPortalRoleWithServer('default_student', inputClean, passClean);
        if (verifyRes.success) {
          const profile: StudentProfile = {
            ...DEFAULT_BICA_STUDENT_PROFILE,
            email: '25119034@st.vju.ac.vn',
            ma_sinh_vien: 'BICA25119034',
            ho_va_ten: 'Trần Duy Khánh',
          };
          await ensureStudentInHoSo(profile);
          onStudentLoginSuccess(profile, null);
          return;
        }
      }

      // Thông báo lỗi rõ ràng, không có gợi ý điền nhanh
      setStudentError(
        'Email trường hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại email @st.vju.ac.vn và mật khẩu, hoặc bấm tab "Đăng Ký Tài Khoản" để tạo tài khoản mới.'
      );
    } catch (err: any) {
      setStudentError(err?.message || 'Lỗi kết nối máy chủ xác thực');
    } finally {
      setIsStudentLoading(false);
    }
  };

  // Xử lý Đăng Ký Tài Khoản Sinh Viên Mới
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    const nameClean = regFullName.trim();
    const idClean = regStudentId.trim().toUpperCase();
    const emailClean = regEmail.trim().toLowerCase();
    const passClean = regPassword.trim();
    const confirmClean = regConfirmPassword.trim();

    if (!nameClean) {
      setRegError('Vui lòng nhập Họ và tên sinh viên.');
      return;
    }
    if (!idClean) {
      setRegError('Vui lòng nhập Mã số sinh viên (MSSV).');
      return;
    }

    // YÊU CẦU: Bắt buộc dùng mail trường có đuôi @st.vju.ac.vn
    if (!emailClean.endsWith('@st.vju.ac.vn')) {
      setRegError(
        `Email sinh viên bắt buộc phải có đuôi trường @st.vju.ac.vn (Ví dụ: ${idClean.toLowerCase()}@st.vju.ac.vn).`
      );
      return;
    }

    if (passClean.length < 6) {
      setRegError('Mật khẩu đăng ký phải có tối thiểu 6 ký tự.');
      return;
    }
    if (passClean !== confirmClean) {
      setRegError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsRegLoading(true);

    try {
      // 1. Kiểm tra trực tiếp trên bảng public.ho_so của Supabase (sanitize chống PostgREST filter injection)
      const safeIdFilter = idClean.replace(/[^A-Z0-9_-]/g, '');
      const safeEmailFilter = emailClean.replace(/[^a-z0-9@._-]/g, '');
      const { data: existingInDb, error: checkErr } = await supabase
        .from('ho_so')
        .select('ma_sinh_vien, email')
        .or(`ma_sinh_vien.ilike.${safeIdFilter},email.ilike.${safeEmailFilter}`);

      if (!checkErr && existingInDb) {
        const dupId = existingInDb.find(
          (row) => (row.ma_sinh_vien || '').trim().toUpperCase() === idClean
        );
        if (dupId) {
          setRegError(
            `Mã sinh viên ${idClean} đang tồn tại trên hệ thống Supabase. Mỗi mã sinh viên chỉ được tạo 1 tài khoản. Vui lòng chuyển sang tab Đăng Nhập.`
          );
          setIsRegLoading(false);
          return;
        }

        const dupEmail = existingInDb.find(
          (row) => (row.email || '').trim().toLowerCase() === emailClean
        );
        if (dupEmail) {
          setRegError(
            `Email ${emailClean} đang tồn tại trên hệ thống Supabase. Vui lòng chuyển sang tab Đăng Nhập.`
          );
          setIsRegLoading(false);
          return;
        }

        // Nếu không tồn tại trên Supabase ho_so (ví dụ đã bị xóa trước đó), dọn sạch cache cũ của mã SV / email này
        purgeStudentFromLocalStorage(idClean, emailClean);
      }

      // 2. Tạo cấu trúc hồ sơ sinh viên ban đầu
      const newProfile: StudentProfile = {
        ...DEFAULT_BICA_STUDENT_PROFILE,
        email: emailClean,
        ma_sinh_vien: idClean,
        ho_va_ten: nameClean,
        lop: 'BICA-K2025',
        nganh_hoc: 'Kỹ thuật Điều khiển Thông minh & Tự động hóa',
        khoa: 'Khoa Kỹ thuật Công nghệ Tiên tiến',
        nien_khoa: '2025 - 2029',
        trang_thai_hoc_tap: 'Đang theo học',
        tong_tin_chi_tich_luy: 0,
        tong_tin_chi_yeu_cau: 145,
        diem_gpa: 0,
        diem_cpa: 0,
        xep_loai: 'Chưa xếp loại',
      };

      // 3. Gửi lệnh tạo tài khoản lên Supabase Auth & đồng bộ ngay vào bảng public.ho_so
      const { data } = await signUp(emailClean, passClean, nameClean, idClean);
      if (data?.user?.id) {
        newProfile.user_id = data.user.id;
      }

      // Đảm bảo 100% bản ghi hồ sơ sinh viên mới đã nằm trong bảng public.ho_so trên Supabase
      await ensureStudentInHoSo(newProfile);

      // 4. Lưu vào danh bạ tài khoản đã đăng ký trên máy
      saveRegisteredStudentToLocal({
        email: emailClean,
        studentId: idClean,
        fullName: nameClean,
        password: passClean,
        profile: newProfile,
        createdAt: new Date().toISOString(),
      });

      setRegSuccess('Đăng ký tài khoản và đồng bộ vào danh sách ngành thành công! Đang chuyển hướng...');

      // Tự động chuyển thẳng vào giao diện học vụ sau 900ms
      setTimeout(() => {
        onStudentLoginSuccess(newProfile, data?.user || null);
      }, 900);
    } catch (err: any) {
      setRegError(err?.message || 'Có lỗi xảy ra trong quá trình đăng ký tài khoản.');
      setIsRegLoading(false);
    }
  };

  // Xử lý đăng nhập Cổng Chủ Nhiệm Ngành / Khoa
  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);

    const emailClean = teacherEmail.trim().toLowerCase();
    const passClean = teacherPassword.trim();

    if (!emailClean) {
      setTeacherError('Vui lòng nhập email Chủ nhiệm ngành (@vju.ac.vn).');
      return;
    }
    if (!passClean) {
      setTeacherError('Vui lòng nhập mật khẩu phân quyền Chủ nhiệm ngành.');
      return;
    }

    setIsTeacherLoading(true);

    try {
      // Xác thực mật khẩu Chủ nhiệm ngành trực tiếp qua Server API (/api/verify-portal-role)
      const verifyRes = await verifyPortalRoleWithServer('teacher', emailClean, passClean);

      if (!verifyRes.success || !verifyRes.teacher) {
        setTeacherError(
          verifyRes.error ||
            'Tài khoản hoặc mật khẩu phân quyền không chính xác. Vui lòng kiểm tra lại.'
        );
        return;
      }

      const teacherAccount: TeacherAccount = verifyRes.teacher;
      saveTeacherSession(teacherAccount);
      onTeacherLoginSuccess(teacherAccount);
      return;
    } catch (err: any) {
      setTeacherError(err?.message || 'Lỗi xác thực quyền Chủ nhiệm ngành');
    } finally {
      setIsTeacherLoading(false);
    }
  };

  // Helper classes linh hoạt theo giao diện đang chọn ('plain' nền trơn mặc định vs 'phoenix' phượng hoàng)
  const inputFieldClass = isPlainSkin
    ? 'w-full pl-10 pr-4 py-2.5 bg-[#040c21]/95 border border-cyan-500/35 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all'
    : 'w-full pl-10 pr-4 py-2.5 bg-[#0b0a14]/95 border border-violet-500/35 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition-all';

  const compactInputFieldClass = isPlainSkin
    ? 'w-full pl-10 pr-4 py-2 bg-[#040c21]/95 border border-cyan-500/35 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all'
    : 'w-full pl-10 pr-4 py-2 bg-[#0b0a14]/95 border border-violet-500/35 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition-all';

  const primaryBtnClass = isPlainSkin
    ? 'bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white border border-cyan-300/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_24px_rgba(0,183,255,0.4)]'
    : 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-purple-500 text-white border border-violet-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_24px_rgba(124,58,237,0.45)]';

  const accentTextClass = isPlainSkin ? 'text-cyan-300' : 'text-violet-300';
  const accentIconClass = isPlainSkin ? 'text-cyan-300/75' : 'text-violet-300/70';

  return (
    <div
      className={`min-h-screen ${
        isPlainSkin
          ? 'bg-[#03091c] selection:bg-cyan-500'
          : 'bg-[#07060e] selection:bg-violet-500'
      } text-[#f4f4f6] flex flex-col justify-between relative overflow-hidden selection:text-white font-sans transition-colors duration-300`}
    >
      {/* SVG Filter: Làm nét 8K + Xóa hoàn toàn nền tối của ảnh Linh Điểu (Chỉ dùng khi bật giao diện Phượng Hoàng) */}
      {!isPlainSkin && (
        <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
          <defs>
            <filter id="bica-phoenix-nobg-sharp" x="-10%" y="-10%" width="120%" height="120%">
              <feConvolveMatrix
                order="3 3"
                preserveAlpha="true"
                kernelMatrix="0 -0.55 0 -0.55 3.2 -0.55 0 -0.55 0"
                result="sharpened"
              />
              <feColorMatrix
                in="sharpened"
                type="matrix"
                values="1.15 0    0    0 -0.04
                        0    1.18 0    0 -0.04
                        0    0    1.25 0 -0.03
                        1.8  2.4  2.8  0 -0.42"
                result="transparentBird"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/* CSS Keyframes cho ảnh nền Linh Điểu lượn nhẹ toàn trang */}
      <style>{`
        @keyframes phoenix-bg-float {
          0%, 100% {
            transform: translate3d(0px, 0px, 0) scale(1) rotate(0deg);
          }
          50% {
            transform: translate3d(12px, -14px, 0) scale(1.03) rotate(-1deg);
          }
        }
        .animate-phoenix-bg {
          animation: phoenix-bg-float 9s ease-in-out infinite;
        }
      `}</style>

      {/* Background Layer: Phân tách rõ Giao diện Nền Trơn Mặc Định vs Giao diện Phượng Hoàng */}
      {isPlainSkin ? (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {/* Nền trơn xanh đen sâu thẳm (#03091c) chuẩn theo mẫu ảnh logo mới, hoàn toàn không có phượng hoàng */}
          <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[920px] h-[520px] rounded-full bg-gradient-to-b from-sky-500/12 via-blue-800/10 to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[780px] h-[360px] rounded-full bg-blue-900/15 blur-[130px]" />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {/* Deep ambient radial glows (Electric Violet + Rose Crimson) */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[980px] h-[560px] bg-gradient-to-b from-violet-600/22 via-purple-900/14 to-transparent blur-3xl" />
          <div className="absolute top-1/3 left-10 w-[420px] h-[420px] rounded-full bg-rose-600/10 blur-[130px]" />
          <div className="absolute bottom-0 right-10 w-[520px] h-[420px] rounded-full bg-indigo-600/15 blur-[130px]" />

          {/* Cosmic starlight dust specks */}
          <div
            className="absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                'radial-gradient(rgba(196, 181, 253, 0.55) 1px, transparent 1px), radial-gradient(rgba(255, 255, 255, 0.35) 1px, transparent 1px)',
              backgroundSize: '52px 52px, 96px 96px',
              backgroundPosition: '0 0, 26px 26px',
            }}
          />

          {/* Ảnh Phượng Hoàng Linh Điểu đã xóa nền, làm nét */}
          <div className="absolute inset-0 flex items-center justify-center select-none">
            <div className="w-[1050px] sm:w-[1320px] lg:w-[1520px] max-w-[145vw] opacity-35 sm:opacity-40 animate-phoenix-bg">
              <img
                src={celestialPhoenixImg}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain mix-blend-screen"
                style={{
                  filter:
                    'url(#bica-phoenix-nobg-sharp) drop-shadow(0 0 35px rgba(139, 92, 246, 0.42))',
                  maskImage:
                    'radial-gradient(ellipse 75% 70% at 50% 50%, black 50%, transparent 92%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 75% 70% at 50% 50%, black 50%, transparent 92%)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Top Academic Institutional Bar */}
      <header
        className={`relative z-20 border-b backdrop-blur-xl transition-colors duration-300 ${
          isPlainSkin
            ? 'border-cyan-500/20 bg-[#040c24]/85'
            : 'border-violet-500/20 bg-[#0b0a14]/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-semibold text-white tracking-wide">
              ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC VIỆT NHẬT (VJU)
            </span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className={`${accentTextClass} font-medium hidden md:inline`}>
              KHOA KỸ THUẬT CÔNG NGHỆ TIÊN TIẾN
            </span>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <span
              className={`hidden lg:inline-flex items-center space-x-1.5 text-[11px] ${
                isPlainSkin ? 'text-cyan-200/90' : 'text-violet-200/90'
              }`}
            >
              <Globe className={`w-3.5 h-3.5 ${isPlainSkin ? 'text-cyan-400' : 'text-violet-400'}`} />
              <span>Cổng Thông Tin Học Vụ BICA 2025</span>
            </span>

            {/* 1 Nút Ấn Đổi Giao Diện Linh Hoạt: Bấm để chuyển qua lại giữa Giao diện 1 (Mặc định) & Giao diện 2 */}
            <button
              type="button"
              onClick={handleToggleGatewaySkin}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer border ${
                isPlainSkin
                  ? 'bg-gradient-to-r from-sky-500/20 to-blue-600/25 hover:from-sky-500/35 hover:to-blue-600/40 text-cyan-200 border-cyan-400/40 shadow-[0_0_15px_rgba(0,183,255,0.25)]'
                  : 'bg-gradient-to-r from-violet-600/25 to-purple-600/30 hover:from-violet-600/40 hover:to-purple-600/45 text-violet-200 border-violet-400/40 shadow-[0_0_15px_rgba(124,58,237,0.3)]'
              }`}
              title={
                isPlainSkin
                  ? 'Đang ở Giao diện 1 — Nhấn để chuyển sang Giao diện 2'
                  : 'Đang ở Giao diện 2 — Nhấn để chuyển sang Giao diện 1'
              }
            >
              <Palette className={`w-3.5 h-3.5 ${isPlainSkin ? 'text-cyan-300' : 'text-violet-300'}`} />
              <span>{isPlainSkin ? 'Giao diện 1' : 'Giao diện 2'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Center Container */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-4xl flex flex-col items-center">
          {/* ============================================================== */}
          {/* LOGO ĐỘNG ĐIỀU KHIỂN THÔNG MINH VÀ TỰ ĐỘNG HOÁ MẪU MỚI        */}
          {/* ============================================================== */}
          <div className="mb-4 sm:mb-6">
            <AnimatedBicaLogo size="lg" showText={true} />
          </div>

          {/* Tagline / Subtitle */}
          <p className="text-slate-300 text-xs sm:text-sm text-center max-w-lg mb-7 leading-relaxed">
            Hệ thống Quản lý Đào tạo, Theo dõi Tín chỉ, Điểm Rèn Luyện & Giám sát Học vụ Nội bộ
          </p>

          {/* ============================================================== */}
          {/* DUAL PORTAL AUTHENTICATION CARD (2 CỔNG ĐĂNG NHẬP CHÍNH)        */}
          {/* ============================================================== */}
          <div
            className={`w-full max-w-md backdrop-blur-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300 ${
              isPlainSkin
                ? 'bg-gradient-to-b from-[#071432]/95 to-[#040a1d]/95 border border-cyan-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_60px_-10px_rgba(0,180,255,0.22)]'
                : 'bg-gradient-to-b from-[#181626]/95 to-[#0d0c16]/95 border border-violet-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_60px_-10px_rgba(109,40,217,0.28)]'
            }`}
          >
            {/* Top Glowing Trim Line */}
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
                isPlainSkin ? 'via-cyan-400' : 'via-violet-400'
              } to-transparent`}
            />

            {/* Segmented Gateway Switcher (2 Cổng Chính) */}
            <div
              className={`grid grid-cols-2 gap-2 p-1.5 rounded-2xl border mb-5 shadow-inner ${
                isPlainSkin
                  ? 'bg-[#03091a]/95 border-cyan-500/20'
                  : 'bg-[#0a0912]/90 border-violet-500/20'
              }`}
            >
              {/* Tab 1: Cổng Sinh Viên */}
              <button
                type="button"
                onClick={() => {
                  setActivePortal('student');
                  setStudentError(null);
                  setRegError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  activePortal === 'student'
                    ? primaryBtnClass
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Cổng Sinh Viên</span>
              </button>

              {/* Tab 2: Cổng Chủ Nhiệm Ngành / Khoa */}
              <button
                type="button"
                onClick={() => {
                  setActivePortal('teacher');
                  setTeacherError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  activePortal === 'teacher'
                    ? primaryBtnClass
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Cổng Chủ Nhiệm</span>
              </button>
            </div>

            {/* ============================================================ */}
            {/* CỔNG SINH VIÊN BICA (ĐĂNG NHẬP HOẶC ĐĂNG KÝ TÀI KHOẢN MỚI)   */}
            {/* ============================================================ */}
            {activePortal === 'student' && (
              <div>
                {/* Switcher giữa Đăng Nhập, Đăng Ký Tài Khoản và Quên Mật Khẩu */}
                <div
                  className={`flex items-center justify-center space-x-1.5 p-1 rounded-xl border mb-5 ${
                    isPlainSkin
                      ? 'bg-[#03091a]/85 border-cyan-500/20'
                      : 'bg-[#0b0a13]/80 border-violet-500/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStudentAuthMode('login');
                      setStudentError(null);
                      setForgotError(null);
                    }}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                      studentAuthMode === 'login'
                        ? isPlainSkin
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                          : 'bg-violet-500/25 text-violet-200 border border-violet-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>Đăng Nhập</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentAuthMode('register');
                      setRegError(null);
                      setForgotError(null);
                    }}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                      studentAuthMode === 'register'
                        ? isPlainSkin
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                          : 'bg-violet-500/25 text-violet-200 border border-violet-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>Đăng Ký</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentAuthMode('forgot');
                      if (studentInput.trim() && !forgotEmail) {
                        setForgotEmail(studentInput.trim());
                      }
                      setForgotError(null);
                    }}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                      studentAuthMode === 'forgot'
                        ? isPlainSkin
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                          : 'bg-violet-500/25 text-violet-200 border border-violet-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span>Quên Mật Khẩu</span>
                  </button>
                </div>

                {/* FORM 1A: ĐĂNG NHẬP SINH VIÊN */}
                {studentAuthMode === 'login' && (
                  <form onSubmit={handleStudentSubmit} className="space-y-4 animate-in fade-in duration-200">
                    <div className="text-center mb-3">
                      <div className={`inline-flex items-center space-x-1.5 text-xs ${accentTextClass} font-semibold mb-1`}>
                        <UserCheck className="w-4 h-4" />
                        <span>XÁC THỰC SINH VIÊN BICA 2025</span>
                      </div>
                      <p className="text-[11px] text-slate-300/80">
                        Tra cứu tín chỉ, bảng điểm cá nhân, dự báo GPA và nộp minh chứng rèn luyện
                      </p>
                    </div>

                    {/* Error Banner */}
                    {studentError && (
                      <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{studentError}</span>
                      </div>
                    )}

                    {/* Input Email Trường (@st.vju.ac.vn) (Để trống, không điền mẫu) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-200">
                          Email Sinh Viên Trường (@st.vju.ac.vn) <span className="text-rose-400">*</span>
                        </label>
                        <span className={`text-[10px] ${accentTextClass} font-mono`}>Bắt buộc @st.vju.ac.vn</span>
                      </div>
                      <div className="relative">
                        <Mail className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                        <input
                          type="email"
                          required
                          autoComplete="username"
                          value={studentInput}
                          onChange={(e) => setStudentInput(e.target.value)}
                          placeholder="Nhập email trường (@st.vju.ac.vn)..."
                          className={`${inputFieldClass} font-medium`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-300/80 mt-1">
                        Bắt buộc dùng email trường có đuôi @st.vju.ac.vn (Ví dụ: <span className={`${accentTextClass} font-mono`}>25119034@st.vju.ac.vn</span>)
                      </p>
                    </div>

                    {/* Input Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-200">
                          Mật Khẩu Đăng Nhập
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowStudentPassword((prev) => !prev)}
                          className="text-[11px] text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                        >
                          {showStudentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showStudentPassword ? 'Ẩn' : 'Hiện'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                        <input
                          type={showStudentPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          placeholder="Nhập mật khẩu sinh viên..."
                          className={`${inputFieldClass} font-mono`}
                        />
                      </div>
                      <div className="flex items-center justify-end mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (studentInput.trim()) {
                              setForgotEmail(studentInput.trim());
                            }
                            setForgotError(null);
                            setRecoveryResult(null);
                            setStudentAuthMode('forgot');
                          }}
                          className={`text-[11px] ${accentTextClass} hover:opacity-85 font-semibold flex items-center space-x-1 cursor-pointer underline underline-offset-2`}
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Quên mật khẩu? Cấp lại vào Email đã đăng ký</span>
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isStudentLoading}
                      className={`w-full mt-2 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${primaryBtnClass}`}
                    >
                      {isStudentLoading ? (
                        <span className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang kết nối xác thực...</span>
                        </span>
                      ) : (
                        <>
                          <span>Đăng Nhập Cổng Sinh Viên</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Switch to Register Link */}
                    <div className="text-center pt-2">
                      <span className="text-xs text-slate-300">Chưa có tài khoản sinh viên? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentAuthMode('register');
                          setStudentError(null);
                        }}
                        className={`text-xs ${accentTextClass} hover:opacity-85 font-semibold cursor-pointer underline underline-offset-2 ml-1`}
                      >
                        Đăng ký tài khoản ngay
                      </button>
                    </div>
                  </form>
                )}

                {/* FORM 1B: ĐĂNG KÝ TÀI KHOẢN SINH VIÊN */}
                {studentAuthMode === 'register' && (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5 animate-in fade-in duration-200">
                    <div className="text-center mb-3">
                      <div className={`inline-flex items-center space-x-1.5 text-xs ${accentTextClass} font-semibold mb-1`}>
                        <UserPlus className="w-4 h-4" />
                        <span>ĐĂNG KÝ TÀI KHOẢN SINH VIÊN BICA 2025</span>
                      </div>
                      <p className="text-[11px] text-slate-300/80">
                        Đăng ký tài khoản cá nhân để theo dõi tiến độ đào tạo, rèn luyện và tín chỉ
                      </p>
                    </div>

                    {/* Error Banner */}
                    {regError && (
                      <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{regError}</span>
                      </div>
                    )}

                    {/* Success Banner */}
                    {regSuccess && (
                      <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{regSuccess}</span>
                      </div>
                    )}

                    {/* Họ và tên sinh viên */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Họ và tên sinh viên <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <User className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                        <input
                          type="text"
                          required
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder="Nhập họ và tên đầy đủ..."
                          className={`${compactInputFieldClass} font-medium`}
                        />
                      </div>
                    </div>

                    {/* Mã số sinh viên (MSSV) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-200">
                          Mã số sinh viên (MSSV) <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[10px] text-amber-300 font-mono">1 Mã SV = 1 Tài khoản</span>
                      </div>
                      <div className="relative">
                        <IdCard className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                        <input
                          type="text"
                          required
                          value={regStudentId}
                          onChange={(e) => setRegStudentId(e.target.value)}
                          placeholder="Nhập mã số sinh viên (VD: BICA25119001)..."
                          className={`${compactInputFieldClass} font-mono uppercase`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-300/80 mt-1">
                        Mỗi mã số sinh viên chỉ được tạo duy nhất 1 tài khoản trên hệ thống.
                      </p>
                    </div>

                    {/* Email sinh viên trường (@st.vju.ac.vn) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-200">
                          Email Sinh Viên (@st.vju.ac.vn) <span className="text-rose-400">*</span>
                        </label>
                        <span className={`text-[10px] ${accentTextClass} font-mono`}>Bắt buộc @st.vju.ac.vn</span>
                      </div>
                      <div className="relative">
                        <Mail className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="Nhập email trường (@st.vju.ac.vn)..."
                          className={`${compactInputFieldClass} font-medium`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-300/80 mt-1">
                        Bắt buộc dùng email do trường cấp (VD: <span className={`${accentTextClass} font-mono`}>{regStudentId ? regStudentId.toLowerCase() : '25119001'}@st.vju.ac.vn</span>)
                      </p>
                    </div>

                    {/* Mật khẩu */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-200">
                            Mật khẩu <span className="text-rose-400">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowRegPassword((prev) => !prev)}
                            className="text-[10px] text-slate-300 hover:text-white flex items-center space-x-0.5 cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showRegPassword ? 'Ẩn' : 'Hiện'}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-2.5`} />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Tối thiểu 6 ký tự..."
                            className={`${compactInputFieldClass} pr-3 font-mono`}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-200">
                            Xác nhận mật khẩu <span className="text-rose-400">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                            className="text-[10px] text-slate-300 hover:text-white flex items-center space-x-0.5 cursor-pointer"
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showRegConfirmPassword ? 'Ẩn' : 'Hiện'}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-2.5`} />
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            placeholder="Nhập lại mật khẩu..."
                            className={`${compactInputFieldClass} pr-3 font-mono`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Register Button */}
                    <button
                      type="submit"
                      disabled={isRegLoading}
                      className={`w-full mt-2 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${primaryBtnClass}`}
                    >
                      {isRegLoading ? (
                        <span className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang khởi tạo tài khoản học vụ...</span>
                        </span>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Tạo Tài Khoản Sinh Viên Mới</span>
                        </>
                      )}
                    </button>

                    {/* Back to Login Link */}
                    <div className="text-center pt-1.5">
                      <span className="text-xs text-slate-300">Đã có tài khoản sinh viên? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentAuthMode('login');
                          setRegError(null);
                        }}
                        className={`text-xs ${accentTextClass} hover:opacity-85 font-semibold cursor-pointer underline underline-offset-2 ml-1`}
                      >
                        Quay lại Đăng nhập
                      </button>
                    </div>
                  </form>
                )}

                {/* FORM 1C: QUÊN MẬT KHẨU & CẤP LẠI MẬT KHẨU QUA TIN NHẮN GMAIL (CHỐNG MẠO DANH) */}
                {studentAuthMode === 'forgot' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="text-center mb-3">
                      <div className={`inline-flex items-center space-x-1.5 text-xs ${accentTextClass} font-semibold mb-1`}>
                        <KeyRound className="w-4 h-4" />
                        <span>KHÔI PHỤC MẬT KHẨU QUA HỘP THƯ GMAIL</span>
                      </div>
                      <p className="text-[11px] text-slate-300/80">
                        Để chống mạo danh tài khoản, hệ thống tuyệt đối không hiển thị mật khẩu công khai trên web mà chỉ xác thực qua tin nhắn gửi vào hộp thư Gmail (@st.vju.ac.vn).
                      </p>
                    </div>

                    {forgotError && (
                      <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{forgotError}</span>
                      </div>
                    )}

                    {/* BƯỚC 1: GỬI EMAIL KHÔI PHỤC VỀ HỘP THƯ GMAIL */}
                    {!isGmailVerified && (
                      <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-200">
                              Email Đã Đăng Ký Tài Khoản (@st.vju.ac.vn) <span className="text-rose-400">*</span>
                            </label>
                            <span className={`text-[10px] ${accentTextClass} font-mono`}>Chỉ gửi về Gmail chính chủ</span>
                          </div>
                          <div className="relative">
                            <Mail className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                            <input
                              type="email"
                              required
                              value={forgotEmail}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForgotEmail(val);
                                if (
                                  recoveryResult &&
                                  val.trim().toLowerCase() !== recoveryResult.targetEmail.toLowerCase()
                                ) {
                                  setRecoveryResult(null);
                                  setVerifiedTargetEmail('');
                                  setRecoveryTicketId(null);
                                  setIsGmailVerified(false);
                                  clearActiveRecoverySession();
                                }
                              }}
                              placeholder="Nhập chính xác email đã đăng ký (@st.vju.ac.vn)..."
                              className={`${inputFieldClass} font-medium`}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-200">
                              Mã số sinh viên (MSSV) đối chiếu (Tùy chọn)
                            </label>
                            <span className="text-[10px] text-slate-400 font-mono">Xác minh chủ tài khoản</span>
                          </div>
                          <div className="relative">
                            <IdCard className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                            <input
                              type="text"
                              value={forgotStudentId}
                              onChange={(e) => setForgotStudentId(e.target.value)}
                              placeholder="VD: BICA25119034 hoặc 25119034 (để trống nếu quên)..."
                              className={`${inputFieldClass} font-mono uppercase`}
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isForgotLoading}
                          className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${primaryBtnClass}`}
                        >
                          {isForgotLoading ? (
                            <span className="flex items-center space-x-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Đang gửi liên kết bảo mật về hộp thư Gmail...</span>
                            </span>
                          ) : (
                            <>
                              <Mail className="w-4 h-4" />
                              <span>
                                {recoveryResult
                                  ? 'Gửi Lại Tin Nhắn Mới Vào Gmail'
                                  : 'Gửi Tin Nhắn Khôi Phục Vào Gmail Đã Đăng Ký'}
                              </span>
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* BƯỚC 2: XÁC THỰC ĐƯỜNG LINK TỪ TRONG TIN NHẮN GMAIL */}
                    {!isGmailVerified && (
                      <div
                        className={`p-4 rounded-2xl space-y-3 animate-in fade-in duration-200 border ${
                          isPlainSkin
                            ? 'bg-[#040e27]/95 border-cyan-500/30'
                            : 'bg-[#110f1f]/95 border-violet-500/35'
                        }`}
                      >
                        {recoveryResult && (
                          <div className="p-3 bg-emerald-950/45 border border-emerald-500/40 rounded-xl flex items-start space-x-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-emerald-100 leading-relaxed">
                              <p className="font-bold text-emerald-300">
                                Đã gửi tin nhắn khôi phục mật khẩu vào hộp thư Gmail:
                              </p>
                              <p className="font-mono font-bold text-white mt-0.5">
                                {recoveryResult.targetEmail}
                              </p>
                              <p className="text-emerald-200/80 mt-0.5">
                                Chủ tài khoản: <strong>{recoveryResult.studentName}</strong> ({recoveryResult.studentId}) — Mật khẩu được ẩn hoàn toàn trên trang web để chống mạo danh.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isPlainSkin ? 'text-cyan-200' : 'text-violet-200'} flex items-center space-x-1.5`}>
                            <Link2 className={`w-3.5 h-3.5 ${isPlainSkin ? 'text-cyan-400' : 'text-violet-400'}`} />
                            <span>Xác thực đường link trong tin nhắn Gmail</span>
                          </span>
                          <a
                            href="https://mail.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center space-x-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                              isPlainSkin
                                ? 'bg-cyan-600/20 hover:bg-cyan-600/35 text-cyan-200 border-cyan-400/30'
                                : 'bg-violet-600/25 hover:bg-violet-600/40 text-violet-200 border-violet-400/30'
                            }`}
                          >
                            <span>Mở hộp thư Gmail</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        <div
                          className={`text-[11px] text-slate-300/90 space-y-1.5 p-2.5 rounded-xl border leading-relaxed ${
                            isPlainSkin
                              ? 'bg-[#03091a]/85 border-cyan-500/20'
                              : 'bg-[#0b0a14]/80 border-violet-500/20'
                          }`}
                        >
                          <p>
                            <strong className="text-amber-300">Hướng dẫn lấy liên kết trong Gmail:</strong> Khi nhận được thư <em>"Reset Password"</em>, hãy <strong>nhấn chuột phải vào nút "Reset Password"</strong> → chọn <strong>"Sao chép địa chỉ liên kết" (Copy link address)</strong> và dán vào ô dưới đây.
                          </p>
                          <p className={`text-[10px] ${accentTextClass} font-medium`}>
                            • Bảo mật: Mỗi liên kết chỉ sử dụng được <strong>1 lần duy nhất</strong>, có hạn sử dụng <strong>10 phút</strong>, và mã của tài khoản nào chỉ đổi được mật khẩu cho đúng tài khoản đó.
                            {remainingSeconds !== null && remainingSeconds > 0 && (
                              <span className="ml-1.5 text-emerald-300 font-mono font-bold">
                                (Còn hiệu lực: {Math.floor(remainingSeconds / 60)}:
                                {String(remainingSeconds % 60).padStart(2, '0')})
                              </span>
                            )}
                          </p>
                        </div>

                        <form onSubmit={handleVerifyGmailLink} className="space-y-2.5">
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={gmailLinkInput}
                              onChange={(e) => setGmailLinkInput(e.target.value)}
                              placeholder="Dán đường link 'Reset Password' copy từ trong tin nhắn Gmail..."
                              className={`flex-1 px-3 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-mono border ${
                                isPlainSkin
                                  ? 'bg-[#03091a]/95 border-cyan-500/35 focus:border-cyan-400'
                                  : 'bg-[#0b0a14]/95 border-violet-500/35 focus:border-violet-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const text = await navigator.clipboard.readText();
                                  if (text) setGmailLinkInput(text.trim());
                                } catch {
                                  // ignore clipboard permission error
                                }
                              }}
                              className={`px-2.5 py-2 text-[11px] font-semibold rounded-xl border cursor-pointer shrink-0 ${
                                isPlainSkin
                                  ? 'bg-[#071636] hover:bg-[#0b204d] text-cyan-200 border-cyan-500/30'
                                  : 'bg-[#1a172b] hover:bg-[#24203b] text-violet-200 border-violet-500/30'
                              }`}
                            >
                              Dán nhanh
                            </button>
                          </div>

                          <button
                            type="submit"
                            disabled={isVerifyingLink || !gmailLinkInput.trim()}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isVerifyingLink ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang xác thực liên kết từ Gmail...</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4" />
                                <span>Xác Thực Link Từ Gmail & Đặt Mật Khẩu Mới</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    )}

                     {/* BƯỚC 3: CHỈ HIỂN THỊ SAU KHI ĐÃ XÁC THỰC ĐÚNG ĐƯỜNG LINK TRONG TIN NHẮN GMAIL */}
                    {isGmailVerified && (
                      <div className="p-4 bg-emerald-950/45 border border-emerald-500/45 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-emerald-100 leading-relaxed">
                              <p className="font-bold text-emerald-300">
                                {isPasswordResetCompleted
                                  ? 'Đã hoàn tất đổi mật khẩu & vô hiệu hóa liên kết!'
                                  : 'Đã xác thực liên kết bảo mật (Chỉ dùng 1 lần duy nhất)'}
                              </p>
                              <p className="text-[11px] text-slate-300 mt-0.5">
                                Tài khoản khóa cố định theo mã liên kết:{' '}
                                <span className="font-mono font-bold text-white bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/40">
                                  {verifiedTargetEmail}
                                </span>
                              </p>
                            </div>
                          </div>
                          {!isPasswordResetCompleted && remainingSeconds !== null && (
                            <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/30 shrink-0">
                              Hạn: {Math.floor(remainingSeconds / 60)}:
                              {String(remainingSeconds % 60).padStart(2, '0')}
                            </span>
                          )}
                        </div>

                        {!isPasswordResetCompleted ? (
                          <form onSubmit={handleUpdateCustomPassword} className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-semibold text-slate-200">
                                  Nhập mật khẩu mới cho {verifiedTargetEmail} <span className="text-rose-400">*</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setShowCustomNewPass((prev) => !prev)}
                                  className={`text-[11px] ${accentTextClass} hover:text-white flex items-center space-x-1 cursor-pointer`}
                                >
                                  {showCustomNewPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  <span>{showCustomNewPass ? 'Ẩn' : 'Hiện'}</span>
                                </button>
                              </div>
                              <input
                                type={showCustomNewPass ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={customNewPass}
                                onChange={(e) => setCustomNewPass(e.target.value)}
                                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                                className="w-full px-3.5 py-2.5 bg-[#040c21]/95 border border-emerald-500/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-200 mb-1">
                                Xác nhận lại mật khẩu mới <span className="text-rose-400">*</span>
                              </label>
                              <input
                                type={showCustomNewPass ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={confirmNewPass}
                                onChange={(e) => setConfirmNewPass(e.target.value)}
                                placeholder="Nhập lại mật khẩu mới..."
                                className="w-full px-3.5 py-2.5 bg-[#040c21]/95 border border-emerald-500/40 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSavingCustomPass || !customNewPass.trim() || !recoveryTicketId}
                              className={`w-full py-2.5 text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${primaryBtnClass}`}
                            >
                              {isSavingCustomPass ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Đang lưu mật khẩu mới & thu hồi liên kết...</span>
                                </>
                              ) : (
                                <>
                                  <KeyRound className="w-4 h-4" />
                                  <span>Lưu Mật Khẩu Mới (Chỉ Dùng 1 Lần)</span>
                                </>
                              )}
                            </button>
                          </form>
                        ) : (
                          customPassSuccess && (
                            <div className="space-y-3 pt-1">
                              <div className="p-3 bg-emerald-900/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 leading-relaxed">
                                {customPassSuccess}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setStudentError(null);
                                  setIsGmailVerified(false);
                                  setIsPasswordResetCompleted(false);
                                  setRecoveryTicketId(null);
                                  setStudentAuthMode('login');
                                }}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Quay Lại Đăng Nhập Bằng Mật Khẩu Mới Ngay</span>
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentAuthMode('login');
                          setForgotError(null);
                        }}
                        className={`text-xs ${accentTextClass} hover:opacity-85 font-semibold cursor-pointer underline underline-offset-2`}
                      >
                        ← Quay lại màn hình Đăng nhập
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* FORM 2: CỔNG ĐĂNG NHẬP CHỦ NHIỆM NGÀNH / KHOA               */}
            {/* ============================================================ */}
            {activePortal === 'teacher' && (
              <form onSubmit={handleTeacherSubmit} className="space-y-4 animate-in fade-in duration-200">
                <div className="text-center mb-4">
                  <div className={`inline-flex items-center space-x-1.5 text-xs ${accentTextClass} font-semibold mb-1`}>
                    <ShieldCheck className="w-4 h-4" />
                    <span>CỔNG CHỦ NHIỆM NGÀNH & CỐ VẤN HỌC TẬP</span>
                  </div>
                  <p className="text-[11px] text-slate-300/80">
                    Đăng nhập sẽ dẫn thẳng đến <strong>Cổng Cố Vấn / Khoa</strong> để theo dõi toàn bộ sinh viên, cảnh báo học vụ và nạp bảng điểm
                  </p>
                </div>

                {/* Error Banner */}
                {teacherError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{teacherError}</span>
                  </div>
                )}

                {/* Input Email (Để trống, không điền mẫu) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Email Chủ Nhiệm Ngành / Giảng Viên VJU
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      placeholder="Nhập email cán bộ / giảng viên (@vju.ac.vn)..."
                      className={`${inputFieldClass} font-medium`}
                    />
                  </div>
                </div>

                {/* Input Access Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-200">
                      Mật Khẩu Phân Quyền Giảng Viên
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowTeacherPassword((prev) => !prev)}
                      className="text-[11px] text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                    >
                      {showTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showTeacherPassword ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className={`w-4 h-4 ${accentIconClass} absolute left-3.5 top-3`} />
                    <input
                      type={showTeacherPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="Nhập mật khẩu truy cập Chủ nhiệm ngành..."
                      className={`${inputFieldClass} font-mono`}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isTeacherLoading}
                  className={`w-full mt-2 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${primaryBtnClass}`}
                >
                  {isTeacherLoading ? (
                    <span className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xác thực quyền...</span>
                    </span>
                  ) : (
                    <>
                      <Building className="w-4 h-4" />
                      <span>Đăng Nhập Cổng Chủ Nhiệm (Khoa / Cố Vấn)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Note under card */}
            <div
              className={`mt-5 pt-4 border-t text-[11px] text-slate-300/80 text-center flex items-center justify-center space-x-1.5 ${
                isPlainSkin ? 'border-cyan-500/20' : 'border-violet-500/20'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${isPlainSkin ? 'text-cyan-400' : 'text-violet-400'} shrink-0`} />
              <span>Dữ liệu điểm & hồ sơ được đồng bộ bảo mật trực tiếp theo chuẩn đào tạo VJU</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`relative z-20 py-4 border-t text-center text-xs text-slate-400 transition-colors duration-300 ${
          isPlainSkin
            ? 'border-cyan-500/15 bg-[#030819]/85'
            : 'border-violet-500/15 bg-[#080711]/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4">
          © 2025-2026 Khoa Công Nghệ & Kĩ Thuật Tiên Tiến — Trường Đại học Việt Nhật (VJU).
        </div>
      </footer>
    </div>
  );
};
