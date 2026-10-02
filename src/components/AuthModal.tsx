import React, { useState } from 'react';
import { X, Mail, Lock, User, IdCard, AlertCircle, CheckCircle2, Loader2, KeyRound, ExternalLink, Link2 } from 'lucide-react';
import {
  supabase,
  signInWithPassword,
  signUp,
  ensureStudentInHoSo,
  purgeStudentFromLocalStorage,
  signOut,
  requestPasswordRecoveryToRegisteredEmail,
  verifyGmailRecoveryLinkOrOtp,
  updateStudentAccountPassword,
} from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const isLoginMode = authMode === 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reissuedInfo, setReissuedInfo] = useState<{
    targetEmail: string;
    studentName: string;
    studentId: string;
  } | null>(null);
  const [gmailLinkInput, setGmailLinkInput] = useState('');
  const [isGmailVerified, setIsGmailVerified] = useState(false);
  const [recoveryTicketId, setRecoveryTicketId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setReissuedInfo(null);
    setIsGmailVerified(false);
    setRecoveryTicketId(null);
    setLoading(true);

    if (authMode === 'forgot') {
      const res = await requestPasswordRecoveryToRegisteredEmail(email, studentId || undefined);
      setLoading(false);
      if (!res.success || !res.targetEmail) {
        setErrorMessage(res.error || 'Không thể gửi email khôi phục mật khẩu cho địa chỉ này.');
      } else {
        setSuccessMessage(
          `Đã gửi liên kết khôi phục mật khẩu tới hộp thư Gmail: ${res.targetEmail}. Mật khẩu được ẩn trên web để chống mạo danh.`
        );
        setReissuedInfo({
          targetEmail: res.targetEmail,
          studentName: res.studentName || 'Sinh viên BICA',
          studentId: res.studentId || '',
        });
      }
      return;
    }

    if (isLoginMode) {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await signInWithPassword(cleanEmail, password);
      if (error) {
        setLoading(false);
        setErrorMessage(error);
      } else {
        // Kiểm tra xem hồ sơ sinh viên còn tồn tại trong bảng public.ho_so trên Supabase không
        const metaMsv = String(data?.user?.user_metadata?.ma_sinh_vien || '').trim().toUpperCase();
        const { data: hoSoByEmail } = await supabase
          .from('ho_so')
          .select('ma_sinh_vien')
          .ilike('email', cleanEmail)
          .maybeSingle();
        let existsInHoSo = Boolean(hoSoByEmail);
        if (!existsInHoSo && metaMsv) {
          const { data: hoSoById } = await supabase
            .from('ho_so')
            .select('ma_sinh_vien')
            .ilike('ma_sinh_vien', metaMsv)
            .maybeSingle();
          existsInHoSo = Boolean(hoSoById);
        }

        if (!existsInHoSo) {
          purgeStudentFromLocalStorage(metaMsv, cleanEmail);
          await signOut();
          setLoading(false);
          setErrorMessage(
            'Hồ sơ sinh viên này đã bị xóa khỏi cơ sở dữ liệu Supabase. Vui lòng đăng ký lại tài khoản mới.'
          );
          return;
        }

        setLoading(false);
        setSuccessMessage('Đăng nhập Supabase thành công!');
        setTimeout(() => {
          onAuthSuccess();
          onClose();
        }, 800);
      }
    } else {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const cleanId = studentId.trim().toUpperCase();
      const { data, error } = await signUp(cleanEmail, password, cleanName, cleanId);
      await ensureStudentInHoSo({
        ma_sinh_vien: cleanId,
        ho_va_ten: cleanName,
        email: cleanEmail,
      });
      setLoading(false);
      if (error && !(data as any)?.hoSoSynced) {
        setErrorMessage(error);
      } else {
        setSuccessMessage(
          'Đăng ký tài khoản và đồng bộ hồ sơ lên Supabase thành công!'
        );
        setTimeout(() => {
          onAuthSuccess();
          onClose();
        }, 1200);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            id="btn-close-auth-modal"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold tracking-tight">
            {authMode === 'login'
              ? 'Đăng Nhập Cổng Sinh Viên'
              : authMode === 'register'
              ? 'Đăng Ký Tài Khoản Mới'
              : 'Cấp Lại Mật Khẩu Qua Email'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {authMode === 'forgot'
              ? 'Xác thực & cấp lại mật khẩu vào chính Email đã đăng ký (@st.vju.ac.vn)'
              : 'Xác thực trực tiếp với Supabase Auth (Khóa 2025 BICA)'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {reissuedInfo && authMode === 'forgot' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>
                  Chủ tài khoản: <strong className="text-slate-900">{reissuedInfo.studentName}</strong> ({reissuedInfo.studentId})
                </span>
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  <span>Mở Gmail</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {!isGmailVerified ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-600">
                    Chuột phải vào nút <strong>"Reset Password"</strong> trong tin nhắn Gmail → chọn <strong>"Sao chép địa chỉ liên kết"</strong> rồi dán vào đây để xác thực:
                  </p>
                  <div className="flex items-center space-x-1.5">
                    <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={gmailLinkInput}
                      onChange={(e) => setGmailLinkInput(e.target.value)}
                      placeholder="Dán link 'Reset Password' từ Gmail..."
                      className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const currentEmailClean = email.trim().toLowerCase();
                      if (currentEmailClean !== reissuedInfo.targetEmail.trim().toLowerCase()) {
                        setErrorMessage(
                          `Từ chối bảo mật: Mã khôi phục này được yêu cầu cho "${reissuedInfo.targetEmail}", không thể dùng cho "${currentEmailClean}".`
                        );
                        return;
                      }
                      const res = await verifyGmailRecoveryLinkOrOtp(currentEmailClean, gmailLinkInput);
                      if (!res.success || !res.recoveryTicket) {
                        setErrorMessage(res.error || 'Link xác thực không hợp lệ hoặc đã được sử dụng.');
                      } else {
                        setErrorMessage(null);
                        setRecoveryTicketId(res.recoveryTicket);
                        setIsGmailVerified(true);
                      }
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors"
                  >
                    Xác Thực Link Từ Gmail
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!recoveryTicketId) {
                        setErrorMessage('Liên kết khôi phục đã được sử dụng (chỉ dùng 1 lần duy nhất).');
                        return;
                      }
                      const upd = await updateStudentAccountPassword(
                        reissuedInfo.targetEmail,
                        newPassword,
                        undefined,
                        recoveryTicketId
                      );
                      if (!upd.success) {
                        setErrorMessage(upd.error || 'Lỗi lưu mật khẩu mới.');
                      } else {
                        setRecoveryTicketId(null);
                        setIsGmailVerified(false);
                        setReissuedInfo(null);
                        setEmail(reissuedInfo.targetEmail);
                        setPassword(newPassword.trim());
                        setNewPassword('');
                        setErrorMessage(null);
                        setSuccessMessage('Đã đặt mật khẩu mới thành công (liên kết đã thu hồi sau 1 lần dùng)! Nhấn Đăng Nhập Ngay.');
                        setAuthMode('login');
                      }
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors"
                  >
                    Lưu Mật Khẩu Mới & Quay Lại Đăng Nhập
                  </button>
                </div>
              )}
            </div>
          )}

          {authMode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Họ và tên sinh viên
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="input-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mã số sinh viên (MSSV)
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="input-student-id"
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="VD: 25119001 hoặc BICA25119001"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {authMode === 'forgot'
                ? 'Email sinh viên đã đăng ký tài khoản (@st.vju.ac.vn)'
                : 'Email trường / tài khoản Supabase'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                id="input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email sinh viên (@st.vju.ac.vn)..."
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {authMode === 'forgot' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mã số sinh viên đối chiếu (Tùy chọn)
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="VD: BICA25119034 (để trống nếu quên)..."
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {authMode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Mật khẩu
                </label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setReissuedInfo(null);
                      setAuthMode('forgot');
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Quên mật khẩu?</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="input-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <button
            id="btn-submit-auth"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs flex items-center justify-center space-x-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý qua Supabase...</span>
              </>
            ) : (
              <span>
                {authMode === 'login'
                  ? 'Đăng Nhập Ngay'
                  : authMode === 'register'
                  ? 'Tạo Tài Khoản Mới'
                  : 'Cấp Lại Mật Khẩu Về Email Đã Đăng Ký'}
              </span>
            )}
          </button>

          <div className="pt-2 text-center space-y-2">
            <button
              id="btn-toggle-auth-mode"
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setErrorMessage(null);
                setSuccessMessage(null);
                setReissuedInfo(null);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              {authMode === 'login'
                ? 'Chưa có tài khoản? Nhấn để Đăng Ký'
                : 'Đã có tài khoản? Nhấn để quay lại Đăng Nhập'}
            </button>
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Thầy là Chủ nhiệm ngành? Vui lòng sử dụng tab <strong className="text-indigo-600 font-semibold">Cổng Chủ Nhiệm Ngành</strong> trên thanh điều hướng để đăng nhập tài khoản quản trị.
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
