'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ActionName, ModuleName, ScopeMode } from '@/lib/auth/rbac-constants';

export interface UserInfo {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  isSystemRole: boolean;
  teacherId: number | null;
  scopeMode: ScopeMode;
  hasFullScope: boolean;
  permissions: string[];
  assignedClassIds: number[];
  assignedSubjectIds: number[];
  homeroomClassIds: number[];
}

export interface SchoolInfo {
  id: number;
  name: string;
  npsn: string;
  jenjang: string;
  naungan: string;
  status: string;
  accreditation: string;
  address: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  principalName: string;
  principalNip: string;
  logoUrl: string;
  principalSignaturePath?: string | null;
  schoolStampPath?: string | null;
  showPrincipalSignature?: boolean;
  showSchoolStamp?: boolean;
  showLetterhead?: boolean;
  enableKeasramaan: boolean;
  enableAi: boolean;
}

export interface ClassOption {
  id: number;
  name: string;
  gradeLevel: number;
  fase: string;
  semesterId: number;
  homeroomTeacherId: number | null;
  homeroomTeacherName: string | null;
  capacity: number;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  user: UserInfo | null;
  school: SchoolInfo | null;
  activeYear: { id: number; name: string } | null;
  activeSemester: { id: number; name: string; startDate: string; reportDate: string } | null;
  classes: ClassOption[];
  selectedClassId: number;
  setSelectedClassId: (id: number) => void;
  selectedClass: ClassOption | null;
  unreadCount: number;
  loadingContext: boolean;
  refreshContext: () => Promise<void>;
  logout: () => Promise<void>;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
  can: (module: ModuleName, action?: ActionName) => boolean;
  canAny: (modules: ModuleName[], action?: ActionName) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [activeYear, setActiveYear] = useState<{ id: number; name: string } | null>(null);
  const [activeSemester, setActiveSemester] = useState<{
    id: number;
    name: string;
    startDate: string;
    reportDate: string;
  } | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassIdState] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingContext, setLoadingContext] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDark, setIsDark] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast]
  );

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
      }
      return next;
    });
  }, []);

  const setSelectedClassId = useCallback((id: number) => {
    setSelectedClassIdState(id);
  }, []);

  const refreshContext = useCallback(async () => {
    try {
      const res = await fetch('/api/context', { cache: 'no-store' });
      if (res.status === 401) {
        setUser(null);
        setLoadingContext(false);
        if (pathname !== '/login') {
          router.replace('/login');
        }
        return;
      }
      if (!res.ok) {
        setLoadingContext(false);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setSchool(data.school);
      setActiveYear(data.activeYear);
      setActiveSemester(data.activeSemester);
      setClasses(data.classes || []);
      setUnreadCount(data.unreadNotificationCount || 0);

      setSelectedClassIdState((prev) => {
        if (prev && (data.classes || []).some((c: ClassOption) => c.id === prev)) {
          return prev;
        }
        const preferred =
          (data.classes || []).find((c: ClassOption) => c.name === '4 A') ||
          (data.classes || [])[0];
        return preferred?.id || 0;
      });
    } catch {
      // Offline/network guard
    } finally {
      setLoadingContext(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (pathname === '/login') {
        setLoadingContext(false);
        return;
      }
      void refreshContext();
    });
  }, [pathname, refreshContext]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    setUser(null);
    router.replace('/login');
  }, [router]);

  const permissions = user?.permissions;
  const can = useCallback(
    (module: ModuleName, action: ActionName = 'read') => {
      if (!permissions) return false;
      return permissions.includes(`${module}:${action}`);
    },
    [permissions]
  );

  const canAny = useCallback(
    (modules: ModuleName[], action: ActionName = 'read') => {
      if (!permissions) return false;
      return modules.some((m) => permissions.includes(`${m}:${action}`));
    },
    [permissions]
  );

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0] || null;

  return (
    <AppContext.Provider
      value={{
        user,
        school,
        activeYear,
        activeSemester,
        classes,
        selectedClassId,
        setSelectedClassId,
        selectedClass,
        unreadCount,
        loadingContext,
        refreshContext,
        logout,
        notify,
        toasts,
        dismissToast,
        isDark,
        toggleTheme,
        can,
        canAny,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus digunakan di dalam AppProvider');
  return ctx;
}
