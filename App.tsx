import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  supabase,
  getCurrentUser,
  signOut,
  onAuthStateChange,
  fetchStudentProfile,
  fetchCoursesAndGrades,
  fetchSchedule,
  fetchTuition,
  subscribeToRealtimeChanges,
  DEFAULT_STUDENT_PROFILE
} from './lib/supabase';
import type {
  StudentProfile,
  StudentCourse,
  ScheduleItem,
  TuitionRecord
} from './types';
import { Header } from './components/Header';
import { ProfileTab } from './components/ProfileTab';
import { CoursesGradesTab } from './components/CoursesGradesTab';
import { GpaWhatIfCalculatorTab } from './components/GpaWhatIfCalculatorTab';
import { ScheduleTab } from './components/ScheduleTab';
import { TuitionTab } from './components/TuitionTab';
import { SupportTab } from './components/SupportTab';
import { SupabaseConsoleTab } from './components/SupabaseConsoleTab';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState('profile');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_STUDENT_PROFILE);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [tuition, setTuition] = useState<TuitionRecord[]>([]);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref lưu giữ thông tin user hiện tại nhằm tránh tái tạo hàm loadAllData gây vòng lặp vô hạn
  const userRef = useRef<User | null>(null);
  // Ref kiểm soát tiến trình fetch để tránh nhiều request chạy chồng chéo
  const isFetchingRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Hàm tải toàn bộ dữ liệu từ Supabase theo đúng tài khoản người dùng đang đăng nhập
  const loadAllData = useCallback(async (targetUser?: User | null) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    try {
      // 1. Xác định tài khoản hiện tại từ tham số hoặc ref ổn định
      const currentUser = targetUser !== undefined ? targetUser : userRef.current;

      // 2. Lấy hồ sơ của riêng tài khoản này
      const profileRes = await fetchStudentProfile(currentUser);
      const studentId = profileRes.data.ma_sinh_vien;

      // 3. Lấy các bảng liên kết theo mã sinh viên và user_id của tài khoản
      const [coursesRes, scheduleRes, tuitionRes] = await Promise.all([
        fetchCoursesAndGrades(studentId, currentUser),
        fetchSchedule(studentId, currentUser),
        fetchTuition(studentId, currentUser),
      ]);

      setProfile(profileRes.data);
      setCourses(coursesRes.data);
      setSchedule(scheduleRes.data);
      setTuition(tuitionRes.data);

      const isAnyLive =
        Boolean(currentUser) &&
        (profileRes.isFromSupabase ||
          coursesRes.isFromSupabase ||
          scheduleRes.isFromSupabase ||
          tuitionRes.isFromSupabase);
      setIsSupabaseLive(isAnyLive);
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu Supabase:', err);
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Khởi tạo một lần duy nhất khi ứng dụng tải
  useEffect(() => {
    let isMounted = true;

    // 1. Kiểm tra session ban đầu và nạp đúng hồ sơ của tài khoản đó
    getCurrentUser().then((currentUser) => {
      if (!isMounted) return;
      userRef.current = currentUser;
      setUser(currentUser);
      loadAllData(currentUser);
    });

    // 2. Lắng nghe trạng thái đăng nhập: supabase.auth.onAuthStateChange()
    const subscription = onAuthStateChange((event, session) => {
      if (!isMounted) return;
      const activeUser = session?.user ?? null;
      const prevUserId = userRef.current?.id;
      const nextUserId = activeUser?.id;

      if (event === 'SIGNED_IN' && prevUserId !== nextUserId) {
        userRef.current = activeUser;
        setUser(activeUser);
        showToast('Đã đăng nhập thành công vào Supabase Auth');
        loadAllData(activeUser);
      } else if (event === 'SIGNED_OUT') {
        userRef.current = null;
        setUser(null);
        showToast('Đã đăng xuất tài khoản');
        loadAllData(null);
      } else if (prevUserId !== nextUserId) {
        userRef.current = activeUser;
        setUser(activeUser);
        loadAllData(activeUser);
      }
    });

    // 3. Lắng nghe thay đổi Realtime từ Supabase (có debounce chống giật màn hình)
    let debounceTimer: any = null;
    const unsubscribeRealtime = subscribeToRealtimeChanges((tableName) => {
      if (!isMounted) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        showToast(`⚡ Nhận cập nhật Realtime từ bảng [${tableName}]`);
        loadAllData(userRef.current);
      }, 600);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      unsubscribeRealtime();
      clearTimeout(debounceTimer);
    };
  }, [loadAllData, showToast]);

  const handleSignOut = async () => {
    await signOut();
    userRef.current = null;
    setUser(null);
    loadAllData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        profile={profile}
        isSupabaseLive={isSupabaseLive}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onRefreshData={loadAllData}
        isRefreshing={isRefreshing}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-lg border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'profile' && (
          <ProfileTab
            profile={profile}
            isSupabaseLive={isSupabaseLive}
            user={user}
            onProfileUpdated={loadAllData}
            onOpenAuth={() => setAuthModalOpen(true)}
            onNavigateToWhatIf={() => setCurrentTab('what-if')}
          />
        )}

        {currentTab === 'courses' && (
          <CoursesGradesTab
            courses={courses}
            isSupabaseLive={isSupabaseLive}
            user={user}
            studentId={profile.ma_sinh_vien}
            onDataChanged={loadAllData}
            onOpenAuth={() => setAuthModalOpen(true)}
            onNavigateToWhatIf={() => setCurrentTab('what-if')}
          />
        )}

        {currentTab === 'what-if' && (
          <GpaWhatIfCalculatorTab
            courses={courses}
            profile={profile}
            isSupabaseLive={isSupabaseLive}
            user={user}
            studentId={profile.ma_sinh_vien}
            onDataChanged={loadAllData}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentTab === 'schedule' && (
          <ScheduleTab
            schedule={schedule}
            isSupabaseLive={isSupabaseLive}
            user={user}
            studentId={profile.ma_sinh_vien}
            onDataChanged={loadAllData}
          />
        )}

        {currentTab === 'tuition' && (
          <TuitionTab
            tuitionRecords={tuition}
            isSupabaseLive={isSupabaseLive}
            user={user}
            studentId={profile.ma_sinh_vien}
            onDataChanged={loadAllData}
          />
        )}

        {currentTab === 'support' && (
          <SupportTab
            profile={profile}
            user={user}
          />
        )}

        {currentTab === 'supabase' && (
          <SupabaseConsoleTab onDataRefreshed={loadAllData} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div>
            © 2025 - 2026 Viện Công Nghệ Thông Tin & Truyền Thông BICA 2025.
          </div>
          <div className="flex items-center space-x-3">
            <span>Hệ thống cơ sở dữ liệu sinh viên BICA 2025</span>
            <span>•</span>
            <button
              onClick={() => setCurrentTab('support')}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
            >
              Hỗ Trợ Sự Cố (Admin: Trần Duy Khánh)
            </button>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={loadAllData}
      />
    </div>
  );
}
