const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

export default async function handler(req: any, res: any) {
  const origin = String(req.headers?.origin || '').replace(/\/$/, '');
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

  // Rate limiting chống Brute-force mật khẩu (tối đa 10 lần thử / phút / IP)
  const clientIp = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: `Bạn đã nhập sai hoặc thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${retryAfterSec} giây.`,
    });
  } else {
    record.count += 1;
  }

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
}
