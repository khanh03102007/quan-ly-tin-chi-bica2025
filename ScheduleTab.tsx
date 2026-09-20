import React, { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Video,
  Plus,
  Save,
  X,
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  Trash2,
  BookOpen,
} from 'lucide-react';
import type { ScheduleItem } from '../types';
import { supabase } from '../lib/supabase';
import { BICA_CURRICULUM } from '../data/bicaCurriculum';

interface ScheduleTabProps {
  schedule: ScheduleItem[];
  isSupabaseLive: boolean;
  user?: SupabaseUser | null;
  studentId?: string;
  onDataChanged: () => void;
}

// Khung giờ các tiết học chuẩn ĐHQGHN / VJU
const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '07:00', end: '07:50' },
  2: { start: '07:55', end: '08:45' },
  3: { start: '08:50', end: '09:40' },
  4: { start: '09:45', end: '10:35' },
  5: { start: '10:40', end: '11:30' },
  6: { start: '11:35', end: '12:25' },
  7: { start: '12:30', end: '13:20' },
  8: { start: '13:25', end: '14:15' },
  9: { start: '14:20', end: '15:10' },
  10: { start: '15:15', end: '16:05' },
  11: { start: '16:10', end: '17:00' },
  12: { start: '17:05', end: '17:55' },
};

