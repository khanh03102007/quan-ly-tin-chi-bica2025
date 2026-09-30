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
import { BicaCurriculumPickerModal, CourseWithGradePayload } from './BicaCurriculumPickerModal';
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

  // Xử lý nạp các môn chọn từ Khung CTĐT BICA kèm điểm số đã chọn
  const handleSelectCoursesFromCurriculum = async (
    selectedCourses: CourseWithGradePayload[],
    status?: 'DangHoc' | 'Dat'
  ) => {
    setIsBatchAdding(true);
    setActionMessage(null);
    try {
      const items = selectedCourses.map((c) => ({
        ma_hoc_phan: c.ma_hoc_phan,
        ten_hoc_phan: c.ten_hoc_phan,
        so_tin_chi: c.so_tin_chi,
        hoc_ky_goi_y: c.hoc_ky_goi_y,
        ket_qua: c.ket_qua || status || 'DangHoc',
        diem_chuyen_can: c.diem_chuyen_can,
        diem_giua_ky: c.diem_giua_ky,
        diem_cuoi_ky: c.diem_cuoi_ky,
        diem_tong_ket: c.diem_tong_ket !== undefined ? c.diem_tong_ket : (status === 'Dat' ? 8.5 : undefined),
        diem_chu: c.diem_chu || (status === 'Dat' ? 'A' : undefined),
        diem_thang_4: c.diem_thang_4 !== undefined ? c.diem_thang_4 : (status === 'Dat' ? 4.0 : undefined),
      }));

      const res = await batchAddBicaCourses(items, studentId || profile.ma_sinh_vien, user);
      if (res.success) {
        setActionMessage(`✅ Đã nạp thành công ${res.count} môn học kèm điểm số từ Khung CTĐT BICA vào danh sách!`);
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

  // Cho phép người dùng tùy chỉnh tham số mô phỏng What-if (bỏ số 0 mặc định để sinh viên tự nhập trực tiếp)
  const [simCreditsInput, setSimCreditsInput] = useState<string>(
    actualCompletedCredits > 0 ? String(actualCompletedCredits) : ''
  );
  const [simCpaInput, setSimCpaInput] = useState<string>(
    actualCurrentCpa > 0 ? String(actualCurrentCpa) : ''
  );
  const [targetCpa, setTargetCpa] = useState<number>(3.20);
  const [targetCpaInput, setTargetCpaInput] = useState<string>('3.2');
  const [isCustomSimParams, setIsCustomSimParams] = useState<boolean>(true);

  const simCompletedCredits = useMemo(() => {
    const parsed = parseFloat(simCreditsInput);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(totalCurriculumCredits, parsed);
  }, [simCreditsInput, totalCurriculumCredits]);

  const simCurrentCpa = useMemo(() => {
    const parsed = parseFloat(simCpaInput);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(4.0, parsed);
  }, [simCpaInput]);

  // Cập nhật khi dữ liệu tài khoản thay đổi
  React.useEffect(() => {
    if (user) {
      setSimCreditsInput(actualCompletedCredits > 0 ? String(actualCompletedCredits) : '');
      setSimCpaInput(actualCurrentCpa > 0 ? String(actualCurrentCpa) : '');
    }
  }, [actualCompletedCredits, actualCurrentCpa, user]);

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
  const [beWeightCC, setBeWeightCC] = useState<10 | 20>(10); // Tự chọn 10% hoặc 20%
  const [beWeightGK, setBeWeightGK] = useState<30 | 20>(30); // Tự chọn 30% hoặc 20%
  const beWeightCK = 60; // Cuối kỳ cố định 60%
  const [beScoreCCInput, setBeScoreCCInput] = useState<string>('10');
  const [beScoreGKInput, setBeScoreGKInput] = useState<string>('8.5');
  const [beTargetGrade, setBeTargetGrade] = useState<string>('A');

  const beScoreCC = useMemo(() => {
    const parsed = parseFloat(beScoreCCInput);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(10, parsed);
  }, [beScoreCCInput]);

  const beScoreGK = useMemo(() => {
    const parsed = parseFloat(beScoreGKInput);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(10, parsed);
  }, [beScoreGKInput]);

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
      if (found.diem_chuyen_can !== undefined && found.diem_chuyen_can !== null) {
        setBeScoreCCInput(String(found.diem_chuyen_can));
      }
      if (found.diem_giua_ky !== undefined && found.diem_giua_ky !== null) {
        setBeScoreGKInput(String(found.diem_giua_ky));
      }
      if (found.diem_chu) setBeTargetGrade(found.diem_chu);
    }
  };

  // -------------------------------------------------------------
  // PHẦN 3: BẢNG ĐIỂM TỔNG KẾT HỆ 10 & HỆ 4 (INLINE EDIT)
  // -------------------------------------------------------------
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editRowValues, setEditRowValues] = useState<{
    diem_tong_ket: number;
    diem_thang_4: number;
  }>({ diem_tong_ket: 8.5, diem_thang_4: 4.0 });

  const startEditRow = (course: StudentCourse) => {
    const score10 = Number(course.diem_tong_ket ?? 8.5);
    const { gpa4 } = convertGradeScale(score10);
    setEditingCourseId(course.id || course.ma_hoc_phan);
    setEditRowValues({
      diem_tong_ket: score10,
      diem_thang_4: Number(course.diem_thang_4 ?? gpa4),
    });
  };

  const handleSaveInlineEdit = async (course: StudentCourse) => {
    const total10 = Math.round(Number(editRowValues.diem_tong_ket || 0) * 10) / 10;
    const { letter, gpa4: autoGpa4 } = convertGradeScale(total10);
    const finalGpa4 =
      editRowValues.diem_thang_4 !== undefined && !isNaN(Number(editRowValues.diem_thang_4))
        ? Math.round(Number(editRowValues.diem_thang_4) * 100) / 100
        : autoGpa4;

    const updates: Partial<StudentCourse> = {
      diem_tong_ket: total10,
      diem_chu: letter,
      diem_thang_4: finalGpa4,
      ket_qua: total10 >= 4.0 ? 'Dat' : 'KhongDat',
    };

    if (course.id) {
      const res = await updateCourseGrades(course.id, updates);
      if (res.success) {
        setActionMessage(`Đã cập nhật điểm tổng kết môn ${course.ten_hoc_phan} thành công!`);
        onDataChanged();
      } else {
        setActionMessage(`Lỗi cập nhật: ${res.error}`);
      }
    } else {
      setActionMessage('Đã tính lại điểm tổng kết mô phỏng thành công!');
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
    diem_tong_ket: 8.5,
    diem_chu: 'A',
    diem_thang_4: 4.0,
    ket_qua: 'Dat',
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

    const final10 = Math.round(Number(newCourseData.diem_tong_ket ?? 8.5) * 10) / 10;
    const { letter, gpa4: autoGpa4 } = convertGradeScale(final10);
    const finalGpa4 =
      newCourseData.diem_thang_4 !== undefined && !isNaN(Number(newCourseData.diem_thang_4))
        ? Number(newCourseData.diem_thang_4)
        : autoGpa4;

    const payload: any = {
      ma_sinh_vien: studentId || profile.ma_sinh_vien,
      ma_hoc_phan: newCourseData.ma_hoc_phan,
      ten_hoc_phan: newCourseData.ten_hoc_phan,
      so_tin_chi: Number(newCourseData.so_tin_chi || 3),
      hoc_ky: newCourseData.hoc_ky || 'Học kỳ 1',
      nam_hoc: newCourseData.nam_hoc || '2025-2026',
      diem_tong_ket: final10,
      diem_chu: letter,
      diem_thang_4: finalGpa4,
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
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-700" />
              <span>CÔNG CỤ DỰ BÁO KẾT QUẢ HỌC VỤ & MÔ PHỎNG CPA</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-700 bg-slate-100 border border-slate-300">
              Mô phỏng What-If
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Quản lý điểm tổng kết hệ 10 & tổng kết hệ 4, dự báo điểm thi cuối kỳ tối thiểu (Break-Even) và lập kế hoạch CPA tốt nghiệp
          </p>
        </div>

        {/* Controls: Semester dropdown & Add Course */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              id="select-what-if-semester"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-700 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
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
            className="inline-flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors shadow-2xs"
            title="Tải môn từ Khung CTĐT BICA"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Nạp khung CTĐT</span>
          </button>

          <button
            id="btn-add-course-whatif"
            onClick={() => setIsAddingCourse(!isAddingCourse)}
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-md transition-colors border border-slate-300 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Thêm môn</span>
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
              <label className="font-semibold text-slate-700 block mb-1">Điểm Tổng Kết Hệ 10</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newCourseData.diem_tong_ket ?? 8.5}
                onChange={(e) => {
                  const val = Math.min(10, Math.max(0, Number(e.target.value)));
                  const { letter, gpa4 } = convertGradeScale(val);
                  setNewCourseData({
                    ...newCourseData,
                    diem_tong_ket: val,
                    diem_thang_4: gpa4,
                    diem_chu: letter,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-bold text-indigo-700"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Tổng Kết Hệ 4</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="4"
                value={newCourseData.diem_thang_4 ?? 4.0}
                onChange={(e) =>
                  setNewCourseData({
                    ...newCourseData,
                    diem_thang_4: Math.min(4, Math.max(0, Number(e.target.value))),
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-bold text-emerald-700"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Chữ Quy Đổi</label>
              <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg font-bold text-purple-900">
                {newCourseData.diem_chu || convertGradeScale(Number(newCourseData.diem_tong_ket ?? 8.5)).letter}
              </div>
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

      {/* ----------------- PHẦN 1: MÔ PHỎNG WHAT-IF (KẾ HOẠCH CPA TỐT NGHIỆP) ----------------- */}
      <div className="bg-slate-900 rounded-xl p-5 sm:p-6 text-white border border-slate-800 shadow-sm">
        <div className="space-y-6">
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
                  placeholder="3.20"
                  value={targetCpaInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTargetCpaInput(raw);
                    const num = parseFloat(raw);
                    if (!Number.isNaN(num)) {
                      setTargetCpa(Math.min(4.0, Math.max(2.0, num)));
                    }
                  }}
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
              onChange={(e) => {
                const val = Number(e.target.value);
                setTargetCpa(val);
                setTargetCpaInput(String(val));
              }}
              className="w-full h-2.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />

            {/* Milestone Buttons */}
            <div className="flex justify-between items-center text-xs pt-1 px-1">
              <button
                type="button"
                onClick={() => {
                  setTargetCpa(2.50);
                  setTargetCpaInput('2.50');
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 2.50 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                2.50 (Khá)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetCpa(3.20);
                  setTargetCpaInput('3.20');
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 3.20 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                3.20 (Giỏi)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetCpa(3.60);
                  setTargetCpaInput('3.60');
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  targetCpa === 3.60 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                3.60 (Xuất sắc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetCpa(3.80);
                  setTargetCpaInput('3.80');
                }}
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
                    type="text"
                    inputMode="numeric"
                    placeholder="Nhập số tín chỉ tích lũy (VD: 30)..."
                    value={simCreditsInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                      if (raw === '') {
                        setSimCreditsInput('');
                        return;
                      }
                      const num = Math.min(totalCurriculumCredits, parseInt(raw, 10));
                      setSimCreditsInput(String(num));
                    }}
                    className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">CPA hiện tại (giả định)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Nhập CPA hiện tại (VD: 3.45)..."
                    value={simCpaInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                      if (formatted === '') {
                        setSimCpaInput('');
                        return;
                      }
                      const num = parseFloat(formatted);
                      if (!Number.isNaN(num) && num > 4.0) {
                        setSimCpaInput('4.0');
                        return;
                      }
                      setSimCpaInput(formatted);
                    }}
                    className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-400"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Điểm Chuyên cần: tự chọn 10% hoặc 20% */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">
                    Chuyên cần ({beWeightCC}%)
                  </label>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                    {([10, 20] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setBeWeightCC(w);
                          setBeWeightGK(w === 10 ? 30 : 20);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          beWeightCC === w
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {w}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Nhập điểm chuyên cần (0 - 10)..."
                  value={beScoreCCInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                    if (raw === '') {
                      setBeScoreCCInput('');
                      return;
                    }
                    const num = parseFloat(raw);
                    if (!Number.isNaN(num) && num > 10) {
                      setBeScoreCCInput('10');
                      return;
                    }
                    setBeScoreCCInput(raw);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Điểm Giữa kỳ: tự chọn 30% hoặc 20% */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">
                    Giữa kỳ ({beWeightGK}%)
                  </label>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                    {([30, 20] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setBeWeightGK(w);
                          setBeWeightCC(w === 30 ? 10 : 20);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          beWeightGK === w
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {w}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Nhập điểm giữa kỳ (0 - 10)..."
                  value={beScoreGKInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                    if (raw === '') {
                      setBeScoreGKInput('');
                      return;
                    }
                    const num = parseFloat(raw);
                    if (!Number.isNaN(num) && num > 10) {
                      setBeScoreGKInput('10');
                      return;
                    }
                    setBeScoreGKInput(raw);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Trọng số thi cuối kỳ cố định 60% */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Trọng số bài thi cuối kỳ (Cố định):</span>
                <span className="font-mono text-indigo-600 text-xs font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Cuối kỳ 60%
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Cấu trúc trọng số đang áp dụng:</span>
                <span className="font-mono font-bold text-slate-800">
                  CC {beWeightCC}% • GK {beWeightGK}% • CK {beWeightCK}%
                </span>
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
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Mục tiêu điểm chữ: <span className="text-base font-bold text-blue-700">Điểm {beTargetGrade}</span> (≥ {LETTER_GRADE_THRESHOLDS[beTargetGrade]} thang 10)
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

      {/* ----------------- PHẦN 3: BẢNG ĐIỂM TỔNG KẾT HỆ 10 & HỆ 4 ----------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
        {/* Table Header & Semester Summary Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <span>Bảng điểm tổng kết học phần (Hệ 10 & Hệ 4)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi và chỉnh sửa trực tiếp Điểm tổng kết hệ 10 và Điểm tổng kết hệ 4 cho từng học phần
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
              <span className="text-slate-400 block text-[10px]">TỔNG KẾT HỆ 4</span>
              <span className="font-bold font-mono text-emerald-600">{currentSemesterStats.semGpa4.toFixed(2)}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">TỔNG KẾT HỆ 10</span>
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
                  <th className="py-3 px-3">Học Kỳ</th>
                  <th className="py-3 px-3 text-center">Số TC</th>
                  <th className="py-3 px-3 text-center bg-indigo-50/40 text-indigo-900">Điểm Tổng Kết Hệ 10</th>
                  <th className="py-3 px-3 text-center bg-emerald-50/40 text-emerald-900">Điểm Tổng Kết Hệ 4</th>
                  <th className="py-3 px-3 text-center">Điểm Chữ</th>
                  <th className="py-3 px-3 text-center">Kết Quả</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((course) => {
                  const isEditing = editingCourseId === (course.id || course.ma_hoc_phan);
                  const hasGrade = course.diem_tong_ket !== undefined && course.diem_tong_ket !== null;
                  const final10 = isEditing
                    ? editRowValues.diem_tong_ket
                    : Number(course.diem_tong_ket ?? 0);

                  const conv = convertGradeScale(final10);
                  const letter = isEditing ? conv.letter : (course.diem_chu || (hasGrade ? conv.letter : '-'));
                  const gpa4 = isEditing
                    ? editRowValues.diem_thang_4
                    : (course.diem_thang_4 !== undefined && course.diem_thang_4 !== null
                        ? Number(course.diem_thang_4)
                        : (hasGrade ? conv.gpa4 : 0));

                  return (
                    <tr key={course.id || course.ma_hoc_phan} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="font-semibold text-slate-800">{course.ten_hoc_phan}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                          <span>{course.ma_hoc_phan}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {course.hoc_ky}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {course.so_tin_chi}
                      </td>

                      {/* Điểm Tổng Kết Hệ 10 */}
                      <td className="py-3 px-3 text-center bg-indigo-50/40 font-mono font-extrabold text-slate-900 text-sm">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={editRowValues.diem_tong_ket}
                            onChange={(e) => {
                              const val = Math.min(10, Math.max(0, Number(e.target.value)));
                              const { gpa4: newGpa4 } = convertGradeScale(val);
                              setEditRowValues({
                                diem_tong_ket: val,
                                diem_thang_4: newGpa4,
                              });
                            }}
                            className="w-16 px-1.5 py-1 text-center bg-white border border-indigo-300 rounded font-mono font-bold text-indigo-700"
                          />
                        ) : (
                          hasGrade ? final10.toFixed(1) : '-'
                        )}
                      </td>

                      {/* Điểm Tổng Kết Hệ 4 */}
                      <td className="py-3 px-3 text-center bg-emerald-50/40 font-mono font-bold text-emerald-700 text-sm">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="4"
                            value={editRowValues.diem_thang_4}
                            onChange={(e) =>
                              setEditRowValues({
                                ...editRowValues,
                                diem_thang_4: Math.min(4, Math.max(0, Number(e.target.value))),
                              })
                            }
                            className="w-16 px-1.5 py-1 text-center bg-white border border-emerald-300 rounded font-mono font-bold text-emerald-700"
                          />
                        ) : (
                          hasGrade || (course.diem_thang_4 !== undefined && course.diem_thang_4 !== null)
                            ? gpa4.toFixed(1)
                            : '-'
                        )}
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
                            : letter === 'F'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {letter}
                        </span>
                      </td>

                      {/* Kết quả */}
                      <td className="py-3 px-3 text-center">
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
                            title="Sửa điểm tổng kết"
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
