'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Award,
  BarChart2,
  Bell,
  BookOpen,
  BookUser,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  RefreshCw,
  School,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '@/components/providers/AppContext';
import { AccessDeniedCard, TableSkeleton } from '@/components/ui/Primitives';
import type { ModuleName } from '@/lib/auth/rbac-constants';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredModules?: ModuleName[];
  requireKeasramaanEnabled?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const DEFAULT_TAB_BY_PATH: Record<string, string> = {
  '/sekolah': 'profil',
  '/kurikulum': 'mapel',
  '/penilaian': 'sumatif',
  '/absensi': 'murid',
  '/administrasi': 'tamu',
  '/laporan': 'nilai',
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Utama',
    icon: Home,
    items: [
      { href: '/dashboard', label: 'Beranda', icon: Home, requiredModules: ['dashboard'] },
    ],
  },
  {
    label: 'Informasi Umum',
    icon: BarChart2,
    items: [
      { href: '/sekolah?tab=profil', label: 'Sekolah', icon: School, requiredModules: ['sekolah'] },
      {
        href: '/sekolah?tab=akademik',
        label: 'Akademik',
        icon: CalendarDays,
        requiredModules: ['sekolah'],
      },
      { href: '/kelas', label: 'Kelas', icon: Building2, requiredModules: ['kelas'] },
      {
        href: '/siswa',
        label: 'Murid',
        icon: Users,
        requiredModules: ['siswa', 'kesiswaan'],
      },
      { href: '/guru', label: 'Guru & Tendik', icon: GraduationCap, requiredModules: ['guru'] },
    ],
  },
  {
    label: 'Mata Pelajaran',
    icon: BookOpen,
    items: [
      {
        href: '/kurikulum?tab=mapel',
        label: 'Intrakurikuler',
        icon: BookOpen,
        requiredModules: ['kurikulum'],
      },
      {
        href: '/penilaian?tab=kokurikuler',
        label: 'Kokurikuler',
        icon: Layers,
        requiredModules: ['penilaian'],
      },
      {
        href: '/penilaian?tab=ekstra',
        label: 'Ekstrakurikuler',
        icon: Award,
        requiredModules: ['penilaian'],
      },
      {
        href: '/penilaian?tab=keasramaan',
        label: 'Keasramaan',
        icon: Sparkles,
        requiredModules: ['keasramaan'],
        requireKeasramaanEnabled: true,
      },
    ],
  },
  {
    label: 'Input Nilai',
    icon: ClipboardCheck,
    items: [
      {
        href: '/penilaian?tab=sumatif',
        label: 'Intrakurikuler',
        icon: ClipboardCheck,
        requiredModules: ['penilaian'],
      },
      {
        href: '/penilaian?tab=kokurikuler',
        label: 'Kokurikuler',
        icon: Layers,
        requiredModules: ['penilaian'],
      },
      {
        href: '/penilaian?tab=ekstra',
        label: 'Ekstrakurikuler',
        icon: Award,
        requiredModules: ['penilaian'],
      },
      {
        href: '/penilaian?tab=keasramaan',
        label: 'Keasramaan',
        icon: Sparkles,
        requiredModules: ['keasramaan'],
        requireKeasramaanEnabled: true,
      },
    ],
  },
  {
    label: 'Administrasi',
    icon: Briefcase,
    items: [
      {
        href: '/absensi?tab=murid',
        label: 'Presensi Murid',
        icon: UserCheck,
        requiredModules: ['absensi'],
      },
      {
        href: '/kurikulum?tab=rpm',
        label: 'RPM',
        icon: FileText,
        requiredModules: ['kurikulum'],
      },
      {
        href: '/jurnal',
        label: 'Jurnal Mengajar',
        icon: NotebookPen,
        requiredModules: ['kurikulum'],
      },
      {
        href: '/penilaian?tab=catatan',
        label: 'Catatan Wali Kelas',
        icon: MessageSquareText,
        requiredModules: ['penilaian', 'rapor'],
      },
      {
        href: '/laporan?tab=nilai',
        label: 'Rekap Nilai',
        icon: FileSpreadsheet,
        requiredModules: ['penilaian', 'rapor'],
      },
      {
        href: '/laporan?tab=keasramaan',
        label: 'Rekap Keasramaan',
        icon: FileSpreadsheet,
        requiredModules: ['keasramaan'],
        requireKeasramaanEnabled: true,
      },
      {
        href: '/administrasi?tab=tamu',
        label: 'Buku Tamu',
        icon: BookUser,
        requiredModules: ['administrasi'],
      },
      {
        href: '/absensi?tab=guru',
        label: 'Presensi Guru',
        icon: UserCheck,
        requiredModules: ['absensi', 'guru'],
      },
      {
        href: '/administrasi?tab=dinas',
        label: 'Dinas Luar',
        icon: Briefcase,
        requiredModules: ['administrasi'],
      },
      {
        href: '/jadwal',
        label: 'Jadwal & Bel',
        icon: CalendarClock,
        requiredModules: ['jadwal'],
      },
    ],
  },
  {
    label: 'Integrasi & Sistem',
    icon: Settings,
    items: [
      {
        href: '/cetak',
        label: 'Pusat Cetak',
        icon: Printer,
        requiredModules: ['rapor', 'keasramaan', 'kurikulum', 'administrasi', 'absensi', 'guru'],
      },
      { href: '/rapor', label: 'Cetak Rapor A4', icon: FileCheck2, requiredModules: ['rapor'] },
      {
        href: '/integrasi',
        label: 'Dapodik & E-Rapor',
        icon: RefreshCw,
        requiredModules: ['dapodik', 'erapor'],
      },
      { href: '/pengaturan', label: 'Pengaturan & Backup', icon: Settings },
    ],
  },
];

