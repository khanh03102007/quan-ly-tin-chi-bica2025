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
  DEFAULT_STUDENT_PROFILE,
  getActiveTeacherSession,
  saveTeacherSession,
  clearTeacherSession,
  getEvaluatorSession,
  clearEvaluatorSession,
  fetchAllStudentsForTeacher,
  fetchStudentReminders,
  fetchAllMinhChungForAdmin,
  fetchMinhChungForStudent,
  getInitialRecoveryUrlState,
  computeAcademicMetricsFromCourses,
  syncStudentAcademicMetricsToProfile
} from './lib/supabase';
import type {
  StudentProfile,
  StudentCourse,
  ScheduleItem,
  TuitionRecord,
  TeacherAccount,
  MinhChungRenLuyen
} from './types';
import { Header } from './components/Header';
import { ProfileTab } from './components/ProfileTab';
import { CoursesGradesTab } from './components/CoursesGradesTab';
import { GpaWhatIfCalculatorTab } from './components/GpaWhatIfCalculatorTab';
import { ScheduleTab } from './components/ScheduleTab';
import { TuitionTab } from './components/TuitionTab';
import { SupportTab } from './components/SupportTab';
import { SupabaseConsoleTab } from './components/SupabaseConsoleTab';
import { TeacherPortalTab } from './components/TeacherPortalTab';
import { StudyPortalTab } from './components/StudyPortalTab';
import { AuthModal } from './components/AuthModal';
import { GatewayAuthScreen } from './components/GatewayAuthScreen';

const PORTAL_AUTH_KEY = 'bica_portal_gateway_session';

