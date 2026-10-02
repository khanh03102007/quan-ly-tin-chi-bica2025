import React, { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  LifeBuoy,
  Mail,
  UserCheck,
  ShieldCheck,
  Send,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  FileQuestion,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import type { StudentProfile } from '../types';

interface SupportTabProps {
  profile: StudentProfile;
  user?: SupabaseUser | null;
}

export const SupportTab: React.FC<SupportTabProps> = ({ profile, user }) => {
  const adminName = 'Trần Duy Khánh';
  const supportEmail = 'hotrotaikhoanbica2025@gmail.com';

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    senderName: profile.ho_va_ten || '',
    studentId: profile.ma_sinh_vien || '',
    senderEmail: profile.email || user?.email || '',
    phone: profile.so_dien_thoai || '',
    category: 'Điểm số & Tín chỉ',
    priority: 'Bình thường',
    subject: '',
    message: '',
  });

  const categories = [
    'Điểm số & Tín chỉ',
    'Thời khóa biểu & Lớp học',
    'Học phí & Công nợ',
    'Tài khoản & Đăng nhập Supabase',
    'Khung chương trình BICA K2025',
    'Sự cố kỹ thuật / Góp ý khác',
  ];

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const generateEmailDraft = () => {
    return `Kính gửi Quản trị viên: ${adminName} (BICA 2025 Support),

Tôi là: ${formData.senderName || 'Sinh viên BICA'}
Mã số sinh viên: ${formData.studentId || 'Chưa cập nhật'}
Email liên hệ: ${formData.senderEmail || 'Chưa có'}
Số điện thoại: ${formData.phone || 'Chưa cung cấp'}

--- THÔNG TIN SỰ CỐ / CÂU HỎI ---
Phân loại: ${formData.category}
Mức độ ưu tiên: ${formData.priority}
Tiêu đề: ${formData.subject || 'Câu hỏi cần hỗ trợ'}

Nội dung chi tiết:
${formData.message || 'Mô tả chi tiết câu hỏi hoặc sự cố gặp phải...'}

--------------------------------
Gửi từ: Hệ Thống Theo Dõi Tín Chỉ BICA 2025 Portal
Thời gian: ${new Date().toLocaleString('vi-VN')}
`;
  };

  const handleCopyDraft = () => {
    const draft = generateEmailDraft();
    navigator.clipboard.writeText(draft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 3000);
  };

  const handleSendMailto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung câu hỏi sự cố.');
      return;
    }

    const emailSubject = encodeURIComponent(
      `[BICA 2025 Hỗ Trợ - ${formData.category}] ${formData.studentId ? `[${formData.studentId}]` : ''} ${formData.subject}`
    );
    const emailBody = encodeURIComponent(generateEmailDraft());

    // Kích hoạt link mailto
    window.location.href = `mailto:${supportEmail}?subject=${emailSubject}&body=${emailBody}`;
    setIsSubmitted(true);
  };

  const handleOpenGmailWeb = () => {
    if (!formData.subject.trim() || !formData.message.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung câu hỏi sự cố trước khi mở Gmail.');
      return;
    }

    const emailSubject = encodeURIComponent(
      `[BICA 2025 Hỗ Trợ - ${formData.category}] ${formData.studentId ? `[${formData.studentId}]` : ''} ${formData.subject}`
    );
    const emailBody = encodeURIComponent(generateEmailDraft());
    const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${supportEmail}&su=${emailSubject}&body=${emailBody}`;
    
    window.open(webGmailUrl, '_blank');
    setIsSubmitted(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">TIẾP NHẬN YÊU CẦU & HỖ TRỢ HỌC VỤ SINH VIÊN</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300">
                Trực tuyến
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ xử lý thắc mắc điểm số, thời khóa biểu, tài khoản và kỹ thuật hệ thống nội bộ
            </p>
          </div>
        </div>

        {/* Quick Email Contact Badge */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 p-2 rounded-md text-xs">
          <Mail className="w-4 h-4 text-blue-700 ml-1 shrink-0" />
          <span className="font-mono text-slate-800">{supportEmail}</span>
          <button
            id="btn-copy-support-email-header"
            onClick={handleCopyEmail}
            className="p-1 text-slate-500 hover:text-slate-900 transition-colors rounded hover:bg-slate-200"
            title="Sao chép email hỗ trợ"
          >
            {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Admin Profile & Contact Information */}
        <div className="space-y-6">
          {/* Card: Thông tin Quản trị viên & Kênh Hỗ trợ */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Quản trị viên phụ trách</span>
              </h3>
              <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Phòng Đào tạo / Bộ môn
              </span>
            </div>

            {/* Admin Avatar & Details */}
            <div className="flex items-center space-x-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div className="w-10 h-10 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-sm font-mono shrink-0">
                DK
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] text-slate-500">Phụ trách kỹ thuật & cơ sở dữ liệu</div>
                <div className="text-sm font-bold text-slate-900">{adminName}</div>
                <div className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  <span>Cổng SV02 Portal</span>
                </div>
              </div>
            </div>

            {/* Support Email Card with Actions */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Địa Chỉ Email Hỗ Trợ
              </label>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="font-mono text-xs font-bold text-slate-900">{supportEmail}</span>
                  </div>
                  <button
                    id="btn-copy-support-email-card"
                    onClick={handleCopyEmail}
                    className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Mọi thắc mắc và sự cố sẽ được phản hồi trực tiếp qua hòm thư này.
                </p>
              </div>
            </div>

            {/* Cam kết thời gian phản hồi */}
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start space-x-2.5 text-slate-600">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">Thời gian phản hồi:</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Thông thường từ 2 - 12 giờ làm việc (tất cả các ngày trong tuần).
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 text-slate-600">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">Phạm vi hỗ trợ:</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đính chính bảng điểm, điều chỉnh tiến độ tín chỉ, giải đáp biểu phí, cấp quyền tài khoản.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hướng Dẫn Nhanh */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
            <h4 className="font-bold text-xs text-slate-900 flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-blue-700" />
              <span>Lưu ý khi gửi yêu cầu hỗ trợ</span>
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>
                Ghi rõ <strong>Mã Số Sinh Viên (MSSV)</strong> và tên môn học để đối soát dữ liệu trên Supabase.
              </li>
              <li>
                Nếu là lỗi điểm số, vui lòng ghi rõ điểm thành phần (chuyên cần, giữa kỳ, cuối kỳ) có sai lệch.
              </li>
              <li>
                Sinh viên có thể bấm <strong>"Mở Gmail Web"</strong> để chuyển trực tiếp nội dung sang giao diện gửi thư.
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Biểu Mẫu Câu Hỏi Sự Cố (Form) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <FileQuestion className="w-5 h-5 text-blue-600" />
                  <span>Biểu Mẫu Câu Hỏi Sự Cố Gửi Đến Admin</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điền đầy đủ thông tin bên dưới để gửi câu hỏi trực tiếp đến <strong className="text-slate-800">{supportEmail}</strong>
                </p>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                Mẫu chuẩn BICA
              </span>
            </div>

            {/* Thông báo gửi thành công nếu có */}
            {isSubmitted && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-3 text-emerald-900 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-950">Yêu Cầu Đã Được Chuẩn Bị Thành Công!</h4>
                  <p className="text-xs text-emerald-800">
                    Ứng dụng thư điện tử của bạn đã được mở để gửi tới <strong>{supportEmail}</strong>. Bạn cũng có thể bấm nút <strong>"Sao Chép Nội Dung Thư"</strong> bên dưới để dán vào Webmail bất cứ lúc nào.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSendMailto} className="space-y-4">
              {/* Sinh viên & MSSV */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Họ và Tên Sinh Viên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.senderName}
                    onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                    placeholder="VD: Nguyễn Cao Nam"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Mã Số Sinh Viên (MSSV) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="VD: 25119099"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Email & Số điện thoại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Email Sinh Viên Để Nhận Phản Hồi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.senderEmail}
                    onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                    placeholder="VD: 25119099@st.vju.ac.vn"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Số Điện Thoại Liên Hệ (Tùy chọn)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="VD: 0912 345 678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Phân loại & Mức độ ưu tiên */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Phân Loại Vấn Đề <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Mức Độ Cần Thiết
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  >
                    <option value="Bình thường">Bình thường (12-24h)</option>
                    <option value="Khẩn cấp">Khẩn cấp (cần sửa trước thời hạn đăng ký/thi)</option>
                  </select>
                </div>
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Tiêu Đề Câu Hỏi / Sự Cố <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="VD: Cần đối soát lại điểm môn Toán Rời Rạc học kỳ 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Nội dung chi tiết */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Mô Tả Chi Tiết Nội Dung Sự Cố Hoặc Câu Hỏi <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Vui lòng mô tả chi tiết: Mã môn học, lớp học phần, điểm số hiện tại và điểm số mong muốn điều chỉnh, hoặc lỗi cụ thể bạn đang gặp phải..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors leading-relaxed"
                />
              </div>

              {/* Preview Bản Thư Dự Thảo */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Địa chỉ nhận: <code className="font-mono text-blue-700 font-bold">{supportEmail}</code> ({adminName})
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="inline-flex items-center space-x-1 text-slate-600 hover:text-blue-600 font-semibold"
                  >
                    {copiedDraft ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Đã sao chép nội dung thư!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép nội dung thư</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCopyDraft}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copiedDraft ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenGmailWeb}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-md transition-colors shadow-2xs flex items-center space-x-1.5"
                  title="Mở thư mục soạn thảo của Gmail trên trình duyệt"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mở Gmail Web</span>
                </button>

                <button
                  id="btn-submit-support-form"
                  type="submit"
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-md transition-colors shadow-2xs flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi yêu cầu hỗ trợ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
