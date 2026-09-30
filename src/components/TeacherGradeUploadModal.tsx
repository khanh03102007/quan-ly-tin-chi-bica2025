import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  FileImage,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  BookOpen,
  UserCheck,
  Send,
  Sliders,
  ChevronDown,
  Info,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  saveTeacherGradesForStudent,
  TeacherUploadedCourse,
  convertGradeVjuStandard,
  inferScore10FromLetterOrGpa4,
} from '../lib/supabase';
import {
  parseExcelGrades,
  parseWordGrades,
  parseMediaGradesWithAi,
  parseTextGradesWithAi,
} from '../utils/gradeDocumentParser';
import { BICA_CURRICULUM } from '../data/bicaCurriculum';
import { GRADE_PRESETS } from './BicaCurriculumPickerModal';

interface StudentItem {
  ma_sinh_vien: string;
  ho_va_ten: string;
  email?: string;
  lop?: string;
  tong_tin_chi_tich_luy?: number;
  registered_credits?: number;
  diem_gpa?: number;
  calculated_gpa?: number;
}

interface TeacherGradeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentItem[];
  preSelectedStudentId?: string;
  teacherName?: string;
  onSuccess: () => void;
}

export const TeacherGradeUploadModal: React.FC<TeacherGradeUploadModalProps> = ({
  isOpen,
  onClose,
  students,
  preSelectedStudentId,
  teacherName = 'TS. Phạm Tiến Thành (Chủ nhiệm ngành BICA)',
  onSuccess,
}) => {
  // Sinh viên được chọn để nạp điểm
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Chế độ: 'scan' (Quét tài liệu / AI) hoặc 'manual' (Nhập thủ công)
  const [activeMode, setActiveMode] = useState<'scan' | 'manual'>('scan');

  // Danh sách các môn học đang chỉnh sửa / chuẩn bị nạp
  const [coursesList, setCoursesList] = useState<TeacherUploadedCourse[]>([]);
  // Lưu chuỗi đang gõ cho ô điểm hệ 10 và hệ 4 để gõ số thập phân (VD: 8.5 hoặc 8,5) không bị mất dấu chấm/phẩy
  const [rawScore10Inputs, setRawScore10Inputs] = useState<Record<number, string>>({});
  const [rawScore4Inputs, setRawScore4Inputs] = useState<Record<number, string>>({});
  const [selectedSemester, setSelectedSemester] = useState('Học kỳ 1');
  const [selectedYear, setSelectedYear] = useState('2025-2026');
  const [sendNotification, setSendNotification] = useState(true);

  // States quét tệp
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tạo và tải xuống tệp Excel mẫu chuẩn BICA
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        'Mã Học Phần': 'IEA1001',
        'Tên Học Phần': 'Nhập môn Kỹ thuật Thông minh và Tự động hóa',
        'Số Tín Chỉ': 3,
        'Điểm Tổng Kết Hệ 10': 8.9,
        'Điểm Tổng Kết Hệ 4': 4.0,
        'Điểm Chữ': 'A',
        'Mã Sinh Viên': currentStudent.ma_sinh_vien,
        'Họ và Tên': currentStudent.ho_va_ten,
      },
      {
        'Mã Học Phần': 'MAT1093',
        'Tên Học Phần': 'Giải tích 1',
        'Số Tín Chỉ': 4,
        'Điểm Tổng Kết Hệ 10': 8.1,
        'Điểm Tổng Kết Hệ 4': 3.5,
        'Điểm Chữ': 'B+',
        'Mã Sinh Viên': currentStudent.ma_sinh_vien,
        'Họ và Tên': currentStudent.ho_va_ten,
      },
      {
        'Mã Học Phần': 'VJU2002',
        'Tên Học Phần': 'Tiếng Nhật sơ cấp 1',
        'Số Tín Chỉ': 3,
        'Điểm Tổng Kết Hệ 10': 9.4,
        'Điểm Tổng Kết Hệ 4': 4.0,
        'Điểm Chữ': 'A+',
        'Mã Sinh Viên': currentStudent.ma_sinh_vien,
        'Họ và Tên': currentStudent.ho_va_ten,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');
    XLSX.writeFile(wb, `Mau_Bang_Diem_BICA_${currentStudent.ma_sinh_vien}.xlsx`);
  };

  // Nhập văn bản thô / Clipboard
  const [rawTextModal, setRawTextModal] = useState(false);
  const [rawTextInput, setRawTextInput] = useState('');

  // Trạng thái lưu
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Tìm kiếm môn học từ khung CTĐT BICA
  const [curriculumSearch, setCurriculumSearch] = useState('');
  const [showCurriculumSelector, setShowCurriculumSelector] = useState(false);

  // Khởi tạo sinh viên ban đầu
  useEffect(() => {
    if (preSelectedStudentId) {
      setTargetStudentId(preSelectedStudentId);
    } else if (students.length > 0 && !targetStudentId) {
      setTargetStudentId(students[0].ma_sinh_vien);
    }
  }, [preSelectedStudentId, students]);

  if (!isOpen) return null;

  const currentStudent = students.find((s) => s.ma_sinh_vien === targetStudentId) || {
    ma_sinh_vien: targetStudentId || 'Chưa chọn',
    ho_va_ten: 'Sinh viên BICA',
    email: '',
    lop: 'BICA-K2025',
    diem_gpa: 0,
    tong_tin_chi_tich_luy: 0,
  };

  // Lọc sinh viên theo tên hoặc MSSV
  const filteredStudents = students.filter(
    (s) =>
      s.ho_va_ten.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      s.ma_sinh_vien.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

  // Xử lý tệp được chọn hoặc kéo thả
  const handleProcessFile = async (file: File) => {
    setLastFile(file);
    setIsParsing(true);
    setParseError(null);
    setSaveSuccessMessage(null);
    setParsingStep('Đang phân tích cấu trúc tệp...');

    try {
      const fileName = file.name.toLowerCase();
      let result;

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        setParsingStep('Đang đọc các cột bảng điểm Excel...');
        result = await parseExcelGrades(file);
      } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        setParsingStep('Đang trích xuất nội dung văn bản Word qua AI...');
        result = await parseWordGrades(file, targetStudentId);
      } else if (
        fileName.endsWith('.png') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.webp') ||
        fileName.endsWith('.pdf')
      ) {
        setParsingStep('AI đang đọc và nhận diện bảng điểm, quy đổi thang điểm VJU...');
        result = await parseMediaGradesWithAi(file, targetStudentId);
      } else {
        throw new Error('Định dạng tệp chưa được hỗ trợ. Vui lòng chọn tệp Excel, Word, PDF hoặc Ảnh.');
      }

      if (!result.success || !result.courses || result.courses.length === 0) {
        throw new Error(result.error || 'Không trích xuất được môn học nào từ tệp');
      }

      // Nếu tài liệu phát hiện mã sinh viên và trùng với sinh viên trong lớp, tự động gợi ý chuyển sinh viên
      if (result.studentIdDetected && result.studentIdDetected !== targetStudentId) {
        const found = students.find(
          (s) => s.ma_sinh_vien.toUpperCase() === result.studentIdDetected?.toUpperCase()
        );
        if (found) {
          setTargetStudentId(found.ma_sinh_vien);
        }
      }

      setCoursesList(result.courses);
      setRawScore10Inputs({});
      setRawScore4Inputs({});
      setParsingStep('');
    } catch (err: any) {
      console.error('Lỗi đọc tệp điểm:', err);
      setParseError(err.message || 'Lỗi xử lý tệp');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Xử lý dán văn bản thô
  const handleProcessRawText = async () => {
    if (!rawTextInput.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setParsingStep('AI đang phân tích văn bản bảng điểm...');
    try {
      const result = await parseTextGradesWithAi(rawTextInput, targetStudentId);
      if (!result.success || !result.courses || result.courses.length === 0) {
        throw new Error(result.error || 'Không nhận diện được môn học từ đoạn văn bản');
      }
      setCoursesList(result.courses);
      setRawScore10Inputs({});
      setRawScore4Inputs({});
      setRawTextModal(false);
      setRawTextInput('');
    } catch (err: any) {
      setParseError(err.message || 'Lỗi bóc tách văn bản');
    } finally {
      setIsParsing(false);
      setParsingStep('');
    }
  };

  // Cập nhật ô trong danh sách môn học
  const handleUpdateCourseRow = (index: number, field: keyof TeacherUploadedCourse, value: any) => {
    setCoursesList((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Nếu cập nhật điểm thành phần CC, GK, CK thì tự tính tổng kết
      if (field === 'diem_chuyen_can' || field === 'diem_giua_ky' || field === 'diem_cuoi_ky') {
        const cc = field === 'diem_chuyen_can' ? Number(value) : Number(item.diem_chuyen_can ?? 0);
        const gk = field === 'diem_giua_ky' ? Number(value) : Number(item.diem_giua_ky ?? 0);
        const ck = field === 'diem_cuoi_ky' ? Number(value) : Number(item.diem_cuoi_ky ?? 0);

        if (!isNaN(cc) || !isNaN(gk) || !isNaN(ck)) {
          const finalScore = Math.round((cc * 0.1 + gk * 0.3 + ck * 0.6) * 10) / 10;
          item.diem_tong_ket = finalScore;
          const conv = convertGradeVjuStandard(finalScore);
          item.diem_chu = conv.letter;
          item.diem_thang_4 = conv.gpa4;
          item.ket_qua = conv.status;
        }
      } else if (field === 'diem_tong_ket') {
        if (value === undefined || value === null || value === '') {
          item.diem_tong_ket = undefined;
        } else {
          const score = Number(String(value).replace(',', '.'));
          if (!isNaN(score)) {
            const clamped = Math.min(10, Math.max(0, score));
            item.diem_tong_ket = clamped;
            const conv = convertGradeVjuStandard(clamped);
            item.diem_chu = conv.letter;
            item.diem_thang_4 = conv.gpa4;
            item.ket_qua = conv.status;
          }
        }
      } else if (field === 'diem_thang_4') {
        if (value === undefined || value === null || value === '') {
          item.diem_thang_4 = undefined;
        } else {
          const g4 = Number(String(value).replace(',', '.'));
          if (!isNaN(g4)) {
            const clamped4 = Math.min(4, Math.max(0, g4));
            item.diem_thang_4 = clamped4;
            const inferred = inferScore10FromLetterOrGpa4(undefined, clamped4);
            if (inferred.letter) item.diem_chu = inferred.letter;
            if ((item.diem_tong_ket === undefined || item.diem_tong_ket === null) && inferred.score10 !== undefined) {
              item.diem_tong_ket = inferred.score10;
            }
            item.ket_qua = inferred.status;
          }
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  // Xử lý gõ trực tiếp vào ô Tổng kết hệ 10 (cho phép gõ dấu chấm, dấu phẩy, xóa trắng)
  const handleScore10InputChange = (index: number, rawVal: string) => {
    // Chỉ cho phép số, dấu chấm, dấu phẩy
    if (rawVal !== '' && !/^\d{0,2}([.,]\d{0,2})?$/.test(rawVal)) return;
    setRawScore10Inputs((prev) => ({ ...prev, [index]: rawVal }));

    if (rawVal.trim() === '') {
      handleUpdateCourseRow(index, 'diem_tong_ket', undefined);
      return;
    }

    const normalized = rawVal.replace(',', '.');
    const parsed = Number(normalized);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      handleUpdateCourseRow(index, 'diem_tong_ket', parsed);
      // Đồng bộ lại ô hiển thị hệ 4
      setRawScore4Inputs((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  // Xử lý gõ trực tiếp vào ô Tổng kết hệ 4
  const handleScore4InputChange = (index: number, rawVal: string) => {
    if (rawVal !== '' && !/^\d{0,1}([.,]\d{0,2})?$/.test(rawVal)) return;
    setRawScore4Inputs((prev) => ({ ...prev, [index]: rawVal }));

    if (rawVal.trim() === '') {
      handleUpdateCourseRow(index, 'diem_thang_4', undefined);
      return;
    }

    const normalized = rawVal.replace(',', '.');
    const parsed = Number(normalized);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 4) {
      handleUpdateCourseRow(index, 'diem_thang_4', parsed);
      setRawScore10Inputs((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  // Tự động điền điểm hệ 10 chuẩn VJU cho toàn bộ các môn đã có điểm chữ / hệ 4 nhưng thiếu hệ 10
  const handleAutoFillMissingScore10 = () => {
    setCoursesList((prev) =>
      prev.map((item) => {
        if (item.diem_tong_ket !== undefined && item.diem_tong_ket !== null) return item;
        const inferred = inferScore10FromLetterOrGpa4(item.diem_chu, item.diem_thang_4);
        if (inferred.score10 !== undefined) {
          return {
            ...item,
            diem_tong_ket: inferred.score10,
            diem_chu: item.diem_chu || inferred.letter,
            diem_thang_4: item.diem_thang_4 ?? inferred.gpa4,
            ket_qua: inferred.status,
          };
        }
        return item;
      })
    );
    setRawScore10Inputs({});
  };

  // Thêm môn từ khung CTĐT BICA
  const handleAddBicaCourse = (course: any) => {
    const existingIndex = coursesList.findIndex((c) => c.ma_hoc_phan === course.ma_hoc_phan);
    if (existingIndex >= 0) return;

    const newCourse: TeacherUploadedCourse = {
      ma_hoc_phan: course.ma_hoc_phan,
      ten_hoc_phan: course.ten_hoc_phan,
      so_tin_chi: course.so_tin_chi,
      hoc_ky: selectedSemester,
      nam_hoc: selectedYear,
      ket_qua: 'DangHoc',
    };

    setCoursesList((prev) => [...prev, newCourse]);
  };

  // Áp dụng Preset điểm cho 1 môn
  const handleApplyPreset = (index: number, preset: any) => {
    setRawScore10Inputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setRawScore4Inputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setCoursesList((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (preset.score !== null) {
        item.diem_tong_ket = preset.score;
        item.diem_chu = preset.letter;
        item.diem_thang_4 = preset.gpa4;
        item.ket_qua = preset.status;
      } else {
        item.diem_tong_ket = undefined;
        item.diem_chu = undefined;
        item.diem_thang_4 = undefined;
        item.ket_qua = 'DangHoc';
      }
      updated[index] = item;
      return updated;
    });
  };

  // Thêm 1 dòng môn trống
  const handleAddEmptyRow = () => {
    setCoursesList((prev) => [
      ...prev,
      {
        ma_hoc_phan: `HP-${prev.length + 1}`,
        ten_hoc_phan: '',
        so_tin_chi: 3,
        hoc_ky: selectedSemester,
        nam_hoc: selectedYear,
        ket_qua: 'DangHoc',
      },
    ]);
  };

  // Xóa môn khỏi danh sách chuẩn bị nạp
  const handleRemoveCourse = (index: number) => {
    setCoursesList((prev) => prev.filter((_, i) => i !== index));
  };

  // Tính thống kê sơ bộ của danh sách môn chuẩn bị nạp
  const totalCreditsPreview = coursesList.reduce((sum, c) => sum + (Number(c.so_tin_chi) || 0), 0);
  let totalPointsPreview = 0;
  let gradedCreditsPreview = 0;
  coursesList.forEach((c) => {
    if (c.diem_thang_4 !== undefined && c.diem_thang_4 !== null && c.so_tin_chi) {
      totalPointsPreview += Number(c.diem_thang_4) * Number(c.so_tin_chi);
      gradedCreditsPreview += Number(c.so_tin_chi);
    }
  });
  const termGpaPreview =
    gradedCreditsPreview > 0 ? (totalPointsPreview / gradedCreditsPreview).toFixed(2) : '---';

  // Lưu & nạp điểm đích danh
  const handleSaveGrades = async () => {
    if (!targetStudentId) {
      setParseError('Vui lòng chọn sinh viên đích để nạp điểm');
      return;
    }
    if (coursesList.length === 0) {
      setParseError('Chưa có môn học nào để nạp. Vui lòng quét tệp hoặc thêm môn học.');
      return;
    }

    setIsSaving(true);
    setParseError(null);
    setSaveSuccessMessage(null);

    try {
      const res = await saveTeacherGradesForStudent({
        targetStudentId,
        targetStudentName: currentStudent.ho_va_ten,
        courses: coursesList.map((c) => ({
          ...c,
          hoc_ky: c.hoc_ky || selectedSemester,
          nam_hoc: c.nam_hoc || selectedYear,
        })),
        teacherName,
        academicYear: selectedYear,
        sendNotification,
      });

      if (!res.success) {
        throw new Error(res.error || 'Không thể lưu bảng điểm');
      }

      setSaveSuccessMessage(
        `Đã nạp thành công ${res.count} học phần vào tài khoản ${currentStudent.ho_va_ten} (${targetStudentId})! GPA mới: ${res.calculatedGpa}`
      );

      // Gọi callback làm mới danh sách ngoài Portal
      onSuccess();
    } catch (err: any) {
      setParseError(err.message || 'Lỗi lưu bảng điểm');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-blue-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  PHÊ DUYỆT & CẬP NHẬT ĐIỂM HỌC PHẦN SINH VIÊN
                </h2>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[11px] px-2 py-0.5 rounded font-mono">
                  Chủ nhiệm ngành
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Nạp kết quả học tập chính thức vào cơ sở dữ liệu Supabase • Tự động tính GPA & CPA tích lũy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thẻ chọn sinh viên đích (Target Student Selector) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              {currentStudent.ho_va_ten?.charAt(0) || 'SV'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sinh viên đích:
                </span>
                <span className="font-bold text-slate-900 text-sm">{currentStudent.ho_va_ten}</span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono font-medium">
                  {currentStudent.ma_sinh_vien}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Lớp: {currentStudent.lop || 'BICA-K2025'}</span>
                <span>•</span>
                <span>GPA hiện tại: {currentStudent.calculated_gpa || currentStudent.diem_gpa || '---'}</span>
                <span>•</span>
                <span>Tín chỉ: {currentStudent.tong_tin_chi_tich_luy || 0} TC</span>
              </div>
            </div>
          </div>

          {/* Nút bấm chọn/đổi sinh viên */}
          <div className="relative">
            <button
              onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-2xs transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Đổi Sinh Viên Nhận Điểm</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown danh sách sinh viên */}
            {isStudentDropdownOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-30 p-2">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc MSSV..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredStudents.map((s) => (
                    <button
                      key={s.ma_sinh_vien}
                      onClick={() => {
                        setTargetStudentId(s.ma_sinh_vien);
                        setIsStudentDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        s.ma_sinh_vien === targetStudentId
                          ? 'bg-blue-50 text-blue-800 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{s.ho_va_ten}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.ma_sinh_vien}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-slate-600">
                          GPA {s.calculated_gpa || s.diem_gpa || '---'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thanh chọn chế độ: Quét tệp tự động vs Nhập thủ công */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveMode('scan')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeMode === 'scan'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Quét Bảng Điểm Tự Động (Ảnh, Excel, Word, PDF)</span>
            </button>
            <button
              onClick={() => setActiveMode('manual')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeMode === 'manual'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>2. Nhập Thủ Công / Chọn Từ Khung CTĐT BICA</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 pb-2">
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
            >
              <option value="Học kỳ 1">Học kỳ 1</option>
              <option value="Học kỳ 2">Học kỳ 2</option>
              <option value="Học kỳ hè">Học kỳ hè</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
            >
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
            </select>
          </div>
        </div>

        {/* Thân Modal cuộn được */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Thông báo thành công / lỗi */}
          {saveSuccessMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="font-semibold">{saveSuccessMessage}</div>
            </div>
          )}

          {parseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs space-y-3 animate-in fade-in">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-900">Không thể bóc tách bảng điểm tự động</div>
                  <div className="text-red-700 mt-1 leading-relaxed">{parseError}</div>
                </div>
              </div>

              {/* Tùy chọn giải quyết nhanh cho Giảng viên */}
              <div className="pt-2 border-t border-red-200/60 flex flex-wrap items-center gap-2">
                {lastFile && (
                  <button
                    type="button"
                    onClick={() => handleProcessFile(lastFile)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử lại quét tệp ({lastFile.name})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tải mẫu Excel chuẩn BICA</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('manual');
                    setParseError(null);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Chuyển sang nhập điểm thủ công</span>
                </button>
              </div>
            </div>
          )}

          {/* Chế độ 1: Quét tệp tự động */}
          {activeMode === 'scan' && (
            <div className="space-y-4">
              {/* Khu vực kéo thả tệp */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                />

                {isParsing ? (
                  <div className="py-4 flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                    <div className="font-semibold text-sm text-slate-800">{parsingStep}</div>
                    <p className="text-xs text-slate-500">
                      Đang xử lý dữ liệu và tự động nhận diện thang điểm VJU...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                        <FileImage className="w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm">
                        Nhấp vào đây hoặc kéo thả tệp bảng điểm cần nạp
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Hỗ trợ đầy đủ: <b>Excel (.xlsx, .xls, .csv)</b>, <b>Word (.docx)</b>, <b>Tài liệu PDF</b>, hoặc <b>Ảnh chụp bảng điểm (.png, .jpg)</b>
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <span className="text-[11px] bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                        ✓ Tự động trích xuất mã môn & điểm số
                      </span>
                      <span className="text-[11px] bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                        ✓ Tự quy đổi thang điểm chữ VJU & Hệ 4
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tùy chọn dán văn bản thô */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Hoặc bạn có thể dán bảng điểm dạng văn bản/email:</span>
                <button
                  type="button"
                  onClick={() => setRawTextModal(!rawTextModal)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
                >
                  {rawTextModal ? 'Đóng khung dán văn bản' : 'Dán văn bản thô / Copy-paste'}
                </button>
              </div>

              {rawTextModal && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
                  <label className="block text-xs font-semibold text-slate-700">
                    Dán nội dung văn bản bảng điểm từ email hoặc sổ điểm:
                  </label>
                  <textarea
                    rows={4}
                    value={rawTextInput}
                    onChange={(e) => setRawTextInput(e.target.value)}
                    placeholder="Ví dụ: IEA1001 Nhập môn Kỹ thuật Thông minh 3 tín chỉ điểm 9.0; MAT1093 Giải tích 1 điểm 8.5..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleProcessRawText}
                      disabled={isParsing || !rawTextInput.trim()}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Bóc Tách Văn Bản</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chế độ 2: Nhập thủ công & Chọn từ khung CTĐT BICA */}
          {activeMode === 'manual' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 p-4 rounded-xl border border-blue-200">
                <div>
                  <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Chọn nhanh từ Khung CTĐT BICA 2025
                  </h3>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Hệ thống đã tích hợp 145 tín chỉ chuẩn của ngành BICA (VJU)
                  </p>
                </div>
                <button
                  onClick={() => setShowCurriculumSelector(!showCurriculumSelector)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center space-x-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{showCurriculumSelector ? 'Ẩn danh mục' : 'Mở danh mục 49 học phần BICA'}</span>
                </button>
              </div>

              {/* Khung tìm & thêm học phần CTĐT */}
              {showCurriculumSelector && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm môn học BICA theo mã hoặc tên (VD: IEA, Giải tích, Lập trình, IoT...)"
                      value={curriculumSearch}
                      onChange={(e) => setCurriculumSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                    {BICA_CURRICULUM.filter(
                      (c) =>
                        c.ten_hoc_phan.toLowerCase().includes(curriculumSearch.toLowerCase()) ||
                        c.ma_hoc_phan.toLowerCase().includes(curriculumSearch.toLowerCase())
                    ).map((c) => {
                      const isAdded = coursesList.some((row) => row.ma_hoc_phan === c.ma_hoc_phan);
                      return (
                        <div
                          key={c.ma_hoc_phan}
                          className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">{c.ten_hoc_phan}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {c.ma_hoc_phan} • {c.so_tin_chi} TC • HK {c.hoc_ky_goi_y}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddBicaCourse(c)}
                            disabled={isAdded}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                              isAdded
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isAdded ? 'Đã thêm' : '+ Thêm môn'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BẢNG XEM TRƯỚC & HIỆU CHỈNH ĐIỂM (EDITABLE REVIEW TABLE) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Danh Sách Môn Học Nạp Cho Sinh Viên ({coursesList.length} học phần)
                </h3>
                {coursesList.length > 0 && (
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-full font-medium">
                    Tổng: {totalCreditsPreview} tín chỉ • GPA dự kiến: {termGpaPreview}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {coursesList.some(
                  (c) =>
                    (c.diem_tong_ket === undefined || c.diem_tong_ket === null) &&
                    (c.diem_chu || (c.diem_thang_4 !== undefined && c.diem_thang_4 !== null))
                ) && (
                  <button
                    type="button"
                    onClick={handleAutoFillMissingScore10}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Tự động điền điểm hệ 10 chuẩn VJU từ điểm chữ hoặc hệ 4 cho các môn còn trống"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Tự điền điểm hệ 10</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddEmptyRow}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng môn học</span>
                </button>
              </div>
            </div>

            {coursesList.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                Chưa có môn học nào trong danh sách. Hãy quét tệp bảng điểm ở tab 1 hoặc chọn môn ở tab 2.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Mã HP</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Tên Học Phần</th>
                      <th className="py-2.5 px-2 text-center w-14">Số TC</th>
                      <th className="py-2.5 px-2 text-center w-24">Tổng kết hệ 10</th>
                      <th className="py-2.5 px-2 text-center w-24">Tổng kết hệ 4</th>
                      <th className="py-2.5 px-2 text-center w-16">Điểm chữ</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Chọn nhanh VJU</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {coursesList.map((course, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        {/* Mã HP */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={course.ma_hoc_phan}
                            onChange={(e) => handleUpdateCourseRow(idx, 'ma_hoc_phan', e.target.value)}
                            className="w-24 p-1 font-mono uppercase bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        {/* Tên học phần */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={course.ten_hoc_phan}
                            onChange={(e) => handleUpdateCourseRow(idx, 'ten_hoc_phan', e.target.value)}
                            className="w-full p-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                          />
                        </td>
                        {/* Tín chỉ */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={course.so_tin_chi}
                            onChange={(e) => handleUpdateCourseRow(idx, 'so_tin_chi', Number(e.target.value))}
                            className="w-12 p-1 text-center bg-white border border-slate-200 rounded text-xs"
                          />
                        </td>
                        {/* Tổng kết hệ 10 */}
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              rawScore10Inputs[idx] !== undefined
                                ? rawScore10Inputs[idx]
                                : course.diem_tong_ket !== undefined && course.diem_tong_ket !== null
                                ? String(course.diem_tong_ket)
                                : ''
                            }
                            onChange={(e) => handleScore10InputChange(idx, e.target.value)}
                            onBlur={() => {
                              setRawScore10Inputs((prev) => {
                                const next = { ...prev };
                                delete next[idx];
                                return next;
                              });
                            }}
                            placeholder="Nhập điểm"
                            className="w-18 p-1.5 text-center font-bold bg-amber-50 border border-amber-300 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-900 rounded text-xs transition-all"
                          />
                        </td>
                        {/* Tổng kết hệ 4 */}
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              rawScore4Inputs[idx] !== undefined
                                ? rawScore4Inputs[idx]
                                : course.diem_thang_4 !== undefined && course.diem_thang_4 !== null
                                ? String(course.diem_thang_4)
                                : ''
                            }
                            onChange={(e) => handleScore4InputChange(idx, e.target.value)}
                            onBlur={() => {
                              setRawScore4Inputs((prev) => {
                                const next = { ...prev };
                                delete next[idx];
                                return next;
                              });
                            }}
                            placeholder="-"
                            className="w-16 p-1.5 text-center font-bold bg-emerald-50 border border-emerald-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-emerald-900 rounded text-xs transition-all"
                          />
                        </td>
                        {/* Điểm chữ */}
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 font-bold rounded text-[11px] ${
                            course.diem_chu?.startsWith('A')
                              ? 'bg-emerald-100 text-emerald-800'
                              : course.diem_chu?.startsWith('B')
                              ? 'bg-blue-100 text-blue-800'
                              : course.diem_chu?.startsWith('C')
                              ? 'bg-amber-100 text-amber-800'
                              : course.diem_chu === 'F'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {course.diem_chu || '---'}
                          </span>
                        </td>
                        {/* Nút chọn nhanh preset */}
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'].map((letter) => {
                              const preset = GRADE_PRESETS.find((p) => p.letter === letter);
                              return (
                                <button
                                  key={letter}
                                  type="button"
                                  onClick={() => preset && handleApplyPreset(idx, preset)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                    course.diem_chu === letter
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {letter}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        {/* Nút xóa */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCourse(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Xóa môn này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal: Tùy chọn thông báo & Nút Phê duyệt nạp điểm */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>
              Gửi thông báo học vụ đích danh đến tài khoản sinh viên (<b>{currentStudent.ho_va_ten}</b>)
            </span>
          </label>

          <div className="flex items-center space-x-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveGrades}
              disabled={isSaving || coursesList.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang Lưu & Tính Toán GPA...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Phê Duyệt & Nạp Bảng Điểm Đích Danh</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
