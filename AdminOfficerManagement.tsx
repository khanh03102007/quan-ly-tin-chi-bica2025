import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Copy,
  Edit2,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  Lock,
  Unlock,
  Plus,
  X,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import type { AuthorizedOfficer } from '../types';
import {
  getAuthorizedOfficers,
  addAuthorizedOfficer,
  updateAuthorizedOfficer,
  type EvaluatorSession
} from '../lib/supabase';

interface AdminOfficerManagementProps {
  evaluator: EvaluatorSession;
  onOfficersChanged?: () => void;
}

export const AdminOfficerManagement: React.FC<AdminOfficerManagementProps> = ({
  evaluator,
  onOfficersChanged
}) => {
  const [officers, setOfficers] = useState<AuthorizedOfficer[]>(() => getAuthorizedOfficers());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<AuthorizedOfficer | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Lớp trưởng BICA K2025');
  const [formPassword, setFormPassword] = useState('');
  const [formPermission, setFormPermission] = useState<'toan_quyen' | 'cham_diem' | 'chi_xem'>('cham_diem');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Notification / Feedback State
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Visible passwords map
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOfficers(getAuthorizedOfficers());
  }, []);

  const refreshList = () => {
    const list = getAuthorizedOfficers();
    setOfficers(list);
    if (onOfficersChanged) onOfficersChanged();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered officers list
  const filteredOfficers = useMemo(() => {
    return officers.filter(item => {
      const matchStatus = filterStatus === 'all' ? true : item.trang_thai === filterStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.ho_va_ten.toLowerCase().includes(q) ||
        item.ma_sinh_vien.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.chuc_vu.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [officers, filterStatus, searchQuery]);

  // Generate random password helper
  const handleGeneratePassword = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generated = `BicaCB2025@${randomNum}`;
    setFormPassword(generated);
  };

  const openCreateModal = () => {
    setEditingOfficer(null);
    setFormName('');
    setFormStudentId('BICA2511');
    setFormEmail('');
    setFormRole('Lớp trưởng BICA K2025');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setFormPassword(`BicaCB2025@${randomNum}`);
    setFormPermission('cham_diem');
    setFormNotes('Thẩm định và tổng hợp điểm rèn luyện của sinh viên lớp');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (officer: AuthorizedOfficer) => {
    setEditingOfficer(officer);
    setFormName(officer.ho_va_ten);
    setFormStudentId(officer.ma_sinh_vien);
    setFormEmail(officer.email);
    setFormRole(officer.chuc_vu);
    setFormPassword(officer.mat_khau);
    setFormPermission(officer.quyen_han);
    setFormNotes(officer.ghi_chu || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formName.trim();
    const studentId = formStudentId.trim().toUpperCase();
    const email = formEmail.trim().toLowerCase();
    const password = formPassword.trim();
    const role = formRole.trim();

    if (!name || !studentId || !email || !password) {
      setFormError('Vui lòng điền đầy đủ Họ tên, Mã sinh viên, Email và Mật khẩu.');
      return;
    }

    if (editingOfficer) {
      // Update
      const updated = updateAuthorizedOfficer(editingOfficer.id, {
        ho_va_ten: name,
        ma_sinh_vien: studentId,
        email,
        chuc_vu: role,
        mat_khau: password,
        quyen_han: formPermission,
        ghi_chu: formNotes.trim()
      });
      setOfficers(updated);
      showToast(`Đã cập nhật thông tin cán bộ "${name}" thành công!`);
    } else {
      // Check duplicate email
      const existing = officers.find(o => o.email.toLowerCase() === email);
      if (existing) {
        setFormError(`Email "${email}" đã được cấp quyền cho cán bộ ${existing.ho_va_ten}.`);
        return;
      }

      addAuthorizedOfficer({
        ho_va_ten: name,
        ma_sinh_vien: studentId,
        email,
        chuc_vu: role,
        mat_khau: password,
        quyen_han: formPermission,
        ghi_chu: formNotes.trim(),
        nguoi_cap: evaluator.name
      });
      refreshList();
      showToast(`Đã cấp quyền thẩm định thành công cho Cán bộ lớp "${name}"!`);
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (officer: AuthorizedOfficer) => {
    const newStatus = officer.trang_thai === 'active' ? 'suspended' : 'active';
    const updated = updateAuthorizedOfficer(officer.id, { trang_thai: newStatus });
    setOfficers(updated);
    showToast(
      newStatus === 'active'
        ? `Đã kích hoạt lại quyền cho cán bộ ${officer.ho_va_ten}.`
        : `Đã tạm khóa quyền thẩm định của cán bộ ${officer.ho_va_ten}.`
    );
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCredentials = (officer: AuthorizedOfficer) => {
    const textToCopy = `[BICA 2025 - THÔNG TIN TÀI KHOẢN THẨM ĐỊNH ĐIỂM RÈN LUYỆN]\n- Họ và tên: ${officer.ho_va_ten}\n- Chức vụ: ${officer.chuc_vu}\n- Tài khoản/Email: ${officer.email}\n- Mật khẩu thẩm định: ${officer.mat_khau}\n- Cổng đăng nhập: Tab Quản Lý Rèn Luyện -> Khu Vực Thẩm Định Minh Chứng`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopyFeedback(officer.id);
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const activeCount = officers.filter(o => o.trang_thai === 'active').length;
  const suspendedCount = officers.filter(o => o.trang_thai === 'suspended').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner & Super Admin Info */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-indigo-900/50 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
              <span>ĐẶC QUYỀN QUẢN TRỊ VIÊN HỆ THỐNG (SUPER ADMIN)</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Phân Quyền Thẩm Định Minh Chứng Cho Cán Bộ Lớp
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Quản trị viên hệ thống (Admin Web) có thẩm quyền ủy quyền cho Lớp trưởng, Bí thư chi đoàn hoặc Ban cán sự lớp tham gia chấm duyệt, xem ảnh minh chứng rèn luyện của sinh viên BICA 2025.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={refreshList}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm Mới</span>
            </button>
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Cấp Quyền Cán Bộ Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">Tổng Cán Bộ Cấp Quyền</p>
            <p className="text-xl font-bold text-slate-800">{officers.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">Đang Hoạt Động (Active)</p>
            <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">Tạm Khóa Quyền (Suspended)</p>
            <p className="text-xl font-bold text-amber-600">{suspendedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên cán bộ, MSV, email, chức vụ..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 hidden sm:inline">Trạng thái:</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({officers.length})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'active' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kích hoạt ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus('suspended')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'suspended' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạm khóa ({suspendedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Table of Authorized Officers */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Danh Sách Cán Bộ Lớp Được Phân Quyền Thẩm Định
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Hiển thị {filteredOfficers.length} cán bộ
          </span>
        </div>

        {filteredOfficers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">Chưa tìm thấy cán bộ lớp nào</p>
            <p className="text-xs mt-1 text-slate-400">Nhấn "+ Cấp Quyền Cán Bộ Mới" để thêm cán bộ lớp vào hội đồng thẩm định</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Cán Bộ Lớp</th>
                  <th className="py-3 px-4">Chức Vụ</th>
                  <th className="py-3 px-4">Tài Khoản Đăng Nhập</th>
                  <th className="py-3 px-4">Mật Khẩu Cấp Quyền</th>
                  <th className="py-3 px-4">Phạm Vi Quyền</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficers.map(officer => {
                  const isPassVisible = !!visiblePasswords[officer.id];
                  const isCopied = copyFeedback === officer.id;

                  return (
                    <tr key={officer.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Cán Bộ */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {officer.ho_va_ten.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{officer.ho_va_ten}</div>
                            <div className="text-[11px] font-mono text-slate-400">{officer.ma_sinh_vien}</div>
                          </div>
                        </div>
                      </td>

                      {/* Chức vụ */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                          {officer.chuc_vu}
                        </span>
                        {officer.ghi_chu && (
                          <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate" title={officer.ghi_chu}>
                            {officer.ghi_chu}
                          </div>
                        )}
                      </td>

                      {/* Tài khoản Email */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {officer.email}
                      </td>

                      {/* Mật khẩu */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 font-mono">
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200 text-xs">
                            {isPassVisible ? officer.mat_khau : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(officer.id)}
                            title={isPassVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(officer)}
                            title="Sao chép thông tin tài khoản để gửi cho cán bộ"
                            className="p-1 text-indigo-600 hover:text-indigo-800 rounded transition-colors"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {isCopied && (
                          <div className="text-[10px] text-emerald-600 mt-0.5 font-sans font-medium">
                            Đã chép thông tin!
                          </div>
                        )}
                      </td>

                      {/* Phạm vi quyền */}
                      <td className="py-3.5 px-4">
                        {officer.quyen_han === 'toan_quyen' && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Toàn quyền duyệt
                          </span>
                        )}
                        {officer.quyen_han === 'cham_diem' && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Duyệt & Chấm điểm
                          </span>
                        )}
                        {officer.quyen_han === 'chi_xem' && (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                            Chỉ xem minh chứng
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(officer)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                            officer.trang_thai === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              officer.trang_thai === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span>{officer.trang_thai === 'active' ? 'Đang kích hoạt' : 'Tạm khóa'}</span>
                        </button>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(officer)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Chỉnh sửa thông tin phân quyền"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info note */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center space-x-1.5">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              Cán bộ lớp sau khi được cấp quyền có thể dùng chính <strong>Email</strong> và <strong>Mật khẩu</strong> trên để đăng nhập trực tiếp vào Khu vực thẩm định.
            </span>
          </div>
          <span className="font-mono text-slate-400">
            Người cấp quyền: Ban Quản Trị Hệ Thống (Admin Web)
          </span>
        </div>
      </div>

      {/* Modal Cấp Quyền / Chỉnh Sửa Cán Bộ Lớp */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingOfficer ? 'Chỉnh Sửa Quyền Cán Bộ Lớp' : 'Cấp Quyền Thẩm Định Minh Chứng Mới'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Ủy quyền thẩm định điểm rèn luyện sinh viên BICA 2025</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficer} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Họ và Tên Cán Bộ *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Nam"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã Sinh Viên Cán Bộ *
                  </label>
                  <input
                    type="text"
                    required
                    value={formStudentId}
                    onChange={e => setFormStudentId(e.target.value)}
                    placeholder="VD: BICA25119001"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chức Vụ Trong Lớp *
                  </label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Lớp trưởng BICA K2025">Lớp trưởng BICA K2025</option>
                    <option value="Lớp phó học tập BICA">Lớp phó học tập BICA</option>
                    <option value="Bí thư Chi đoàn BICA">Bí thư Chi đoàn BICA</option>
                    <option value="Phó Bí thư Chi đoàn">Phó Bí thư Chi đoàn</option>
                    <option value="Ủy viên Ban cán sự lớp">Ủy viên Ban cán sự lớp</option>
                    <option value="Trưởng ban Phong trào & TN">Trưởng ban Phong trào & TN</option>
                    <option value="Cán bộ thẩm định điểm rèn luyện">Cán bộ thẩm định điểm rèn luyện</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phạm Vi Quyền Hạn *
                  </label>
                  <select
                    value={formPermission}
                    onChange={e => setFormPermission(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="cham_diem">Duyệt & Chấm điểm rèn luyện</option>
                    <option value="toan_quyen">Toàn quyền thẩm định & ghi nhận</option>
                    <option value="chi_xem">Chỉ xem minh chứng (Không chấm điểm)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Đăng Nhập Cán Bộ (VJU / Cá nhân) *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="VD: nam.nv25@st.vju.ac.vn"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mật Khẩu Cấp Quyền Đăng Nhập *
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Tạo mật khẩu ngẫu nhiên</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder="Nhập mật khẩu cho cán bộ..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Cán bộ sẽ nhập Email và Mật khẩu này tại khu vực đăng nhập thẩm định minh chứng.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi Chú Phân Công / Lĩnh Vực Phụ Trách
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Ghi chú phân công công tác thẩm định..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{editingOfficer ? 'Lưu Thay Đổi' : 'Xác Nhận Cấp Quyền'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