const MOBILE_BOTTOM_TABS: NavItem[] = [
  { href: '/dashboard', label: 'Beranda', icon: Home, requiredModules: ['dashboard'] },
  { href: '/siswa', label: 'Murid', icon: Users, requiredModules: ['siswa', 'kesiswaan'] },
  {
    href: '/penilaian',
    label: 'Akademik',
    icon: ClipboardCheck,
    requiredModules: ['penilaian', 'keasramaan'],
  },
  {
    href: '/cetak',
    label: 'Cetak',
    icon: Printer,
    requiredModules: ['rapor', 'keasramaan', 'kurikulum', 'administrasi', 'absensi', 'guru'],
  },
];

function SearchParamTabObserver({ onChange }: { onChange: (tab: string) => void }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || '';
  useEffect(() => {
    onChange(tab);
  }, [tab, onChange]);
  return null;
}

export function AppShell({
  title,
  requiredModule,
  children,
}: {
  title: string;
  requiredModule?: ModuleName | ModuleName[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    user,
    school,
    activeYear,
    activeSemester,
    classes,
    selectedClassId,
    setSelectedClassId,
    unreadCount,
    loadingContext,
    refreshContext,
    logout,
    toasts,
    dismissToast,
    isDark,
    toggleTheme,
    canAny,
  } = useApp();

  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [menuSearch, setMenuSearch] = useState('');
  const [activeTabParam, setActiveTabParam] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<
    Array<{
      id: number;
      title: string;
      message: string;
      category: string;
      isRead: boolean;
      linkHref: string;
      createdAt: string;
    }>
  >([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    });
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const canViewItem = useCallback(
    (item: NavItem) => {
      if (item.requireKeasramaanEnabled && !school?.enableKeasramaan) {
        return false;
      }
      if (!item.requiredModules || item.requiredModules.length === 0) return true;
      if (!user) return false;
      if (item.href === '/penilaian' && !canAny(['penilaian'], 'read')) {
        return Boolean(school?.enableKeasramaan && canAny(['keasramaan'], 'read'));
      }
      return canAny(item.requiredModules, 'read');
    },
    [school?.enableKeasramaan, user, canAny]
  );

  const isNavItemActive = (href: string) => {
    const [itemPath, itemQuery] = href.split('?');
    if (itemQuery) {
      const targetTab = new URLSearchParams(itemQuery).get('tab');
      if (pathname !== itemPath) return false;
      const effectiveTab = activeTabParam || DEFAULT_TAB_BY_PATH[itemPath] || '';
      return effectiveTab === targetTab;
    }
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  };

  const normalizedSearch = menuSearch.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      const permittedItems = group.items.filter(canViewItem);
      const matchedItems = normalizedSearch
        ? permittedItems.filter(
            (item) =>
              item.label.toLowerCase().includes(normalizedSearch) ||
              group.label.toLowerCase().includes(normalizedSearch)
          )
        : permittedItems;
      return {
        ...group,
        items: matchedItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [normalizedSearch, canViewItem]);

  const visibleFlatItems = visibleGroups.flatMap((g) =>
    g.items.map((item) => ({ ...item, groupLabel: g.label }))
  );
  const visibleBottomTabs = MOBILE_BOTTOM_TABS.filter(canViewItem);

  const requiredModulesArr = requiredModule
    ? Array.isArray(requiredModule)
      ? requiredModule
      : [requiredModule]
    : null;
  const hasRouteAccess =
    !requiredModulesArr || !user || canAny(requiredModulesArr, 'read');

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const loadNotifications = async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      setNotifItems(data.notifications || []);
    }
  };

  const handleToggleNotif = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) loadNotifications();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ markAll: true }),
    });
    await loadNotifications();
    await refreshContext();
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B1320] text-slate-900 dark:text-slate-100">
      <Suspense fallback={null}>
        <SearchParamTabObserver onChange={setActiveTabParam} />
      </Suspense>

      {/* Desktop Fixed Collapsible Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 bg-[#0F2942] text-slate-100 border-r border-[#1E3A5F] transition-all duration-150 no-print sticky top-0 h-screen',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-white/10">
          <Link
            href={visibleFlatItems[0]?.href || '/pengaturan'}
            className="flex items-center gap-2.5 min-w-0"
          >
            <img
              src={school?.logoUrl || '/images/school-crest.jpg'}
              alt="Logo Sekolah"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded object-cover bg-white shrink-0"
            />
            {!collapsed && (
              <span className="font-[family-name:var(--font-display)] font-bold tracking-tight text-sm text-white truncate">
                SEKOLAHKITA
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 cursor-pointer shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-2.5">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupCollapsed = !normalizedSearch && Boolean(collapsedGroups[group.label]);
            return (
              <div key={group.label}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <GroupIcon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{group.label}</span>
                    </span>
                    {isGroupCollapsed ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    )}
                  </button>
                )}

                {(!isGroupCollapsed || collapsed) && (
                  <ul
                    className={cn(
                      'space-y-0.5 mt-1',
                      !collapsed && 'ml-3 pl-2.5 border-l border-white/15'
                    )}
                  >
                    {group.items.map((item) => {
                      const active = isNavItemActive(item.href);
                      const Icon = item.icon;
                      return (
                        <li key={`${group.label}-${item.href}-${item.label}`}>
                          <Link
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                              'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                              active
                                ? 'bg-white text-[#0F2942] font-semibold'
                                : 'text-slate-200 hover:bg-white/10 hover:text-white'
                            )}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {visibleGroups.length === 0 && !collapsed && (
            <p className="px-2.5 py-4 text-xs text-slate-400 text-center">
              Menu tidak ditemukan.
            </p>
          )}
        </nav>

        {!collapsed && (
          <div className="px-3 py-2 border-t border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Cari menu"
                aria-label="Cari menu"
                className="w-full h-8 pl-8 pr-2.5 rounded-md bg-white/10 border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/25"
              />
            </div>
          </div>
        )}

        <div className="p-3 border-t border-white/10 text-xs text-slate-300">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-white">
                  {user?.fullName || 'Memuat...'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.roleName || 'Pengguna'}
              </p>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-2.5 rounded bg-white/10 hover:bg-white/15 text-xs text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              title="Keluar"
              className="w-full flex items-center justify-center p-2 rounded hover:bg-white/10 text-white cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Top Bar (Desktop 56px / Mobile 52px) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-14 bg-white dark:bg-[#111C2E] border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={school?.logoUrl || '/images/school-crest.jpg'}
              alt="Logo"
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded object-cover lg:hidden shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="hidden sm:inline truncate max-w-[180px]">
                  {school?.name || 'SEKOLAHKITA'}
                </span>
                <span className="hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                  {title}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Offline/Online indicator */}
            <div
              title={isOnline ? 'Mode Luring-Utama (Koneksi Jaringan Aktif)' : 'Mode Luring (Offline)'}
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-2"
            >
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="whitespace-nowrap">{isOnline ? 'Lokal Aktif' : 'Offline'}</span>
            </div>

            {/* Active Term Text */}
            {activeYear && activeSemester && (
              <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                TA {activeYear.name} · {activeSemester.name}
              </span>
            )}

            {/* Global Active Rombel Selector */}
            {classes.length > 0 && (
              <select
                aria-label="Pilih Rombel Aktif"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
                className="h-9 px-2.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 cursor-pointer"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Theme Switch */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Ganti tema tampilan"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleNotif}
                aria-label="Pusat Notifikasi"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#1D4ED8] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Pusat Notifikasi
                    </span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-xs text-[#1D4ED8] hover:underline cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Tandai dibaca
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifItems.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">Belum ada notifikasi.</p>
                    ) : (
                      notifItems.map((n) => (
                        <Link
                          key={n.id}
                          href={n.linkHref || '/dashboard'}
                          onClick={() => setNotifOpen(false)}
                          className={cn(
                            'block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                            !n.isRead && 'bg-blue-50/40 dark:bg-blue-950/20'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {n.title}
                            </span>
                            <span className="text-[11px] text-slate-400">{n.category}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {loadingContext && !user ? (
            <TableSkeleton rows={6} />
          ) : !hasRouteAccess ? (
            <AccessDeniedCard moduleLabel={title} roleName={user?.roleName} />
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Navigasi Utama Mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white dark:bg-[#111C2E] border-t border-slate-200 dark:border-slate-800 flex items-center justify-around no-print"
      >
        {visibleBottomTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                active
                  ? 'text-[#0F2942] dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile Full Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 flex flex-col justify-end no-print">
          <div className="bg-[#0F2942] text-slate-100 rounded-t-2xl max-h-[88vh] flex flex-col border-t border-[#1E3A5F]">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Dashboard</p>
                <p className="text-xs text-slate-300">
                  {user?.fullName} · {user?.roleName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {visibleGroups.map((group) => {
                const GroupIcon = group.icon;
                const isGroupCollapsed =
                  !normalizedSearch && Boolean(collapsedGroups[group.label]);
                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-xs font-semibold text-slate-200 hover:bg-white/5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <GroupIcon className="w-4 h-4 text-slate-400" />
                        <span>{group.label}</span>
                      </span>
                      {isGroupCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {!isGroupCollapsed && (
                      <ul className="mt-1 ml-3 pl-3 border-l border-white/15 space-y-1">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const active = isNavItemActive(item.href);
                          return (
                            <li key={`mobile-${group.label}-${item.href}-${item.label}`}>
                              <Link
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  'min-h-[40px] flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                                  active
                                    ? 'bg-white text-[#0F2942] font-semibold'
                                    : 'text-slate-200 hover:bg-white/10'
                                )}
                              >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}

              {visibleGroups.length === 0 && (
                <p className="py-6 text-xs text-slate-400 text-center">
                  Menu tidak ditemukan untuk kata kunci tersebut.
                </p>
              )}
            </div>

            <div className="p-3 border-t border-white/10 space-y-2.5 bg-[#0B1F33]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Cari menu"
                  aria-label="Cari menu mobile"
                  className="w-full h-10 pl-9 pr-3 rounded-md bg-white/10 border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-md bg-red-500/20 text-red-200 border border-red-400/30 text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Keluar dari Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-20 lg:bottom-5 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-md border shadow-md text-xs font-medium',
              t.type === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-900',
              t.type === 'error' && 'bg-red-50 border-red-200 text-red-900',
              t.type === 'info' && 'bg-white border-slate-200 text-slate-800'
            )}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
