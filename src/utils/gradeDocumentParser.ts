import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  TeacherUploadedCourse,
  convertGradeVjuStandard,
  inferScore10FromLetterOrGpa4,
} from '../lib/supabase';

export interface ParseGradesResult {
  success: boolean;
  courses: TeacherUploadedCourse[];
  studentIdDetected?: string;
  studentNameDetected?: string;
  rawText?: string;
  error?: string;
}

/**
 * Chuyển đổi chuỗi điểm (hỗ trợ cả dấu chấm 8.5 và dấu phẩy 8,5) sang số hợp lệ
 */
export function parseFlexibleScore(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') {
    return !isNaN(val) ? val : undefined;
  }
  const str = String(val).trim().replace(',', '.');
  if (!str || str === '-') return undefined;
  const num = Number(str);
  return !isNaN(num) ? num : undefined;
}

/**
 * Chuẩn hóa danh sách môn học sau khi quét (Excel, Word, AI Ảnh/PDF, Văn bản)
 * Đảm bảo cột Điểm Tổng Kết Hệ 10 luôn có giá trị hợp lệ (kể cả khi tài liệu gốc chỉ có Điểm chữ hoặc Hệ 4)
 */
export function normalizeParsedCourses(rawCourses: any[]): TeacherUploadedCourse[] {
  return (rawCourses || []).map((c, idx) => {
    const cc = parseFlexibleScore(c.diem_chuyen_can);
    const gk = parseFlexibleScore(c.diem_giua_ky);
    const ck = parseFlexibleScore(c.diem_cuoi_ky);
    let score10 = parseFlexibleScore(c.diem_tong_ket);
    let gpa4 = parseFlexibleScore(c.diem_thang_4);
    let letter = c.diem_chu ? String(c.diem_chu).trim().toUpperCase() : '';

    // 1. Nếu chưa có điểm hệ 10 nhưng có điểm thành phần CC/GK/CK
    if (score10 === undefined && (cc !== undefined || gk !== undefined || ck !== undefined)) {
      score10 = Math.round(((cc ?? 0) * 0.1 + (gk ?? 0) * 0.3 + (ck ?? 0) * 0.6) * 10) / 10;
    }

    // 2. Nếu điểm hệ 10 bị nhầm lẫn hoặc chỉ có điểm chữ / hệ 4 -> Tự động suy luận điểm hệ 10 chuẩn VJU
    let status: 'Dat' | 'KhongDat' | 'DangHoc' = (c.ket_qua as any) || 'DangHoc';
    if (score10 !== undefined && score10 >= 0 && score10 <= 10) {
      const conv = convertGradeVjuStandard(score10);
      if (!letter) letter = conv.letter;
      if (gpa4 === undefined) gpa4 = conv.gpa4;
      status = conv.status;
    } else if (letter || gpa4 !== undefined) {
      const inferred = inferScore10FromLetterOrGpa4(letter, gpa4);
      if (inferred.score10 !== undefined) score10 = inferred.score10;
      if (!letter && inferred.letter) letter = inferred.letter;
      if (gpa4 === undefined && inferred.gpa4 !== undefined) gpa4 = inferred.gpa4;
      status = inferred.status;
    }

    const creditsParsed = parseFlexibleScore(c.so_tin_chi);
    const cleanCredits = creditsParsed !== undefined && creditsParsed > 0 ? Math.round(creditsParsed) : 3;

    return {
      ...c,
      ma_hoc_phan: String(c.ma_hoc_phan || `HP-${idx + 1}`).trim().toUpperCase(),
      ten_hoc_phan: String(c.ten_hoc_phan || c.ma_hoc_phan || `Học phần ${idx + 1}`).trim(),
      so_tin_chi: cleanCredits,
      diem_chuyen_can: cc,
      diem_giua_ky: gk,
      diem_cuoi_ky: ck,
      diem_tong_ket: score10,
      diem_chu: letter || undefined,
      diem_thang_4: gpa4,
      ket_qua: status,
    };
  });
}

