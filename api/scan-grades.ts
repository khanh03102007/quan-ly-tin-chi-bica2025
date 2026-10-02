import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

function cleanJsonText(rawText: string): string {
  let cleaned = (rawText || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export default async function handler(req: any, res: any) {
  const origin = String(req.headers?.origin || '').replace(/\/$/, '');
  const allowedOrigins = new Set(
    [
      'https://sv02.bica-vju.com',
      'https://www.sv02.bica-vju.com',
      process.env.APP_URL,
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
    ]
      .map((o) => (o || '').trim().replace(/\/$/, ''))
      .filter(Boolean)
  );

  const isAllowedOrigin =
    !origin ||
    allowedOrigins.has(origin) ||
    origin.endsWith('.run.app') ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  if (origin && isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return isAllowedOrigin ? res.status(204).end() : res.status(403).json({ success: false, error: 'CORS Forbidden' });
  }

  if (origin && !isAllowedOrigin) {
    return res.status(403).json({ success: false, error: 'Origin không được phép truy cập API.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Kiểm tra Rate Limit theo IP
  const clientIp = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: `Bạn đã gửi quá nhiều yêu cầu quét điểm. Vui lòng thử lại sau ${retryAfterSec} giây.`,
    });
  } else {
    record.count += 1;
  }

  try {
    const { fileType, base64Data, textContent, targetStudentId } = req.body || {};

    if (!base64Data && !textContent) {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu tệp hoặc văn bản' });
    }

    const cleanFileType = typeof fileType === 'string' ? fileType.trim().toLowerCase() : '';
    if (base64Data && cleanFileType && !ALLOWED_MIME_TYPES.has(cleanFileType)) {
      return res.status(400).json({
        success: false,
        error: 'Định dạng tệp không hợp lệ. Chỉ chấp nhận PNG, JPG, WEBP hoặc PDF.',
      });
    }

    if (base64Data && (typeof base64Data !== 'string' || base64Data.length > 45_000_000)) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu tệp tải lên vượt quá kích thước cho phép.',
      });
    }

    const sanitizedTextContent =
      typeof textContent === 'string' ? textContent.slice(0, 200_000) : '';
    const sanitizedTargetStudentId =
      typeof targetStudentId === 'string'
        ? targetStudentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
        : '';

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const promptInstruction = `Bạn là Trợ lý Học vụ Thông minh của Trường Đại học Việt Nhật (VJU - ĐHQGHN), chuyên trách chương trình Cử nhân Kỹ thuật Thông minh và Tự động hóa (BICA 2025).
Nhiệm vụ của bạn là đọc kỹ bảng điểm, phiếu điểm, sổ điểm hoặc tài liệu được gửi tới và trích xuất dữ liệu học phần thật chính xác.

YÊU CẦU TRÍCH XUẤT:
1. "ma_sinh_vien": Mã sinh viên ghi trong tài liệu (ví dụ: BICA25119034, 25119034, BICA25119001...). Nếu trong tài liệu không có hoặc khó đọc, hãy trả về "${sanitizedTargetStudentId}".
2. "ho_va_ten": Họ và tên sinh viên (nếu có trong bảng điểm).
3. "hoc_ky": Học kỳ hoặc năm học ghi nhận (ví dụ: "Học kỳ 1", "Học kỳ 2", "2025-2026").
4. "courses": Danh sách tất cả học phần/môn học có trong bảng điểm. Mỗi môn học bao gồm:
   - "ma_hoc_phan": Mã môn học (ví dụ: IEA1001, VJU2002, MAT1093, PHY1100, HIS1001, IT2120, IT3080...).
   - "ten_hoc_phan": Tên môn học đầy đủ tiếng Việt hoặc tiếng Anh.
   - "so_tin_chi": Số tín chỉ (số nguyên, mặc định 3 nếu không rõ).
   - "diem_chuyen_can": Điểm chuyên cần (hệ 10, nếu có).
   - "diem_giua_ky": Điểm giữa kỳ (hệ 10, nếu có).
   - "diem_cuoi_ky": Điểm thi cuối kỳ / hết môn (hệ 10, nếu có).
   - "diem_tong_ket": Điểm tổng kết hệ 10 (ví dụ 8.5, 7.8). Nếu bảng điểm chưa có cột tổng kết nhưng có điểm thành phần, tính = CC*0.1 + GK*0.3 + CK*0.6, làm tròn 1 chữ số thập phân. Đặc biệt, nếu bảng điểm chỉ ghi điểm chữ hoặc điểm hệ 4 mà không ghi điểm hệ 10, hãy tự động quy đổi điểm hệ 10 chuẩn VJU tương ứng: A+ -> 9.5, A -> 8.6, B+ -> 8.2, B -> 7.5, C+ -> 6.7, C -> 6.0, D+ -> 5.2, D -> 4.5, F -> 3.0.
   - "diem_chu": Điểm chữ theo quy chế đào tạo VJU (A+, A, B+, B, C+, C, D+, D, F).
   - "diem_thang_4": Điểm hệ 4 quy đổi (4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.0).
   - "ket_qua": "Dat" nếu điểm tổng kết >= 4.0 hoặc điểm chữ khác F; "KhongDat" nếu điểm tổng kết < 4.0 hoặc điểm chữ F; "DangHoc" nếu môn chưa có điểm thi.`;

    const contents: any[] = [];
    if (base64Data && cleanFileType) {
      contents.push({
        inlineData: {
          mimeType: cleanFileType,
          data: base64Data,
        },
      });
      contents.push(promptInstruction);
    } else if (sanitizedTextContent) {
      contents.push(promptInstruction + '\n\n=== NỘI DUNG VĂN BẢN BẢNG ĐIỂM ===\n' + sanitizedTextContent);
    }

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ma_sinh_vien: { type: Type.STRING },
          ho_va_ten: { type: Type.STRING },
          hoc_ky: { type: Type.STRING },
          courses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ma_hoc_phan: { type: Type.STRING },
                ten_hoc_phan: { type: Type.STRING },
                so_tin_chi: { type: Type.NUMBER },
                diem_chuyen_can: { type: Type.NUMBER },
                diem_giua_ky: { type: Type.NUMBER },
                diem_cuoi_ky: { type: Type.NUMBER },
                diem_tong_ket: { type: Type.NUMBER },
                diem_chu: { type: Type.STRING },
                diem_thang_4: { type: Type.NUMBER },
                ket_qua: { type: Type.STRING },
                giang_vien: { type: Type.STRING },
                ghi_chu: { type: Type.STRING },
              },
              required: ['ma_hoc_phan', 'ten_hoc_phan', 'so_tin_chi'],
            },
          },
        },
        required: ['courses'],
      },
    };

    let lastError: any = null;
    for (const model of GEMINI_CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: schemaConfig,
        });
        const rawText = response.text?.trim() || '';
        if (rawText) {
          const parsed = JSON.parse(cleanJsonText(rawText));
          return res.status(200).json({
            success: true,
            modelUsed: model,
            data: parsed,
          });
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('Không thể xử lý bảng điểm');
  } catch (err: any) {
    return res.status(503).json({
      success: false,
      error: err?.message || 'Lỗi xử lý quét điểm qua AI',
    });
  }
}
