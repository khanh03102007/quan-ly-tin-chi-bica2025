import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Check,
  Plus,
  Layers,
  Calendar,
  AlertCircle,
  GraduationCap,
  Sparkles,
  Info,
  Award,
  Sliders,
  CheckCheck,
} from 'lucide-react';
import {
  BICA_CURRICULUM,
  BICA_KNOWLEDGE_BLOCKS,
  BICA_SEMESTER_INFO,
  BicaCurriculumCourse,
} from '../data/bicaCurriculum';

export interface CourseWithGradePayload extends BicaCurriculumCourse {
  ket_qua: 'Dat' | 'KhongDat' | 'DangHoc';
  diem_chuyen_can?: number;
  diem_giua_ky?: number;
  diem_cuoi_ky?: number;
  diem_tong_ket?: number;
  diem_chu?: string;
  diem_thang_4?: number;
}

export interface CourseGradeSelection {
  ket_qua: 'Dat' | 'KhongDat' | 'DangHoc';
  diem_chuyen_can?: number;
  diem_giua_ky?: number;
  diem_cuoi_ky?: number;
  diem_tong_ket?: number;
  diem_chu?: string;
  diem_thang_4?: number;
}

interface BicaCurriculumPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCourses: (
    courses: CourseWithGradePayload[],
    defaultStatus?: 'DangHoc' | 'Dat'
  ) => Promise<void>;
  existingCourseCodes?: string[];
  isSubmitting?: boolean;
}

export const GRADE_PRESETS = [
  { id: 'DangHoc', label: 'Đang theo học (Chưa có điểm thi)', score: null, letter: '', gpa4: null, status: 'DangHoc' as const, badgeColor: 'bg-blue-100 text-blue-800' },
  { id: 'A_PLUS', label: 'Điểm A+ (9.5 - 10 | Hệ 4: 4.0 | Xuất sắc)', score: 9.5, letter: 'A+', gpa4: 4.0, status: 'Dat' as const, badgeColor: 'bg-emerald-100 text-emerald-800' },
  { id: 'A', label: 'Điểm A (8.5 - 8.9 | Hệ 4: 4.0 | Giỏi)', score: 8.6, letter: 'A', gpa4: 4.0, status: 'Dat' as const, badgeColor: 'bg-emerald-100 text-emerald-800' },
  { id: 'B_PLUS', label: 'Điểm B+ (8.0 - 8.4 | Hệ 4: 3.5 | Khá Giỏi)', score: 8.2, letter: 'B+', gpa4: 3.5, status: 'Dat' as const, badgeColor: 'bg-blue-100 text-blue-800' },
  { id: 'B', label: 'Điểm B (7.0 - 7.9 | Hệ 4: 3.0 | Khá)', score: 7.5, letter: 'B', gpa4: 3.0, status: 'Dat' as const, badgeColor: 'bg-blue-100 text-blue-800' },
  { id: 'C_PLUS', label: 'Điểm C+ (6.5 - 6.9 | Hệ 4: 2.5 | TB Khá)', score: 6.7, letter: 'C+', gpa4: 2.5, status: 'Dat' as const, badgeColor: 'bg-amber-100 text-amber-800' },
  { id: 'C', label: 'Điểm C (5.5 - 6.4 | Hệ 4: 2.0 | Trung Bình)', score: 6.0, letter: 'C', gpa4: 2.0, status: 'Dat' as const, badgeColor: 'bg-amber-100 text-amber-800' },
  { id: 'D_PLUS', label: 'Điểm D+ (5.0 - 5.4 | Hệ 4: 1.5 | TB Yếu)', score: 5.2, letter: 'D+', gpa4: 1.5, status: 'Dat' as const, badgeColor: 'bg-orange-100 text-orange-800' },
  { id: 'D', label: 'Điểm D (4.0 - 4.9 | Hệ 4: 1.0 | Đạt chuẩn)', score: 4.5, letter: 'D', gpa4: 1.0, status: 'Dat' as const, badgeColor: 'bg-orange-100 text-orange-800' },
  { id: 'F', label: 'Điểm F (< 4.0 | Hệ 4: 0.0 | Không đạt)', score: 3.0, letter: 'F', gpa4: 0.0, status: 'KhongDat' as const, badgeColor: 'bg-red-100 text-red-800' },
];

