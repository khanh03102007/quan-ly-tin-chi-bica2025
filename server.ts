import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. Ép buộc chuyển hướng HTTP -> HTTPS trên Production & thiết lập Security Headers
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (isProduction && proto && proto !== 'https' && !req.hostname.includes('localhost')) {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // 2. Cấu hình CORS theo Whitelist (bao gồm cả non-www, www, APP_URL và môi trường preview)
  const allowedOrigins = new Set(
    [
      'https://quan-ly-tin-chi-bica.vercel.app',
      'https://sv02.bica-vju.com',
      'https://www.sv02.bica-vju.com',
      process.env.APP_URL,
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
    ]
      .map((o) => (o || '').trim().replace(/\/$/, ''))
      .filter(Boolean)
  );

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin?.replace(/\/$/, '');
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
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      return isAllowedOrigin ? res.status(204).end() : res.status(403).json({ success: false, error: 'CORS Forbidden' });
    }

    if (origin && !isAllowedOrigin) {
      return res.status(403).json({ success: false, error: 'Origin không được phép truy cập API.' });
    }

    next();
  });

  // 3. Bộ giới hạn tần suất (Rate Limiting) cho các API AI nặng (Tối đa 15 requests / phút / IP)
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000;
  const RATE_LIMIT_MAX_REQUESTS = 15;

  function apiRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const clientIp = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const record = rateLimitMap.get(clientIp);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: `Bạn đã gửi quá nhiều yêu cầu quét điểm. Vui lòng thử lại sau ${retryAfterSec} giây.`,
      });
    }

    record.count += 1;
    next();
  }

  // Tăng payload limit để nhận ảnh chụp bảng điểm độ phân giải cao và tài liệu PDF
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Danh sách các mô hình Gemini hợp lệ hỗ trợ phân tích văn bản & thị giác
  // gemini-3.8-flash: Mô hình chính
  // gemini-3.1-flash-lite: Mô hình Flash Lite tốc độ cao, dự phòng khi cao tải
  // gemini-flash-latest: Mô hình Flash phiên bản ổn định mới nhất
  const GEMINI_CANDIDATE_MODELS = [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];

  function cleanJsonText(rawText: string): string {
    let cleaned = (rawText || '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return cleaned.trim();
  }

  // Hàm gọi Gemini với cơ chế tự động thử lại (Retry) và chuyển đổi mô hình dự phòng (Fallback) khi 503 / 429
  async function callGeminiWithFallback(contents: any[], schemaConfig: any) {
    let lastError: any = null;

    for (const model of GEMINI_CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Gemini API] Đang quét bảng điểm với model '${model}' (lần thử ${attempt})...`);
          const response = await ai.models.generateContent({
            model,
            contents,
            config: schemaConfig,
          });

          const rawText = response.text?.trim() || '';
          if (rawText) {
            const parsed = JSON.parse(cleanJsonText(rawText));
            console.log(`[Gemini API] Thành công bóc tách dữ liệu từ model '${model}'!`);
            return { modelUsed: model, data: parsed };
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const isOverloaded =
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded');

          console.warn(`[Gemini API] Model '${model}' lần ${attempt} thất bại:`, errMsg);

          if (isOverloaded) {
            if (attempt === 1) {
              // Nghỉ 1.2s trước khi thử lại model này
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
            // Nếu đã thử 2 lần vẫn quá tải, chuyển ngay sang model tiếp theo trong danh sách
            console.log(`[Gemini API] Model '${model}' đang cao tải, chuyển sang model dự phòng tiếp theo...`);
            break;
          } else {
            // Lỗi khác không phải quá tải, ném ra ngay
            throw err;
          }
        }
      }
    }

    throw lastError;
  }

  const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/pdf',
  ]);

  // Bộ giới hạn tần suất riêng cho xác thực mật khẩu phân quyền (chống Brute-force: tối đa 10 lần/phút/IP)
  const authRateLimitMap = new Map<string, { count: number; resetAt: number }>();
  function authRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const clientIp = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const record = authRateLimitMap.get(clientIp);

    if (!record || now > record.resetAt) {
      authRateLimitMap.set(clientIp, { count: 1, resetAt: now + 60 * 1000 });
      return next();
    }

    if (record.count >= 10) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${retryAfterSec} giây.`,
      });
    }

    record.count += 1;
    next();
  }

  // API Xác thực mật khẩu phân quyền ở phía Server (không lưu mật khẩu cứng ở Client Bundle)
  app.post('/api/verify-portal-role', authRateLimiter, (req, res) => {
    const { portalType, email, password } = req.body || {};
    const emailClean = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 120) : '';
    const passClean = typeof password === 'string' ? password.trim().slice(0, 120) : '';
    const masterPassword = process.env.PORTAL_MASTER_PASSWORD || 'Bica2025';

    if (!emailClean || !passClean) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập đầy đủ tài khoản email và mật khẩu.',
      });
    }

    if (portalType === 'teacher') {
      const isAuthorizedTeacher =
        emailClean === 'phamtienthanh@vju.ac.vn' ||
        emailClean === 'thanh.pt@vju.ac.vn' ||
        emailClean === 'gv.thanh@vju.ac.vn' ||
        (emailClean.includes('thanh') && emailClean.includes('vju')) ||
        emailClean === 'khanhtd2007@gmail.com' ||
        emailClean === '25119034@st.vju.ac.vn' ||
        emailClean === 'bica25119034@st.vju.ac.vn';

      if (!isAuthorizedTeacher) {
        return res.status(401).json({
          success: false,
          error: 'Email không tồn tại trong danh sách tài khoản Chủ nhiệm ngành được cấp quyền.',
        });
      }

      if (passClean !== masterPassword) {
        return res.status(401).json({
          success: false,
          error: 'Mật khẩu phân quyền không chính xác. Vui lòng nhập đúng mật khẩu được cấp.',
        });
      }

      return res.status(200).json({
        success: true,
        teacher: {
          email: 'phamtienthanh@vju.ac.vn',
          ho_va_ten: 'TS. Phạm Tiến Thành',
          ma_giang_vien: 'GV-BICA-TRUONGNGANH',
          khoa_vien: 'Chương trình Kỹ thuật Thông minh & Tự động hóa (BICA - VJU)',
          vai_tro: 'truong_nganh',
        },
      });
    }

    if (portalType === 'evaluator') {
      if (emailClean === 'khanhtd2007@gmail.com') {
        if (passClean === masterPassword) {
          return res.status(200).json({
            success: true,
            session: {
              name: 'Trần Duy Khánh (Admin Web)',
              role: 'Quản Trị Viên Hệ Thống (Super Admin)',
              email: 'khanhtd2007@gmail.com',
              isSuperAdmin: true,
              quyen_han: 'toan_quyen',
            },
          });
        }
        return res.status(401).json({
          success: false,
          error: 'Mật khẩu Quản trị viên không chính xác. Vui lòng kiểm tra lại.',
        });
      }

      const isTeacherAccount =
        emailClean === 'phamtienthanh@vju.ac.vn' ||
        emailClean === 'thanh.pt@vju.ac.vn' ||
        emailClean === 'gv.thanh@vju.ac.vn';

      if (isTeacherAccount) {
        if (passClean === masterPassword) {
          return res.status(200).json({
            success: true,
            session: {
              name: 'TS. Phạm Tiến Thành (Chủ nhiệm ngành)',
              role: 'Chủ nhiệm ngành BICA',
              email: emailClean,
              isSuperAdmin: false,
              quyen_han: 'toan_quyen',
            },
          });
        }
        return res.status(401).json({
          success: false,
          error: 'Mật khẩu tài khoản Chủ nhiệm ngành không chính xác.',
        });
      }

      return res.status(200).json({
        success: false,
        isNotServerAccount: true,
      });
    }

    if (portalType === 'default_student') {
      const isDefaultStudentEmail =
        emailClean === '25119034@st.vju.ac.vn' ||
        emailClean === 'bica25119034@st.vju.ac.vn' ||
        emailClean === 'khanhtd@st.vju.ac.vn';

      if (isDefaultStudentEmail && passClean === masterPassword) {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({
        success: false,
        error: 'Email trường hoặc mật khẩu không chính xác.',
      });
    }

    return res.status(400).json({ success: false, error: 'Loại cổng xác thực không hợp lệ.' });
  });

  // API Quét & Bóc tách bảng điểm từ Hình ảnh / PDF / Văn bản trích xuất
  app.post('/api/scan-grades', apiRateLimiter, async (req, res) => {
    try {
      const { fileType, base64Data, textContent, targetStudentId } = req.body || {};

      if (!base64Data && !textContent) {
        return res.status(400).json({ success: false, error: 'Thiếu dữ liệu tệp hoặc văn bản' });
      }

      // Validate & Sanitize đầu vào để chống XSS, DoS và Prompt Injection
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

      const promptInstruction = `Bạn là Trợ lý Học vụ Thông minh của Trường Đại học Việt Nhật (VJU - ĐHQGHN), chuyên trách chương trình Cử nhân Kỹ thuật Thông minh và Tự động hóa (BICA 2025).
Nhiệm vụ của bạn là đọc kỹ bảng điểm, phiếu điểm, sổ điểm hoặc tài liệu được gửi tới và trích xuất dữ liệu học phần thật chính xác.

YÊU CẦU TRÍCH XUẤT:
1. "ma_sinh_vien": Mã sinh viên ghi trong tài liệu (ví dụ: BICA25119034, 25119034, BICA25119001...). Nếu trong tài liệu không có hoặc khó đọc, hãy trả về "${sanitizedTargetStudentId}".
2. "ho_va_ten": Họ và tên sinh viên (nếu có trong bảng điểm).
3. "hoc_ky": Học kỳ hoặc năm học ghi nhận (ví dụ: "Học kỳ 1", "Học kỳ 2", "2025-2026").
4. "courses": Danh sách tất cả học phần/môn học có trong bảng điểm. Mỗi môn học bao gồm:
   - "ma_hoc_phan": Mã môn học (ví dụ: IEA1001, VJU2002, MAT1093, PHY1100, HIS1001, IT2120, IT3080...). Nếu không thấy mã, hãy tự suy luận mã hợp lý theo tên môn.
   - "ten_hoc_phan": Tên môn học đầy đủ tiếng Việt hoặc tiếng Anh (ví dụ: "Nhập môn Kỹ thuật Thông minh", "Giải tích 1", "Tiếng Nhật thương mại"...).
   - "so_tin_chi": Số tín chỉ (số nguyên, ví dụ 2, 3, 4. Mặc định 3 nếu không rõ).
   - "diem_chuyen_can": Điểm chuyên cần (hệ 10, nếu có, ví dụ 10, 9.5).
   - "diem_giua_ky": Điểm giữa kỳ (hệ 10, nếu có, ví dụ 8.0, 8.5).
   - "diem_cuoi_ky": Điểm thi cuối kỳ / hết môn (hệ 10, nếu có, ví dụ 8.5, 9.0).
   - "diem_tong_ket": Điểm tổng kết hệ 10 (ví dụ 8.5, 7.8). Nếu bảng điểm chưa có cột tổng kết nhưng có điểm thành phần, tính = CC*0.1 + GK*0.3 + CK*0.6, làm tròn 1 chữ số thập phân. Đặc biệt, nếu bảng điểm chỉ ghi điểm chữ hoặc điểm hệ 4 mà không ghi điểm hệ 10, hãy tự động quy đổi điểm hệ 10 chuẩn VJU tương ứng: A+ -> 9.5, A -> 8.6, B+ -> 8.2, B -> 7.5, C+ -> 6.7, C -> 6.0, D+ -> 5.2, D -> 4.5, F -> 3.0.
   - "diem_chu": Điểm chữ theo quy chế đào tạo VJU:
     + 9.0 - 10.0 -> A+
     + 8.5 - 8.9  -> A
     + 8.0 - 8.4  -> B+
     + 7.0 - 7.9  -> B
     + 6.5 - 6.9  -> C+
     + 5.5 - 6.4  -> C
     + 5.0 - 5.4  -> D+
     + 4.0 - 4.9  -> D
     + < 4.0      -> F
   - "diem_thang_4": Điểm hệ 4 quy đổi:
     + A+, A -> 4.0
     + B+    -> 3.5
     + B     -> 3.0
     + C+    -> 2.5
     + C     -> 2.0
     + D+    -> 1.5
     + D     -> 1.0
     + F     -> 0.0
   - "ket_qua": "Dat" nếu điểm tổng kết >= 4.0 hoặc điểm chữ khác F; "KhongDat" nếu điểm tổng kết < 4.0 hoặc điểm chữ F; "DangHoc" nếu môn chưa có điểm thi.
   - "giang_vien": Tên giảng viên phụ trách nếu có ghi.
   - "ghi_chu": Ghi chú thêm nếu có.

Ưu tiên trích xuất chính xác các dòng bảng điểm của sinh viên mang mã "${sanitizedTargetStudentId}".`;

      const contents: any[] = [];

      if (base64Data && cleanFileType) {
        // Hỗ trợ ảnh (image/png, image/jpeg, image/webp) hoặc PDF (application/pdf)
        contents.push({
          inlineData: {
            mimeType: cleanFileType,
            data: base64Data,
          },
        });
        contents.push(promptInstruction);
      } else if (sanitizedTextContent) {
        // Dữ liệu văn bản từ Word hoặc Excel / PDF trích xuất text
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

      const result = await callGeminiWithFallback(contents, schemaConfig);

      return res.json({
        success: true,
        modelUsed: result.modelUsed,
        data: result.data,
      });
    } catch (err: any) {
      console.error('Lỗi khi gọi Gemini scan-grades:', err);
      const rawMsg = err?.message || String(err);
      let userFriendlyError = 'Lỗi xử lý quét điểm qua AI';

      if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
        userFriendlyError =
          'Hệ thống AI hiện đang trong thời gian cao tải tạm thời (503: High Demand). Vui lòng thử lại sau vài giây hoặc sử dụng tệp Excel (.xlsx) để nạp điểm trực tiếp tức thì.';
      } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        userFriendlyError =
          'Đã đạt hạn mức yêu cầu tạm thời (429). Vui lòng chờ 10-15 giây rồi thử lại, hoặc nhập điểm qua file Excel.';
      } else if (!isProduction && err?.message) {
        userFriendlyError = err.message;
      }

      return res.status(503).json({
        success: false,
        error: userFriendlyError,
        ...(isProduction ? {} : { rawError: rawMsg }),
      });
    }
  });

  // 4. Xử lý 404 chuẩn cho các API endpoint không tồn tại
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}`,
    });
  });

  // Gắn kết Vite middleware trong môi trường Dev, hoặc serve dist có Caching trong Production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.resolve(__dirname, 'dist', 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        maxAge: '1h',
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // 5. Global Error Handler (500 Internal Server Error / PayloadTooLarge)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        error: 'Kích thước dữ liệu gửi lên vượt quá giới hạn tối đa (35MB).',
      });
    }
    console.error('Unhandled Server Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi hệ thống máy chủ nội bộ (500). Vui lòng thử lại sau.',
    });
  });

  app.listen(port, () => {
    console.log(`BICA Portal Server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