export interface PortalAuthSession {
  role: 'student' | 'teacher';
  studentId?: string;
  name: string;
  email: string;
  loginAt: string;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('profile');
  const [portalSession, setPortalSession] = useState<PortalAuthSession | null>(() => {
    if (typeof window === 'undefined') return null;
    if (getInitialRecoveryUrlState().isRecoveryRedirect) return null;
    try {
      const raw = localStorage.getItem(PORTAL_AUTH_KEY);
      if (!raw) return null;
      const parsed: PortalAuthSession = JSON.parse(raw);
      if (!parsed || !parsed.role || !parsed.email) return null;
      const loginTime = parsed.loginAt ? new Date(parsed.loginAt).getTime() : 0;
      const maxAgeMs = parsed.role === 'teacher' ? 12 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      if (loginTime && Date.now() - loginTime > maxAgeMs) {
        localStorage.removeItem(PORTAL_AUTH_KEY);
        return null;
      }
      if (parsed.role === 'teacher' && !getActiveTeacherSession()) {
        localStorage.removeItem(PORTAL_AUTH_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_STUDENT_PROFILE);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [tuition, setTuition] = useState<TuitionRecord[]>([]);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Teacher / Cố vấn học tập State
  const [activeTeacher, setActiveTeacher] = useState<TeacherAccount | null>(() => getActiveTeacherSession());
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  // Dark mode state (mặc định ưu tiên giao diện Dark Mode Cosmic Violet mới)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const stored = localStorage.getItem('bica_theme_mode_v2');
      if (stored === 'dark' || stored === 'light') return stored;
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('bica_theme_mode_v2', theme);
      localStorage.setItem('bica_theme_mode', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Minh chứng điểm rèn luyện State
  const [allEvidence, setAllEvidence] = useState<MinhChungRenLuyen[]>([]);

  // Ref lưu giữ thông tin user hiện tại và phiên đăng nhập cổng nhằm tránh tái tạo hàm loadAllData gây vòng lặp vô hạn
  const userRef = useRef<User | null>(null);
  const portalSessionRef = useRef<PortalAuthSession | null>(portalSession);
  useEffect(() => {
    portalSessionRef.current = portalSession;
  }, [portalSession]);
  // Ref kiểm soát tiến trình fetch và bộ giới hạn tần suất request (Request Throttler)
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimestampRef = useRef<number>(0);
  const lastFetchActorRef = useRef<string>('');
  const LOAD_ALL_DATA_THROTTLE_MS = 3000; // Giới hạn tối소 3 giây giữa các lần tải lại dữ liệu cho cùng 1 phiên

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Tải danh sách tất cả sinh viên cho giảng viên (Chỉ thực thi khi đã xác thực quyền Chủ nhiệm ngành / Giảng viên)
  const loadTeacherStudents = useCallback(async () => {
    const isTeacherAuthenticated = Boolean(
      getActiveTeacherSession() || portalSessionRef.current?.role === 'teacher'
    );
    if (!isTeacherAuthenticated) {
      setAllStudents([]);
      return;
    }
    const res = await fetchAllStudentsForTeacher(userRef.current);
    setAllStudents(res.students);
  }, []);

  // Tải danh sách minh chứng điểm rèn luyện (Phân lập bảo mật: Kiểm tra xác thực trước khi gọi Supabase)
  const loadEvidence = useCallback(async (targetStudentId?: string) => {
    const hasAdminOrEvaluatorAccess = Boolean(getActiveTeacherSession() || getEvaluatorSession());
    if (hasAdminOrEvaluatorAccess) {
      const res = await fetchAllMinhChungForAdmin(userRef.current);
      setAllEvidence(res.data);
      return;
    }
    const activePortal = portalSessionRef.current;
    const currentUser = userRef.current;
    if (!currentUser && !activePortal) {
      setAllEvidence([]);
      return;
    }
    const sid = targetStudentId || activePortal?.studentId || profile.ma_sinh_vien;
    if (sid && sid !== '---' && sid !== 'CHƯA_ĐĂNG_NHẬP') {
      const res = await fetchMinhChungForStudent(sid, currentUser);
      setAllEvidence(res.data);
    } else {
      setAllEvidence([]);
    }
  }, [profile.ma_sinh_vien]);

  // Tải lời nhắc/cảnh báo học vụ cho sinh viên hiện tại (Yêu cầu đã xác thực)
  const loadRemindersForStudent = useCallback(async (studentId: string) => {
    const currentUser = userRef.current;
    const activePortal = portalSessionRef.current;
    if ((!currentUser && !activePortal) || !studentId || studentId === '---' || studentId === 'CHƯA_ĐĂNG_NHẬP') {
      setReminders([]);
      return;
    }
    const res = await fetchStudentReminders(studentId, currentUser);
    setReminders(res.data);
  }, []);

  // Hàm tải toàn bộ dữ liệu từ Supabase theo đúng tài khoản người dùng đang đăng nhập
  const loadAllData = useCallback(async (targetUser?: User | null, options?: { force?: boolean }) => {
    if (isFetchingRef.current) return;

    // Tránh trường hợp sự kiện onClick truyền thẳng SyntheticEvent vào tham số đầu tiên
    const normalizedTargetUser =
      targetUser && typeof targetUser === 'object' && 'nativeEvent' in (targetUser as any)
        ? undefined
        : targetUser;

    // 1. Kiểm tra xác thực người dùng (Authenticated User Guard) TRƯỚC khi gọi tới Supabase
    const currentUser = normalizedTargetUser !== undefined ? normalizedTargetUser : userRef.current;
    const activePortal = portalSessionRef.current;
    const activeTeacherSession = getActiveTeacherSession();
    const isAuthenticated = Boolean(currentUser || activePortal || activeTeacherSession);

    if (!isAuthenticated) {
      lastFetchTimestampRef.current = 0;
      lastFetchActorRef.current = '';
      setProfile(DEFAULT_STUDENT_PROFILE);
      setCourses([]);
      setSchedule([]);
      setTuition([]);
      setReminders([]);
      setAllStudents([]);
      setAllEvidence([]);
      setIsSupabaseLive(false);
      return;
    }

    // 1b. Request Throttler: Ngăn chặn gửi quá nhiều request lên Supabase khi làm mới liên tục trên Dashboard
    const currentActorKey =
      currentUser?.id ||
      activePortal?.studentId ||
      activePortal?.email ||
      activeTeacherSession?.email ||
      'authenticated';
    const now = Date.now();
    const isSameActor = lastFetchActorRef.current === currentActorKey;

    if (!options?.force && isSameActor && now - lastFetchTimestampRef.current < LOAD_ALL_DATA_THROTTLE_MS) {
      return;
    }

    lastFetchTimestampRef.current = now;
    lastFetchActorRef.current = currentActorKey;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    try {
      const fallbackStudentId = activePortal?.role === 'student' ? activePortal.studentId : undefined;
      const fallbackEmail = activePortal?.role === 'student' ? activePortal.email : undefined;

      // 2. Lấy hồ sơ của riêng tài khoản đã xác thực này
      const profileRes = await fetchStudentProfile(currentUser, fallbackStudentId, fallbackEmail);

      // Nếu tài khoản sinh viên đang đăng nhập nhưng hồ sơ đã bị xóa khỏi Supabase
      if (activePortal?.role === 'student' && profileRes.isDeletedFromSupabase) {
        localStorage.removeItem(PORTAL_AUTH_KEY);
        portalSessionRef.current = null;
        setPortalSession(null);
        userRef.current = null;
        setUser(null);
        await signOut();
        showToast('Hồ sơ sinh viên này đã bị xóa khỏi Supabase. Đã đăng xuất phiên làm việc.');
        return;
      }

      const studentId = profileRes.data.ma_sinh_vien;
      const isTeacherPortal = Boolean(getActiveTeacherSession() || activePortal?.role === 'teacher');

      // 3. Lấy các bảng liên kết theo mã sinh viên và phân lập quyền truy cập dữ liệu lớp
      const [coursesRes, scheduleRes, tuitionRes] = await Promise.all([
        fetchCoursesAndGrades(studentId, currentUser),
        fetchSchedule(studentId, currentUser),
        fetchTuition(studentId, currentUser),
        loadRemindersForStudent(studentId),
        isTeacherPortal ? loadTeacherStudents() : Promise.resolve(),
        loadEvidence(studentId),
      ]);

      const computedMetrics = computeAcademicMetricsFromCourses(coursesRes.data);
      const syncedProfileData: StudentProfile = {
        ...profileRes.data,
        tong_tin_chi_tich_luy: computedMetrics.accumulatedCredits,
        diem_gpa: computedMetrics.latestSemesterGpa,
        diem_cpa: computedMetrics.cpa,
        xep_loai: computedMetrics.academicRank,
      };

      if (
        profileRes.data.tong_tin_chi_tich_luy !== computedMetrics.accumulatedCredits ||
        profileRes.data.diem_gpa !== computedMetrics.latestSemesterGpa ||
        profileRes.data.diem_cpa !== computedMetrics.cpa ||
        profileRes.data.xep_loai !== computedMetrics.academicRank
      ) {
        syncStudentAcademicMetricsToProfile(studentId, coursesRes.data, currentUser).catch(() => {});
      }

      setProfile(syncedProfileData);
      setCourses(coursesRes.data);
      setSchedule(scheduleRes.data);
      setTuition(tuitionRes.data);

      const isAnyLive =
        (Boolean(currentUser) || Boolean(fallbackStudentId)) &&
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
  }, [loadRemindersForStudent, loadTeacherStudents, loadEvidence, showToast]);

  const handleRefreshTeacherData = useCallback(async () => {
    await Promise.all([
      loadTeacherStudents(),
      loadEvidence(),
    ]);
  }, [loadTeacherStudents, loadEvidence]);

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

    // 3. Lắng nghe thay đổi Realtime từ Supabase (Chỉ kích hoạt làm mới khi người dùng đã xác thực)
    let debounceTimer: any = null;
    const unsubscribeRealtime = subscribeToRealtimeChanges((tableName) => {
      if (!isMounted) return;
      const hasActiveAuth = Boolean(
        userRef.current || portalSessionRef.current || getActiveTeacherSession()
      );
      if (!hasActiveAuth) return;
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
    clearTeacherSession();
    clearEvaluatorSession();
    userRef.current = null;
    setUser(null);
    setAllStudents([]);
    loadAllData(null);
  };

  const handleTeacherLogin = (teacher: TeacherAccount) => {
    setActiveTeacher(teacher);
    saveTeacherSession(teacher);
    showToast(`Chào mừng Thầy ${teacher.ho_va_ten} đã đăng nhập Cổng Chủ Nhiệm Ngành BICA`);
    loadTeacherStudents();
  };

  const handleTeacherLogout = () => {
    setActiveTeacher(null);
    clearTeacherSession();
    if (portalSession?.role === 'teacher') {
      localStorage.removeItem(PORTAL_AUTH_KEY);
      setPortalSession(null);
    }
    showToast('Đã đăng xuất tài khoản Chủ nhiệm ngành');
  };

  // Xử lý đăng nhập thành công Cổng Sinh Viên từ Gateway
  const handleStudentGatewayLogin = (prof: StudentProfile, authUser?: any) => {
    const sessionData: PortalAuthSession = {
      role: 'student',
      studentId: prof.ma_sinh_vien,
      name: prof.ho_va_ten,
      email: prof.email,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem(PORTAL_AUTH_KEY, JSON.stringify(sessionData));
    portalSessionRef.current = sessionData;
    setPortalSession(sessionData);
    setProfile(prof);
    if (authUser) {
      userRef.current = authUser;
      setUser(authUser);
    }
    setCurrentTab('profile');
    showToast(`Chào mừng sinh viên ${prof.ho_va_ten} (${prof.ma_sinh_vien}) đã đăng nhập`);
    loadAllData(authUser);
  };

  // Xử lý đăng nhập thành công Cổng Chủ Nhiệm Ngành từ Gateway (DẪN THẲNG ĐẾN CỔNG CỐ VẤN / KHOA)
  const handleTeacherGatewayLogin = (teacher: TeacherAccount) => {
    const sessionData: PortalAuthSession = {
      role: 'teacher',
      name: teacher.ho_va_ten,
      email: teacher.email,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem(PORTAL_AUTH_KEY, JSON.stringify(sessionData));
    setPortalSession(sessionData);
    setActiveTeacher(teacher);
    saveTeacherSession(teacher);
    // DẪN THẲNG ĐẾN CỔNG CỐ VẤN / KHOA THEO ĐÚNG YÊU CẦU:
    setCurrentTab('teacher');
    showToast(`Chào mừng Thầy ${teacher.ho_va_ten} — Đã kết nối Cổng Quản Trị Học Vụ & Cố Vấn BICA`);
    loadTeacherStudents();
    loadAllData();
  };

  // Đăng xuất toàn bộ phiên làm việc của Cổng
  const handleGatewayLogout = () => {
    localStorage.removeItem(PORTAL_AUTH_KEY);
    portalSessionRef.current = null;
    setPortalSession(null);
    setActiveTeacher(null);
    clearTeacherSession();
    clearEvaluatorSession();
    setAllStudents([]);
    setAllEvidence([]);
    userRef.current = null;
    setUser(null);
    signOut().catch(() => {});
    showToast('Đã đăng xuất và khóa cổng bảo mật. Vui lòng đăng nhập lại để tiếp tục.');
  };

  // =========================================================================
  // NẾU CHƯA ĐĂNG NHẬP: CHỈ HIỂN THỊ PHẦN GIAO DIỆN YÊU CẦU ĐĂNG NHẬP VỚI LOGO ĐỘNG
  // =========================================================================
  if (!portalSession) {
    return (
      <GatewayAuthScreen
        onStudentLoginSuccess={handleStudentGatewayLogin}
        onTeacherLoginSuccess={handleTeacherGatewayLogin}
        isDarkMode={theme === 'dark'}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="portal-main-view min-h-screen bg-slate-50 dark:bg-[#121316] text-slate-900 dark:text-[#e6e8ec] flex flex-col font-sans selection:bg-blue-500/25 dark:selection:bg-[#4b74ab]/35 selection:text-blue-950 dark:selection:text-[#f3f4f6] transition-colors duration-200 relative">
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
        unreadRemindersCount={reminders.filter(r => !r.da_doc).length}
        isTeacherActive={Boolean(activeTeacher)}
        portalSession={portalSession}
        onGatewayLogout={handleGatewayLogout}
        isDarkMode={theme === 'dark'}
        onToggleTheme={toggleTheme}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-[#23252c] text-[#eaecef] text-xs px-4 py-3 rounded-xl shadow-lg border border-slate-700 dark:border-[#363a47] animate-in fade-in slide-in-from-bottom-3 duration-200">
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
            courses={courses}
            onProfileUpdated={loadAllData}
            onOpenAuth={() => setAuthModalOpen(true)}
            onNavigateToWhatIf={() => setCurrentTab('what-if')}
            onNavigateToTeacher={() => setCurrentTab('teacher')}
            onNavigateToStudyPortal={() => setCurrentTab('study-portal')}
            onNavigateToCourses={() => setCurrentTab('courses')}
            reminders={reminders}
            onRefreshReminders={() => loadRemindersForStudent(profile.ma_sinh_vien)}
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

        {currentTab === 'study-portal' && (
          <StudyPortalTab
            profile={profile}
            user={user}
            activeTeacher={activeTeacher}
            allEvidence={allEvidence}
            onEvidenceChanged={loadEvidence}
            isSupabaseLive={isSupabaseLive}
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

        {currentTab === 'teacher' && (
          <TeacherPortalTab
            activeTeacher={activeTeacher}
            onTeacherLogin={handleTeacherLogin}
            onTeacherLogout={handleTeacherLogout}
            allStudents={allStudents}
            onRefreshData={handleRefreshTeacherData}
            isRefreshing={isRefreshing}
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
      <footer className="bg-white dark:bg-[#18191e] border-t border-slate-200 dark:border-[#282b34] mt-auto py-6 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-[#828896] gap-3">
          <div>
            © 2025-2026 Khoa Công Nghệ & Kĩ Thuật Tiên Tiến.
          </div>
          <div className="flex items-center space-x-3">
            <span>Hệ thống cơ sở dữ liệu sinh viên BICA 2025</span>
            <span>•</span>
            <button
              onClick={() => setCurrentTab('support')}
              className="text-blue-600 dark:text-[#88aedb] hover:text-blue-800 dark:hover:text-[#a3c2e8] font-semibold hover:underline cursor-pointer"
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