export function convertScoreToGradeInfo(score: number): {
  letter: string;
  gpa4: number;
  status: 'Dat' | 'KhongDat';
} {
  const rounded = Math.round(score * 10) / 10;
  if (rounded >= 9.0) return { letter: 'A+', gpa4: 4.0, status: 'Dat' };
  if (rounded >= 8.5) return { letter: 'A', gpa4: 4.0, status: 'Dat' };
  if (rounded >= 8.0) return { letter: 'B+', gpa4: 3.5, status: 'Dat' };
  if (rounded >= 7.0) return { letter: 'B', gpa4: 3.0, status: 'Dat' };
  if (rounded >= 6.5) return { letter: 'C+', gpa4: 2.5, status: 'Dat' };
  if (rounded >= 5.5) return { letter: 'C', gpa4: 2.0, status: 'Dat' };
  if (rounded >= 5.0) return { letter: 'D+', gpa4: 1.5, status: 'Dat' };
  if (rounded >= 4.0) return { letter: 'D', gpa4: 1.0, status: 'Dat' };
  return { letter: 'F', gpa4: 0.0, status: 'KhongDat' };
}

export const BicaCurriculumPickerModal: React.FC<BicaCurriculumPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectCourses,
  existingCourseCodes = [],
  isSubmitting = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>('all');
  const [selectedBlock, setSelectedBlock] = useState<string>('Tất cả');
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<Set<string>>(new Set());

  // Thiết lập điểm mặc định toàn cục
  const [globalGradePresetId, setGlobalGradePresetId] = useState<string>('DangHoc');
  const [customGlobalScore, setCustomGlobalScore] = useState<number>(8.5);
  const [isCustomScoreMode, setIsCustomScoreMode] = useState<boolean>(false);

  // Lưu cấu hình điểm cho từng môn học riêng biệt (ma_hoc_phan -> CourseGradeSelection)
  const [courseGradesMap, setCourseGradesMap] = useState<Record<string, CourseGradeSelection>>({});

  const existingCodesSet = useMemo(() => {
    return new Set(existingCourseCodes.map((c) => c.toUpperCase().trim()));
  }, [existingCourseCodes]);

  // Lấy dữ liệu điểm hiện tại từ global preset
  const currentGlobalGrade = useMemo<CourseGradeSelection>(() => {
    if (isCustomScoreMode) {
      const conv = convertScoreToGradeInfo(customGlobalScore);
      return {
        ket_qua: conv.status,
        diem_tong_ket: customGlobalScore,
        diem_chu: conv.letter,
        diem_thang_4: conv.gpa4,
      };
    }
    const preset = GRADE_PRESETS.find((p) => p.id === globalGradePresetId);
    if (!preset || preset.id === 'DangHoc') {
      return {
        ket_qua: 'DangHoc',
        diem_tong_ket: undefined,
        diem_chu: undefined,
        diem_thang_4: undefined,
      };
    }
    return {
      ket_qua: preset.status,
      diem_tong_ket: preset.score || undefined,
      diem_chu: preset.letter,
      diem_thang_4: preset.gpa4 || undefined,
    };
  }, [globalGradePresetId, isCustomScoreMode, customGlobalScore]);

  // Lấy điểm hiệu lực cho 1 môn cụ thể
  const getCourseGrade = (code: string): CourseGradeSelection => {
    return courseGradesMap[code] || currentGlobalGrade;
  };

  // Cập nhật điểm cho môn học cụ thể và tự động đánh dấu chọn môn này
  const setSingleCourseGrade = (code: string, grade: CourseGradeSelection) => {
    setCourseGradesMap((prev) => ({
      ...prev,
      [code]: grade,
    }));
    // Tự động thêm môn vào danh sách chọn
    if (!existingCodesSet.has(code.toUpperCase().trim())) {
      setSelectedCourseCodes((prev) => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });
    }
  };

  // Áp dụng điểm toàn cục cho tất cả môn đang chọn
  const handleApplyGlobalGradeToAllSelected = () => {
    const nextMap = { ...courseGradesMap };
    selectedCourseCodes.forEach((code) => {
      nextMap[code] = currentGlobalGrade;
    });
    setCourseGradesMap(nextMap);
  };

  // Lọc danh sách môn học
  const filteredCourses = useMemo(() => {
    return BICA_CURRICULUM.filter((c) => {
      if (selectedSemester !== 'all' && c.hoc_ky_goi_y !== selectedSemester) {
        return false;
      }
      if (selectedBlock !== 'Tất cả' && c.khoi_kien_thuc !== selectedBlock) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const codeMatch = c.ma_hoc_phan.toLowerCase().includes(query);
        const nameMatch = c.ten_hoc_phan.toLowerCase().includes(query);
        const enMatch = c.ten_tieng_anh.toLowerCase().includes(query);
        const moduleMatch = c.nhom_hoac_module?.toLowerCase().includes(query);
        return codeMatch || nameMatch || enMatch || !!moduleMatch;
      }
      return true;
    });
  }, [searchTerm, selectedSemester, selectedBlock]);

  // Tính toán tổng số tín chỉ đã chọn
  const selectedSummary = useMemo(() => {
    const selected = BICA_CURRICULUM.filter((c) => selectedCourseCodes.has(c.ma_hoc_phan));
    const totalCredits = selected.reduce((sum, c) => sum + c.so_tin_chi, 0);
    return {
      count: selected.length,
      credits: totalCredits,
      courses: selected,
    };
  }, [selectedCourseCodes]);

  if (!isOpen) return null;

  const toggleCourse = (code: string) => {
    if (existingCodesSet.has(code.toUpperCase().trim())) return;
    setSelectedCourseCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
        // Gán điểm mặc định hiện hành nếu môn này chưa được chỉnh điểm
        if (!courseGradesMap[code]) {
          setCourseGradesMap((old) => ({
            ...old,
            [code]: currentGlobalGrade,
          }));
        }
      }
      return next;
    });
  };

  const handleSelectAllInView = () => {
    const newSet = new Set(selectedCourseCodes);
    const updatedMap = { ...courseGradesMap };
    filteredCourses.forEach((c) => {
      if (!existingCodesSet.has(c.ma_hoc_phan.toUpperCase().trim())) {
        newSet.add(c.ma_hoc_phan);
        if (!updatedMap[c.ma_hoc_phan]) {
          updatedMap[c.ma_hoc_phan] = currentGlobalGrade;
        }
      }
    });
    setSelectedCourseCodes(newSet);
    setCourseGradesMap(updatedMap);
  };

  const handleDeselectAllInView = () => {
    const newSet = new Set(selectedCourseCodes);
    filteredCourses.forEach((c) => {
      newSet.delete(c.ma_hoc_phan);
    });
    setSelectedCourseCodes(newSet);
  };

  const handleSubmit = async () => {
    if (selectedSummary.count === 0) return;
    const payload: CourseWithGradePayload[] = selectedSummary.courses.map((course) => {
      const grade = getCourseGrade(course.ma_hoc_phan);
      return {
        ...course,
        ket_qua: grade.ket_qua,
        diem_chuyen_can: grade.diem_chuyen_can,
        diem_giua_ky: grade.diem_giua_ky,
        diem_cuoi_ky: grade.diem_cuoi_ky,
        diem_tong_ket: grade.diem_tong_ket,
        diem_chu: grade.diem_chu,
        diem_thang_4: grade.diem_thang_4,
      };
    });

    const fallbackStatus = currentGlobalGrade.ket_qua === 'Dat' ? 'Dat' : 'DangHoc';
    await onSelectCourses(payload, fallbackStatus);
    setSelectedCourseCodes(new Set());
    onClose();
  };

  const handleAddSingleCourse = async (course: BicaCurriculumCourse) => {
    const grade = getCourseGrade(course.ma_hoc_phan);
    const payload: CourseWithGradePayload = {
      ...course,
      ket_qua: grade.ket_qua,
      diem_chuyen_can: grade.diem_chuyen_can,
      diem_giua_ky: grade.diem_giua_ky,
      diem_cuoi_ky: grade.diem_cuoi_ky,
      diem_tong_ket: grade.diem_tong_ket,
      diem_chu: grade.diem_chu,
      diem_thang_4: grade.diem_thang_4,
    };
    const fallbackStatus = grade.ket_qua === 'Dat' ? 'Dat' : 'DangHoc';
    await onSelectCourses([payload], fallbackStatus);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold">KHUNG CHƯƠNG TRÌNH ĐÀO TẠO KHÓA 2025 (BICA - TỰ ĐỘNG HÓA)</h2>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-mono border border-slate-700">
                  145 Tín chỉ
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Chọn học phần theo từng học kỳ để nạp trực tiếp vào hồ sơ bảng điểm sinh viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo mã môn (IEA1001, VJU2002...), tên môn (Mạch điện, Giải tích, Vi xử lý...)"
                className="w-full pl-9.5 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Khối kiến thức Dropdown */}
            <div className="w-full sm:w-72">
              <select
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs text-slate-700"
              >
                {BICA_KNOWLEDGE_BLOCKS.map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tab chọn Học kỳ (1 -> 8) */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedSemester('all')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedSemester === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              Tất cả các kỳ ({BICA_CURRICULUM.length})
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
              const info = BICA_SEMESTER_INFO[sem];
              const count = BICA_CURRICULUM.filter((c) => c.hoc_ky_goi_y === sem).length;
              return (
                <button
                  key={sem}
                  onClick={() => setSelectedSemester(sem)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center space-x-1 ${
                    selectedSemester === sem
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <span>Kỳ {sem}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedSemester === sem ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {info?.tin_chi ? `${info.tin_chi} TC` : `${count} môn`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cài đặt điểm số mặc định cho các môn được chọn */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Cài đặt điểm số nạp vào:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Áp dụng cho các môn bạn tích chọn (có thể tùy chỉnh riêng từng môn bên dưới)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Mode Chọn Điểm Chữ Chuẩn VJU */}
                {!isCustomScoreMode ? (
                  <select
                    id="select-global-grade-preset"
                    value={globalGradePresetId}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setIsCustomScoreMode(true);
                      } else {
                        setGlobalGradePresetId(e.target.value);
                      }
                    }}
                    className="bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  >
                    {GRADE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                    <option value="CUSTOM">✏️ Tự nhập điểm số hệ 10 tùy chỉnh (0.0 - 10.0)</option>
                  </select>
                ) : (
                  <div className="flex items-center space-x-1.5 bg-white border border-blue-300 rounded-lg px-2 py-1 shadow-2xs">
                    <span className="text-xs font-semibold text-slate-600">Điểm hệ 10:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={customGlobalScore}
                      onChange={(e) => setCustomGlobalScore(Math.min(10, Math.max(0, Number(e.target.value))))}
                      className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-xs font-bold text-blue-700 text-center"
                    />
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {convertScoreToGradeInfo(customGlobalScore).letter} (Hệ 4: {convertScoreToGradeInfo(customGlobalScore).gpa4})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomScoreMode(false)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 underline ml-1"
                    >
                      Dùng thang chuẩn
                    </button>
                  </div>
                )}

                {/* Huy hiệu điểm hiển thị tóm tắt */}
                <div className="hidden sm:flex items-center space-x-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700">
                  <span>Trạng thái:</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[11px] ${
                      currentGlobalGrade.ket_qua === 'Dat'
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentGlobalGrade.ket_qua === 'KhongDat'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {currentGlobalGrade.ket_qua === 'Dat'
                      ? `Đạt (${currentGlobalGrade.diem_chu || 'A'} - ${currentGlobalGrade.diem_tong_ket}đ)`
                      : currentGlobalGrade.ket_qua === 'KhongDat'
                      ? `Không đạt (${currentGlobalGrade.diem_chu || 'F'})`
                      : 'Đang theo học'}
                  </span>
                </div>

                {selectedCourseCodes.size > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyGlobalGradeToAllSelected}
                    className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs flex items-center space-x-1"
                    title="Gán mức điểm này cho toàn bộ môn đã tích chọn"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Áp dụng cho {selectedCourseCodes.size} môn đã chọn</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Thanh tác vụ chọn nhanh */}
        <div className="px-5 sm:px-6 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center space-x-3">
            <span>
              Tìm thấy <strong className="text-slate-900">{filteredCourses.length}</strong> môn học
            </span>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleSelectAllInView}
              className="text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center space-x-1"
            >
              <span>Chọn tất cả môn đang hiển thị</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleDeselectAllInView}
              className="text-slate-500 hover:text-slate-800 font-medium hover:underline"
            >
              Bỏ chọn
            </button>
          </div>

          <div className="text-[11px] text-slate-500 italic">
            * Nhấp vào ô chọn điểm trên từng môn để tùy biến điểm riêng cho từng môn học
          </div>
        </div>

        {/* Danh sách các môn học BICA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 divide-y divide-slate-100">
          {filteredCourses.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3 stroke-1" />
              <p className="font-medium text-slate-600">Không tìm thấy môn học nào phù hợp</p>
              <p className="text-xs mt-1">Hãy thử xóa bộ lọc hoặc tìm kiếm với từ khóa khác</p>
            </div>
          ) : (
            filteredCourses.map((course) => {
              const isAlreadyAdded = existingCodesSet.has(course.ma_hoc_phan.toUpperCase().trim());
              const isChecked = selectedCourseCodes.has(course.ma_hoc_phan);
              const courseGrade = getCourseGrade(course.ma_hoc_phan);

              return (
                <div
                  key={course.ma_hoc_phan}
                  onClick={() => !isAlreadyAdded && toggleCourse(course.ma_hoc_phan)}
                  className={`pt-2.5 first:pt-0 group rounded-xl p-3 transition-all cursor-pointer border ${
                    isAlreadyAdded
                      ? 'bg-slate-50/70 border-slate-200/60 opacity-65 cursor-not-allowed'
                      : isChecked
                      ? 'bg-blue-50/60 border-blue-300 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Checkbox và thông tin môn học */}
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {isAlreadyAdded ? (
                          <div className="w-5 h-5 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-300 group-hover:border-slate-400'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300">
                            {course.ma_hoc_phan}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            {course.so_tin_chi} Tín chỉ
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                              course.loai_hoc_phan === 'BatBuoc'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {course.loai_hoc_phan === 'BatBuoc' ? 'Bắt buộc' : 'Tự chọn'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                            Kỳ {course.hoc_ky_goi_y}
                          </span>
                          {course.nhom_hoac_module && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                              {course.nhom_hoac_module}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {course.ten_hoc_phan}
                        </h3>
                        <p className="text-xs text-slate-500 italic">{course.ten_tieng_anh}</p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                          <span>
                            LT: <strong className="text-slate-700">{course.ly_thuyet}h</strong>
                          </span>
                          <span>
                            TH/TN: <strong className="text-slate-700">{course.thuc_hanh}h</strong>
                          </span>
                          <span>
                            Tự học: <strong className="text-slate-700">{course.tu_hoc}h</strong>
                          </span>
                          {course.hoc_phan_tien_quyet && (
                            <span className="text-amber-700 font-medium flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Tiên quyết: {course.hoc_phan_tien_quyet}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vùng Lựa Chọn Điểm Số & Nút Thao Tác Cho Từng Môn */}
                    <div
                      className="shrink-0 flex flex-col sm:items-end space-y-2 mt-2 sm:mt-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isAlreadyAdded ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium border border-slate-200 flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Đã có trong bảng điểm</span>
                        </span>
                      ) : (
                        <>
                          {/* Bộ Chọn Điểm Cho Môn Này */}
                          <div className="flex items-center space-x-1.5 bg-slate-50/90 border border-slate-200 p-1 rounded-lg text-xs">
                            <span className="text-[11px] font-semibold text-slate-600 pl-1">Điểm:</span>
                            <select
                              value={
                                courseGrade.ket_qua === 'DangHoc'
                                  ? 'DangHoc'
                                  : courseGrade.diem_chu || 'A'
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'DangHoc') {
                                  setSingleCourseGrade(course.ma_hoc_phan, {
                                    ket_qua: 'DangHoc',
                                    diem_tong_ket: undefined,
                                    diem_chu: undefined,
                                    diem_thang_4: undefined,
                                  });
                                } else {
                                  const preset = GRADE_PRESETS.find((p) => p.letter === val);
                                  if (preset) {
                                    setSingleCourseGrade(course.ma_hoc_phan, {
                                      ket_qua: preset.status,
                                      diem_tong_ket: preset.score || 8.5,
                                      diem_chu: preset.letter,
                                      diem_thang_4: preset.gpa4 || 4.0,
                                    });
                                  }
                                }
                              }}
                              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="DangHoc">Đang học</option>
                              <option value="A+">A+ (9.5 - 4.0)</option>
                              <option value="A">A (8.5 - 4.0)</option>
                              <option value="B+">B+ (8.0 - 3.5)</option>
                              <option value="B">B (7.5 - 3.0)</option>
                              <option value="C+">C+ (6.5 - 2.5)</option>
                              <option value="C">C (6.0 - 2.0)</option>
                              <option value="D+">D+ (5.0 - 1.5)</option>
                              <option value="D">D (4.5 - 1.0)</option>
                              <option value="F">F (3.0 - 0.0)</option>
                            </select>

                            {/* Ô nhập điểm hệ 10 tùy chỉnh lẻ (VD: 9.2, 8.8) */}
                            {courseGrade.ket_qua !== 'DangHoc' && (
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={courseGrade.diem_tong_ket ?? 8.5}
                                onChange={(e) => {
                                  const val = Math.min(10, Math.max(0, Number(e.target.value)));
                                  const conv = convertScoreToGradeInfo(val);
                                  setSingleCourseGrade(course.ma_hoc_phan, {
                                    ket_qua: conv.status,
                                    diem_tong_ket: val,
                                    diem_chu: conv.letter,
                                    diem_thang_4: conv.gpa4,
                                  });
                                }}
                                className="w-14 px-1 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-bold text-blue-700"
                                title="Nhập điểm hệ 10 cụ thể (tự quy đổi)"
                              />
                            )}

                            {/* Badge kết quả tóm tắt */}
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                courseGrade.ket_qua === 'Dat'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : courseGrade.ket_qua === 'KhongDat'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {courseGrade.ket_qua === 'Dat'
                                ? `${courseGrade.diem_chu || 'A'} (Hệ 10: ${courseGrade.diem_tong_ket} | Hệ 4: ${courseGrade.diem_thang_4 ?? 4.0})`
                                : courseGrade.ket_qua === 'KhongDat'
                                ? `F (Hệ 10: ${courseGrade.diem_tong_ket ?? 0} | Hệ 4: 0.0)`
                                : 'Đang học'}
                            </span>
                          </div>

                          {/* Nút thêm riêng môn này ngay lập tức */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddSingleCourse(course);
                            }}
                            disabled={isSubmitting}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-medium border border-blue-200 transition-all flex items-center justify-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              {courseGrade.ket_qua === 'Dat'
                                ? `+ Thêm môn này (Điểm ${courseGrade.diem_chu || 'A'})`
                                : '+ Thêm môn này (Đang học)'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal: Thống kê và xác nhận nạp nhiều môn */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-700">
            <span>Đang chọn:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
              {selectedSummary.count} môn
            </span>
            <span>tương đương</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {selectedSummary.credits} Tín chỉ
            </span>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs sm:text-sm transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={selectedSummary.count === 0 || isSubmitting}
              onClick={handleSubmit}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-white font-medium text-xs sm:text-sm transition-colors shadow-2xs flex items-center justify-center space-x-2 ${
                selectedSummary.count === 0 || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-blue-700 hover:bg-blue-800 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang nạp vào bảng điểm...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Thêm {selectedSummary.count} môn kèm điểm đã chọn</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
