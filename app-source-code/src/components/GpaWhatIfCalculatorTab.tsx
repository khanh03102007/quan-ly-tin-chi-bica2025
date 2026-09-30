import React, { useState, useMemo } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Calculator,
  Sparkles,
  Award,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  Edit3,
  Save,
  Trash2,
  RefreshCw,
  TrendingUp,
  Target,
  GraduationCap,
  Sliders,
  ChevronRight,
  Filter,
  Check,
  X,
  Layers,
  ArrowUpRight,
  LogIn
} from 'lucide-react';
import type { StudentCourse, StudentProfile } from '../types';
import { BICA_CURRICULUM, BicaCurriculumCourse } from '../data/bicaCurriculum';
import { BicaCurriculumPickerModal } from './BicaCurriculumPickerModal';
import { supabase, updateCourseGrades, batchAddBicaCourses } from '../lib/supabase';

interface GpaWhatIfCalculatorTabProps {
  courses: StudentCourse[];
  profile: StudentProfile;
  user: SupabaseUser | null;
  isSupabaseLive: boolean;
  studentId: string;
  onDataChanged: () => void;
  onOpenAuth?: () => void;
}

// Hàm quy đổi điểm tổng kết hệ 10 sang hệ 4 và điểm chữ theo chuẩn ĐHQGHN
export function convertGradeScale(score10: number): { letter: string; gpa4: number; description: string } {
  const rounded = Math.round(score10 * 10) / 10;
  if (rounded >= 9.0) return { letter: 'A+', gpa4: 4.0, description: 'Xuất sắc' };
  if (rounded >= 8.5) return { letter: 'A', gpa4: 4.0, description: 'Giỏi' };
  if (rounded >= 8.0) return { letter: 'B+', gpa4: 3.5, description: 'Khá giỏi' };
  if (rounded >= 7.0) return { letter: 'B', gpa4: 3.0, description: 'Khá' };
  if (rounded >= 6.5) return { letter: 'C+', gpa4: 2.5, description: 'Trung bình khá' };
  if (rounded >= 5.5) return { letter: 'C', gpa4: 2.0, description: 'Trung bình' };
  if (rounded >= 5.0) return { letter: 'D+', gpa4: 1.5, description: 'Trung bình yếu' };
  if (rounded >= 4.0) return { letter: 'D', gpa4: 1.0, description: 'Yếu (Qua môn)' };
  return { letter: 'F', gpa4: 0.0, description: 'Kém (Trượt môn)' };
}

// Ngưỡng điểm tối thiểu hệ 10 để đạt các điểm chữ
const LETTER_GRADE_THRESHOLDS: Record<string, number> = {
  'A+': 9.0,
  'A': 8.5,
  'B+': 8.0,
  'B': 7.0,
  'C+': 6.5,
  'C': 5.5,
  'D+': 5.0,
  'D': 4.0,
};

