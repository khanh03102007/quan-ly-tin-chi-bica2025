import React, { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  Database,
  Award,
  Trash2,
  Save,
  X,
  Download,
  Sparkles,
  RefreshCw,
  GraduationCap,
  ListPlus,
  Calculator,
} from 'lucide-react';
import type { StudentCourse } from '../types';
import { supabase, batchAddBicaCourses, deleteCourse, deleteMultipleCourses } from '../lib/supabase';
import { BICA_CURRICULUM, BicaCurriculumCourse } from '../data/bicaCurriculum';
import { BicaCurriculumPickerModal } from './BicaCurriculumPickerModal';

interface CoursesGradesTabProps {
  courses: StudentCourse[];
  isSupabaseLive: boolean;
  user?: SupabaseUser | null;
  studentId?: string;
  onDataChanged: () => void;
  onOpenAuth?: () => void;
  onNavigateToWhatIf?: () => void;
}

export const CoursesGradesTab: React.FC<CoursesGradesTabProps> = ({
  courses,
  isSupabaseLive,
  user,
  studentId = '',
  onDataChanged,
  onOpenAuth,
  onNavigateToWhatIf,
}) => {
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // States hỗ trợ xóa học phần khi sinh viên chọn nhầm
  const [courseToDelete, setCourseToDelete] = useState<StudentCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // New course form
  const [newCourse, setNewCourse] = useState<Partial<StudentCourse>>({
    ma_hoc_phan: '',
    ten_hoc_phan: '',
    so_tin_chi: 3,
    hoc_ky: 'Học kỳ 1',
    nam_hoc: '2025-2026',
    diem_chuyen_can: 10,
    diem_giua_ky: 8.5,
    diem_cuoi_ky: 9.0,
    diem_tong_ket: 8.9,
    diem_chu: 'A',
    diem_thang_4: 4.0,
    ket_qua: 'DangHoc',
    giang_vien: '',
  });

  // Khi sinh viên chọn nhanh môn học từ Khung CTĐT BICA trong form thêm mới
  const handleSelectQuickBicaCourse = (courseCode: string) => {
    if (!courseCode) return;
    const found = BICA_CURRICULUM.find((c) => c.ma_hoc_phan === courseCode);
    if (found) {
      setNewCourse((prev) => ({
        ...prev,
        ma_hoc_phan: found.ma_hoc_phan,
        ten_hoc_phan: found.ten_hoc_phan,
        so_tin_chi: found.so_tin_chi,
        hoc_ky: `Học kỳ ${found.hoc_ky_goi_y}`,
      }));
    }
  };

  // Calculate letter grade and 4.0 scale automatically
  const handleScoreChange = (field: 'diem_chuyen_can' | 'diem_giua_ky' | 'diem_cuoi_ky', val: number) => {
    const updated = { ...newCourse, [field]: val };
    const cc = Number(updated.diem_chuyen_can || 0);
    const gk = Number(updated.diem_giua_ky || 0);
    const ck = Number(updated.diem_cuoi_ky || 0);
    const finalScore = Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10;

    let letter = 'F';
    let gpa4 = 0;
    if (finalScore >= 9.0) { letter = 'A+'; gpa4 = 4.0; }
    else if (finalScore >= 8.5) { letter = 'A'; gpa4 = 4.0; }
    else if (finalScore >= 8.0) { letter = 'B+'; gpa4 = 3.5; }
    else if (finalScore >= 7.0) { letter = 'B'; gpa4 = 3.0; }
    else if (finalScore >= 6.5) { letter = 'C+'; gpa4 = 2.5; }
    else if (finalScore >= 5.5) { letter = 'C'; gpa4 = 2.0; }
    else if (finalScore >= 5.0) { letter = 'D+'; gpa4 = 1.5; }
    else if (finalScore >= 4.0) { letter = 'D'; gpa4 = 1.0; }
    else { letter = 'F'; gpa4 = 0.0; }

    setNewCourse({
      ...updated,
      diem_tong_ket: finalScore,
      diem_chu: letter,
      diem_thang_4: gpa4,
      ket_qua: finalScore >= 4.0 ? 'Dat' : 'KhongDat',
    });
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.ma_hoc_phan || !newCourse.ten_hoc_phan) {
      setMessage('Vui lòng điền hoặc chọn mã học phần và tên học phần');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload: any = {
        ma_sinh_vien: studentId,
        ma_hoc_phan: newCourse.ma_hoc_phan,
        ten_hoc_phan: newCourse.ten_hoc_phan,
        so_tin_chi: Number(newCourse.so_tin_chi),
        hoc_ky: newCourse.hoc_ky,
        nam_hoc: newCourse.nam_hoc,
        diem_chuyen_can: Number(newCourse.diem_chuyen_can),
        diem_giua_ky: Number(newCourse.diem_giua_ky),
        diem_cuoi_ky: Number(newCourse.diem_cuoi_ky),
        diem_tong_ket: Number(newCourse.diem_tong_ket),
        diem_chu: newCourse.diem_chu,
        diem_thang_4: Number(newCourse.diem_thang_4),
        ket_qua: newCourse.ket_qua,
        giang_vien: newCourse.giang_vien,
      };

      if (user?.id) {
        payload.user_id = user.id;
      }

      let { error } = await supabase.from('khoa_hoc_sinh_vien').insert([payload]);
      if (error && error.message?.includes('user_id')) {
        delete payload.user_id;
        const retry = await supabase.from('khoa_hoc_sinh_vien').insert([payload]);
        error = retry.error;
      }

      if (error) {
        setMessage(`Lỗi thêm vào bảng khoa_hoc_sinh_vien: ${error.message}`);
      } else {
        setMessage('Đã lưu học phần vào bảng điểm thành công!');
        setIsAdding(false);
        setNewCourse({
          ma_hoc_phan: '',
          ten_hoc_phan: '',
          so_tin_chi: 3,
          hoc_ky: 'Học kỳ 1',
          nam_hoc: '2025-2026',
          diem_chuyen_can: 10,
          diem_giua_ky: 8.5,
          diem_cuoi_ky: 9.0,
          diem_tong_ket: 8.9,
          diem_chu: 'A',
          diem_thang_4: 4.0,
          ket_qua: 'DangHoc',
          giang_vien: '',
        });
        onDataChanged();
      }
    } catch (err: any) {
      setMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Nạp các môn học được chọn từ Modal Khung CTĐT BICA
  const handleSelectCoursesFromCurriculum = async (
    selectedCourses: BicaCurriculumCourse[],
    status: 'DangHoc' | 'Dat'
  ) => {
    setIsBatchAdding(true);
    setMessage(null);
    try {
      const items = selectedCourses.map((c) => ({
        ma_hoc_phan: c.ma_hoc_phan,
        ten_hoc_phan: c.ten_hoc_phan,
        so_tin_chi: c.so_tin_chi,
        hoc_ky_goi_y: c.hoc_ky_goi_y,
        ket_qua: status,
        diem_tong_ket: status === 'Dat' ? 8.5 : undefined,
        diem_chu: status === 'Dat' ? 'A' : undefined,
        diem_thang_4: status === 'Dat' ? 4.0 : undefined,
      }));

      const res = await batchAddBicaCourses(items, studentId, user);
      if (res.success) {
        setMessage(`✅ Đã thêm thành công ${res.count} môn học từ Khung CTĐT BICA vào bảng điểm của bạn!`);
        onDataChanged();
      } else {
        setMessage(`Lỗi lưu môn học: ${res.error}`);
      }
    } catch (err: any) {
      setMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsBatchAdding(false);
    }
  };

  // Xóa một học phần riêng lẻ khi sinh viên chọn nhầm
  const handleDeleteSingleCourse = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteCourse(
        courseToDelete.id,
        courseToDelete.ma_hoc_phan,
        studentId,
        user
      );
      if (res.success) {
        setMessage(`✅ Đã xóa học phần [${courseToDelete.ma_hoc_phan}] - ${courseToDelete.ten_hoc_phan} thành công!`);
        setSelectedCourseCodes((prev) => prev.filter((code) => code !== courseToDelete.ma_hoc_phan));
        setCourseToDelete(null);
        onDataChanged();
      } else {
        setMessage(`Lỗi xóa học phần: ${res.error}`);
      }
    } catch (err: any) {
      setMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Xóa hàng loạt nhiều học phần đã chọn khi sinh viên chọn nhầm
  const handleDeleteMultipleCourses = async () => {
    if (selectedCourseCodes.length === 0) return;
    setIsDeleting(true);
    try {
      const selectedItems = courses.filter((c) => selectedCourseCodes.includes(c.ma_hoc_phan));
      const ids = selectedItems.map((c) => c.id).filter(Boolean) as string[];
      const res = await deleteMultipleCourses(ids, selectedCourseCodes, studentId, user);
      if (res.success) {
        setMessage(`✅ Đã xóa thành công ${selectedCourseCodes.length} học phần khỏi bảng điểm!`);
        setSelectedCourseCodes([]);
        setShowBulkDeleteModal(false);
        onDataChanged();
      } else {
        setMessage(`Lỗi xóa học phần: ${res.error}`);
      }
    } catch (err: any) {
      setMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectCourse = (code: string) => {
    setSelectedCourseCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredCodes = filteredCourses.map((c) => c.ma_hoc_phan);
    const allSelected =
      allFilteredCodes.length > 0 &&
      allFilteredCodes.every((code) => selectedCourseCodes.includes(code));
    if (allSelected) {
      setSelectedCourseCodes((prev) => prev.filter((code) => !allFilteredCodes.includes(code)));
    } else {
      setSelectedCourseCodes((prev) => Array.from(new Set([...prev, ...allFilteredCodes])));
    }
  };

  // Filter courses
  const filteredCourses = courses.filter((c) => {
    const matchesSemester = selectedSemester === 'all' || c.hoc_ky.toLowerCase().includes(selectedSemester.toLowerCase());
    const matchesQuery =
      c.ma_hoc_phan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ten_hoc_phan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.giang_vien && c.giang_vien.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSemester && matchesQuery;
  });

  const totalFilteredCredits = filteredCourses.reduce((sum, c) => sum + (c.so_tin_chi || 0), 0);
  const totalPassedCredits = filteredCourses
    .filter((c) => c.ket_qua === 'Dat')
    .reduce((sum, c) => sum + (c.so_tin_chi || 0), 0);

  const existingCodes = courses.map((c) => c.ma_hoc_phan);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Danh Sách Điểm Số & Tín Chỉ (Bảng khoa_hoc_sinh_vien)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi kết quả học tập từng môn, điểm chữ, điểm hệ 4 và trạng thái tích lũy tín chỉ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút chuyển nhanh sang Cỗ Máy What-if */}
          {onNavigateToWhatIf && (
            <button
              id="btn-nav-to-whatif-from-courses"
              onClick={onNavigateToWhatIf}
              className="inline-flex items-center space-x-1.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-xs"
              title="Mở cỗ máy mô phỏng What-if & dự báo GPA"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Dự Báo GPA (What-if)</span>
            </button>
          )}

          {/* Nút mở Modal Chọn Môn Từ Khung CTĐT BICA */}
          <button
            id="btn-open-curriculum-modal"
            onClick={() => setIsCurriculumModalOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-xs"
            title="Duyệt và chọn các môn học trong khung chương trình đào tạo BICA K2025"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Chọn Môn Từ Khung CTĐT BICA</span>
          </button>

          <button
            id="btn-open-add-course"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border border-slate-300"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Môn Thủ Công</span>
          </button>
        </div>
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

      {/* Add new course form */}
      {isAdding && (
        <form onSubmit={handleAddCourse} className="bg-white rounded-2xl p-6 border border-blue-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Nhập Môn Học & Điểm Vào Bảng Điểm</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hộp chọn nhanh từ Khung CTĐT BICA */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
            <label className="text-xs font-semibold text-blue-900 block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Chọn nhanh từ Khung CTĐT BICA (Tự động điền Mã, Tên môn và Số tín chỉ):</span>
            </label>
            <select
              onChange={(e) => handleSelectQuickBicaCourse(e.target.value)}
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
                value={newCourse.ma_hoc_phan}
                onChange={(e) => setNewCourse({ ...newCourse, ma_hoc_phan: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Tên môn học</label>
              <input
                type="text"
                required
                placeholder="VD: Lý thuyết mạch điện"
                value={newCourse.ten_hoc_phan}
                onChange={(e) => setNewCourse({ ...newCourse, ten_hoc_phan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Số tín chỉ</label>
              <input
                type="number"
                min="1"
                max="10"
                value={newCourse.so_tin_chi}
                onChange={(e) => setNewCourse({ ...newCourse, so_tin_chi: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Học kỳ</label>
              <select
                value={newCourse.hoc_ky}
                onChange={(e) => setNewCourse({ ...newCourse, hoc_ky: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={`Học kỳ ${s}`}>
                    Học kỳ {s}
                  </option>
                ))}
                <option value="Học kỳ Hè">Học kỳ Hè</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Năm học</label>
              <input
                type="text"
                placeholder="VD: 2025-2026"
                value={newCourse.nam_hoc}
                onChange={(e) => setNewCourse({ ...newCourse, nam_hoc: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Trạng thái</label>
              <select
                value={newCourse.ket_qua}
                onChange={(e) => setNewCourse({ ...newCourse, ket_qua: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              >
                <option value="DangHoc">Đang theo học</option>
                <option value="Dat">Đã đạt</option>
                <option value="KhongDat">Không đạt</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Giảng viên phụ trách</label>
              <input
                type="text"
                placeholder="VD: TS. Trần Văn A"
                value={newCourse.giang_vien}
                onChange={(e) => setNewCourse({ ...newCourse, giang_vien: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Chuyên cần (10%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourse.diem_chuyen_can}
                onChange={(e) => handleScoreChange('diem_chuyen_can', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Giữa kỳ (30%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourse.diem_giua_ky}
                onChange={(e) => handleScoreChange('diem_giua_ky', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Cuối kỳ (60%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourse.diem_cuoi_ky}
                onChange={(e) => handleScoreChange('diem_cuoi_ky', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tổng kết / Chữ / Hệ 4</label>
              <div className="px-3 py-2 bg-blue-50 text-blue-900 font-semibold rounded-lg border border-blue-200">
                {newCourse.diem_tong_ket} ({newCourse.diem_chu} - {newCourse.diem_thang_4})
              </div>
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
              id="btn-save-course-supabase"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu lên Supabase...' : 'Lưu Vào CSDL Supabase'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              id="input-search-courses"
              type="text"
              placeholder="Tìm mã môn hoặc tên môn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          <select
            id="select-filter-semester"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="all">Tất cả học kỳ</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={`Học kỳ ${sem}`}>
                Học kỳ {sem}
              </option>
            ))}
          </select>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center space-x-3 text-xs">
          {selectedCourseCodes.length > 0 && (
            <button
              id="btn-trigger-bulk-delete"
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs"
              title="Xóa các học phần đã chọn do chọn nhầm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa ({selectedCourseCodes.length}) môn đã chọn</span>
            </button>
          )}
          <span className="text-slate-500">
            Hiển thị: <strong className="text-slate-800">{filteredCourses.length}</strong> môn học
          </span>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg border border-blue-100">
            Tổng: {totalFilteredCredits} Tín chỉ
          </span>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-lg border border-emerald-100">
            Đã đạt: {totalPassedCredits} TC
          </span>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="w-10 px-3 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredCourses.length > 0 &&
                      filteredCourses.every((c) => selectedCourseCodes.includes(c.ma_hoc_phan))
                    }
                    onChange={handleSelectAllFiltered}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Chọn tất cả để xóa khi chọn nhầm"
                  />
                </th>
                <th className="px-4 py-3.5">Mã Học Phần</th>
                <th className="px-4 py-3.5">Tên Học Phần</th>
                <th className="px-3 py-3.5 text-center">Tín Chỉ</th>
                <th className="px-3 py-3.5">Học Kỳ</th>
                <th className="px-3 py-3.5 text-center">CC (10%)</th>
                <th className="px-3 py-3.5 text-center">GK (30%)</th>
                <th className="px-3 py-3.5 text-center">CK (60%)</th>
                <th className="px-3 py-3.5 text-center font-bold text-slate-800">Tổng Kết</th>
                <th className="px-3 py-3.5 text-center font-bold">Chữ</th>
                <th className="px-3 py-3.5 text-center">Hệ 4</th>
                <th className="px-3 py-3.5 text-center">Kết Quả</th>
                <th className="px-3 py-3.5 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-16 text-center text-slate-500">
                    {courses.length === 0 ? (
                      <div className="max-w-lg mx-auto space-y-4">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                          <BookOpen className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">
                            Bảng điểm hiện đang để trống
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed mt-1">
                            Để tránh nhập tay từng môn, bạn có thể nhấp vào <strong>"Chọn Môn Từ Khung CTĐT BICA"</strong> để tải toàn bộ danh mục môn học chương trình Kỹ thuật Thông minh & Tự động hóa và nhấp chọn môn theo từng kỳ (Kỳ 1 đến Kỳ 8).
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <button
                            id="btn-empty-open-curriculum"
                            onClick={() => setIsCurriculumModalOpen(true)}
                            className="inline-flex items-center space-x-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20"
                          >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Chọn Môn Từ Khung CTĐT BICA</span>
                          </button>
                          <button
                            onClick={() => setIsAdding(true)}
                            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors border border-slate-300"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Tự Nhập Môn Học Mới</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      'Không tìm thấy môn học nào phù hợp với bộ lọc.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course, idx) => (
                  <tr
                    key={course.id || course.ma_hoc_phan + idx}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      selectedCourseCodes.includes(course.ma_hoc_phan) ? 'bg-red-50/20' : ''
                    }`}
                  >
                    <td className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCourseCodes.includes(course.ma_hoc_phan)}
                        onChange={() => toggleSelectCourse(course.ma_hoc_phan)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Chọn môn này để xóa"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {course.ma_hoc_phan}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{course.ten_hoc_phan}</div>
                      {course.giang_vien && (
                        <div className="text-[11px] text-slate-400">GV: {course.giang_vien}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">
                      {course.so_tin_chi}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {course.hoc_ky}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {course.diem_chuyen_can !== undefined && course.diem_chuyen_can !== null ? course.diem_chuyen_can : '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {course.diem_giua_ky !== undefined && course.diem_giua_ky !== null ? course.diem_giua_ky : '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {course.diem_cuoi_ky !== undefined && course.diem_cuoi_ky !== null ? course.diem_cuoi_ky : '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-900">
                      {course.diem_tong_ket !== undefined && course.diem_tong_ket !== null ? course.diem_tong_ket : '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        course.diem_chu?.startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
                        course.diem_chu?.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                        course.diem_chu?.startsWith('C') ? 'bg-amber-100 text-amber-800' :
                        course.diem_chu?.startsWith('D') ? 'bg-orange-100 text-orange-800' :
                        course.diem_chu === 'F' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {course.diem_chu || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">
                      {course.diem_thang_4 !== undefined && course.diem_thang_4 !== null ? course.diem_thang_4 : '-'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        course.ket_qua === 'Dat'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : course.ket_qua === 'DangHoc'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {course.ket_qua === 'Dat' ? 'Đã đạt' : course.ket_qua === 'DangHoc' ? 'Đang học' : 'Chưa đạt'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <button
                        id={`btn-delete-course-${course.ma_hoc_phan}`}
                        type="button"
                        onClick={() => setCourseToDelete(course)}
                        className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title={`Xóa học phần ${course.ma_hoc_phan} (${course.ten_hoc_phan}) khi chọn nhầm`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal xác nhận xóa một học phần */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 animate-in fade-in zoom-in">
            <div className="flex items-start space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Xác Nhận Xóa Học Phần
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Bạn có chắc chắn muốn xóa học phần này khỏi bảng điểm? Thao tác này giúp bạn điều chỉnh lại nếu lỡ chọn nhầm môn học.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mã học phần:</span>
                <span className="font-mono font-bold text-blue-600">{courseToDelete.ma_hoc_phan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tên môn học:</span>
                <span className="font-semibold text-slate-800 text-right">{courseToDelete.ten_hoc_phan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số tín chỉ:</span>
                <span className="font-bold text-slate-800">{courseToDelete.so_tin_chi} tín chỉ</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Học kỳ:</span>
                <span className="text-slate-700">{courseToDelete.hoc_ky}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                id="btn-confirm-delete-course"
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSingleCourse}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang Xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác Nhận Xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa hàng loạt học phần đã chọn */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 p-6 animate-in fade-in zoom-in">
            <div className="flex items-start space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Xác Nhận Xóa {selectedCourseCodes.length} Học Phần
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Bạn có chắc chắn muốn xóa {selectedCourseCodes.length} học phần đã chọn khỏi bảng điểm? Thao tác này sẽ gỡ bỏ các môn học để bạn có thể chọn lại môn chính xác.
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              {courses
                .filter((c) => selectedCourseCodes.includes(c.ma_hoc_phan))
                .map((c) => (
                  <div key={c.ma_hoc_phan} className="py-1.5 flex justify-between items-center">
                    <span className="font-mono font-bold text-blue-600">{c.ma_hoc_phan}</span>
                    <span className="text-slate-700 truncate max-w-[220px] text-right">{c.ten_hoc_phan}</span>
                  </div>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                id="btn-confirm-bulk-delete"
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteMultipleCourses}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang Xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác Nhận Xóa ({selectedCourseCodes.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Duyệt & Chọn Môn Từ Khung CTĐT BICA */}
      <BicaCurriculumPickerModal
        isOpen={isCurriculumModalOpen}
        onClose={() => setIsCurriculumModalOpen(false)}
        onSelectCourses={handleSelectCoursesFromCurriculum}
        existingCourseCodes={existingCodes}
        isSubmitting={isBatchAdding}
      />
    </div>
  );
};
