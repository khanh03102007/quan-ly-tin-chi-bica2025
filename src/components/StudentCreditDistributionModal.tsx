import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import {
  X,
  Layers,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Send,
  Upload,
  Printer,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
  RefreshCw
} from 'lucide-react';
import type { StudentCourse } from '../types';
import { calculateKnowledgeBlockStats, BICA_CURRICULUM } from '../data/bicaCurriculum';
import { getLocalCoursesForStudent, getMockCoursesForStudent } from '../lib/supabase';

interface StudentCreditDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  allStudents?: any[];
  onSelectStudent?: (student: any) => void;
  onOpenReminderModal?: (student: any, initialNote?: string) => void;
  onOpenUploadModal?: (studentId: string) => void;
  teacherName?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lỗi hiển thị bảng phân bổ tín chỉ:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Không thể tải phân bổ tín chỉ</h3>
            <p className="text-xs text-slate-600">
              Đã xảy ra sự cố khi tính toán phân bổ 6 khối kiến thức: {this.state.error?.message || 'Lỗi không xác định'}
            </p>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const StudentCreditDistributionModal: React.FC<StudentCreditDistributionModalProps> = (props) => {
  if (!props.isOpen || !props.student) return null;

  return (
    <ModalErrorBoundary onClose={props.onClose}>
      <StudentCreditDistributionModalContent {...props} />
    </ModalErrorBoundary>
  );
};