export const GpaWhatIfCalculatorTab: React.FC<GpaWhatIfCalculatorTabProps> = ({
  courses,
  profile,
  user,
  isSupabaseLive,
  studentId,
  onDataChanged,
  onOpenAuth,
}) => {
  // Bộ lọc học kỳ
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Xử lý nạp các môn chọn từ Khung CTĐT BICA
  const handleSelectCoursesFromCurriculum = async (
    selectedCourses: BicaCurriculumCourse[],
    status: 'DangHoc' | 'Dat'
  ) => {
    setIsBatchAdding(true);
    setActionMessage(null);
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

      const res = await batchAddBicaCourses(items, studentId || profile.ma_sinh_vien, user);
      if (res.success) {
        setActionMessage(`✅ Đã nạp thành công ${res.count} môn học từ Khung CTĐT BICA vào danh sách!`);
        onDataChanged();
      } else {
        setActionMessage(`Lỗi lưu môn học: ${res.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsBatchAdding(false);
    }
  };

  // -------------------------------------------------------------
  // PHẦN 1: CỖ MÁY MÔ PHỎNG WHAT-IF (KẾ HOẠCH CPA TỐT NGHIỆP)
  // -------------------------------------------------------------
  const totalCurriculumCredits = profile.tong_tin_chi_yeu_cau || 145;

  // Tính số tín chỉ và CPA thực tế từ danh sách môn học đã hoàn thành
  const completedCourses = useMemo(() => {
    return courses.filter((c) => {
      const score = Number(c.diem_tong_ket ?? -1);
      return (c.ket_qua === 'Dat' || score >= 4.0) && score >= 0;
    });
  }, [courses]);

  const actualCompletedCredits = useMemo(() => {
    const fromCourses = completedCourses.reduce((sum, c) => sum + (c.so_tin_chi || 0), 0);
    return Math.max(fromCourses, Number(profile.tong_tin_chi_tich_luy || 0));
  }, [completedCourses, profile.tong_tin_chi_tich_luy]);

  const actualCurrentCpa = useMemo(() => {
    let totalQualityPoints = 0;
    let totalCredits = 0;
    completedCourses.forEach((c) => {
      const credits = c.so_tin_chi || 0;
      const gpa4 = c.diem_thang_4 ?? (c.diem_tong_ket !== undefined ? convertGradeScale(c.diem_tong_ket).gpa4 : 0);
      totalQualityPoints += gpa4 * credits;
      totalCredits += credits;
    });
    if (totalCredits > 0) {
      return Math.round((totalQualityPoints / totalCredits) * 100) / 100;
    }
    return Number(profile.diem_cpa || 0);
  }, [completedCourses, profile.diem_cpa]);

  // Cho phép người dùng tùy chỉnh tham số mô phỏng What-if
  const [simCompletedCredits, setSimCompletedCredits] = useState<number>(actualCompletedCredits || 88);
  const [simCurrentCpa, setSimCurrentCpa] = useState<number>(actualCurrentCpa > 0 ? actualCurrentCpa : 3.59);
  const [targetCpa, setTargetCpa] = useState<number>(3.20);
  const [isCustomSimParams, setIsCustomSimParams] = useState<boolean>(false);

  // Cập nhật khi dữ liệu tài khoản thay đổi
  React.useEffect(() => {
    if (!isCustomSimParams && user) {
      if (actualCompletedCredits > 0) setSimCompletedCredits(actualCompletedCredits);
      if (actualCurrentCpa > 0) setSimCurrentCpa(actualCurrentCpa);
    }
  }, [actualCompletedCredits, actualCurrentCpa, user, isCustomSimParams]);

  // Tính toán toán học cho What-If CPA
  const remainingCredits = Math.max(0, totalCurriculumCredits - simCompletedCredits);
  const currentQualityPoints = simCurrentCpa * simCompletedCredits;
  const targetQualityPoints = targetCpa * totalCurriculumCredits;
  const remainingQualityPointsNeeded = targetQualityPoints - currentQualityPoints;

  const requiredGpa = remainingCredits > 0
    ? Math.round((remainingQualityPointsNeeded / remainingCredits) * 100) / 100
    : 0;

  const maxPossibleCpa = remainingCredits > 0
    ? Math.round(((currentQualityPoints + 4.0 * remainingCredits) / totalCurriculumCredits) * 100) / 100
    : simCurrentCpa;

  const completionPercent = Math.min(100, Math.round((simCompletedCredits / totalCurriculumCredits) * 100));

  // -------------------------------------------------------------
  // PHẦN 2: CÔNG CỤ TÍNH ĐIỂM THI CUỐI KỲ CẦN ĐẠT (BREAK-EVEN EXAM SCORE)
  // -------------------------------------------------------------
  const [beCourseId, setBeCourseId] = useState<string>('');
  const [beCourseName, setBeCourseName] = useState<string>('IEA2001 - Kỹ thuật Lập trình và Thuật toán');
  const [beWeightCC, setBeWeightCC] = useState<number>(10); // 10%
  const [beWeightGK, setBeWeightGK] = useState<number>(30); // 30%
  const [beWeightCK, setBeWeightCK] = useState<number>(60); // 60%
  const [beScoreCC, setBeScoreCC] = useState<number>(10);
  const [beScoreGK, setBeScoreGK] = useState<number>(8.5);
  const [beTargetGrade, setBeTargetGrade] = useState<string>('A');

  // Điểm quá trình hiện có trước thi (thang 10)
  const processWeight = (beWeightCC + beWeightGK) / 100;
  const currentCourseworkAccumulated = (beScoreCC * (beWeightCC / 100)) + (beScoreGK * (beWeightGK / 100));
  const currentProcessGrade10 = processWeight > 0 ? Math.round((currentCourseworkAccumulated / processWeight) * 10) / 10 : 0;

  // Tính điểm thi cuối kỳ tối thiểu cần đạt cho mục tiêu được chọn
  const calculateRequiredExamScore = (targetLetter: string) => {
    const minThreshold = LETTER_GRADE_THRESHOLDS[targetLetter] ?? 8.5;
    const finalExamWeight = beWeightCK / 100;
    if (finalExamWeight <= 0) return 0;
    const scoreNeeded = (minThreshold - currentCourseworkAccumulated) / finalExamWeight;
    return Math.round(scoreNeeded * 10) / 10;
  };

  const selectedTargetExamScore = calculateRequiredExamScore(beTargetGrade);

  // Đánh giá mức độ khả thi
  const getFeasibilityBadge = (score: number) => {
    if (score <= 0) {
      return { text: 'Chắc chắn đạt (≥ 0.0)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (score <= 5.0) {
      return { text: 'Rất dễ (≤ 5.0)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (score <= 7.5) {
      return { text: 'Khả thi (5.1 - 7.5)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (score <= 8.5) {
      return { text: 'Cần cố gắng (7.6 - 8.5)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (score <= 10.0) {
      return { text: 'Rất thử thách (8.6 - 10.0)', color: 'bg-orange-50 text-orange-700 border-orange-200' };
    }
    return { text: 'Bất khả thi (> 10.0)', color: 'bg-red-50 text-red-700 border-red-200' };
  };

  // Chọn nhanh môn học trong danh sách của sinh viên để nạp vào Break-Even Calculator
  const handleSelectCourseForBreakEven = (courseId: string) => {
    setBeCourseId(courseId);
    const found = courses.find((c) => c.id === courseId);
    if (found) {
      setBeCourseName(`[${found.ma_hoc_phan}] ${found.ten_hoc_phan}`);
      if (found.diem_chuyen_can !== undefined) setBeScoreCC(Number(found.diem_chuyen_can));
      if (found.diem_giua_ky !== undefined) setBeScoreGK(Number(found.diem_giua_ky));
      if (found.diem_chu) setBeTargetGrade(found.diem_chu);
    }
  };

  // -------------------------------------------------------------
  // PHẦN 3: BẢNG ĐIỂM CHI TIẾT & CHỈNH SỬA THÀNH PHẦN (INLINE EDIT)
  // -------------------------------------------------------------
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editRowValues, setEditRowValues] = useState<{
    diem_chuyen_can: number;
    diem_giua_ky: number;
    diem_cuoi_ky: number;
  }>({ diem_chuyen_can: 10, diem_giua_ky: 8.5, diem_cuoi_ky: 9.0 });

  const startEditRow = (course: StudentCourse) => {
    setEditingCourseId(course.id || course.ma_hoc_phan);
    setEditRowValues({
      diem_chuyen_can: Number(course.diem_chuyen_can ?? 10),
      diem_giua_ky: Number(course.diem_giua_ky ?? 8.0),
      diem_cuoi_ky: Number(course.diem_cuoi_ky ?? 8.5),
    });
  };

  const handleSaveInlineEdit = async (course: StudentCourse) => {
    const cc = editRowValues.diem_chuyen_can;
    const gk = editRowValues.diem_giua_ky;
    const ck = editRowValues.diem_cuoi_ky;
    const total10 = Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10;
    const { letter, gpa4 } = convertGradeScale(total10);

    const updates: Partial<StudentCourse> = {
      diem_chuyen_can: cc,
      diem_giua_ky: gk,
      diem_cuoi_ky: ck,
      diem_tong_ket: total10,
      diem_chu: letter,
      diem_thang_4: gpa4,
      ket_qua: total10 >= 4.0 ? 'Dat' : 'KhongDat',
    };

    if (course.id) {
      const res = await updateCourseGrades(course.id, updates);
      if (res.success) {
        setActionMessage(`Đã cập nhật điểm môn ${course.ten_hoc_phan} thành công!`);
        onDataChanged();
      } else {
        setActionMessage(`Lỗi cập nhật: ${res.error}`);
      }
    } else {
      setActionMessage('Đã tính lại điểm mô phỏng thành công!');
    }
    setEditingCourseId(null);
  };

  // Danh sách các học kỳ có trong bảng điểm
  const semestersList = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.hoc_ky) set.add(c.hoc_ky);
    });
    return Array.from(set);
  }, [courses]);

  // Lọc môn học theo học kỳ được chọn
  const filteredCourses = useMemo(() => {
    if (selectedSemester === 'all') return courses;
    return courses.filter((c) => c.hoc_ky === selectedSemester);
  }, [courses, selectedSemester]);

  // Thống kê cho bảng điểm hiện tại
  const currentSemesterStats = useMemo(() => {
    let totalCredits = 0;
    let qualityPoints = 0;
    let totalScore10 = 0;
    let gradedCount = 0;

    filteredCourses.forEach((c) => {
      const credits = c.so_tin_chi || 0;
      totalCredits += credits;
      if (c.diem_thang_4 !== undefined) {
        qualityPoints += c.diem_thang_4 * credits;
      }
      if (c.diem_tong_ket !== undefined) {
        totalScore10 += c.diem_tong_ket * credits;
        gradedCount += credits;
      }
    });

    const semGpa4 = totalCredits > 0 ? Math.round((qualityPoints / totalCredits) * 100) / 100 : 0;
    const semAvg10 = gradedCount > 0 ? Math.round((totalScore10 / gradedCount) * 10) / 10 : 0;

    return { totalCredits, semGpa4, semAvg10 };
  }, [filteredCourses]);

  // Form thêm môn mới
  const [newCourseData, setNewCourseData] = useState<Partial<StudentCourse>>({
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
  });

  const handleSelectQuickBica = (code: string) => {
    const found = BICA_CURRICULUM.find((c) => c.ma_hoc_phan === code);
    if (found) {
      setNewCourseData((prev) => ({
        ...prev,
        ma_hoc_phan: found.ma_hoc_phan,
        ten_hoc_phan: found.ten_hoc_phan,
        so_tin_chi: found.so_tin_chi,
        hoc_ky: `Học kỳ ${found.hoc_ky_goi_y}`,
      }));
    }
  };

  const handleSaveNewCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseData.ma_hoc_phan || !newCourseData.ten_hoc_phan) {
      setActionMessage('Vui lòng điền mã học phần và tên môn học!');
      return;
    }
    setSavingCourse(true);
    setActionMessage(null);

    const cc = Number(newCourseData.diem_chuyen_can ?? 10);
    const gk = Number(newCourseData.diem_giua_ky ?? 8.5);
    const ck = Number(newCourseData.diem_cuoi_ky ?? 9.0);
    const final10 = Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10;
    const { letter, gpa4 } = convertGradeScale(final10);

    const payload: any = {
      ma_sinh_vien: studentId || profile.ma_sinh_vien,
      ma_hoc_phan: newCourseData.ma_hoc_phan,
      ten_hoc_phan: newCourseData.ten_hoc_phan,
      so_tin_chi: Number(newCourseData.so_tin_chi || 3),
      hoc_ky: newCourseData.hoc_ky || 'Học kỳ 1',
      nam_hoc: newCourseData.nam_hoc || '2025-2026',
      diem_chuyen_can: cc,
      diem_giua_ky: gk,
      diem_cuoi_ky: ck,
      diem_tong_ket: final10,
      diem_chu: letter,
      diem_thang_4: gpa4,
      ket_qua: final10 >= 4.0 ? 'Dat' : 'KhongDat',
    };

    if (user?.id) payload.user_id = user.id;

    try {
      let { error } = await supabase.from('khoa_hoc_sinh_vien').insert([payload]);
      if (error && error.message?.includes('user_id')) {
        delete payload.user_id;
        const retry = await supabase.from('khoa_hoc_sinh_vien').insert([payload]);
        error = retry.error;
      }

      if (error) {
        setActionMessage(`Lỗi lưu vào Supabase: ${error.message}`);
      } else {
        setActionMessage(`Đã thêm môn [${payload.ma_hoc_phan}] ${payload.ten_hoc_phan} thành công!`);
        setIsAddingCourse(false);
        onDataChanged();
      }
    } catch (err: any) {
      setActionMessage(`Lỗi: ${err.message}`);
    } finally {
      setSavingCourse(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ----------------- TOP HEADER BANNER ----------------- */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Calculator className="w-6 h-6 text-purple-600" />
              <span>Quản Lý Điểm Số & Dự Báo GPA (What-if Calculator)</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-purple-100 to-indigo-100 text-purple-800 border border-purple-200 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin" />
              <span>Interactive Simulator</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Nhập điểm thành phần để tính điểm hệ 10/4, dự đoán điểm tối thiểu cần đạt cho các kỳ và mô phỏng mục tiêu tốt nghiệp
          </p>
        </div>

        {/* Controls: Semester dropdown & Add Course */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              id="select-what-if-semester"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">Tất cả các học kỳ</option>
              {semestersList.map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
              <option value="Học kỳ 1">Học kỳ 1 (2025 - 2026)</option>
              <option value="Học kỳ 2">Học kỳ 2 (2025 - 2026)</option>
              <option value="Học kỳ 3">Học kỳ 1 (2026 - 2027)</option>
            </select>
          </div>

          <button
            id="btn-open-curriculum-modal-whatif"
            onClick={() => setIsCurriculumModalOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-xs"
            title="Tải môn từ Khung CTĐT BICA"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Khung CTĐT BICA</span>
          </button>

          <button
            id="btn-add-course-whatif"
            onClick={() => setIsAddingCourse(!isAddingCourse)}
            className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Môn</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
          actionMessage.includes('Lỗi')
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form thêm môn nhanh */}
      {isAddingCourse && (
        <form onSubmit={handleSaveNewCourse} className="bg-white rounded-2xl p-6 border border-purple-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Plus className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm">Thêm Môn Học Vào Bộ Mô Phỏng & Bảng Điểm</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingCourse(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3">
            <label className="text-xs font-semibold text-purple-900 block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Chọn nhanh từ Khung CTĐT BICA:</span>
            </label>
            <select
              onChange={(e) => handleSelectQuickBica(e.target.value)}
              defaultValue=""
              className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Nhấp để chọn môn trong CTĐT BICA K2025 --</option>
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
                placeholder="VD: IEA2001"
                value={newCourseData.ma_hoc_phan}
                onChange={(e) => setNewCourseData({ ...newCourseData, ma_hoc_phan: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white uppercase font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Tên môn học</label>
              <input
                type="text"
                required
                placeholder="VD: Kỹ thuật Lập trình và Thuật toán"
                value={newCourseData.ten_hoc_phan}
                onChange={(e) => setNewCourseData({ ...newCourseData, ten_hoc_phan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Số tín chỉ</label>
              <input
                type="number"
                min="1"
                max="10"
                value={newCourseData.so_tin_chi}
                onChange={(e) => setNewCourseData({ ...newCourseData, so_tin_chi: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Chuyên cần (10%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourseData.diem_chuyen_can}
                onChange={(e) => setNewCourseData({ ...newCourseData, diem_chuyen_can: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Giữa kỳ (30%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourseData.diem_giua_ky}
                onChange={(e) => setNewCourseData({ ...newCourseData, diem_giua_ky: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Cuối kỳ (60%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourseData.diem_cuoi_ky}
                onChange={(e) => setNewCourseData({ ...newCourseData, diem_cuoi_ky: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Học kỳ</label>
              <input
                type="text"
                value={newCourseData.hoc_ky}
                onChange={(e) => setNewCourseData({ ...newCourseData, hoc_ky: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingCourse(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingCourse}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingCourse ? 'Đang lưu...' : 'Lưu Môn Học'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ----------------- PHẦN 1: CỖ MÁY MÔ PHỎNG WHAT-IF (KẾ HOẠCH CPA TỐT NGHIỆP) ----------------- */}
      <div className="bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white relative overflow-hidden shadow-md border border-indigo-900/40">
        <div className="relative z-10 space-y-6">
          {/* Header & Current CPA Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Cỗ máy mô phỏng What-if (Kế hoạch CPA tốt nghiệp)</span>
                </h2>
                <p className="text-xs text-indigo-200/80">
                  Dự đoán số điểm trung bình cần đạt cho các kỳ còn lại để đạt chuẩn xếp loại mong muốn
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-xs font-semibold text-right">
                <span className="text-indigo-200 text-[10px] block">CPA HIỆN TẠI</span>
                <span className="text-emerald-400 text-base font-extrabold font-mono">
                  {simCurrentCpa.toFixed(2)}
                </span>
                <span className="text-slate-400 text-[10px] ml-1">/ 4.00</span>
              </div>
            </div>
          </div>

          {/* Slider & Milestones */}
          <div className="space-y-3 bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-semibold text-indigo-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                <span>Mục tiêu CPA tốt nghiệp mong muốn:</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.01"
                  min="2.00"
                  max="4.00"
                  value={targetCpa}
                  onChange={(e) => setTargetCpa(Math.min(4.0, Math.max(2.0, Number(e.target.value))))}
                  className="w-20 px-3 py-1 bg-white/10 border border-white/20 rounded-xl text-center text-sm font-bold font-mono text-white focus:bg-white/20 focus:outline-none"
                />
                <span className="text-xs text-indigo-300 font-medium">/ 4.00</span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="2.00"
              max="4.00"
              step="0.01"
              value={targetCpa}
              onChange={(e) => setTargetCpa(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />

            {/* Milestone Buttons */}
            <div className="flex justify-between items-center text-xs pt-1 px-1">
              <button
                type="button"
                onClick={() => setTargetCpa(2.50)}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 2.50 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                2.50 (Khá)
              </button>
              <button
                type="button"
                onClick={() => setTargetCpa(3.20)}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 3.20 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                3.20 (Giỏi)
              </button>
              <button
                type="button"
                onClick={() => setTargetCpa(3.60)}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 3.60 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                3.60 (Xuất sắc)
              </button>
              <button
                type="button"
                onClick={() => setTargetCpa(3.80)}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 3.80 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                3.80 (Thủ khoa)
              </button>
            </div>
          </div>

          {/* KẾT QUẢ PHÂN TÍCH (Analysis Result Box matching video) */}
          <div className="bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                KẾT QUẢ PHÂN TÍCH
              </span>
              <span className="text-[11px] text-slate-400">
                Chương trình chuẩn: {totalCurriculumCredits} Tín chỉ
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Đã tích lũy</span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5 block">
                  {simCompletedCredits} <span className="text-xs font-normal text-slate-400">TC</span>
                </span>
                <span className="text-[10px] text-emerald-400 mt-1 block">
                  Đạt {completionPercent}% CTĐT
                </span>
              </div>

              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Số tín chỉ còn lại</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-300 font-mono mt-0.5 block">
                  {remainingCredits} <span className="text-xs font-normal text-slate-400">TC</span>
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Cần hoàn thành
                </span>
              </div>

              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 sm:col-span-2">
                <span className="text-[11px] text-slate-400 block">GPA cần đạt mỗi tín chỉ còn lại</span>
                <div className="flex items-baseline space-x-2 mt-0.5">
                  <span className={`text-2xl sm:text-3xl font-black font-mono ${
                    requiredGpa <= 0
                      ? 'text-emerald-400'
                      : requiredGpa <= 3.2
                      ? 'text-emerald-400'
                      : requiredGpa <= 3.6
                      ? 'text-blue-400'
                      : requiredGpa <= 4.0
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}>
                    {requiredGpa <= 0 ? '0.00' : requiredGpa > 4.0 ? '> 4.00' : requiredGpa.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">/ 4.00</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ml-auto ${
                    requiredGpa <= 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : requiredGpa <= 3.2
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : requiredGpa <= 3.6
                      ? 'bg-blue-500/20 text-blue-300'
                      : requiredGpa <= 4.0
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>
                    {requiredGpa <= 0
                      ? 'Đã đạt'
                      : requiredGpa <= 3.2
                      ? 'Rất khả thi'
                      : requiredGpa <= 3.6
                      ? 'Khả thi'
                      : requiredGpa <= 4.0
                      ? 'Cần nỗ lực lớn'
                      : 'Không khả thi'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1.5 font-medium">
                  {requiredGpa <= 0
                    ? '🎉 Điểm CPA hiện tại của bạn đã vượt mức mục tiêu mong muốn!'
                    : requiredGpa <= 3.2
                    ? `Bạn cần duy trì điểm trung bình các kỳ sau là ~${requiredGpa.toFixed(2)}/4.00 để tốt nghiệp loại ${targetCpa >= 3.6 ? 'Xuất sắc' : targetCpa >= 3.2 ? 'Giỏi' : 'Khá'}.`
                    : requiredGpa <= 3.6
                    ? `Mục tiêu khá thử thách: Bạn cần đạt trung bình B+ đến A (GPA ${requiredGpa.toFixed(2)}) ở tất cả các môn còn lại.`
                    : requiredGpa <= 4.0
                    ? `Thử thách cực lớn: Bạn cần đạt điểm A tuyệt đối ở hầu hết tất cả các môn còn lại để cán đích ${targetCpa.toFixed(2)}.`
                    : `⚠️ Bất khả thi: Ngay cả khi đạt điểm A tuyệt đối (4.0) ở toàn bộ ${remainingCredits} tín chỉ còn lại, CPA tối đa bạn có thể đạt được là ${maxPossibleCpa.toFixed(2)} / 4.00.`}
                </p>
              </div>
            </div>

            {/* Chỉnh sửa tham số mô phỏng thủ công */}
            <div className="pt-1 flex items-center justify-between text-xs text-indigo-300/80">
              <button
                type="button"
                onClick={() => setIsCustomSimParams(!isCustomSimParams)}
                className="hover:underline flex items-center gap-1 font-medium text-slate-300"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isCustomSimParams ? 'Thu gọn điều chỉnh số liệu' : 'Tùy chỉnh nhanh số tín chỉ & CPA hiện tại để thử nghiệm'}</span>
              </button>
            </div>

            {isCustomSimParams && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1">Số tín chỉ đã tích lũy (giả định)</label>
                  <input
                    type="number"
                    min="0"
                    max={totalCurriculumCredits}
                    value={simCompletedCredits}
                    onChange={(e) => setSimCompletedCredits(Math.min(totalCurriculumCredits, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">CPA hiện tại (giả định)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.0"
                    max="4.0"
                    value={simCurrentCpa}
                    onChange={(e) => setSimCurrentCpa(Math.min(4.0, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------------- PHẦN 2: CÔNG CỤ TÍNH ĐIỂM THI CUỐI KỲ CẦN ĐẠT (BREAK-EVEN EXAM SCORE) ----------------- */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>Công cụ tính điểm thi cuối kỳ cần đạt (Break-Even Exam Score)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Biết trước số điểm bài thi cuối kỳ tối thiểu để đạt điểm chữ mong muốn (A, B+, B, C+)
            </p>
          </div>

          {/* Quick course pick from registered list */}
          {courses.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">Chọn môn học:</span>
              <select
                value={beCourseId}
                onChange={(e) => handleSelectCourseForBreakEven(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Chọn môn từ bảng điểm của bạn --</option>
                {courses.map((c) => (
                  <option key={c.id || c.ma_hoc_phan} value={c.id || c.ma_hoc_phan}>
                    [{c.ma_hoc_phan}] {c.ten_hoc_phan}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form nhập điểm thành phần & trọng số */}
          <div className="lg:col-span-5 space-y-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 text-xs">
            <div>
              <label className="font-bold text-slate-800 block mb-1">Tên môn học cần tính toán</label>
              <input
                type="text"
                value={beCourseName}
                onChange={(e) => setBeCourseName(e.target.value)}
                placeholder="Nhập tên môn học..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Chuyên cần ({beWeightCC}%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={beScoreCC}
                  onChange={(e) => setBeScoreCC(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-sm font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Giữa kỳ ({beWeightGK}%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={beScoreGK}
                  onChange={(e) => setBeScoreGK(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-sm font-semibold"
                />
              </div>
            </div>

            {/* Trọng số thi cuối kỳ */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Trọng số bài thi cuối kỳ:</span>
                <span className="font-mono text-indigo-600 text-xs font-bold">{beWeightCK}%</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[50, 60, 70].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setBeWeightCK(w);
                      setBeWeightGK(w === 50 ? 40 : w === 60 ? 30 : 20);
                      setBeWeightCC(10);
                    }}
                    className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      beWeightCK === w
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Cuối kỳ {w}%
                  </button>
                ))}
              </div>
            </div>

            {/* Điểm quá trình hiện có */}
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-indigo-900 font-medium block">Điểm quá trình trước thi:</span>
                <span className="text-xs text-indigo-700">Hệ số {beWeightCC + beWeightGK}% tổng điểm</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-indigo-700 font-mono">{currentProcessGrade10}</span>
                <span className="text-[10px] text-slate-400 block">/ 10</span>
              </div>
            </div>
          </div>

          {/* Cột hiển thị kết quả Break-even & Thẻ điểm */}
          <div className="lg:col-span-7 space-y-4">
            {/* Target Letter Grade Selection Pills */}
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Chọn mục tiêu điểm chữ mong muốn:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {['A', 'B+', 'B', 'C+', 'C', 'D'].map((grade) => {
                  const score = calculateRequiredExamScore(grade);
                  const isSelected = beTargetGrade === grade;
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setBeTargetGrade(grade)}
                      className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base font-black leading-tight">{grade}</span>
                      <span className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                        ≥ {LETTER_GRADE_THRESHOLDS[grade]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Highlighted Result Card for Selected Target */}
            <div className="bg-linear-to-r from-indigo-50 via-purple-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-indigo-900 block">
                    Mục tiêu điểm chữ: <span className="text-lg font-extrabold text-indigo-700">Điểm {beTargetGrade}</span> (≥ {LETTER_GRADE_THRESHOLDS[beTargetGrade]} thang 10)
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Bài thi cuối kỳ ({beWeightCK}%) tối thiểu bạn phải đạt:
                  </p>
                </div>

                <div className="text-right sm:text-right">
                  <div className="flex items-baseline space-x-1.5 justify-start sm:justify-end">
                    <span className={`text-3xl sm:text-4xl font-black font-mono ${
                      selectedTargetExamScore > 10
                        ? 'text-red-600'
                        : selectedTargetExamScore <= 5.0
                        ? 'text-emerald-600'
                        : selectedTargetExamScore <= 7.5
                        ? 'text-blue-600'
                        : 'text-amber-600'
                    }`}>
                      {selectedTargetExamScore <= 0 ? '0.0' : selectedTargetExamScore.toFixed(1)}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">/ 10</span>
                  </div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border mt-1 ${getFeasibilityBadge(selectedTargetExamScore).color}`}>
                    {getFeasibilityBadge(selectedTargetExamScore).text}
                  </span>
                </div>
              </div>

              {/* Progress bar visualizer */}
              <div className="mt-4">
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      selectedTargetExamScore > 10
                        ? 'bg-red-500'
                        : selectedTargetExamScore <= 5.0
                        ? 'bg-emerald-500'
                        : selectedTargetExamScore <= 7.5
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, (selectedTargetExamScore / 10) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>0.0 (Dễ)</span>
                  <span>5.0 (Trung bình)</span>
                  <span>8.0 (Cao)</span>
                  <span>10.0 (Tuyệt đối)</span>
                </div>
              </div>
            </div>

            {/* Quick breakdown table for all targets of this course */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-semibold text-slate-700 flex justify-between">
                <span>Bảng tra cứu nhanh mọi mức điểm chữ:</span>
                <span>Trọng số CK: {beWeightCK}%</span>
              </div>
              <div className="divide-y divide-slate-100">
                {['A', 'B+', 'B', 'C+', 'D'].map((g) => {
                  const req = calculateRequiredExamScore(g);
                  const badge = getFeasibilityBadge(req);
                  return (
                    <div key={g} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 w-8">{g}</span>
                        <span className="text-slate-500 text-[11px]">Tổng kết ≥ {LETTER_GRADE_THRESHOLDS[g]}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-slate-800">
                          {req <= 0 ? '0.0' : req.toFixed(1)} / 10
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.color}`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- PHẦN 3: BẢNG ĐIỂM CHI TIẾT & TÍNH THÀNH PHẦN ----------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
        {/* Table Header & Semester Summary Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <span>Bảng điểm chi tiết & tính thành phần</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhấp trực tiếp hoặc sửa nhanh điểm Chuyên cần, Giữa kỳ, Cuối kỳ để hệ thống tự động quy đổi hệ 10 & hệ 4
            </p>
          </div>

          {/* Quick Semester Stats */}
          <div className="flex items-center space-x-3 text-xs bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[10px]">TỔNG TÍN CHỈ</span>
              <span className="font-bold font-mono text-slate-800">{currentSemesterStats.totalCredits} TC</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">GPA HỆ 4.0</span>
              <span className="font-bold font-mono text-emerald-600">{currentSemesterStats.semGpa4.toFixed(2)}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">ĐIỂM TB HỆ 10</span>
              <span className="font-bold font-mono text-indigo-600">{currentSemesterStats.semAvg10.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredCourses.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {user ? 'Chưa có môn học nào trong bảng điểm' : 'Chưa đăng nhập tài khoản sinh viên'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {user
                ? 'Bạn có thể bấm "Khung CTĐT BICA" để tải nhanh các môn học mẫu, hoặc bấm "Thêm Môn" để nhập điểm.'
                : 'Vui lòng đăng nhập tài khoản để lưu và theo dõi bảng điểm học tập của riêng bạn.'}
            </p>
            <div className="mt-4 flex justify-center space-x-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => setIsCurriculumModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:bg-purple-700"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chọn từ Khung CTĐT BICA</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center space-x-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:bg-blue-700"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập ngay</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Mã & Tên Môn Học</th>
                  <th className="py-3 px-3 text-center">Số TC</th>
                  <th className="py-3 px-3 text-center">Chuyên cần (10%)</th>
                  <th className="py-3 px-3 text-center">Giữa kỳ (30%)</th>
                  <th className="py-3 px-3 text-center bg-purple-50/40 text-purple-900">Điểm QT (40%)</th>
                  <th className="py-3 px-3 text-center">Cuối kỳ (60%)</th>
                  <th className="py-3 px-3 text-center bg-indigo-50/40 text-indigo-900">Tổng kết (10)</th>
                  <th className="py-3 px-3 text-center">Hệ 4.0</th>
                  <th className="py-3 px-3 text-center">Điểm chữ</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((course) => {
                  const isEditing = editingCourseId === (course.id || course.ma_hoc_phan);
                  const cc = isEditing ? editRowValues.diem_chuyen_can : Number(course.diem_chuyen_can ?? 10);
                  const gk = isEditing ? editRowValues.diem_giua_ky : Number(course.diem_giua_ky ?? 8.0);
                  const ck = isEditing ? editRowValues.diem_cuoi_ky : Number(course.diem_cuoi_ky ?? 8.5);

                  // Real-time calculated scores
                  const qt = Math.round(((cc * 0.1 + gk * 0.3) / 0.4) * 10) / 10;
                  const final10 = isEditing
                    ? Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10
                    : Number(course.diem_tong_ket ?? Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10);

                  const { letter, gpa4 } = convertGradeScale(final10);

                  return (
                    <tr key={course.id || course.ma_hoc_phan} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="font-semibold text-slate-800">{course.ten_hoc_phan}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                          <span>{course.ma_hoc_phan}</span>
                          <span>•</span>
                          <span>{course.hoc_ky}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {course.so_tin_chi}
                      </td>

                      {/* Chuyên cần */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={editRowValues.diem_chuyen_can}
                            onChange={(e) => setEditRowValues({ ...editRowValues, diem_chuyen_can: Number(e.target.value) })}
                            className="w-14 px-1.5 py-1 text-center bg-white border border-purple-300 rounded font-mono font-semibold"
                          />
                        ) : (
                          <span className="font-mono text-slate-700">{course.diem_chuyen_can ?? '---'}</span>
                        )}
                      </td>

                      {/* Giữa kỳ */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={editRowValues.diem_giua_ky}
                            onChange={(e) => setEditRowValues({ ...editRowValues, diem_giua_ky: Number(e.target.value) })}
                            className="w-14 px-1.5 py-1 text-center bg-white border border-purple-300 rounded font-mono font-semibold"
                          />
                        ) : (
                          <span className="font-mono text-slate-700">{course.diem_giua_ky ?? '---'}</span>
                        )}
                      </td>

                      {/* Điểm QT (40%) */}
                      <td className="py-3 px-3 text-center bg-purple-50/40 font-mono font-bold text-purple-700">
                        {qt.toFixed(1)}
                      </td>

                      {/* Cuối kỳ */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={editRowValues.diem_cuoi_ky}
                            onChange={(e) => setEditRowValues({ ...editRowValues, diem_cuoi_ky: Number(e.target.value) })}
                            className="w-14 px-1.5 py-1 text-center bg-white border border-purple-300 rounded font-mono font-semibold"
                          />
                        ) : (
                          <span className="font-mono text-slate-700">{course.diem_cuoi_ky ?? '---'}</span>
                        )}
                      </td>

                      {/* Tổng kết (10) */}
                      <td className="py-3 px-3 text-center bg-indigo-50/40 font-mono font-extrabold text-slate-900 text-sm">
                        {final10.toFixed(1)}
                      </td>

                      {/* Hệ 4.0 */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">
                        {gpa4.toFixed(1)}
                      </td>

                      {/* Điểm chữ */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-xs ${
                          letter.startsWith('A')
                            ? 'bg-emerald-100 text-emerald-800'
                            : letter.startsWith('B')
                            ? 'bg-blue-100 text-blue-800'
                            : letter.startsWith('C')
                            ? 'bg-amber-100 text-amber-800'
                            : letter.startsWith('D')
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {letter}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(course)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                              title="Lưu điểm môn này"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCourseId(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditRow(course)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 rounded-lg font-medium transition-colors"
                            title="Sửa điểm nhanh"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal chọn môn từ Khung CTĐT BICA */}
      <BicaCurriculumPickerModal
        isOpen={isCurriculumModalOpen}
        onClose={() => setIsCurriculumModalOpen(false)}
        existingCourseCodes={courses.map((c) => c.ma_hoc_phan)}
        onSelectCourses={handleSelectCoursesFromCurriculum}
        isSubmitting={isBatchAdding}
      />
    </div>
  );
};
