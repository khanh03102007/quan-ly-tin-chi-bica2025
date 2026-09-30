import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  UploadCloud,
  Terminal,
  Code2,
  Table,
  ExternalLink
} from 'lucide-react';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  checkSupabaseConnection,
  syncSampleDataToSupabase
} from '../lib/supabase';

interface SupabaseConsoleTabProps {
  onDataRefreshed: () => void;
}

export const SupabaseConsoleTab: React.FC<SupabaseConsoleTabProps> = ({
  onDataRefreshed,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    counts: { ho_so: number; khoa_hoc: number; lich_trinh: number; hoc_phi: number };
    error?: string | null;
  } | null>(null);

  const [seeding, setSeeding] = useState(false);
  const [seedLogs, setSeedLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const sqlSchema = `-- ==============================================================================
-- SQL MIGRATION CHO DỰ ÁN SUPABASE: THEO DÕI TÍN CHỈ BICA 2025
-- Chạy đoạn mã này trong Supabase Studio -> SQL Editor nếu bảng chưa được tạo
-- ==============================================================================

-- 1. Bảng hồ sơ sinh viên
CREATE TABLE IF NOT EXISTS public.ho_so (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ma_sinh_vien TEXT UNIQUE NOT NULL,
  ho_va_ten TEXT NOT NULL,
  lop TEXT NOT NULL,
  nganh_hoc TEXT NOT NULL,
  khoa TEXT NOT NULL,
  nien_khoa TEXT NOT NULL,
  email TEXT NOT NULL,
  so_dien_thoai TEXT,
  ngay_sinh DATE,
  avatar_url TEXT,
  trang_thai_hoc_tap TEXT DEFAULT 'Đang theo học',
  tong_tin_chi_tich_luy NUMERIC DEFAULT 32,
  tong_tin_chi_yeu_cau NUMERIC DEFAULT 145,
  diem_gpa NUMERIC DEFAULT 3.65,
  diem_cpa NUMERIC DEFAULT 3.65,
  xep_loai TEXT DEFAULT 'Giỏi',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng các khóa học & điểm số của sinh viên
CREATE TABLE IF NOT EXISTS public.khoa_hoc_sinh_vien (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ma_sinh_vien TEXT NOT NULL,
  ma_hoc_phan TEXT NOT NULL,
  ten_hoc_phan TEXT NOT NULL,
  so_tin_chi INTEGER NOT NULL DEFAULT 3,
  hoc_ky TEXT NOT NULL,
  nam_hoc TEXT NOT NULL,
  diem_chuyen_can NUMERIC,
  diem_giua_ky NUMERIC,
  diem_cuoi_ky NUMERIC,
  diem_tong_ket NUMERIC,
  diem_chu TEXT,
  diem_thang_4 NUMERIC,
  ket_qua TEXT DEFAULT 'Dat',
  giang_vien TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bảng lịch trình / thời khóa biểu
CREATE TABLE IF NOT EXISTS public.lich_trinh (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ma_sinh_vien TEXT NOT NULL,
  ma_hoc_phan TEXT NOT NULL,
  ten_hoc_phan TEXT NOT NULL,
  thu INTEGER NOT NULL, -- 2: Thứ 2, ..., 7: Thứ 7
  tiet_bat_dau INTEGER NOT NULL,
  so_tiet INTEGER NOT NULL,
  gio_bat_dau TEXT NOT NULL,
  gio_ket_thuc TEXT NOT NULL,
  phong_hoc TEXT NOT NULL,
  giang_vien TEXT NOT NULL,
  hinh_thuc TEXT DEFAULT 'TrucTiep',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Bảng hồ sơ học phí
CREATE TABLE IF NOT EXISTS public.ho_so_hoc_phi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ma_sinh_vien TEXT NOT NULL,
  hoc_ky TEXT NOT NULL,
  nam_hoc TEXT NOT NULL,
  tong_so_tin_chi INTEGER NOT NULL,
  tong_hoc_phi NUMERIC NOT NULL,
  mien_giam NUMERIC DEFAULT 0,
  da_thanh_toan NUMERIC DEFAULT 0,
  con_no NUMERIC DEFAULT 0,
  han_dong DATE NOT NULL,
  trang_thai TEXT DEFAULT 'ChuaThanhToan',
  ma_giao_dich TEXT,
  ngay_thanh_toan DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bật tính năng Realtime cho các bảng trên
ALTER PUBLICATION supabase_realtime ADD TABLE public.ho_so;
ALTER PUBLICATION supabase_realtime ADD TABLE public.khoa_hoc_sinh_vien;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lich_trinh;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ho_so_hoc_phi;

-- Cấp quyền truy cập Read/Write cho anon role (khi dùng anon key)
ALTER TABLE public.ho_so ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khoa_hoc_sinh_vien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lich_trinh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ho_so_hoc_phi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép đọc dữ liệu công khai" ON public.ho_so FOR SELECT USING (true);
CREATE POLICY "Cho phép cập nhật hồ sơ" ON public.ho_so FOR ALL USING (true);

CREATE POLICY "Cho phép đọc khóa học" ON public.khoa_hoc_sinh_vien FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa khóa học" ON public.khoa_hoc_sinh_vien FOR ALL USING (true);

CREATE POLICY "Cho phép đọc lịch trình" ON public.lich_trinh FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa lịch trình" ON public.lich_trinh FOR ALL USING (true);

CREATE POLICY "Cho phép đọc học phí" ON public.ho_so_hoc_phi FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm/sửa học phí" ON public.ho_so_hoc_phi FOR ALL USING (true);
`;

  const handleTestConnection = async () => {
    setTesting(true);
    const res = await checkSupabaseConnection();
    setTestResult(res);
    setTesting(false);
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedLogs(['Bắt đầu đồng bộ dữ liệu mẫu lên Supabase...']);
    const res = await syncSampleDataToSupabase();
    setSeedLogs(res.logs);
    setSeeding(false);
    onDataRefreshed();
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Status Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <span>Cấu Hình Supabase SDK Đang Sử Dụng</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Được kết nối qua thư viện Supabase JS SDK (CDN & npm client)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-test-supabase"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Đang Kiểm Tra...' : 'Kiểm Tra Kết Nối'}</span>
            </button>
            <button
              id="btn-seed-supabase"
              onClick={handleSeedData}
              disabled={seeding}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{seeding ? 'Đang Nạp...' : 'Nạp Dữ Liệu Mẫu Lên Supabase'}</span>
            </button>
          </div>
        </div>

        {/* Credentials preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase font-sans">
              SUPABASE_URL (Cấu hình)
            </span>
            <div className="text-slate-800 break-all select-all font-semibold">
              {SUPABASE_URL}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase font-sans">
              SUPABASE_ANON_KEY (Public Key)
            </span>
            <div className="text-slate-800 break-all select-all font-semibold">
              {SUPABASE_ANON_KEY.substring(0, 24)}••••••••••
            </div>
          </div>
        </div>

        {/* Test Result summary */}
        {testResult && (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Kết nối đến Supabase Cloud REST endpoint hoạt động tốt!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-sans">
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-500 block text-[11px]">Bảng ho_so:</span>
                <strong className="text-emerald-700 text-sm">{testResult.counts.ho_so} bản ghi</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-500 block text-[11px]">Bảng khoa_hoc_sinh_vien:</span>
                <strong className="text-emerald-700 text-sm">{testResult.counts.khoa_hoc} bản ghi</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-500 block text-[11px]">Bảng lich_trinh:</span>
                <strong className="text-emerald-700 text-sm">{testResult.counts.lich_trinh} bản ghi</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-500 block text-[11px]">Bảng ho_so_hoc_phi:</span>
                <strong className="text-emerald-700 text-sm">{testResult.counts.hoc_phi} bản ghi</strong>
              </div>
            </div>
          </div>
        )}

        {/* Seed Logs */}
        {seedLogs.length > 0 && (
          <div className="p-3.5 bg-slate-900 rounded-xl text-slate-200 text-xs font-mono space-y-1">
            <div className="flex items-center space-x-2 text-emerald-400 font-sans font-semibold mb-2">
              <Terminal className="w-4 h-4" />
              <span>Nhật ký nạp dữ liệu Supabase:</span>
            </div>
            {seedLogs.map((log, index) => (
              <div key={index} className="text-slate-300">
                &gt; {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SQL Migration Script */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Mã Nguồn SQL Tạo Bảng & RLS Cho Supabase
            </h3>
          </div>
          <button
            onClick={copySql}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Đã Sao Chép SQL!' : 'Sao Chép SQL'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Nếu bạn mới khởi tạo database trên Supabase và chưa tạo bảng, hãy copy đoạn SQL này dán vào mục <strong>SQL Editor</strong> trên bảng điều khiển Supabase để tạo 4 bảng: <code>ho_so</code>, <code>khoa_hoc_sinh_vien</code>, <code>lich_trinh</code>, <code>ho_so_hoc_phi</code> kèm kích hoạt tính năng Realtime và cấp quyền RLS.
        </p>

        <div className="relative">
          <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
            {sqlSchema}
          </pre>
        </div>
      </div>
    </div>
  );
};
