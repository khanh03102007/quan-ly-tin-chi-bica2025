import React, { useState } from 'react';
import { X, Mail, Lock, User, IdCard, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { signInWithPassword, signUp } from '../lib/supabase';

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
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    if (isLoginMode) {
      const { data, error } = await signInWithPassword(email, password);
      setLoading(false);
      if (error) {
        setErrorMessage(error);
      } else {
        setSuccessMessage('Đăng nhập Supabase thành công!');
        setTimeout(() => {
          onAuthSuccess();
          onClose();
        }, 800);
      }
    } else {
      const { data, error } = await signUp(email, password, fullName, studentId);
      setLoading(false);
      if (error) {
        setErrorMessage(error);
      } else {
        setSuccessMessage(
          'Đăng ký tài khoản Supabase thành công! Nếu cần xác nhận email, vui lòng kiểm tra hộp thư.'
        );
        setTimeout(() => {
          onAuthSuccess();
          onClose();
        }, 1500);
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
            {isLoginMode ? 'Đăng Nhập Cổng Sinh Viên' : 'Đăng Ký Tài Khoản Mới'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Xác thực trực tiếp với Supabase Auth (Khóa 2025 BICA)
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

          {!isLoginMode && (
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
              Email trường / tài khoản Supabase
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                id="input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sinhvien@st.vju.ac.vn"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mật khẩu
            </label>
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
              <span>{isLoginMode ? 'Đăng Nhập Ngay' : 'Tạo Tài Khoản Mới'}</span>
            )}
          </button>

          <div className="pt-2 text-center">
            <button
              id="btn-toggle-auth-mode"
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              {isLoginMode
                ? 'Chưa có tài khoản? Nhấn để Đăng Ký'
                : 'Đã có tài khoản? Nhấn để Đăng Nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
