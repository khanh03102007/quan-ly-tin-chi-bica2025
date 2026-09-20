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
} from 'lucide-react';
import {
  BICA_CURRICULUM,
  BICA_KNOWLEDGE_BLOCKS,
  BICA_SEMESTER_INFO,
  BicaCurriculumCourse,
} from '../data/bicaCurriculum';

interface BicaCurriculumPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCourses: (courses: BicaCurriculumCourse[], defaultStatus: 'DangHoc' | 'Dat') => Promise<void>;
  existingCourseCodes?: string[];
  isSubmitting?: boolean;
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
  const [defaultStatus, setDefaultStatus] = useState<'DangHoc' | 'Dat'>('DangHoc');

  const existingCodesSet = useMemo(() => {
    return new Set(existingCourseCodes.map((c) => c.toUpperCase().trim()));
  }, [existingCourseCodes]);

  // Lọc danh sách môn học
  const filteredCourses = useMemo(() => {
    return BICA_CURRICULUM.filter((c) => {
      // Lọc kỳ
      if (selectedSemester !== 'all' && c.hoc_ky_goi_y !== selectedSemester) {
        return false;
      }
      // Lọc khối kiến thức
      if (selectedBlock !== 'Tất cả' && c.khoi_kien_thuc !== selectedBlock) {
        return false;
      }
      // Lọc từ khóa tìm kiếm
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
      }
      return next;
    });
  };

  const handleSelectAllInView = () => {
    const newSet = new Set(selectedCourseCodes);
    filteredCourses.forEach((c) => {
      if (!existingCodesSet.has(c.ma_hoc_phan.toUpperCase().trim())) {
        newSet.add(c.ma_hoc_phan);
      }
    });
    setSelectedCourseCodes(newSet);
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
    await onSelectCourses(selectedSummary.courses, defaultStatus);
    setSelectedCourseCodes(new Set());
    onClose();
  };

  const handleAddSingleCourse = async (course: BicaCurriculumCourse) => {
    await onSelectCourses([course], defaultStatus);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <GraduationCap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Khung CTĐT Kỹ thuật Thông minh & Tự động hóa (BICA)</h2>
                <span className="bg-amber-400/20 text-amber-200 text-xs px-2 py-0.5 rounded-full font-medium border border-amber-300/30">
                  145 Tín chỉ
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Trường Đại học Việt Nhật (VJU - ĐHQGHN) • Nhấp chọn môn học để nạp vào bảng điểm cá nhân
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo mã môn (IEA1001, VJU2002...), tên môn (Mạch điện, Giải tích, Vi xử lý...)"
                className="w-full pl-9.5 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs text-slate-700"
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

          {/* Thông tin nhanh về kỳ học được chọn */}
          {selectedSemester !== 'all' && BICA_SEMESTER_INFO[selectedSemester] && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-900 flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-blue-800">
                  {BICA_SEMESTER_INFO[selectedSemester].title} (Đề xuất {BICA_SEMESTER_INFO[selectedSemester].tin_chi} Tín chỉ):
                </span>{' '}
                <span className="text-slate-600">{BICA_SEMESTER_INFO[selectedSemester].ghi_chu}</span>
              </div>
            </div>
          )}
        </div>

        {/* Thanh tác vụ chọn nhanh */}
        <div className="px-6 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
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

          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Trạng thái khi nạp:</span>
            <select
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value as 'DangHoc' | 'Dat')}
              className="bg-white border border-slate-300 rounded-md px-2 py-0.5 text-xs font-medium text-slate-700 focus:ring-1 focus:ring-blue-500"
            >
              <option value="DangHoc">Đang theo học</option>
              <option value="Dat">Đã đạt (Hoàn thành)</option>
            </select>
          </div>
        </div>

        {/* Danh sách các môn học BICA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 divide-y divide-slate-100">
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
                  <div className="flex items-start justify-between gap-3">
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

                    {/* Nút hành động đơn lẻ hoặc nhãn trạng thái */}
                    <div className="shrink-0 flex items-center space-x-2">
                      {isAlreadyAdded ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium border border-slate-200 flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Đã có trong bảng điểm</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSingleCourse(course);
                          }}
                          disabled={isSubmitting}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-medium border border-blue-200 transition-all flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Thêm môn này</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal: Thống kê và xác nhận nạp nhiều môn */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-sm text-slate-700">
            <span>Đang chọn:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
              {selectedSummary.count} môn
            </span>
            <span>tương đương</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {selectedSummary.credits} Tín chỉ
            </span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={selectedSummary.count === 0 || isSubmitting}
              onClick={handleSubmit}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-white font-medium text-sm transition-all shadow-md flex items-center justify-center space-x-2 ${
                selectedSummary.count === 0 || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
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
                  <span>Thêm {selectedSummary.count} môn đã chọn vào bảng điểm</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
