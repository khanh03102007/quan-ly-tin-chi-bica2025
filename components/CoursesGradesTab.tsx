import React, { useState, useMemo } from 'react';
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
  Pencil,
  Sliders,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { StudentCourse } from '../types';
import {
  supabase,
  batchAddBicaCourses,
  deleteCourse,
  deleteMultipleCourses,
  updateCourseGrade,
  getLocalCoursesForStudent,
  saveLocalCoursesForStudent,
  DEFAULT_COURSES,
  DEFAULT_STUDENT_PROFILE,
  getLocalProfile,
  saveLocalProfile,
  inferScore10FromLetterOrGpa4,
  syncStudentAcademicMetricsToProfile,
  computeAcademicMetricsFromCourses,
} from '../lib/supabase';
import {
  BICA_CURRICULUM,
  BicaCurriculumCourse,
  calculateKnowledgeBlockStats,
  getCourseKnowledgeBlock,
  BICA_KNOWLEDGE_BLOCKS,
  BICA_BLOCK_TARGETS,
} from '../data/bicaCurriculum';
import {
  BicaCurriculumPickerModal,
  CourseWithGradePayload,
  convertScoreToGradeInfo,
  GRADE_PRESETS,
} from './BicaCurriculumPickerModal';

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
  const [selectedBlock, setSelectedBlock] = useState('Tất cả');
  const [showBlockStats, setShowBlockStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Thống kê phân bổ 6 khối kiến thức chuẩn Khóa 2025 liên kết trực tiếp với dữ liệu tín chỉ
  const blockStats = useMemo(() => calculateKnowledgeBlockStats(courses), [courses]);
  const [showGpaChart, setShowGpaChart] = useState(true);

  // Dữ liệu biểu đồ đường Recharts theo dõi sự thay đổi GPA qua từng học kỳ (sắp xếp theo thứ tự thời gian tăng dần)
  const semesterGpaChartData = useMemo(() => {
    const metrics = computeAcademicMetricsFromCourses(courses);
    // Đảo ngược danh sách học kỳ để hiển thị theo trình tự thời gian từ Kỳ 1 -> Kỳ 2 -> các kỳ tiếp theo
    const chronologicalSemesters = [...metrics.semesterList].reverse();

    let runningQualityPoints4 = 0;
    let runningGradedCredits = 0;
    let prevGpa4: number | null = null;

    return chronologicalSemesters.map((semLabel) => {
      const semSummary = metrics.bySemester[semLabel];
      const gradedCredits = semSummary?.gradedCredits || 0;
      const gpa4 = semSummary?.gpa4 || 0;
      const gpa10 = semSummary?.gpa10 || 0;

      if (gradedCredits > 0) {
        runningQualityPoints4 += gpa4 * gradedCredits;
        runningGradedCredits += gradedCredits;
      }

      const cumulativeCpa =
        runningGradedCredits > 0
          ? Number((runningQualityPoints4 / runningGradedCredits).toFixed(2))
          : 0;

      const deltaGpa =
        gradedCredits > 0 && prevGpa4 !== null
          ? Number((gpa4 - prevGpa4).toFixed(2))
          : null;

      if (gradedCredits > 0) {
        prevGpa4 = gpa4;
      }

      const shortLabel = semLabel.replace(/năm\s*/i, '');

      return {
        semester: semLabel,
        shortLabel,
        gpa4: gradedCredits > 0 ? gpa4 : null,
        cpa4: runningGradedCredits > 0 ? cumulativeCpa : null,
        gpa10: gradedCredits > 0 ? gpa10 : null,
        gradedCredits,
        passedCredits: semSummary?.passedCredits || 0,
        totalCredits: semSummary?.totalCredits || 0,
        courseCount: semSummary?.courseCount || 0,
        deltaGpa,
      };
    });
  }, [courses]);

  const gradedSemesterPoints = useMemo(
    () => semesterGpaChartData.filter((d) => d.gpa4 !== null),
    [semesterGpaChartData]
  );

  const latestSemPoint =
    gradedSemesterPoints.length > 0
      ? gradedSemesterPoints[gradedSemesterPoints.length - 1]
      : null;

  // States hỗ trợ xóa học phần khi sinh viên chọn nhầm
  const [courseToDelete, setCourseToDelete] = useState<StudentCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // States chỉnh sửa điểm học phần đã có trong bảng điểm
  const [editingCourse, setEditingCourse] = useState<StudentCourse | null>(null);
  const [editFormData, setEditFormData] = useState<{
    diem_chuyen_can?: number;
    diem_giua_ky?: number;
    diem_cuoi_ky?: number;
    diem_tong_ket?: number;
    diem_chu?: string;
    diem_thang_4?: number;
    ket_qua: 'Dat' | 'KhongDat' | 'DangHoc';
    giang_vien?: string;
  }>({
    ket_qua: 'DangHoc',
  });
  const [isUpdatingGrade, setIsUpdatingGrade] = useState(false);

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

  // Chọn nhanh điểm chuẩn cho form thêm mới
  const handleApplyPresetToNewCourse = (preset: typeof GRADE_PRESETS[0]) => {
    if (preset.id === 'DangHoc') {
      setNewCourse((prev) => ({
        ...prev,
        diem_chuyen_can: undefined,
        diem_giua_ky: undefined,
        diem_cuoi_ky: undefined,
        diem_tong_ket: undefined,
        diem_chu: undefined,
        diem_thang_4: undefined,
        ket_qua: 'DangHoc',
      }));
    } else {
      setNewCourse((prev) => ({
        ...prev,
        diem_chuyen_can: 10,
        diem_giua_ky: preset.score ? Math.min(10, preset.score + 0.2) : 8.5,
        diem_cuoi_ky: preset.score || 8.5,
        diem_tong_ket: preset.score || 8.5,
        diem_chu: preset.letter,
        diem_thang_4: preset.gpa4 ?? 4.0,
        ket_qua: preset.status,
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
    const conv = convertScoreToGradeInfo(finalScore);

    setNewCourse({
      ...updated,
      diem_tong_ket: finalScore,
      diem_chu: conv.letter,
      diem_thang_4: conv.gpa4,
      ket_qua: conv.status,
    });
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.ma_hoc_phan?.trim() || !newCourse.ten_hoc_phan?.trim()) {
      setMessage('Vui lòng điền mã học phần và tên học phần');
      return;
    }

    setSaving(true);
    setMessage(null);

    const effectiveId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP')
      ? studentId
      : (user?.user_metadata?.student_id || 'BICA25119034');

    const cc = newCourse.diem_chuyen_can !== undefined ? Number(newCourse.diem_chuyen_can) : undefined;
    const gk = newCourse.diem_giua_ky !== undefined ? Number(newCourse.diem_giua_ky) : undefined;
    const ck = newCourse.diem_cuoi_ky !== undefined ? Number(newCourse.diem_cuoi_ky) : undefined;
    
    let finalScore = newCourse.diem_tong_ket !== undefined ? Number(newCourse.diem_tong_ket) : undefined;
    if (finalScore === undefined && (cc !== undefined || gk !== undefined || ck !== undefined)) {
      finalScore = Math.round(((cc ?? 0) * 0.1 + (gk ?? 0) * 0.3 + (ck ?? 0) * 0.6) * 10) / 10;
    }
    const conv = finalScore !== undefined ? convertScoreToGradeInfo(finalScore) : null;
    const letter = newCourse.diem_chu || conv?.letter || (newCourse.ket_qua === 'Dat' ? 'A' : undefined);
    const gpa4 = newCourse.diem_thang_4 !== undefined ? Number(newCourse.diem_thang_4) : (conv?.gpa4 ?? (newCourse.ket_qua === 'Dat' ? 4.0 : 0.0));
    const ketQua = newCourse.ket_qua || conv?.status || (finalScore && finalScore >= 4 ? 'Dat' : 'DangHoc');

    const newCourseItem: StudentCourse = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ma_sinh_vien: effectiveId,
      user_id: user?.id,
      ma_hoc_phan: newCourse.ma_hoc_phan.trim().toUpperCase(),
      ten_hoc_phan: newCourse.ten_hoc_phan.trim(),
      so_tin_chi: Number(newCourse.so_tin_chi) || 3,
      hoc_ky: newCourse.hoc_ky || 'Học kỳ 1',
      nam_hoc: newCourse.nam_hoc || '2025-2026',
      diem_chuyen_can: cc,
      diem_giua_ky: gk,
      diem_cuoi_ky: ck,
      diem_tong_ket: finalScore,
      diem_chu: letter,
      diem_thang_4: gpa4,
      ket_qua: ketQua,
      giang_vien: newCourse.giang_vien?.trim() || undefined,
    };

    // 1. Luôn cập nhật LocalStorage ngay lập tức
    try {
      const existingLocal = getLocalCoursesForStudent(effectiveId);
      const localMap = new Map<string, StudentCourse>();
      if (existingLocal.length === 0 && effectiveId === 'BICA25119034') {
        DEFAULT_COURSES.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
      } else {
        existingLocal.forEach((c) => localMap.set(c.ma_hoc_phan.toUpperCase(), c));
      }
      localMap.set(newCourseItem.ma_hoc_phan.toUpperCase(), newCourseItem);
      const mergedList = Array.from(localMap.values());
      saveLocalCoursesForStudent(effectiveId, mergedList);

      // Cập nhật lại tích lũy tín chỉ, GPA học kỳ, CPA tích lũy và xếp loại cho hồ sơ
      await syncStudentAcademicMetricsToProfile(effectiveId, mergedList, user);
    } catch (localErr) {
      console.warn('Lỗi lưu cục bộ:', localErr);
    }

    // 2. Thử lưu vào Supabase
    try {
      const payload: any = {
        ma_sinh_vien: effectiveId,
        ma_hoc_phan: newCourseItem.ma_hoc_phan,
        ten_hoc_phan: newCourseItem.ten_hoc_phan,
        so_tin_chi: newCourseItem.so_tin_chi,
        hoc_ky: newCourseItem.hoc_ky,
        nam_hoc: newCourseItem.nam_hoc,
        diem_chuyen_can: cc ?? null,
        diem_giua_ky: gk ?? null,
        diem_cuoi_ky: ck ?? null,
        diem_tong_ket: finalScore ?? null,
        diem_chu: letter || null,
        diem_thang_4: gpa4 ?? null,
        ket_qua: ketQua,
        giang_vien: newCourseItem.giang_vien || null,
      };

      if (user?.id) {
        payload.user_id = user.id;
      }

      await supabase.from('khoa_hoc_sinh_vien').upsert([payload], { onConflict: 'ma_sinh_vien,ma_hoc_phan' });
    } catch (dbErr) {
      console.warn('Supabase sync skipped/deferred:', dbErr);
    }

    setMessage(`✅ Đã lưu học phần "${newCourseItem.ten_hoc_phan}" (${newCourseItem.ma_hoc_phan}) vào bảng điểm thành công!`);
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
    setSaving(false);
    onDataChanged();
  };

  // Nạp các môn học được chọn từ Modal Khung CTĐT BICA kèm điểm số đã cấu hình
  const handleSelectCoursesFromCurriculum = async (
    selectedCourses: CourseWithGradePayload[]
  ) => {
    setIsBatchAdding(true);
    setMessage(null);
    try {
      const effectiveId = (studentId && studentId !== '---' && studentId !== 'CHƯA_ĐĂNG_NHẬP')
        ? studentId
        : (user?.user_metadata?.student_id || 'BICA25119034');

      const items = selectedCourses.map((c) => ({
        ma_hoc_phan: c.ma_hoc_phan,
        ten_hoc_phan: c.ten_hoc_phan,
        so_tin_chi: c.so_tin_chi,
        hoc_ky_goi_y: c.hoc_ky_goi_y,
        ket_qua: c.ket_qua || 'DangHoc',
        diem_chuyen_can: c.diem_chuyen_can,
        diem_giua_ky: c.diem_giua_ky,
        diem_cuoi_ky: c.diem_cuoi_ky,
        diem_tong_ket: c.diem_tong_ket,
        diem_chu: c.diem_chu,
        diem_thang_4: c.diem_thang_4,
      }));

      const res = await batchAddBicaCourses(items, effectiveId, user);
      if (res.success) {
        setMessage(`✅ Đã thêm thành công ${res.count} môn học kèm điểm số đã chọn từ Khung CTĐT BICA vào bảng điểm!`);
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

  // Mở modal sửa điểm của một học phần
  const handleOpenEditCourse = (course: StudentCourse) => {
    setEditingCourse(course);
    setEditFormData({
      diem_chuyen_can: course.diem_chuyen_can,
      diem_giua_ky: course.diem_giua_ky,
      diem_cuoi_ky: course.diem_cuoi_ky,
      diem_tong_ket: course.diem_tong_ket,
      diem_chu: course.diem_chu,
      diem_thang_4: course.diem_thang_4,
      ket_qua: course.ket_qua || 'DangHoc',
      giang_vien: course.giang_vien || '',
    });
  };

  // Xử lý thay đổi điểm thành phần khi sửa điểm
  const handleEditScoreChange = (field: 'diem_chuyen_can' | 'diem_giua_ky' | 'diem_cuoi_ky', val: number) => {
    const updated = { ...editFormData, [field]: val };
    const cc = Number(updated.diem_chuyen_can ?? 0);
    const gk = Number(updated.diem_giua_ky ?? 0);
    const ck = Number(updated.diem_cuoi_ky ?? 0);
    const finalScore = Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10;
    const conv = convertScoreToGradeInfo(finalScore);

    setEditFormData({
      ...updated,
      diem_tong_ket: finalScore,
      diem_chu: conv.letter,
      diem_thang_4: conv.gpa4,
      ket_qua: conv.status,
    });
  };

  // Áp dụng điểm nhanh khi sửa điểm
  const handleApplyPresetToEdit = (preset: typeof GRADE_PRESETS[0]) => {
    if (preset.id === 'DangHoc') {
      setEditFormData((prev) => ({
        ...prev,
        diem_chuyen_can: undefined,
        diem_giua_ky: undefined,
        diem_cuoi_ky: undefined,
        diem_tong_ket: undefined,
        diem_chu: undefined,
        diem_thang_4: undefined,
        ket_qua: 'DangHoc',
      }));
    } else {
      setEditFormData((prev) => ({
        ...prev,
        diem_chuyen_can: 10,
        diem_giua_ky: preset.score ? Math.min(10, preset.score + 0.2) : 8.5,
        diem_cuoi_ky: preset.score || 8.5,
        diem_tong_ket: preset.score || 8.5,
        diem_chu: preset.letter,
        diem_thang_4: preset.gpa4 ?? 4.0,
        ket_qua: preset.status,
      }));
    }
  };

  // Lưu điểm đã sửa vào Supabase
  const handleSaveEditedGrade = async () => {
    if (!editingCourse) return;
    setIsUpdatingGrade(true);
    try {
      const res = await updateCourseGrade(
        editingCourse.id,
        editingCourse.ma_hoc_phan,
        studentId,
        user,
        {
          diem_chuyen_can: editFormData.diem_chuyen_can !== undefined ? Number(editFormData.diem_chuyen_can) : null,
          diem_giua_ky: editFormData.diem_giua_ky !== undefined ? Number(editFormData.diem_giua_ky) : null,
          diem_cuoi_ky: editFormData.diem_cuoi_ky !== undefined ? Number(editFormData.diem_cuoi_ky) : null,
          diem_tong_ket: editFormData.diem_tong_ket !== undefined ? Number(editFormData.diem_tong_ket) : null,
          diem_chu: editFormData.diem_chu || null,
          diem_thang_4: editFormData.diem_thang_4 !== undefined ? Number(editFormData.diem_thang_4) : null,
          ket_qua: editFormData.ket_qua,
          giang_vien: editFormData.giang_vien,
        }
      );
      if (res.success) {
        setMessage(`✅ Đã cập nhật điểm thành công cho môn [${editingCourse.ma_hoc_phan}] - ${editingCourse.ten_hoc_phan}!`);
        setEditingCourse(null);
        onDataChanged();
      } else {
        setMessage(`Lỗi cập nhật điểm: ${res.error}`);
      }
    } catch (err: any) {
      setMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setIsUpdatingGrade(false);
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
    const matchesBlock = selectedBlock === 'Tất cả' || getCourseKnowledgeBlock(c) === selectedBlock;
    const matchesQuery =
      c.ma_hoc_phan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ten_hoc_phan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.giang_vien && c.giang_vien.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSemester && matchesBlock && matchesQuery;
  });

  const totalFilteredCredits = filteredCourses.reduce((sum, c) => sum + (c.so_tin_chi || 0), 0);
  const totalPassedCredits = filteredCourses
    .filter((c) => c.ket_qua === 'Dat')
    .reduce((sum, c) => sum + (c.so_tin_chi || 0), 0);

  const existingCodes = courses.map((c) => c.ma_hoc_phan);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-700" />
            <span>BẢNG ĐIỂM HỌC PHẦN & TIẾN ĐỘ TÍCH LŨY</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kết quả học tập theo học kỳ, điểm tổng kết hệ 10, tổng kết hệ 4, điểm chữ và tín chỉ tích lũy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút chuyển nhanh sang Cỗ Máy What-if */}
          {onNavigateToWhatIf && (
            <button
              id="btn-nav-to-whatif-from-courses"
              onClick={onNavigateToWhatIf}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium px-3 py-1.5 rounded-md transition-colors shadow-2xs"
              title="Mô phỏng điểm thi và dự báo CPA tốt nghiệp"
            >
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Dự báo What-if</span>
            </button>
          )}

          {/* Nút mở Modal Chọn Môn Từ Khung CTĐT BICA */}
          <button
            id="btn-open-curriculum-modal"
            onClick={() => setIsCurriculumModalOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition-colors shadow-2xs"
            title="Duyệt và chọn học phần từ khung chương trình đào tạo BICA K2025"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Nạp môn từ khung CTĐT</span>
          </button>

          <button
            id="btn-open-add-course"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-md transition-colors border border-slate-300 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Thêm môn thủ công</span>
          </button>
        </div>
      </div>

      {/* Biểu đồ đường Recharts theo dõi biến động GPA qua từng học kỳ */}
      <div className="bg-white dark:bg-[#1b1c21] rounded-2xl p-5 border border-slate-200/80 dark:border-[#2a2d36] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#eaecef]">
                Biểu Đồ Theo Dõi Biến Động Điểm GPA Qua Từng Học Kỳ
              </h3>
              {latestSemPoint && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-mono">
                  {latestSemPoint.semester}: {latestSemPoint.gpa4?.toFixed(2)} / 4.0
                </span>
              )}
              {latestSemPoint && latestSemPoint.deltaGpa !== null && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono border ${
                    latestSemPoint.deltaGpa >= 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  {latestSemPoint.deltaGpa >= 0
                    ? `▲ +${latestSemPoint.deltaGpa.toFixed(2)} so với kỳ trước`
                    : `▼ ${latestSemPoint.deltaGpa.toFixed(2)} so với kỳ trước`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8b92a0] mt-0.5">
              Trực quan hóa xu hướng thay đổi điểm trung bình học kỳ (GPA) và điểm tích lũy (CPA) theo dữ liệu bảng điểm thực tế
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowGpaChart((prev) => !prev)}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#343844] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-medium flex items-center space-x-1 transition-colors self-start sm:self-auto cursor-pointer"
          >
            {showGpaChart ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Thu gọn biểu đồ</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Mở biểu đồ GPA</span>
              </>
            )}
          </button>
        </div>

        {showGpaChart && (
          <div className="pt-2">
            {gradedSemesterPoints.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#14171f] rounded-xl border border-dashed border-slate-200 dark:border-[#2d3240] text-center p-4">
                <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Chưa có dữ liệu điểm tổng kết học kỳ để vẽ biểu đồ xu hướng GPA
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hãy thêm môn học hoặc cập nhật điểm số trong bảng điểm bên dưới để biểu đồ tự động hiển thị.
                </p>
              </div>
            ) : (
              <div className="w-full h-72 bg-slate-50/50 dark:bg-[#14171f]/60 rounded-xl p-3 sm:p-4 border border-slate-100 dark:border-[#262a34]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={semesterGpaChartData}
                    margin={{ top: 12, right: 24, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                    <XAxis
                      dataKey="semester"
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                      tickMargin={8}
                    />
                    <YAxis
                      domain={[0, 4.0]}
                      ticks={[0, 1.0, 2.0, 2.5, 3.2, 3.6, 4.0]}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                      width={38}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row = payload[0]?.payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-700 text-xs space-y-1.5 min-w-[210px]">
                            <div className="font-bold text-cyan-300 border-b border-slate-700/80 pb-1">
                              {label}
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Điểm GPA Học kỳ (Hệ 4):</span>
                              <span className="font-mono font-bold text-emerald-400">
                                {row?.gpa4 !== null && row?.gpa4 !== undefined
                                  ? `${Number(row.gpa4).toFixed(2)} / 4.0`
                                  : 'Chưa có điểm'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Điểm GPA Học kỳ (Hệ 10):</span>
                              <span className="font-mono font-semibold text-slate-100">
                                {row?.gpa10 !== null && row?.gpa10 !== undefined
                                  ? `${Number(row.gpa10).toFixed(1)} / 10`
                                  : '---'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Điểm CPA Tích lũy:</span>
                              <span className="font-mono font-bold text-indigo-300">
                                {row?.cpa4 !== null && row?.cpa4 !== undefined
                                  ? `${Number(row.cpa4).toFixed(2)} / 4.0`
                                  : '---'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                              <span>Tín chỉ có điểm:</span>
                              <span className="font-mono text-slate-200">
                                {row?.gradedCredits || 0} TC ({row?.courseCount || 0} môn)
                              </span>
                            </div>
                            {row?.deltaGpa !== null && row?.deltaGpa !== undefined && (
                              <div className="flex items-center justify-between gap-4 text-[11px]">
                                <span className="text-slate-400">Thay đổi so với kỳ trước:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    row.deltaGpa >= 0 ? 'text-emerald-400' : 'text-amber-400'
                                  }`}
                                >
                                  {row.deltaGpa >= 0
                                    ? `+${Number(row.deltaGpa).toFixed(2)}`
                                    : Number(row.deltaGpa).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    />
                    <ReferenceLine
                      y={3.2}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Giỏi (3.2)',
                        position: 'insideTopRight',
                        fill: '#059669',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gpa4"
                      name="GPA Học kỳ (Hệ 4.0)"
                      stroke="#0284c7"
                      strokeWidth={3}
                      connectNulls
                      dot={{ r: 5, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 7, fill: '#0ea5e9', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cpa4"
                      name="CPA Tích lũy (Hệ 4.0)"
                      stroke="#6366f1"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      connectNulls
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 1.5, stroke: '#ffffff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Widget Phân Bổ Tín Chỉ Khóa 2025 Liên Kết Trực Tiếp Với Đăng Ký Tín Chỉ */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Phân Bổ Tín Chỉ Khóa 2025 (Thống Kê 6 Khối Kiến Thức)
              </h3>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Chuẩn 145 TC
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhấp vào từng khối để lọc nhanh môn học trong bảng điểm hoặc theo dõi tiến độ tích lũy thực tế
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {selectedBlock !== 'Tất cả' && (
              <button
                type="button"
                onClick={() => setSelectedBlock('Tất cả')}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold border border-indigo-200 flex items-center space-x-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Bỏ lọc khối ({selectedBlock.split('.')[0]})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowBlockStats(!showBlockStats)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium flex items-center space-x-1 transition-colors"
            >
              {showBlockStats ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Thu gọn</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Xem chi tiết (6 khối)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {showBlockStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {blockStats.map((stat) => {
              const isSelected = selectedBlock === stat.block.name;
              return (
                <div
                  key={stat.block.id}
                  onClick={() => setSelectedBlock(isSelected ? 'Tất cả' : stat.block.name)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 dark:border-[#5582b8] bg-indigo-50 dark:bg-[#232d3f] shadow-xs ring-1 ring-indigo-500 dark:ring-[#5582b8]'
                      : 'border-slate-200 dark:border-[#313847] bg-slate-50 dark:bg-[#212631] hover:border-indigo-200 dark:hover:border-[#435169] hover:bg-white dark:hover:bg-[#272d3b]'
                  }`}
                  title="Nhấp để lọc bảng điểm theo khối kiến thức này"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#eef0f4] line-clamp-1 leading-snug">
                      {stat.block.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 dark:text-[#84b0e2] bg-indigo-50 dark:bg-[#1a2230] px-2 py-0.5 rounded-md border border-indigo-100 dark:border-[#2e3d54] shrink-0">
                      {stat.totalPassedCredits} / {stat.block.targetCredits} TC
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-[#14171f] rounded-full h-2 overflow-hidden mb-2 border border-transparent dark:border-[#292f3d]">
                    <div
                      className={`${stat.block.barColor} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${stat.completionPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9ba3b2]">
                    <span>
                      Đạt <strong className="text-slate-800 dark:text-[#eaecef] font-semibold">{stat.completionPercent}%</strong>
                    </span>
                    {stat.totalInProgressCredits > 0 ? (
                      <span className="text-blue-600 dark:text-[#84b0e2] font-medium">
                        +{stat.totalInProgressCredits} TC đang học
                      </span>
                    ) : stat.registeredCourses.length > 0 ? (
                      <span className="text-emerald-700 dark:text-[#78c4a4] font-medium">
                        {stat.registeredCourses.length} môn đã đăng ký
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-[#828b9c]">Chưa có môn</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

            {/* Chọn nhanh điểm chuẩn VJU */}
            <div className="sm:col-span-2 lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-blue-600" />
                <span>Chọn nhanh thang điểm chuẩn VJU:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {GRADE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPresetToNewCourse(p)}
                    className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                  >
                    {p.letter ? `${p.letter} (${p.score}đ)` : 'Đang học'}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Điểm Tổng Kết Hệ 10 (0 - 10)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                placeholder="Nhập điểm hệ 10 (VD: 8.5)"
                value={newCourse.diem_tong_ket ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setNewCourse({
                      ...newCourse,
                      diem_tong_ket: undefined,
                    });
                    return;
                  }
                  const val = Math.min(10, Math.max(0, Number(e.target.value)));
                  const conv = convertScoreToGradeInfo(val);
                  setNewCourse({
                    ...newCourse,
                    diem_tong_ket: val,
                    diem_chu: conv.letter,
                    diem_thang_4: conv.gpa4,
                    ket_qua: conv.status,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Tổng Kết Hệ 4 (0 - 4.0)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="4"
                placeholder="VD: 3.5"
                value={newCourse.diem_thang_4 ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setNewCourse({
                      ...newCourse,
                      diem_thang_4: undefined,
                    });
                    return;
                  }
                  const val = Math.min(4, Math.max(0, Number(e.target.value)));
                  const inferred = inferScore10FromLetterOrGpa4(undefined, val);
                  setNewCourse({
                    ...newCourse,
                    diem_thang_4: val,
                    diem_chu: inferred.letter || newCourse.diem_chu,
                    diem_tong_ket: newCourse.diem_tong_ket ?? inferred.score10,
                    ket_qua: inferred.status,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Điểm Chữ Quy Đổi</label>
              <div className="px-3 py-2 bg-blue-50 text-blue-900 font-semibold rounded-lg border border-blue-200 flex items-center justify-between">
                <span>Điểm chữ:</span>
                <span className="px-2 py-0.5 bg-white rounded border border-blue-200 text-emerald-700 font-bold">
                  {newCourse.diem_chu || '-'}
                </span>
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

          {/* Lọc theo Khối kiến thức CTĐT BICA Khóa 2025 */}
          <select
            id="select-filter-block"
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs max-w-[210px] truncate"
            title="Lọc môn học theo Khối kiến thức CTĐT BICA Khóa 2025"
          >
            {BICA_KNOWLEDGE_BLOCKS.map((block) => (
              <option key={block} value={block}>
                {block}
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
                <th className="px-3 py-3.5 text-center font-bold text-slate-800">Tổng Kết Hệ 10</th>
                <th className="px-3 py-3.5 text-center font-bold text-blue-700">Tổng Kết Hệ 4</th>
                <th className="px-3 py-3.5 text-center font-bold">Điểm Chữ</th>
                <th className="px-3 py-3.5 text-center">Kết Quả</th>
                <th className="px-3 py-3.5 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
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
                            className="inline-flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2 rounded-md transition-colors shadow-2xs"
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>Nạp môn từ khung CTĐT</span>
                          </button>
                          <button
                            onClick={() => setIsAdding(true)}
                            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-4 py-2 rounded-md transition-colors border border-slate-300 shadow-2xs"
                          >
                            <Plus className="w-4 h-4 text-slate-500" />
                            <span>Nhập môn thủ công</span>
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
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                          {getCourseKnowledgeBlock(course)}
                        </span>
                        {course.giang_vien && (
                          <span className="text-[11px] text-slate-400">GV: {course.giang_vien}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">
                      {course.so_tin_chi}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {course.hoc_ky}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-900">
                      {course.diem_tong_ket !== undefined && course.diem_tong_ket !== null ? course.diem_tong_ket : '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-blue-700">
                      {course.diem_thang_4 !== undefined && course.diem_thang_4 !== null ? Number(course.diem_thang_4).toFixed(1) : '-'}
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
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          id={`btn-edit-course-grade-${course.ma_hoc_phan}`}
                          type="button"
                          onClick={() => handleOpenEditCourse(course)}
                          className="inline-flex items-center justify-center p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
                          title={`Sửa điểm học phần [${course.ma_hoc_phan}] - ${course.ten_hoc_phan}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-course-${course.ma_hoc_phan}`}
                          type="button"
                          onClick={() => setCourseToDelete(course)}
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={`Xóa học phần ${course.ma_hoc_phan} (${course.ten_hoc_phan}) khi chọn nhầm`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

      {/* Modal Chỉnh Sửa Điểm Số Môn Học */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Cập Nhật Điểm Học Phần
                  </h3>
                  <p className="text-xs text-slate-300 font-mono truncate max-w-sm">
                    {editingCourse.ma_hoc_phan} — {editingCourse.ten_hoc_phan} ({editingCourse.so_tin_chi} TC)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCourse(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Chọn nhanh thang điểm */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                <span className="text-xs font-bold text-blue-900 block mb-1.5 flex items-center space-x-1">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>Chọn nhanh điểm chữ theo chuẩn VJU:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GRADE_PRESETS.map((p) => {
                    const isSelected =
                      (p.id === 'DangHoc' && editFormData.ket_qua === 'DangHoc') ||
                      (p.letter && editFormData.diem_chu === p.letter && editFormData.ket_qua !== 'DangHoc');
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyPresetToEdit(p)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                      >
                        {p.letter ? `${p.letter} (${p.score}đ)` : 'Đang học'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Điểm tổng kết Hệ 10 & Hệ 4 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span>Điểm Tổng Kết (Hệ 10 & Hệ 4):</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                      editFormData.ket_qua === 'Dat'
                        ? 'bg-emerald-100 text-emerald-800'
                        : editFormData.ket_qua === 'KhongDat'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {editFormData.ket_qua === 'Dat'
                      ? 'Đạt'
                      : editFormData.ket_qua === 'KhongDat'
                      ? 'Chưa đạt'
                      : 'Đang theo học'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Tổng kết hệ 10</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={editFormData.diem_tong_ket ?? ''}
                      placeholder="Nhập điểm"
                      onChange={(e) => {
                        if (e.target.value === '') {
                          setEditFormData((prev) => ({
                            ...prev,
                            diem_tong_ket: undefined,
                          }));
                          return;
                        }
                        const val = Math.min(10, Math.max(0, Number(e.target.value)));
                        const conv = convertScoreToGradeInfo(val);
                        setEditFormData((prev) => ({
                          ...prev,
                          diem_tong_ket: val,
                          diem_chu: conv.letter,
                          diem_thang_4: conv.gpa4,
                          ket_qua: conv.status,
                        }));
                      }}
                      className="w-full text-center text-sm font-black text-blue-700 focus:outline-none"
                    />
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Tổng kết hệ 4</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="4"
                      value={editFormData.diem_thang_4 ?? ''}
                      placeholder="-"
                      onChange={(e) => {
                        if (e.target.value === '') {
                          setEditFormData((prev) => ({
                            ...prev,
                            diem_thang_4: undefined,
                          }));
                          return;
                        }
                        const val = Math.min(4, Math.max(0, Number(e.target.value)));
                        const inferred = inferScore10FromLetterOrGpa4(undefined, val);
                        setEditFormData((prev) => ({
                          ...prev,
                          diem_thang_4: val,
                          diem_chu: inferred.letter || prev.diem_chu,
                          diem_tong_ket: prev.diem_tong_ket ?? inferred.score10,
                          ket_qua: inferred.status,
                        }));
                      }}
                      className="w-full text-center text-sm font-black text-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Điểm Chữ</span>
                    <span className="text-sm font-black text-emerald-600">
                      {editFormData.diem_chu || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trạng thái & Giảng viên */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Trạng thái học phần
                  </label>
                  <select
                    value={editFormData.ket_qua}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        ket_qua: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white"
                  >
                    <option value="DangHoc">Đang theo học</option>
                    <option value="Dat">Đã đạt</option>
                    <option value="KhongDat">Không đạt</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Giảng viên phụ trách
                  </label>
                  <input
                    type="text"
                    value={editFormData.giang_vien || ''}
                    placeholder="VD: TS. Nguyễn Văn A"
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        giang_vien: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                disabled={isUpdatingGrade}
                onClick={() => setEditingCourse(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors border border-slate-300"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isUpdatingGrade}
                onClick={handleSaveEditedGrade}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-md transition-colors shadow-2xs flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isUpdatingGrade ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu kết quả</span>
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