const calculateTimes = (startPeriod: number, periodCount: number) => {
  const start = PERIOD_TIMES[startPeriod]?.start || '07:00';
  const endPeriod = Math.min(12, startPeriod + periodCount - 1);
  const end = PERIOD_TIMES[endPeriod]?.end || '09:40';
  return { start, end };
};

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  schedule,
  isSupabaseLive,
  user,
  studentId = '',
  onDataChanged,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = all days
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const days = [
    { num: 0, label: 'Cả Tuần' },
    { num: 2, label: 'Thứ 2' },
    { num: 3, label: 'Thứ 3' },
    { num: 4, label: 'Thứ 4' },
    { num: 5, label: 'Thứ 5' },
    { num: 6, label: 'Thứ 6' },
    { num: 7, label: 'Thứ 7' },
  ];

  const [newSchedule, setNewSchedule] = useState<Partial<ScheduleItem>>({
    ma_hoc_phan: '',
    ten_hoc_phan: '',
    thu: 2,
    tiet_bat_dau: 1,
    so_tiet: 3,
    gio_bat_dau: '07:00',
    gio_ket_thuc: '09:40',
    phong_hoc: '',
    giang_vien: '',
    hinh_thuc: 'TrucTiep',
    ghi_chu: '',
  });

  // Chọn nhanh môn học từ Khung CTĐT BICA
  const handleSelectQuickCourse = (courseCode: string) => {
    if (!courseCode) return;
    const found = BICA_CURRICULUM.find((c) => c.ma_hoc_phan === courseCode);
    if (found) {
      setNewSchedule((prev) => ({
        ...prev,
        ma_hoc_phan: found.ma_hoc_phan,
        ten_hoc_phan: found.ten_hoc_phan,
      }));
    }
  };

  const handlePeriodChange = (start: number, count: number) => {
    const { start: startTime, end: endTime } = calculateTimes(start, count);
    setNewSchedule((prev) => ({
      ...prev,
      tiet_bat_dau: start,
      so_tiet: count,
      gio_bat_dau: startTime,
      gio_ket_thuc: endTime,
    }));
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.ma_hoc_phan || !newSchedule.ten_hoc_phan) {
      setMessage('Vui lòng nhập hoặc chọn mã học phần và tên môn học');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload: any = {
        ma_sinh_vien: studentId,
        ma_hoc_phan: newSchedule.ma_hoc_phan,
        ten_hoc_phan: newSchedule.ten_hoc_phan,
        thu: Number(newSchedule.thu),
        tiet_bat_dau: Number(newSchedule.tiet_bat_dau),
        so_tiet: Number(newSchedule.so_tiet),
        gio_bat_dau: newSchedule.gio_bat_dau || '07:00',
        gio_ket_thuc: newSchedule.gio_ket_thuc || '09:40',
        phong_hoc: newSchedule.phong_hoc || 'Đang cập nhật',
        giang_vien: newSchedule.giang_vien || 'Giảng viên khoa BICA',
        hinh_thuc: newSchedule.hinh_thuc || 'TrucTiep',
        ghi_chu: newSchedule.ghi_chu || '',
      };

      if (user?.id) {
        payload.user_id = user.id;
      }

      let { error } = await supabase.from('lich_trinh').insert([payload]);
      if (error && error.message?.includes('user_id')) {
        delete payload.user_id;
        const retry = await supabase.from('lich_trinh').insert([payload]);
        error = retry.error;
      }

      if (error) {
        setMessage(`Lỗi thêm vào bảng lich_trinh: ${error.message}`);
      } else {
        setMessage('Đã thêm tiết học vào thời khóa biểu thành công!');
        setIsAdding(false);
        setNewSchedule({
          ma_hoc_phan: '',
          ten_hoc_phan: '',
          thu: 2,
          tiet_bat_dau: 1,
          so_tiet: 3,
          gio_bat_dau: '07:00',
          gio_ket_thuc: '09:40',
          phong_hoc: '',
          giang_vien: '',
          hinh_thuc: 'TrucTiep',
          ghi_chu: '',
        });
        onDataChanged();
      }
    } catch (err: any) {
      setMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (item: ScheduleItem) => {
    if (!item.id && !item.ma_hoc_phan) return;
    setDeletingId(item.id || item.ma_hoc_phan);
    try {
      let query = supabase.from('lich_trinh').delete();
      if (item.id) {
        query = query.eq('id', item.id);
      } else {
        query = query.eq('ma_hoc_phan', item.ma_hoc_phan).eq('thu', item.thu);
      }
      const { error } = await query;
      if (error) {
        setMessage(`Lỗi xóa lịch học: ${error.message}`);
      } else {
        setMessage('Đã xóa tiết học thành công!');
        onDataChanged();
      }
    } catch (err: any) {
      setMessage(`Lỗi: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSchedule = schedule.filter((item) => {
    if (selectedDay === 0) return true;
    return item.thu === selectedDay;
  });

  const dayName = (thu: number) => {
    switch (thu) {
      case 2: return 'Thứ Hai';
      case 3: return 'Thứ Ba';
      case 4: return 'Thứ Tư';
      case 5: return 'Thứ Năm';
      case 6: return 'Thứ Sáu';
      case 7: return 'Thứ Bảy';
      default: return `Thứ ${thu}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-600" />
            <span>Thời Khóa Biểu & Lịch Học (Bảng lich_trinh)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Lịch học hàng tuần của bạn, phòng học, hình thức và giảng viên
          </p>
        </div>

        <button
          id="btn-open-add-schedule"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Tiết Học Mới</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
          message.includes('Lỗi')
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add new schedule form */}
      {isAdding && (
        <form onSubmit={handleAddSchedule} className="bg-white rounded-2xl p-6 border border-blue-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Thêm Tiết Học Mới Vào Thời Khóa Biểu</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick course selector from BICA */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
            <label className="text-xs font-semibold text-blue-900 block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Chọn nhanh môn học từ Khung CTĐT BICA (Tự động điền Mã và Tên môn):</span>
            </label>
            <select
              onChange={(e) => handleSelectQuickCourse(e.target.value)}
              defaultValue=""
              className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Nhấp để chọn môn học trong CTĐT BICA --</option>
              {BICA_CURRICULUM.map((c) => (
                <option key={c.ma_hoc_phan} value={c.ma_hoc_phan}>
                  [{c.ma_hoc_phan}] {c.ten_hoc_phan} ({c.so_tin_chi} TC) - Kỳ {c.hoc_ky_goi_y}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mã học phần</label>
              <input
                type="text"
                required
                placeholder="VD: IEA1001"
                value={newSchedule.ma_hoc_phan}
                onChange={(e) => setNewSchedule({ ...newSchedule, ma_hoc_phan: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tên môn học</label>
              <input
                type="text"
                required
                placeholder="VD: Lý thuyết mạch điện"
                value={newSchedule.ten_hoc_phan}
                onChange={(e) => setNewSchedule({ ...newSchedule, ten_hoc_phan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Thứ trong tuần</label>
              <select
                value={newSchedule.thu}
                onChange={(e) => setNewSchedule({ ...newSchedule, thu: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-medium"
              >
                <option value={2}>Thứ 2</option>
                <option value={3}>Thứ 3</option>
                <option value={4}>Thứ 4</option>
                <option value={5}>Thứ 5</option>
                <option value={6}>Thứ 6</option>
                <option value={7}>Thứ 7</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Hình thức</label>
              <select
                value={newSchedule.hinh_thuc}
                onChange={(e) => setNewSchedule({ ...newSchedule, hinh_thuc: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              >
                <option value="TrucTiep">Trực tiếp (Tại trường)</option>
                <option value="Online">Trực tuyến (Online)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tiết bắt đầu</label>
              <select
                value={newSchedule.tiet_bat_dau}
                onChange={(e) => handlePeriodChange(Number(e.target.value), Number(newSchedule.so_tiet || 3))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-medium"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
                  <option key={p} value={p}>
                    Tiết {p} ({PERIOD_TIMES[p]?.start})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Số tiết</label>
              <select
                value={newSchedule.so_tiet}
                onChange={(e) => handlePeriodChange(Number(newSchedule.tiet_bat_dau || 1), Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-medium"
              >
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count} tiết
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Thời gian học</label>
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  placeholder="07:00"
                  value={newSchedule.gio_bat_dau}
                  onChange={(e) => setNewSchedule({ ...newSchedule, gio_bat_dau: e.target.value })}
                  className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                />
                <span>-</span>
                <input
                  type="text"
                  placeholder="09:40"
                  value={newSchedule.gio_ket_thuc}
                  onChange={(e) => setNewSchedule({ ...newSchedule, gio_ket_thuc: e.target.value })}
                  className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Phòng học</label>
              <input
                type="text"
                placeholder="VD: A2-302 hoặc Lab Tự động hóa"
                value={newSchedule.phong_hoc}
                onChange={(e) => setNewSchedule({ ...newSchedule, phong_hoc: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Giảng viên</label>
              <input
                type="text"
                placeholder="VD: TS. Nguyễn Minh Trí"
                value={newSchedule.giang_vien}
                onChange={(e) => setNewSchedule({ ...newSchedule, giang_vien: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Ghi chú (Tùy chọn)</label>
              <input
                type="text"
                placeholder="VD: Mang theo laptop và kit thực hành"
                value={newSchedule.ghi_chu}
                onChange={(e) => setNewSchedule({ ...newSchedule, ghi_chu: e.target.value })}
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
              id="btn-save-schedule-supabase"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu Vào Thời Khóa Biểu'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Day Selector Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {days.map((d) => (
          <button
            key={d.num}
            id={`day-filter-${d.num}`}
            onClick={() => setSelectedDay(d.num)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              selectedDay === d.num
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Schedule Items Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSchedule.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Thời khóa biểu hiện đang để trống
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {selectedDay === 0
                  ? 'Bạn chưa thêm tiết học nào vào thời khóa biểu. Nhấp vào "Thêm Tiết Học Mới" để lên lịch học cho tuần và chọn nhanh môn từ CTĐT BICA.'
                  : `Không có lịch học nào cho ${dayName(selectedDay)}. Bạn có thể thêm tiết học mới cho ngày này.`}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsAdding(true)}
                  className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Tiết Học Mới</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          filteredSchedule.map((item) => (
            <div
              key={item.id || item.ma_hoc_phan + item.thu}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all group flex flex-col justify-between relative"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 font-mono">
                      {item.ma_hoc_phan}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                      {dayName(item.thu)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteSchedule(item)}
                    disabled={deletingId === (item.id || item.ma_hoc_phan)}
                    title="Xóa tiết học này"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                  {item.ten_hoc_phan}
                </h3>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center space-x-2 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {item.gio_bat_dau} - {item.gio_ket_thuc} (Tiết {item.tiet_bat_dau} -{' '}
                      {item.tiet_bat_dau + item.so_tiet - 1})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {item.hinh_thuc === 'Online' ? (
                      <Video className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800">{item.phong_hoc}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.hinh_thuc === 'Online' ? 'Online' : 'Trực tiếp'}
                    </span>
                  </div>

                  {item.giang_vien && (
                    <div className="flex items-center space-x-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.giang_vien}</span>
                    </div>
                  )}
                </div>
              </div>

              {item.ghi_chu && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 italic">
                  💡 {item.ghi_chu}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