/**
 * Trích xuất điểm từ tệp bảng tính Excel (.xlsx, .xls, .csv)
 */
export async function parseExcelGrades(file: File): Promise<ParseGradesResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, courses: [], error: 'Tệp Excel không có sheet dữ liệu nào' };
    }

    // Đọc sheet đầu tiên
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (!jsonData || jsonData.length === 0) {
      return { success: false, courses: [], error: 'Tệp Excel rỗng, không có dữ liệu dòng' };
    }

    // Tìm dòng tiêu đề (Header row)
    let headerRowIndex = -1;
    let colIndices: {
      courseCode?: number;
      courseName?: number;
      credits?: number;
      scoreCC?: number;
      scoreGK?: number;
      scoreCK?: number;
      scoreFinal?: number;
      letterGrade?: number;
      gpa4?: number;
      studentId?: number;
      studentName?: number;
    } = {};

    for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
      const row = jsonData[r];
      if (!Array.isArray(row)) continue;

      let matchCount = 0;
      row.forEach((cell, idx) => {
        const text = String(cell || '').toLowerCase().trim();
        if (text.includes('mã hp') || text.includes('mã môn') || text.includes('mã học phần') || text.includes('course code')) {
          colIndices.courseCode = idx;
          matchCount++;
        }
        if (text.includes('tên hp') || text.includes('tên môn') || text.includes('tên học phần') || text.includes('course name')) {
          colIndices.courseName = idx;
          matchCount++;
        }
        if (text.includes('tín chỉ') || text.includes('số tc') || text.includes('credits') || text === 'tc') {
          colIndices.credits = idx;
          matchCount++;
        }
        if (text.includes('chuyên cần') || text === 'cc' || text.includes('attendance')) {
          colIndices.scoreCC = idx;
        }
        if (text.includes('giữa kỳ') || text === 'gk' || text.includes('midterm')) {
          colIndices.scoreGK = idx;
        }
        if (text.includes('cuối kỳ') || text === 'ck' || text.includes('thi') || text.includes('final')) {
          colIndices.scoreCK = idx;
        }
        // Kiểm tra cột hệ 4 trước để không bị ghi đè cột Tổng kết hệ 10 khi tiêu đề có chữ "Tổng kết hệ 4"
        if (text.includes('hệ 4') || text.includes('thang 4') || text.includes('thang điểm 4') || text === 'gpa') {
          colIndices.gpa4 = idx;
        } else if (text.includes('chữ') || text.includes('điểm chữ') || text.includes('letter')) {
          colIndices.letterGrade = idx;
        } else if (
          text.includes('hệ 10') ||
          text.includes('thang 10') ||
          text.includes('thang điểm 10') ||
          text.includes('điểm 10') ||
          text.includes('điểm số') ||
          text.includes('tổng kết') ||
          text === 'tk' ||
          text.includes('điểm hp') ||
          text.includes('điểm tk')
        ) {
          colIndices.scoreFinal = idx;
        }
        if (text.includes('mã sv') || text.includes('mssv') || text.includes('mã sinh viên') || text.includes('student id')) {
          colIndices.studentId = idx;
        }
        if (text.includes('họ và tên') || text.includes('họ tên') || text.includes('sinh viên')) {
          colIndices.studentName = idx;
        }
      });

      // Nếu phát hiện ít nhất 2 cột cốt lõi
      if (matchCount >= 2 || (colIndices.courseName !== undefined && colIndices.credits !== undefined)) {
        headerRowIndex = r;
        break;
      }
    }

    const courses: TeacherUploadedCourse[] = [];
    let detectedStudentId: string | undefined;
    let detectedStudentName: string | undefined;

    // Duyệt tìm MSSV ở các dòng đầu trước header nếu có
    for (let r = 0; r < Math.min(jsonData.length, 10); r++) {
      const row = jsonData[r];
      if (!Array.isArray(row)) continue;
      const joined = row.join(' ');
      const matchId = joined.match(/(BICA\d{8}|\b25\d{6}\b)/i);
      if (matchId && !detectedStudentId) {
        detectedStudentId = matchId[1].toUpperCase();
      }
    }

    // Nếu không tìm thấy header rõ ràng, thử map theo vị trí cột mặc định thông dụng
    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      colIndices = {
        courseCode: 0,
        courseName: 1,
        credits: 2,
        scoreCC: 3,
        scoreGK: 4,
        scoreCK: 5,
        scoreFinal: 6,
        letterGrade: 7,
      };
    }

    // Duyệt qua các dòng dữ liệu sau header
    for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const codeRaw = colIndices.courseCode !== undefined ? String(row[colIndices.courseCode] || '').trim() : '';
      const nameRaw = colIndices.courseName !== undefined ? String(row[colIndices.courseName] || '').trim() : '';
      const creditsRaw = colIndices.credits !== undefined ? parseFlexibleScore(row[colIndices.credits]) : undefined;

      // Bỏ qua dòng trống hoặc dòng tổng cộng
      if (!nameRaw && !codeRaw) continue;
      if (nameRaw.toLowerCase().includes('tổng cộng') || codeRaw.toLowerCase().includes('tổng cộng')) continue;

      // Lấy MSSV nếu có trong dòng
      if (colIndices.studentId !== undefined && row[colIndices.studentId]) {
        const idVal = String(row[colIndices.studentId]).trim();
        if (idVal.length >= 6) detectedStudentId = idVal;
      }
      if (colIndices.studentName !== undefined && row[colIndices.studentName]) {
        detectedStudentName = String(row[colIndices.studentName]).trim();
      }

      // Điểm thành phần & tổng kết (hỗ trợ cả số thập phân dấu chấm và dấu phẩy)
      const scoreCC = colIndices.scoreCC !== undefined ? parseFlexibleScore(row[colIndices.scoreCC]) : undefined;
      const scoreGK = colIndices.scoreGK !== undefined ? parseFlexibleScore(row[colIndices.scoreGK]) : undefined;
      const scoreCK = colIndices.scoreCK !== undefined ? parseFlexibleScore(row[colIndices.scoreCK]) : undefined;
      const scoreFinal = colIndices.scoreFinal !== undefined ? parseFlexibleScore(row[colIndices.scoreFinal]) : undefined;
      const letter = colIndices.letterGrade !== undefined ? String(row[colIndices.letterGrade] || '').trim().toUpperCase() : '';
      const gpa4 = colIndices.gpa4 !== undefined ? parseFlexibleScore(row[colIndices.gpa4]) : undefined;

      const cleanCode = (codeRaw || `HP-${courses.length + 1}`).toUpperCase();
      const cleanName = nameRaw || codeRaw;
      const cleanCredits = creditsRaw !== undefined && creditsRaw > 0 ? Math.round(creditsRaw) : 3;

      courses.push({
        ma_hoc_phan: cleanCode,
        ten_hoc_phan: cleanName,
        so_tin_chi: cleanCredits,
        diem_chuyen_can: scoreCC,
        diem_giua_ky: scoreGK,
        diem_cuoi_ky: scoreCK,
        diem_tong_ket: scoreFinal,
        diem_chu: letter || undefined,
        diem_thang_4: gpa4,
        ket_qua: 'DangHoc',
      });
    }

    const normalized = normalizeParsedCourses(courses);

    if (normalized.length === 0) {
      return { success: false, courses: [], error: 'Không tìm thấy dòng môn học nào hợp lệ trong tệp Excel' };
    }

    return {
      success: true,
      courses: normalized,
      studentIdDetected: detectedStudentId,
      studentNameDetected: detectedStudentName,
    };
  } catch (err: any) {
    console.error('Lỗi phân tích Excel:', err);
    return { success: false, courses: [], error: err.message || 'Lỗi đọc tệp Excel' };
  }
}

