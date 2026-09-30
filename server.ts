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

  // API Quét & Bóc tách bảng điểm từ Hình ảnh / PDF / Văn bản trích xuất
  app.post('/api/scan-grades', async (req, res) => {
    try {
      const { fileType, base64Data, textContent, targetStudentId } = req.body;

      if (!base64Data && !textContent) {
        return res.status(400).json({ success: false, error: 'Thiếu dữ liệu tệp hoặc văn bản' });
      }

      const promptInstruction = `Bạn là Trợ lý Học vụ Thông minh của Trường Đại học Việt Nhật (VJU - ĐHQGHN), chuyên trách chương trình Cử nhân Kỹ thuật Thông minh và Tự động hóa (BICA 2025).
Nhiệm vụ của bạn là đọc kỹ bảng điểm, phiếu điểm, sổ điểm hoặc tài liệu được gửi tới và trích xuất dữ liệu học phần thật chính xác.

YÊU CẦU TRÍCH XUẤT:
1. "ma_sinh_vien": Mã sinh viên ghi trong tài liệu (ví dụ: BICA25119034, 25119034, BICA25119001...). Nếu trong tài liệu không có hoặc khó đọc, hãy trả về "${targetStudentId || ''}".
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

Ưu tiên trích xuất chính xác các dòng bảng điểm của sinh viên mang mã "${targetStudentId || ''}".`;

      const contents: any[] = [];

      if (base64Data && fileType) {
        // Hỗ trợ ảnh (image/png, image/jpeg, image/webp) hoặc PDF (application/pdf)
        contents.push({
          inlineData: {
            mimeType: fileType,
            data: base64Data,
          },
        });
        contents.push(promptInstruction);
      } else if (textContent) {
        // Dữ liệu văn bản từ Word hoặc Excel / PDF trích xuất text
        contents.push(promptInstruction + '\n\n=== NỘI DUNG VĂN BẢN BẢNG ĐIỂM ===\n' + textContent);
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
      } else if (err?.message) {
        userFriendlyError = err.message;
      }

      return res.status(503).json({
        success: false,
        error: userFriendlyError,
        rawError: rawMsg,
      });
    }
  });

  // Gắn kết Vite middleware trong môi trường Dev, hoặc serve dist trong Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`BICA Portal Server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