const StudentCreditDistributionModalContent: React.FC<StudentCreditDistributionModalProps> = ({
  isOpen,
  onClose,
  student,
  allStudents = [],
  onSelectStudent,
  onOpenReminderModal,
  onOpenUploadModal,
  teacherName = 'TS. Phạm Tiến Thành (Chủ nhiệm ngành BICA)',
}) => {
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    'block-1': true,
    'block-2-1': true,
    'block-2-2': true,
    'block-3': true,
    'block-4': true,
    'block-5': true,
  });

  if (!isOpen || !student) return null;

  // Lấy danh sách môn học an toàn từ student object hoặc từ bộ nhớ cục bộ / mock
  const courses: StudentCourse[] = useMemo(() => {
    if (student?.courses && Array.isArray(student.courses) && student.courses.length > 0) {
      return student.courses;
    }
    if (student?.ma_sinh_vien) {
      const local = getLocalCoursesForStudent(student.ma_sinh_vien);
      if (local && local.length > 0) return local;
      const mock = getMockCoursesForStudent(student.ma_sinh_vien);
      if (mock && mock.length > 0) return mock;
    }
    return [];
  }, [student]);

  const blockStats = useMemo(() => {
    try {
      return calculateKnowledgeBlockStats(courses);
    } catch (e) {
      console.error('Lỗi calculateKnowledgeBlockStats:', e);
      return [];
    }
  }, [courses]);

  const totalRegisteredCredits = student.registered_credits || courses.reduce((s, c) => s + (Number(c.so_tin_chi) || 0), 0);
  const totalPassedCredits = courses
    .filter((c) => c.ket_qua === 'Dat')
    .reduce((s, c) => s + (Number(c.so_tin_chi) || 0), 0) || student.tong_tin_chi_tich_luy || 0;
  
  const totalInProgressCredits = courses
    .filter((c) => c.ket_qua === 'DangHoc')
    .reduce((s, c) => s + (Number(c.so_tin_chi) || 0), 0);

  const targetCurriculumCredits = 145;
  const overallPercent = Math.min(100, Math.round((totalPassedCredits / targetCurriculumCredits) * 100));

  const rawGpa = Number(student?.calculated_gpa ?? student?.diem_gpa ?? 0);
  const gpa = Number.isFinite(rawGpa) ? rawGpa : 0;
  const gpaFormatted = gpa.toFixed(2);
  const isWarning = gpa < 2.5;
  const isExcellent = gpa >= 3.6;

  const rawDebt = Number(student?.tuition_debt || 0);
  const tuitionDebt = Number.isFinite(rawDebt) ? rawDebt : 0;

  // Navigation between students in the cohort
  const currentIndex = allStudents.findIndex((s) => s?.ma_sinh_vien === student?.ma_sinh_vien);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allStudents.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectStudent) {
      onSelectStudent(allStudents[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectStudent) {
      onSelectStudent(allStudents[currentIndex + 1]);
    }
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    blockStats.forEach((s) => (allExpanded[s.block.id] = true));
    setExpandedBlocks(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    blockStats.forEach((s) => (allCollapsed[s.block.id] = false));
    setExpandedBlocks(allCollapsed);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-auto max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Institutional Portal Navy Style */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-950 border border-blue-800 text-blue-300 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  CỐ VẤN HỌC VỤ & CHỦ NHIỆM NGÀNH
                </span>
                <span className="text-xs text-slate-400">
                  • Khung đào tạo chuẩn Khóa 2025 (145 TC)
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                Báo Cáo Phân Bổ Tín Chỉ: {student.ho_va_ten} ({student.ma_sinh_vien})
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
            {/* Cohort student stepper */}
            {allStudents.length > 1 && (
              <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 rounded transition-colors"
                  title="Sinh viên trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-[11px] text-slate-300">
                  {currentIndex + 1}/{allStudents.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 rounded transition-colors"
                  title="Sinh viên tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              title="In báo cáo phân bổ tín chỉ"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Student Executive Overview Card */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-lg bg-slate-900 text-white font-mono font-bold text-lg flex items-center justify-center border border-slate-700 shrink-0">
                  {student.ho_va_ten?.charAt(0) || 'S'}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h3 className="font-bold text-slate-900 text-base">{student.ho_va_ten}</h3>
                    <span className="font-mono text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {student.ma_sinh_vien}
                    </span>
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {student.lop || 'BICA-K2025'}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      isWarning
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : isExcellent
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}>
                      {student.xep_loai || (isWarning ? 'Cần lưu ý học vụ' : isExcellent ? 'Xuất sắc' : 'Bình thường')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Ngành: {student.nganh_hoc || 'Kỹ thuật Điều khiển Thông minh & Tự động hóa (BICA)'} • Niên khóa 2025-2029 • Email: {student.email}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center space-x-2 shrink-0">
                {onOpenUploadModal && (
                  <button
                    type="button"
                    onClick={() => onOpenUploadModal(student.ma_sinh_vien)}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors inline-flex items-center space-x-1 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Nạp Điểm</span>
                  </button>
                )}
                {onOpenReminderModal && (
                  <button
                    type="button"
                    onClick={() => {
                      const deficit = targetCurriculumCredits - totalPassedCredits;
                      const note = `Tiến độ tích lũy: ${totalPassedCredits}/${targetCurriculumCredits} TC (còn thiếu ${deficit} TC). GPA hiện tại: ${gpaFormatted}.`;
                      onOpenReminderModal(student, note);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors inline-flex items-center space-x-1 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Nhắc Nhở Học Vụ</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 Key Statistics Panels */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">TC Đã Đạt</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  {totalPassedCredits} <span className="text-xs font-normal text-slate-500">/ 145</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Đạt {overallPercent}% toàn khóa
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Đang Học / ĐK</div>
                <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
                  {totalInProgressCredits > 0 ? `+${totalInProgressCredits}` : totalRegisteredCredits} <span className="text-xs font-normal text-slate-500">TC</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {courses.length} học phần đã ghi nhận
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">GPA Tích Lũy</div>
                <div className={`text-xl font-bold font-mono mt-0.5 ${
                  isWarning ? 'text-amber-700' : isExcellent ? 'text-emerald-700' : 'text-slate-900'
                }`}>
                  {gpaFormatted} <span className="text-xs font-normal text-slate-500">/ 4.0</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isWarning ? '⚠️ Cần cố vấn thêm' : isExcellent ? '🏆 Tiến độ xuất sắc' : 'Đúng chuẩn đào tạo'}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tình Trạng Nợ Phí</div>
                <div className={`text-xl font-bold font-mono mt-0.5 ${
                  tuitionDebt > 0 ? 'text-rose-700' : 'text-slate-900'
                }`}>
                  {tuitionDebt > 0 ? `${(tuitionDebt / 1000000).toFixed(1)} tr` : '0 đ'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {tuitionDebt > 0 ? 'Còn nợ học phí' : 'Đã thanh toán đủ'}
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-slate-700 flex items-center space-x-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-700" />
                  <span>Tổng tiến độ hoàn thành CTĐT Khóa 2025:</span>
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {totalPassedCredits} / {targetCurriculumCredits} TC ({overallPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-700 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Section Header & Expand/Collapse controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-700" />
                <span>Chi Tiết Phân Bổ 6 Khối Kiến Thức (Chuẩn Đào Tạo Khóa 2025)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chủ nhiệm ngành theo dõi số tín chỉ đạt, điểm số và danh sách môn học sinh viên đã tích lũy trong từng khối.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs self-end sm:self-auto">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              >
                Mở rộng tất cả
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              >
                Thu gọn tất cả
              </button>
            </div>
          </div>

          {/* 6 Knowledge Blocks List */}
          <div className="space-y-4">
            {blockStats.map((stat) => {
              const isExpanded = Boolean(expandedBlocks[stat.block.id]);
              const passed = stat.totalPassedCredits;
              const target = stat.targetCredits;
              const percent = stat.completionPercent;
              const isBlockCompleted = passed >= target;
              const isBlockStarted = stat.registeredCourses.length > 0;
              const remaining = Math.max(0, target - passed);

              return (
                <div
                  key={stat.block.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
                >
                  {/* Block Header */}
                  <div
                    onClick={() => toggleBlock(stat.block.id)}
                    className="p-4 cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-bold text-slate-900 text-sm">
                          {stat.block.name}
                        </span>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {target} TC Yêu Cầu
                        </span>
                        {isBlockCompleted ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã hoàn thành khối</span>
                          </span>
                        ) : isBlockStarted ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Đang tích lũy (Còn thiếu {remaining} TC)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Chưa tích lũy (Thiếu {target} TC)</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {stat.block.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0 sm:justify-end">
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-slate-900">
                          {passed} / {target} TC
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {percent}% hoàn thành
                        </div>
                      </div>

                      <div className="w-24 sm:w-28 bg-slate-100 rounded-full h-2 overflow-hidden shrink-0">
                        <div
                          className={`${stat.block.barColor} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="text-slate-400 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Block Content (Courses List & Progress Analysis) */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-white space-y-4">
                      {stat.registeredCourses.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">Mã HP</th>
                                <th className="py-2.5 px-3">Tên Học Phần</th>
                                <th className="py-2.5 px-2 text-center">Số TC</th>
                                <th className="py-2.5 px-3 text-center">Tổng Kết Hệ 10</th>
                                <th className="py-2.5 px-3 text-center">Tổng Kết Hệ 4</th>
                                <th className="py-2.5 px-3 text-center">Điểm Chữ</th>
                                <th className="py-2.5 px-3 text-center">Kết Quả</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {stat.registeredCourses.map((course: any, idx: number) => {
                                const isPassed = course.ket_qua === 'Dat';
                                const isInProg = course.ket_qua === 'DangHoc';

                                return (
                                  <tr key={course.id || course.ma_hoc_phan || idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                                      {course.ma_hoc_phan}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-900">
                                      {course.ten_hoc_phan}
                                      {course.giang_vien && (
                                        <span className="text-[10px] text-slate-500 block">
                                          GV: {course.giang_vien}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">
                                      {course.so_tin_chi}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                      {course.diem_tong_ket ?? '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                                      {course.diem_thang_4 !== undefined && course.diem_thang_4 !== null && !isNaN(Number(course.diem_thang_4))
                                        ? Number(course.diem_thang_4).toFixed(1)
                                        : '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                                      {course.diem_chu || '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {isPassed ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                          Đạt tích lũy
                                        </span>
                                      ) : isInProg ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                          Đang học
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                          Không đạt (Học lại)
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                          <div className="flex items-center space-x-2 text-slate-700">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              Sinh viên <strong>{student.ho_va_ten}</strong> chưa tích lũy học phần nào trong khối này. Cần tích lũy tối thiểu <strong>{target} tín chỉ</strong> để đủ điều kiện xét tốt nghiệp.
                            </span>
                          </div>

                          {/* Suggested typical courses in this block from BICA curriculum */}
                          <div className="pt-2 border-t border-slate-200">
                            <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Các học phần tiêu biểu của khối trong chương trình đào tạo BICA:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {BICA_CURRICULUM
                                .filter((c) => c.khoi_kien_thuc === stat.block.name)
                                .slice(0, 5)
                                .map((s) => (
                                  <span
                                    key={s.ma_hoc_phan}
                                    className="bg-white px-2 py-0.5 rounded text-[11px] text-slate-700 border border-slate-200 font-mono"
                                  >
                                    {s.ma_hoc_phan} - {s.ten_hoc_phan} ({s.so_tin_chi} TC)
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Block Advisor Assessment Note */}
                      <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">
                        <span>
                          Trạng thái khối: <strong>{stat.passedCourses.length} môn đã đạt</strong> ({passed} TC)
                          {stat.inProgressCourses.length > 0 && (
                            <span className="text-blue-700 font-medium"> • {stat.inProgressCourses.length} môn đang học (+{stat.totalInProgressCredits} TC)</span>
                          )}
                          {stat.failedCourses.length > 0 && (
                            <span className="text-rose-700 font-medium"> • {stat.failedCourses.length} môn chưa đạt cần học lại</span>
                          )}
                        </span>
                        <span className="font-mono font-semibold text-slate-700">
                          {remaining === 0 ? '✓ Đã đủ tín chỉ yêu cầu' : `Còn thiếu: ${remaining} TC`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Graduation Eligibility Checklist Note */}
          <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-blue-400">
              <Award className="w-4 h-4" />
              <span>ĐÁNH GIÁ ĐIỀU KIỆN TỐT NGHIỆP TỔNG HỢP CỦA CHỦ NHIỆM NGÀNH</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sinh viên <strong>{student.ho_va_ten}</strong> ({student.ma_sinh_vien}) đã tích lũy <strong>{totalPassedCredits} / {targetCurriculumCredits} tín chỉ</strong>. Để đủ điều kiện nhận bằng Kỹ sư Kỹ thuật Điều khiển Thông minh & Tự động hóa (BICA), sinh viên cần hoàn thành đủ 145 tín chỉ theo đúng phân bổ 6 khối kiến thức và đạt CPA ≥ 2.00.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span>Cố vấn phụ trách: <strong className="text-slate-200">{teacherName}</strong></span>
              <span>• Thời điểm rà soát: {new Date().toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Đang xem hồ sơ: <strong className="text-slate-800">{student.ho_va_ten}</strong> ({student.ma_sinh_vien})</span>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenReminderModal && (
              <button
                type="button"
                onClick={() => {
                  const deficit = targetCurriculumCredits - totalPassedCredits;
                  const note = `Lời dặn của Thầy (Chủ nhiệm ngành): Em đã hoàn thành ${totalPassedCredits}/${targetCurriculumCredits} tín chỉ. Hãy lưu ý hoàn thành các khối kiến thức còn thiếu (${deficit} TC) để đảm bảo tiến độ ra trường đúng hạn.`;
                  onOpenReminderModal(student, note);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors inline-flex items-center space-x-1.5 shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi Nhắc Nhở Tín Chỉ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