/**
 * Helper gọi API quét bảng điểm với cơ chế tự động thử lại khi hệ thống AI cao tải (503 / 429)
 */
async function callScanGradesApi(body: any, maxRetries = 2) {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('/api/scan-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({ success: false, error: 'Không thể phân tích phản hồi máy chủ' }));

      if (res.ok && json.success && json.data) {
        return json.data;
      }

      const errMsg = json?.error || `Lỗi máy chủ (${res.status})`;
      lastError = new Error(errMsg);

      const isTransient =
        res.status === 503 ||
        res.status === 429 ||
        errMsg.includes('503') ||
        errMsg.includes('cao tải') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('quá tải');

      if (isTransient && attempt < maxRetries) {
        console.warn(`[Client scan-grades] AI cao tải lần ${attempt}, tự động thử lại sau 1.5 giây...`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      throw lastError;
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('cao tải') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('Failed to fetch');

      if (isTransient && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Trình phân tích văn bản cục bộ dự phòng (Fallback Heuristic Parser) khi AI gặp sự cố cao tải
 */
export function fallbackParseTextToCourses(rawText: string, targetStudentId?: string): TeacherUploadedCourse[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const courses: TeacherUploadedCourse[] = [];

  for (const line of lines) {
    // Tìm mã học phần (ví dụ: IEA1001, MAT1093, VJU2002, IT2120...)
    const codeMatch = line.match(/\b([A-Z]{2,5}\s?\d{3,5}[A-Z]?)\b/i);
    if (!codeMatch) continue;

    const courseCode = codeMatch[1].replace(/\s+/, '').toUpperCase();

    // Tìm các số trong dòng (điểm số, số tín chỉ)
    // Tách các token
    const tokens = line.split(/[\t|;]+|\s{2,}/).map((t) => t.trim()).filter(Boolean);

    let courseName = '';
    let credits = 3;
    let finalScore: number | undefined = undefined;

    // Tìm token chứa tên môn
    for (const token of tokens) {
      if (token.length >= 3 && !token.match(/^\d+([.,]\d+)?$/) && !token.includes(courseCode)) {
        if (!courseName || token.length > courseName.length) {
          courseName = token;
        }
      }
    }

    if (!courseName) {
      courseName = `Học phần ${courseCode}`;
    }

    // Tìm số tín chỉ (1 đến 6) và điểm số (0.0 đến 10.0, hỗ trợ cả dấu chấm và dấu phẩy)
    const numbers = line.match(/\b\d+([.,]\d+)?\b/g);
    if (numbers && numbers.length > 0) {
      for (const numStr of numbers) {
        const val = parseFloat(numStr.replace(',', '.'));
        if (Number.isInteger(val) && val >= 1 && val <= 6 && credits === 3) {
          credits = val;
        } else if (val >= 0 && val <= 10) {
          finalScore = val;
        }
      }
    }

    // Tìm điểm chữ nếu có (A+, A, B+, B, C+, C, D+, D, F)
    const letterMatch = line.match(/\b(A\+|A|B\+|B|C\+|C|D\+|D|F)\b/);
    const detectedLetter = letterMatch ? letterMatch[1].toUpperCase() : undefined;

    courses.push({
      ma_hoc_phan: courseCode,
      ten_hoc_phan: courseName,
      so_tin_chi: credits,
      diem_tong_ket: finalScore,
      diem_chu: detectedLetter,
      ket_qua: 'DangHoc',
      hoc_ky: 'Học kỳ 1',
      nam_hoc: '2025-2026',
    });
  }

  return normalizeParsedCourses(courses);
}

/**
 * Trích xuất điểm từ tệp Word (.docx)
 */
export async function parseWordGrades(file: File, targetStudentId?: string): Promise<ParseGradesResult> {
  let textContent = '';
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    textContent = value || '';

    if (!textContent || textContent.trim().length === 0) {
      return { success: false, courses: [], error: 'Tài liệu Word không có văn bản hoặc bảng điểm' };
    }

    // Gửi văn bản trích xuất tới endpoint AI để bóc tách thông minh (có auto-retry)
    try {
      const data = await callScanGradesApi({
        textContent,
        targetStudentId,
      });

      const { courses = [], ma_sinh_vien, ho_va_ten } = data;
      const normalized = normalizeParsedCourses(courses);
      if (normalized.length > 0) {
        return {
          success: true,
          courses: normalized,
          studentIdDetected: ma_sinh_vien || targetStudentId,
          studentNameDetected: ho_va_ten,
          rawText: textContent,
        };
      }
    } catch (aiErr: any) {
      console.warn('AI bóc tách Word thất bại, kích hoạt bộ bóc tách văn bản cục bộ dự phòng...', aiErr);
      // Fallback cục bộ
      const fallbackCourses = fallbackParseTextToCourses(textContent, targetStudentId);
      if (fallbackCourses.length > 0) {
        return {
          success: true,
          courses: fallbackCourses,
          studentIdDetected: targetStudentId,
          rawText: textContent,
        };
      }
      throw aiErr;
    }

    return { success: false, courses: [], error: 'Không tìm thấy dòng điểm học phần nào trong tệp Word' };
  } catch (err: any) {
    console.error('Lỗi phân tích Word:', err);
    const msg = err.message || 'Lỗi đọc tệp Word';
    return {
      success: false,
      courses: [],
      error: msg.includes('503') || msg.includes('cao tải')
        ? 'Hệ thống AI hiện đang trong thời gian cao tải tạm thời (503). Vui lòng thử lại sau vài giây hoặc nạp tệp Excel (.xlsx).'
        : msg,
    };
  }
}

/**
 * Quét bảng điểm từ Ảnh (.png, .jpg, .jpeg, .webp) hoặc tài liệu PDF (.pdf) bằng AI
 */
export async function parseMediaGradesWithAi(
  file: File,
  targetStudentId?: string
): Promise<ParseGradesResult> {
  try {
    const base64 = await fileToBase64(file);
    const fileType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const data = await callScanGradesApi({
      fileType,
      base64Data: base64,
      targetStudentId,
    });

    const { courses = [], ma_sinh_vien, ho_va_ten } = data;
    return {
      success: true,
      courses: normalizeParsedCourses(courses),
      studentIdDetected: ma_sinh_vien || targetStudentId,
      studentNameDetected: ho_va_ten,
    };
  } catch (err: any) {
    console.error('Lỗi quét điểm bằng AI:', err);
    const msg = err.message || 'Lỗi quét hình ảnh/PDF';
    return {
      success: false,
      courses: [],
      error: msg.includes('503') || msg.includes('cao tải') || msg.includes('high demand')
        ? 'Hệ thống AI hiện đang cao tải tạm thời (503). Vui lòng nhấn "Thử lại quét tệp" sau 5-10 giây hoặc nạp bằng file Excel (.xlsx).'
        : msg,
    };
  }
}

/**
 * Quét điểm từ văn bản thô copy paste
 */
export async function parseTextGradesWithAi(
  text: string,
  targetStudentId?: string
): Promise<ParseGradesResult> {
  try {
    try {
      const data = await callScanGradesApi({
        textContent: text,
        targetStudentId,
      });

      const { courses = [], ma_sinh_vien, ho_va_ten } = data;
      const normalized = normalizeParsedCourses(courses);
      if (normalized.length > 0) {
        return {
          success: true,
          courses: normalized,
          studentIdDetected: ma_sinh_vien || targetStudentId,
          studentNameDetected: ho_va_ten,
        };
      }
    } catch (aiErr: any) {
      console.warn('AI bóc tách văn bản thất bại, dùng fallback cục bộ...', aiErr);
      const fallbackCourses = fallbackParseTextToCourses(text, targetStudentId);
      if (fallbackCourses.length > 0) {
        return {
          success: true,
          courses: fallbackCourses,
          studentIdDetected: targetStudentId,
        };
      }
      throw aiErr;
    }

    return { success: false, courses: [], error: 'Không tìm thấy dòng học phần nào' };
  } catch (err: any) {
    return {
      success: false,
      courses: [],
      error: err.message || 'Lỗi bóc tách văn bản',
    };
  }
}

/**
 * Helper chuyển File sang Base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}
