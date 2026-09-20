import React, { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Calendar,
  Wallet,
  ShieldCheck,
  Plus,
  Save,
  X
} from 'lucide-react';
import type { TuitionRecord } from '../types';
import { supabase } from '../lib/supabase';

interface TuitionTabProps {
  tuitionRecords: TuitionRecord[];
  isSupabaseLive: boolean;
  user?: SupabaseUser | null;
  studentId?: string;
  onDataChanged: () => void;
}

export const TuitionTab: React.FC<TuitionTabProps> = ({
  tuitionRecords,
  isSupabaseLive,
  user,
  studentId = '',
  onDataChanged,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [newTuition, setNewTuition] = useState<Partial<TuitionRecord>>({
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2026-2027',
    tong_so_tin_chi: 18,
    tong_hoc_phi: 16650000,
    mien_giam: 0,
    da_thanh_toan: 0,
    con_no: 16650000,
    han_dong: '2026-10-31',
    trang_thai: 'ChuaThanhToan',
  });

  const totalTuition = tuitionRecords.reduce((sum, t) => sum + (t.tong_hoc_phi || 0), 0);
  const totalPaid = tuitionRecords.reduce((sum, t) => sum + (t.da_thanh_toan || 0), 0);
  const totalDiscount = tuitionRecords.reduce((sum, t) => sum + (t.mien_giam || 0), 0);
  const totalDebt = tuitionRecords.reduce((sum, t) => sum + (t.con_no || 0), 0);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const handleAddTuition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: any = {
        ma_sinh_vien: studentId,
        hoc_ky: newTuition.hoc_ky,
        nam_hoc: newTuition.nam_hoc,
        tong_so_tin_chi: Number(newTuition.tong_so_tin_chi),
        tong_hoc_phi: Number(newTuition.tong_hoc_phi),
        mien_giam: Number(newTuition.mien_giam || 0),
        da_thanh_toan: Number(newTuition.da_thanh_toan || 0),
        con_no: Number(newTuition.con_no || 0),
        han_dong: newTuition.han_dong,
        trang_thai: newTuition.trang_thai,
      };

      if (user?.id) {
        payload.user_id = user.id;
      }

      let { error } = await supabase.from('ho_so_hoc_phi').insert([payload]);
      if (error && error.message?.includes('user_id')) {
        delete payload.user_id;
        const retry = await supabase.from('ho_so_hoc_phi').insert([payload]);
        error = retry.error;
      }

      if (error) {
        setMessage(`Lỗi thêm vào bảng ho_so_hoc_phi: ${error.message}`);
      } else {
        setMessage('Đã thêm kỳ học phí vào Supabase thành công!');
        setIsAdding(false);
        onDataChanged();
      }
    } catch (err: any) {
      setMessage(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span>Hồ Sơ Học Phí & Công Nợ (Bảng ho_so_hoc_phi)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu học phí theo tín chỉ, các đợt thu học phí và trạng thái thanh toán
          </p>
        </div>

        <button
          id="btn-open-add-tuition"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Đợt Học Phí Mới</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium border ${
          message.includes('Lỗi')
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {message}
        </div>
      )}

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleAddTuition} className="bg-white rounded-2xl p-6 border border-blue-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Thêm Đợt Học Phí Mới Vào Supabase (ho_so_hoc_phi)</h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Học kỳ</label>
              <input
                type="text"
                required
                value={newTuition.hoc_ky}
                onChange={(e) => setNewTuition({ ...newTuition, hoc_ky: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Năm học</label>
              <input
                type="text"
                required
                value={newTuition.nam_hoc}
                onChange={(e) => setNewTuition({ ...newTuition, nam_hoc: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Số tín chỉ đăng ký</label>
              <input
                type="number"
                value={newTuition.tong_so_tin_chi}
                onChange={(e) => setNewTuition({ ...newTuition, tong_so_tin_chi: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tổng học phí (VNĐ)</label>
              <input
                type="number"
                step="50000"
                value={newTuition.tong_hoc_phi}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setNewTuition({
                    ...newTuition,
                    tong_hoc_phi: val,
                    con_no: val - (newTuition.da_thanh_toan || 0) - (newTuition.mien_giam || 0)
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Hạn nộp học phí</label>
              <input
                type="date"
                value={newTuition.han_dong}
                onChange={(e) => setNewTuition({ ...newTuition, han_dong: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              id="btn-save-tuition-supabase"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu Đợt Học Phí'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Tổng Học Phí</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {formatVND(totalTuition)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Tổng số tiền học phí phát sinh</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Miễn Giảm / Học Bổng</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-indigo-600">
            {formatVND(totalDiscount)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Chế độ khuyến khích học tập BICA</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Đã Thanh Toán</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600">
            {formatVND(totalPaid)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-2 font-medium">Đã hoàn thành nghĩa vụ tài chính</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Công Nợ Còn Lại</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900">
            {formatVND(totalDebt)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {totalDebt === 0 ? 'Không có công nợ tồn đọng' : 'Cần thanh toán trước hạn'}
          </p>
        </div>
      </div>

      {/* Tuition Invoices List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Danh Sách Các Đợt Thu Học Phí</h3>
          <span className="text-xs text-slate-500">{tuitionRecords.length} đợt ghi nhận</span>
        </div>

        <div className="divide-y divide-slate-100">
          {tuitionRecords.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {user ? 'Chưa có thông tin đợt học phí nào' : 'Chưa đăng nhập tài khoản sinh viên'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {user
                  ? 'Bạn có thể bấm "Thêm Đợt Học Phí Mới" để lưu biểu phí học kỳ của mình.'
                  : 'Vui lòng đăng nhập để xem thông báo và lịch sử học phí của riêng bạn.'}
              </p>
            </div>
          ) : (
            tuitionRecords.map((item, idx) => (
            <div
              key={item.id || item.hoc_ky + idx}
              className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 text-base">
                    {item.hoc_ky} ({item.nam_hoc})
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      item.trang_thai === 'DaHoanThanh'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {item.trang_thai === 'DaHoanThanh' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã nộp đủ
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Chưa thanh toán
                      </>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Số tín chỉ: <strong>{item.tong_so_tin_chi} TC</strong></span>
                  <span>Hạn nộp: <strong className="text-slate-700">{item.han_dong}</strong></span>
                  {item.ma_giao_dich && (
                    <span>Mã giao dịch: <code className="font-mono text-blue-600">{item.ma_giao_dich}</code></span>
                  )}
                  {item.ngay_thanh_toan && (
                    <span>Ngày nộp: <strong className="text-slate-700">{item.ngay_thanh_toan}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-500">Số tiền phải nộp</div>
                  <div className="text-lg font-bold text-slate-900">
                    {formatVND(item.tong_hoc_phi - (item.mien_giam || 0))}
                  </div>
                  {(item.mien_giam || 0) > 0 && (
                    <div className="text-[11px] text-indigo-600">
                      (Đã miễn giảm {formatVND(item.mien_giam!)})
                    </div>
                  )}
                </div>

                {item.trang_thai === 'DaHoanThanh' ? (
                  <div className="px-3.5 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Đã Hoàn Tất</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Chờ Nộp</span>
                  </div>
                )}
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
};
