'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Copy,
  DatabaseBackup,
  Download,
  Edit3,
  FileSignature,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  AlertBox,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  TabBar,
  TableSkeleton,
  ToggleSwitch,
} from '@/components/ui/Primitives';
import {
  ACTION_LABELS,
  ALL_ACTIONS,
  ALL_MODULES,
  LOCKED_SUPER_ADMIN_PERMISSIONS,
  MODULE_METADATA,
  SCOPE_MODE_LABELS,
  type ActionName,
  type ModuleName,
  type ScopeMode,
} from '@/lib/auth/rbac-constants';
import { formatIndoDateTime } from '@/lib/utils';

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  teacherId: number | null;
  scopeMode: ScopeMode;
  classIds: number[];
  subjectIds: number[];
  isActive: boolean;
  lastLoginAt: string | null;
}

interface RoleDetailRow {
  id: number;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
}

interface ClassOption {
  id: number;
  name: string;
  gradeLevel: number;
  fase: string;
}

interface SubjectOption {
  id: number;
  code: string;
  name: string;
  gradeLevel: number;
}

interface AuditLogRow {
  id: number;
  actorName: string;
  action: string;
  details: string;
  createdAt: string;
}

interface BackupRow {
  id: number;
  fileName: string;
  sizeBytes: number;
  checksum: string;
  notes: string;
  createdAt: string;
}

type SettingsTab = 'akun' | 'dokumen' | 'pengguna' | 'peran' | 'backup';

export default function PengaturanPage() {
  const { user, school, classes: contextClasses, can, notify, refreshContext } = useApp();
  const [tab, setTab] = useState<SettingsTab>('akun');
  const [loading, setLoading] = useState(false);

  const canReadSchool = can('sekolah', 'read');
  const canUpdateSchool = can('sekolah', 'update');
  const canReadUsers = can('pengguna', 'read');
  const canCreateUsers = can('pengguna', 'create');
  const canUpdateUsers = can('pengguna', 'update');
  const canDeleteUsers = can('pengguna', 'delete');
  const canReadBackup = can('backup', 'read');
  const canCreateBackup = can('backup', 'create');
  const canExportBackup = can('backup', 'export');
  const canApproveBackup = can('backup', 'approve');

  // Signature & Stamp state
  const sigInputRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const [assetBusy, setAssetBusy] = useState<'signature' | 'stamp' | 'toggle' | null>(null);
  const [assetVersion, setAssetVersion] = useState<number>(() => Date.now());

  // Password Change
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  // Users & Scoping
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleDetailRow[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: number; fullName: string }>>([]);
  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  const [createUserModal, setCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    roleId: '',
    teacherId: '',
    scopeMode: 'ASSIGNED' as ScopeMode,
    classIds: [] as number[],
    subjectIds: [] as number[],
  });

  const [editUserTarget, setEditUserTarget] = useState<UserRow | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    roleId: '',
    teacherId: '',
    scopeMode: 'ASSIGNED' as ScopeMode,
    classIds: [] as number[],
    subjectIds: [] as number[],
  });

  const [resetUserTarget, setResetUserTarget] = useState<UserRow | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserRow | null>(null);

  // Roles & Matrix
  const [selectedRoleId, setSelectedRoleId] = useState<number>(0);
  const selectedRoleIdRef = useRef<number>(0);
  const [draftRoleName, setDraftRoleName] = useState('');
  const [draftRoleDesc, setDraftRoleDesc] = useState('');
  const [draftPermissions, setDraftPermissions] = useState<Set<string>>(new Set());
  const [savingMatrix, setSavingMatrix] = useState(false);

  const [createRoleModal, setCreateRoleModal] = useState(false);
  const [createRoleForm, setCreateRoleForm] = useState({
    code: '',
    name: '',
    description: '',
    cloneFromRoleId: '',
  });
  const [resetRoleDefaultTarget, setResetRoleDefaultTarget] = useState<RoleDetailRow | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleDetailRow | null>(null);

  // Backups
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [backupNotes, setBackupNotes] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  // Sync initial tab from ?tab= query param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'dokumen' || t === 'pengguna' || t === 'peran' || t === 'backup' || t === 'akun') {
      Promise.resolve().then(() => setTab(t));
    }
  }, []);

  // Ensure active tab stays valid when switching roles or losing permissions
  const activeTab: SettingsTab = useMemo(() => {
    if (tab === 'dokumen' && !canReadSchool && !canUpdateSchool) return 'akun';
    if ((tab === 'pengguna' || tab === 'peran') && !canReadUsers) return 'akun';
    if (tab === 'backup' && !canReadBackup) return 'akun';
    return tab;
  }, [tab, canReadSchool, canUpdateSchool, canReadUsers, canReadBackup]);

  const applyRoleDraft = useCallback((role: RoleDetailRow | null | undefined) => {
    if (!role) return;
    setDraftRoleName(role.name);
    setDraftRoleDesc(role.description);
    setDraftPermissions(new Set(role.permissionKeys));
  }, []);

  const selectRoleAndSync = useCallback(
    (role: RoleDetailRow | null | undefined) => {
      if (!role) return;
      selectedRoleIdRef.current = role.id;
      setSelectedRoleId(role.id);
      applyRoleDraft(role);
    },
    [applyRoleDraft]
  );

  const loadUsersAndRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/roles', { cache: 'no-store' }),
      ]);
      if (usersRes.ok) {
        const json = await usersRes.json();
        setUsers(json.users || []);
        setTeachers(json.teachers || []);
        setAllClasses(json.classes || []);
        setAllSubjects(json.subjects || []);
        setAuditLogs(json.auditLogs || []);
      }
      if (rolesRes.ok) {
        const rJson = await rolesRes.json();
        const roleList: RoleDetailRow[] = rJson.roles || [];
        setRoles(roleList);
        const currentId = selectedRoleIdRef.current;
        const matched = currentId ? roleList.find((r) => r.id === currentId) : undefined;
        const nextSelected = matched || roleList[0];
        if (nextSelected) {
          selectRoleAndSync(nextSelected);
        }
        setCreateUserForm((prev) => {
          if (prev.roleId && roleList.some((r) => String(r.id) === prev.roleId)) return prev;
          const defaultGuru = roleList.find((r) => r.code === 'WALI_KELAS') || roleList[0];
          return { ...prev, roleId: defaultGuru ? String(defaultGuru.id) : '' };
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectRoleAndSync]);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setBackups(json.backups || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (activeTab === 'pengguna' || activeTab === 'peran') {
        void loadUsersAndRoles();
      } else if (activeTab === 'backup') {
        void loadBackups();
      }
    });
  }, [activeTab, loadUsersAndRoles, loadBackups]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0] || null,
    [roles, selectedRoleId]
  );

  const isMatrixDirty = useMemo(() => {
    if (!selectedRole) return false;
    if (draftRoleName.trim() !== selectedRole.name || draftRoleDesc.trim() !== selectedRole.description) {
      return true;
    }
    if (draftPermissions.size !== selectedRole.permissionKeys.length) return true;
    for (const k of selectedRole.permissionKeys) {
      if (!draftPermissions.has(k)) return true;
    }
    return false;
  }, [selectedRole, draftRoleName, draftRoleDesc, draftPermissions]);

  const isRoleEditLocked =
    !canUpdateUsers ||
    (selectedRole?.code === 'SUPER_ADMIN' && user?.roleCode !== 'SUPER_ADMIN');

  const classMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of allClasses) map.set(c.id, c.name);
    for (const c of contextClasses) map.set(c.id, c.name);
    return map;
  }, [allClasses, contextClasses]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      notify('error', 'Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal memperbarui kata sandi.');
      return;
    }
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    notify('success', json.message || 'Kata sandi berhasil diperbarui.');
  };

  // --- User Management Handlers ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        username: createUserForm.username,
        fullName: createUserForm.fullName,
        email: createUserForm.email,
        password: createUserForm.password,
        roleId: Number(createUserForm.roleId),
        teacherId: createUserForm.teacherId ? Number(createUserForm.teacherId) : null,
        scopeMode: createUserForm.scopeMode,
        classIds: createUserForm.scopeMode === 'CUSTOM' ? createUserForm.classIds : [],
        subjectIds: createUserForm.scopeMode === 'CUSTOM' ? createUserForm.subjectIds : [],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal membuat akun pengguna.');
      return;
    }
    setCreateUserModal(false);
    setCreateUserForm({
      username: '',
      fullName: '',
      email: '',
      password: '',
      roleId: createUserForm.roleId,
      teacherId: '',
      scopeMode: 'ASSIGNED',
      classIds: [],
      subjectIds: [],
    });
    notify('success', 'Akun pengguna baru berhasil ditambahkan.');
    await loadUsersAndRoles();
  };

  const openEditUserModal = (u: UserRow) => {
    setEditUserTarget(u);
    setEditUserForm({
      fullName: u.fullName,
      email: u.email,
      roleId: String(u.roleId),
      teacherId: u.teacherId ? String(u.teacherId) : '',
      scopeMode: u.scopeMode || 'ASSIGNED',
      classIds: u.classIds || [],
      subjectIds: u.subjectIds || [],
    });
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserTarget) return;
    const isSelf = editUserTarget.id === user?.id;
    const payload: Record<string, unknown> = {
      id: editUserTarget.id,
      fullName: editUserForm.fullName,
      email: editUserForm.email,
      teacherId: editUserForm.teacherId ? Number(editUserForm.teacherId) : null,
      scopeMode: editUserForm.scopeMode,
      classIds: editUserForm.scopeMode === 'CUSTOM' ? editUserForm.classIds : [],
      subjectIds: editUserForm.scopeMode === 'CUSTOM' ? editUserForm.subjectIds : [],
    };
    if (!isSelf && Number(editUserForm.roleId) !== editUserTarget.roleId) {
      payload.roleId = Number(editUserForm.roleId);
    }

    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal memperbarui akun pengguna.');
      return;
    }
    setEditUserTarget(null);
    notify('success', `Peran & cakupan akun @${editUserTarget.username} berhasil disimpan.`);
    await loadUsersAndRoles();
    if (isSelf) {
      await refreshContext();
    }
  };

  const handleToggleUserActive = async (u: UserRow) => {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      notify('success', `Status akun @${u.username} diubah.`);
      await loadUsersAndRoles();
    } else {
      notify('error', json.error || 'Gagal mengubah status akun.');
    }
  };

  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserTarget) return;
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: resetUserTarget.id, resetPassword: resetPwdValue }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal mereset kata sandi.');
      return;
    }
    setResetUserTarget(null);
    setResetPwdValue('');
    notify('success', `Kata sandi @${resetUserTarget.username} berhasil direset.`);
    await loadUsersAndRoles();
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const res = await fetch(`/api/users?id=${deleteUserTarget.id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    const json = await res.json().catch(() => ({}));
    setDeleteUserTarget(null);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menghapus akun pengguna.');
      return;
    }
    notify('success', `Akun @${deleteUserTarget.username} berhasil dihapus.`);
    await loadUsersAndRoles();
  };

  // --- Role & Matrix Handlers ---
  const togglePermission = (mod: ModuleName, action: ActionName) => {
    if (isRoleEditLocked) return;
    const key = `${mod}:${action}`;
    if (selectedRole?.code === 'SUPER_ADMIN' && LOCKED_SUPER_ADMIN_PERMISSIONS.includes(key)) {
      return;
    }
    setDraftPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRowPermissions = (mod: ModuleName) => {
    if (isRoleEditLocked) return;
    const rowKeys = ALL_ACTIONS.map((a) => `${mod}:${a}`);
    const unlockedRowKeys =
      selectedRole?.code === 'SUPER_ADMIN'
        ? rowKeys.filter((k) => !LOCKED_SUPER_ADMIN_PERMISSIONS.includes(k))
        : rowKeys;
    const allChecked = unlockedRowKeys.every((k) => draftPermissions.has(k));

    setDraftPermissions((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const k of unlockedRowKeys) next.delete(k);
      } else {
        for (const k of rowKeys) next.add(k);
      }
      return next;
    });
  };

  const toggleColumnPermissions = (action: ActionName) => {
    if (isRoleEditLocked) return;
    const colKeys = ALL_MODULES.map((m) => `${m}:${action}`);
    const unlockedColKeys =
      selectedRole?.code === 'SUPER_ADMIN'
        ? colKeys.filter((k) => !LOCKED_SUPER_ADMIN_PERMISSIONS.includes(k))
        : colKeys;
    const allChecked = unlockedColKeys.every((k) => draftPermissions.has(k));

    setDraftPermissions((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const k of unlockedColKeys) next.delete(k);
      } else {
        for (const k of colKeys) next.add(k);
      }
      return next;
    });
  };

  const handleSaveMatrix = async () => {
    if (!selectedRole) return;
    setSavingMatrix(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          id: selectedRole.id,
          name: draftRoleName.trim(),
          description: draftRoleDesc.trim(),
          permissionKeys: Array.from(draftPermissions),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify('error', json.error || 'Gagal menyimpan matriks izin peran.');
        return;
      }
      notify('success', `Matriks izin peran "${draftRoleName.trim()}" berhasil disimpan.`);
      await loadUsersAndRoles();
      await refreshContext();
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleResetRoleToDefault = async () => {
    if (!resetRoleDefaultTarget) return;
    const res = await fetch('/api/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        id: resetRoleDefaultTarget.id,
        resetToDefault: true,
      }),
    });
    const json = await res.json();
    setResetRoleDefaultTarget(null);
    if (!res.ok) {
      notify('error', json.error || 'Gagal memulihkan standar peran.');
      return;
    }
    notify('success', `Izin bawaan untuk "${resetRoleDefaultTarget.name}" berhasil dipulihkan.`);
    await loadUsersAndRoles();
    await refreshContext();
  };

  const openCreateRoleModal = (cloneFrom?: RoleDetailRow) => {
    setCreateRoleForm({
      code: cloneFrom ? `${cloneFrom.code}_KUSTOM` : '',
      name: cloneFrom ? `${cloneFrom.name} (Kustom)` : '',
      description: cloneFrom ? cloneFrom.description : '',
      cloneFromRoleId: cloneFrom ? String(cloneFrom.id) : '',
    });
    setCreateRoleModal(true);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        code: createRoleForm.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        name: createRoleForm.name.trim(),
        description: createRoleForm.description.trim(),
        cloneFromRoleId: createRoleForm.cloneFromRoleId
          ? Number(createRoleForm.cloneFromRoleId)
          : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal membuat peran kustom.');
      return;
    }
    setCreateRoleModal(false);
    notify('success', `Peran kustom "${json.role.name}" berhasil dibuat.`);
    selectedRoleIdRef.current = json.role.id;
    await loadUsersAndRoles();
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    const res = await fetch(`/api/roles?id=${deleteRoleTarget.id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    const json = await res.json().catch(() => ({}));
    setDeleteRoleTarget(null);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menghapus peran kustom.');
      return;
    }
    notify('success', `Peran "${deleteRoleTarget.name}" berhasil dihapus.`);
    selectedRoleIdRef.current = 0;
    setSelectedRoleId(0);
    await loadUsersAndRoles();
  };

  // --- Backup Handlers ---
  const handleCreateBackup = async () => {
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ action: 'create', notes: backupNotes || 'Cadangan manual admin' }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal membuat cadangan database.');
      return;
    }
    setBackupNotes('');
    notify('success', `Cadangan ${json.backup.fileName} berhasil dibuat.`);
    await loadBackups();
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget) return;
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ action: 'restore', fileName: restoreTarget, confirmed: true }),
    });
    const json = await res.json();
    setRestoreTarget(null);
    if (!res.ok) {
      notify('error', json.error || 'Gagal memulihkan database.');
      return;
    }
    notify('success', json.message);
    await loadBackups();
  };

  const renderScopeSummary = (u: UserRow) => {
    if (u.roleCode === 'SUPER_ADMIN' || u.scopeMode === 'ALL') {
      return (
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">Semua Rombel & Mapel</span>
          <div className="text-[11px] text-slate-500">Akses penuh sekolah</div>
        </div>
      );
    }
    if (u.scopeMode === 'CUSTOM') {
      const classNames = u.classIds.map((id) => classMap.get(id) || `#${id}`);
      return (
        <div>
          <span className="font-medium text-[#0F2942] dark:text-blue-300">
            Cakupan Khusus ({u.classIds.length} Rombel · {u.subjectIds.length} Mapel)
          </span>
          <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
            {classNames.length > 0 ? classNames.join(', ') : 'Belum ada rombel dipilih'}
          </div>
        </div>
      );
    }
    return (
      <div>
        <span className="font-medium text-slate-700 dark:text-slate-300">Otomatis Penugasan</span>
        <div className="text-[11px] text-slate-500">
          {u.teacherId ? 'Mengikuti jadwal & wali kelas' : 'Belum tertaut data guru'}
        </div>
      </div>
    );
  };

  const renderScopeSelector = (
    formState: {
      roleId: string;
      scopeMode: ScopeMode;
      classIds: number[];
      subjectIds: number[];
    },
    onChange: (patch: Partial<typeof formState>) => void
  ) => {
    const selectedRoleObj = roles.find((r) => String(r.id) === formState.roleId);
    const isSuperAdminRole = selectedRoleObj?.code === 'SUPER_ADMIN';

    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3.5 space-y-3 bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0F2942] dark:text-blue-400" />
            Cakupan Akses Kelas & Mata Pelajaran
          </div>
          {isSuperAdminRole && (
            <span className="text-[11px] text-slate-500">Super Admin selalu Semua Kelas</span>
          )}
        </div>

        <Select
          label="Mode Cakupan Data"
          value={isSuperAdminRole ? 'ALL' : formState.scopeMode}
          disabled={isSuperAdminRole}
          onChange={(e) => onChange({ scopeMode: e.target.value as ScopeMode })}
        >
          {(['ALL', 'ASSIGNED', 'CUSTOM'] as ScopeMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {SCOPE_MODE_LABELS[mode].label} — {SCOPE_MODE_LABELS[mode].description}
            </option>
          ))}
        </Select>

        {!isSuperAdminRole && formState.scopeMode === 'CUSTOM' && (
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Pilih Rombongan Belajar ({formState.classIds.length} dipilih)
                </span>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onChange({ classIds: allClasses.map((c) => c.id) })}
                    className="text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ classIds: [] })}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {allClasses.map((cls) => {
                  const checked = formState.classIds.includes(cls.id);
                  return (
                    <label
                      key={cls.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs cursor-pointer ${
                        checked
                          ? 'bg-[#0F2942] text-white border-[#0F2942]'
                          : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formState.classIds.filter((id) => id !== cls.id)
                            : [...formState.classIds, cls.id];
                          onChange({ classIds: next });
                        }}
                      />
                      <span className="font-medium truncate">Kelas {cls.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Pilih Mata Pelajaran ({formState.subjectIds.length} dipilih · kosongkan bila semua mapel di rombel diizinkan)
                </span>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onChange({ subjectIds: allSubjects.map((s) => s.id) })}
                    className="text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ subjectIds: [] })}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-[#0F172A] divide-y divide-slate-100 dark:divide-slate-800">
                {allSubjects.map((subj) => {
                  const checked = formState.subjectIds.includes(subj.id);
                  return (
                    <label
                      key={subj.id}
                      className="flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formState.subjectIds.filter((id) => id !== subj.id)
                            : [...formState.subjectIds, subj.id];
                          onChange({ subjectIds: next });
                        }}
                        className="rounded border-slate-300 text-[#0F2942] focus:ring-[#1D4ED8]"
                      />
                      <span className="font-mono text-[11px] text-slate-500 w-16 shrink-0">
                        Kls {subj.gradeLevel} · {subj.code}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 truncate">{subj.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleUploadSchoolAsset = async (type: 'signature' | 'stamp', file: File | null) => {
    if (!file) return;
    setAssetBusy(type);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      const res = await fetch('/api/school/assets', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('error', json.error || 'Gagal mengunggah gambar.');
        return;
      }
      setAssetVersion(Date.now());
      await refreshContext();
      notify(
        'success',
        type === 'signature'
          ? 'Tanda tangan Kepala Sekolah berhasil diperbarui.'
          : 'Stempel sekolah berhasil diperbarui.'
      );
    } finally {
      setAssetBusy(null);
    }
  };

  const handleDeleteSchoolAsset = async (type: 'signature' | 'stamp') => {
    setAssetBusy(type);
    try {
      const res = await fetch(`/api/school/assets?type=${type}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('error', json.error || 'Gagal menghapus gambar.');
        return;
      }
      setAssetVersion(Date.now());
      await refreshContext();
      notify(
        'info',
        type === 'signature'
          ? 'Tanda tangan Kepala Sekolah dihapus.'
          : 'Stempel sekolah dihapus.'
      );
    } finally {
      setAssetBusy(null);
    }
  };

  const handleToggleSchoolAsset = async (
    field: 'showPrincipalSignature' | 'showSchoolStamp' | 'showLetterhead',
    value: boolean
  ) => {
    setAssetBusy('toggle');
    try {
      const res = await fetch('/api/school/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('error', json.error || 'Gagal menyimpan status tampilan.');
        return;
      }
      await refreshContext();
      const label =
        field === 'showPrincipalSignature'
          ? 'Tanda tangan'
          : field === 'showSchoolStamp'
          ? 'Stempel sekolah'
          : 'Kop surat sekolah';
      notify(
        'success',
        `${label} ${value ? 'diaktifkan' : 'dinonaktifkan'} pada dokumen cetak.`
      );
    } finally {
      setAssetBusy(null);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'akun', label: 'Akun Saya' },
    ...(canReadSchool || canUpdateSchool
      ? [{ id: 'dokumen' as const, label: 'Dokumen & TTD' }]
      : []),
    ...(canReadUsers
      ? [
          { id: 'pengguna' as const, label: 'Pengguna' },
          { id: 'peran' as const, label: 'Peran & Izin' },
        ]
      : []),
    ...(canReadBackup ? [{ id: 'backup' as const, label: 'Cadangan' }] : []),
  ];

  const userScopeLabel = user?.hasFullScope
    ? SCOPE_MODE_LABELS.ALL.label
    : SCOPE_MODE_LABELS[user?.scopeMode || 'ASSIGNED'].label;

  return (
    <AppShell title="Pengaturan">
      <div className="space-y-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
            Pengaturan Akun & Sistem
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola profil akun, pengguna, peran dan hak akses, serta cadangan database lokal.
          </p>
        </div>

        <TabBar
          items={tabs}
          activeId={activeTab}
          onChange={(id) => setTab(id as SettingsTab)}
        />

        {activeTab === 'akun' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3 h-fit">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                Informasi Akun & Hak Akses Aktif
              </h2>
              <div className="text-xs space-y-2 pt-1">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Nama Lengkap</span>
                  <span className="font-semibold text-right">{user?.fullName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Nama Pengguna</span>
                  <span className="font-mono">{user?.username}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Peran RBAC</span>
                  <span className="font-semibold text-[#0F2942] dark:text-blue-300">
                    {user?.roleName}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Cakupan Data</span>
                  <span className="font-medium text-right">{userScopeLabel}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Rombel Terakses</span>
                  <span className="font-mono tabular-nums text-right">
                    {user?.hasFullScope
                      ? `Semua (${contextClasses.length} rombel)`
                      : `${contextClasses.length} rombel`}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Izin Modul Aktif</span>
                  <span className="font-mono tabular-nums">{user?.permissions.length ?? 0} izin</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Email</span>
                  <span>{user?.email}</span>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleChangePassword}
              className="lg:col-span-7 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4 h-fit"
            >
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                Ubah Kata Sandi Akun
              </h2>
              <Input
                label="Kata Sandi Saat Ini"
                type="password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Kata Sandi Baru (min. 6 karakter)"
                  type="password"
                  minLength={6}
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  required
                />
                <Input
                  label="Konfirmasi Kata Sandi Baru"
                  type="password"
                  minLength={6}
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Simpan Kata Sandi Baru</Button>
              </div>
            </form>
          </div>
        ) : activeTab === 'dokumen' ? (
          <div className="space-y-5">
            {/* Kop Surat Sekolah */}
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                    Kop Surat Sekolah
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                    Ditampilkan otomatis pada dokumen cetak resmi ber-kop (Biodata, Piagam, Buku Tamu, dan Laporan TPP). Matikan saklar ini bila Anda mencetak di atas kertas kop surat fisik sekolah.
                  </p>
                </div>
                <ToggleSwitch
                  checked={school?.showLetterhead ?? true}
                  disabled={!canUpdateSchool || assetBusy === 'toggle'}
                  onChange={(next) => handleToggleSchoolAsset('showLetterhead', next)}
                  label={school?.showLetterhead ?? true ? 'On' : 'Off'}
                />
              </div>

              <div className="bg-white text-slate-900 border border-slate-200 rounded-md p-4">
                {(school?.showLetterhead ?? true) ? (
                  <div className="flex items-center gap-4 pb-3 border-b-2 border-slate-900">
                    <img
                      src="/api/school/logo"
                      alt="Logo Sekolah"
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-cover rounded shrink-0"
                    />
                    <div className="flex-1 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                        DOKUMEN RESMI SEKOLAH
                      </p>
                      <h3 className="text-sm font-bold uppercase text-slate-900">
                        {school?.name || 'Nama Sekolah'}
                      </h3>
                      <p className="text-[11px] text-slate-700">
                        {school?.address}, Kec. {school?.district}, {school?.regency},{' '}
                        {school?.province} · NPSN {school?.npsn}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-3">
                    Kop surat dinonaktifkan — bagian kop surat disembunyikan pada dokumen cetak ber-kop.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Tanda Tangan & Stempel
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                    Unggah tanda tangan kepala sekolah dan stempel sekolah berformat PNG (background transparan disarankan). Keduanya otomatis diterapkan pada dokumen cetak seperti rapor, biodata, piagam, rapor keasramaan, jurnal mengajar, buku tamu, presensi guru, dan laporan TPP. Bila tidak diunggah atau saklar dimatikan, dokumen tetap dicetak tanpa gambar ini.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Tanda Tangan Kepala Sekolah */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <FileSignature className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                        Tanda Tangan Kepala Sekolah
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ditempatkan tepat di atas nama kepala sekolah pada dokumen cetak.
                      </p>
                    </div>
                    <ToggleSwitch
                      size="sm"
                      checked={school?.showPrincipalSignature ?? true}
                      disabled={!canUpdateSchool || assetBusy === 'toggle'}
                      onChange={(next) => handleToggleSchoolAsset('showPrincipalSignature', next)}
                      label={school?.showPrincipalSignature ?? true ? 'On' : 'Off'}
                    />
                  </div>

                  <div className="h-32 rounded-md border border-slate-200 dark:border-slate-700 bg-white flex flex-col items-center justify-center p-3 overflow-hidden">
                    {school?.principalSignaturePath ? (
                      <img
                        src={`/api/school/assets?type=signature&v=${assetVersion}`}
                        alt="Tanda Tangan Kepala Sekolah"
                        referrerPolicy="no-referrer"
                        className={`max-h-24 max-w-full object-contain transition-opacity ${
                          school.showPrincipalSignature === false ? 'opacity-35' : 'opacity-100'
                        }`}
                      />
                    ) : (
                      <span className="text-xs text-slate-400 text-center">
                        Belum ada gambar tanda tangan diunggah
                      </span>
                    )}
                  </div>

                  {canUpdateSchool && (
                    <div className="flex items-center gap-2">
                      <input
                        ref={sigInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          e.target.value = '';
                          void handleUploadSchoolAsset('signature', file);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        loading={assetBusy === 'signature'}
                        onClick={() => sigInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {school?.principalSignaturePath ? 'Ganti' : 'Unggah PNG'}
                      </Button>
                      {school?.principalSignaturePath && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assetBusy === 'signature'}
                          onClick={() => handleDeleteSchoolAsset('signature')}
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Stempel Sekolah */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Stamp className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                        Stempel Sekolah
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Menimpa tanda tangan, sedikit ke kiri, pada dokumen cetak.
                      </p>
                    </div>
                    <ToggleSwitch
                      size="sm"
                      checked={school?.showSchoolStamp ?? true}
                      disabled={!canUpdateSchool || assetBusy === 'toggle'}
                      onChange={(next) => handleToggleSchoolAsset('showSchoolStamp', next)}
                      label={school?.showSchoolStamp ?? true ? 'On' : 'Off'}
                    />
                  </div>

                  <div className="h-32 rounded-md border border-slate-200 dark:border-slate-700 bg-white flex flex-col items-center justify-center p-3 overflow-hidden">
                    {school?.schoolStampPath ? (
                      <img
                        src={`/api/school/assets?type=stamp&v=${assetVersion}`}
                        alt="Stempel Sekolah"
                        referrerPolicy="no-referrer"
                        className={`max-h-24 max-w-full object-contain transition-opacity ${
                          school.showSchoolStamp === false ? 'opacity-35' : 'opacity-100'
                        }`}
                      />
                    ) : (
                      <span className="text-xs text-slate-400 text-center">
                        Belum ada gambar stempel sekolah diunggah
                      </span>
                    )}
                  </div>

                  {canUpdateSchool && (
                    <div className="flex items-center gap-2">
                      <input
                        ref={stampInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          e.target.value = '';
                          void handleUploadSchoolAsset('stamp', file);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        loading={assetBusy === 'stamp'}
                        onClick={() => stampInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {school?.schoolStampPath ? 'Ganti' : 'Unggah PNG'}
                      </Button>
                      {school?.schoolStampPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assetBusy === 'stamp'}
                          onClick={() => handleDeleteSchoolAsset('stamp')}
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Pratinjau Gabungan Posisi Cetak */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
                  Pratinjau Gabungan pada Dokumen Cetak A4
                </p>
                <div className="bg-white text-slate-900 border border-slate-200 rounded-md px-5 py-6 max-w-xs text-center text-xs overflow-visible">
                  <p className="relative z-0 font-medium">Kepala Sekolah,</p>
                  <div className="relative overflow-visible h-16 flex items-center justify-center my-1">
                    {(school?.showSchoolStamp ?? true) && school?.schoolStampPath && (
                      <img
                        src={`/api/school/assets?type=stamp&v=${assetVersion}`}
                        alt="Pratinjau Stempel"
                        referrerPolicy="no-referrer"
                        className="pointer-events-none select-none absolute left-1/2 -translate-x-[72%] top-1/2 -translate-y-1/2 w-28 h-28 object-contain opacity-85 mix-blend-multiply z-10"
                      />
                    )}
                    {(school?.showPrincipalSignature ?? true) && school?.principalSignaturePath && (
                      <img
                        src={`/api/school/assets?type=signature&v=${assetVersion}`}
                        alt="Pratinjau Tanda Tangan"
                        referrerPolicy="no-referrer"
                        className="relative z-0 max-h-14 max-w-[160px] object-contain"
                      />
                    )}
                  </div>
                  <p className="relative z-0 font-semibold underline">
                    {school?.principalName || 'Kepala Sekolah'}
                  </p>
                  <p className="relative z-0 font-mono text-[11px] text-slate-600">
                    NIP {school?.principalNip || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : loading ? (
          <TableSkeleton rows={8} />
        ) : activeTab === 'pengguna' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <p className="text-xs text-slate-500">
                Kelola akun pengguna, penetapan peran RBAC, serta pembatasan akses per rombongan belajar dan mata pelajaran.
              </p>
              {canCreateUsers && (
                <Button size="sm" onClick={() => setCreateUserModal(true)}>
                  <Plus className="w-4 h-4" />
                  Tambah Akun
                </Button>
              )}
            </div>

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table text-left text-xs">
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-3 font-semibold col-id">Nama & Username</th>
                      <th className="py-3 px-3 font-semibold col-a col-sep">Peran RBAC</th>
                      <th className="py-3 px-3 font-semibold col-a col-cell-div">Cakupan Akses</th>
                      <th className="py-3 px-3 font-semibold col-total col-sep">Status</th>
                      <th className="py-3 px-3 font-semibold col-b col-sep">Login Terakhir</th>
                      <th className="py-3 px-3 font-semibold text-right col-action col-sep">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isSelf = u.id === user?.id;
                      const protectedSuperAdmin =
                        u.roleCode === 'SUPER_ADMIN' && user?.roleCode !== 'SUPER_ADMIN';
                      return (
                        <tr key={u.id}>
                          <td className="py-2.5 px-3 col-id">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {u.fullName} {isSelf && <span className="text-[11px] text-[#1D4ED8]">(Anda)</span>}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              @{u.username} · {u.email}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium col-a col-sep">
                            <div>{u.roleName}</div>
                            <div className="text-[11px] font-mono text-slate-400">{u.roleCode}</div>
                          </td>
                          <td className="py-2.5 px-3 col-a col-cell-div">{renderScopeSummary(u)}</td>
                          <td className="py-2.5 px-3 col-total col-sep">
                            <span className={u.isActive ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-red-600 font-medium'}>
                              {u.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 tabular-nums whitespace-nowrap text-slate-500 col-b col-sep">
                            {u.lastLoginAt ? formatIndoDateTime(u.lastLoginAt) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right col-action col-sep">
                            <div className="inline-flex items-center gap-1.5">
                              {canUpdateUsers && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={protectedSuperAdmin}
                                    onClick={() => openEditUserModal(u)}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Peran & Cakupan
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={protectedSuperAdmin}
                                    onClick={() => {
                                      setResetUserTarget(u);
                                      setResetPwdValue('');
                                    }}
                                  >
                                    Reset Sandi
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isSelf || protectedSuperAdmin}
                                    onClick={() => handleToggleUserActive(u)}
                                  >
                                    {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                  </Button>
                                </>
                              )}
                              {canDeleteUsers && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isSelf || protectedSuperAdmin}
                                  onClick={() => setDeleteUserTarget(u)}
                                  aria-label={`Hapus ${u.username}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Riwayat Aktivitas Keamanan & Audit RBAC
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {auditLogs.map((l) => (
                  <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold">{l.actorName}:</span> {l.details}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 tabular-nums whitespace-nowrap">
                      {formatIndoDateTime(l.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'peran' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Role List Sidebar */}
            <div className="lg:col-span-4 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Daftar Peran ({roles.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">Pilih peran untuk mengatur matriks izin.</p>
                </div>
                {canCreateUsers && (
                  <Button size="sm" onClick={() => openCreateRoleModal()}>
                    <Plus className="w-3.5 h-3.5" />
                    Peran Baru
                  </Button>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                {roles.map((r) => {
                  const active = selectedRole?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectRoleAndSync(r)}
                      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0F2942] text-white'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{r.name}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            active
                              ? 'border-white/30 text-slate-100'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}
                        >
                          {r.isSystem ? 'Bawaan' : 'Kustom'}
                        </span>
                      </div>
                      <div
                        className={`mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums ${
                          active ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        <span>{r.code}</span>
                        <span>
                          {r.permissionKeys.length} izin · {r.userCount} akun
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Matrix Editor */}
            <div className="lg:col-span-8 space-y-4">
              {selectedRole && (
                <>
                  <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-[#1D4ED8] dark:text-blue-400">
                            {selectedRole.code}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            · {selectedRole.isSystem ? 'Peran Bawaan Sistem' : 'Peran Kustom Sekolah'} ·{' '}
                            <Users className="w-3 h-3 inline -mt-0.5" /> {selectedRole.userCount} akun
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Perubahan matriks izin langsung berlaku di SQLite untuk seluruh akun dengan peran ini.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {canCreateUsers && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCreateRoleModal(selectedRole)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplikasi
                          </Button>
                        )}
                        {canUpdateUsers && selectedRole.isSystem && !isRoleEditLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResetRoleDefaultTarget(selectedRole)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Pulihkan Bawaan
                          </Button>
                        )}
                        {canDeleteUsers && !selectedRole.isSystem && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selectedRole.userCount > 0}
                            onClick={() => setDeleteRoleTarget(selectedRole)}
                            title={
                              selectedRole.userCount > 0
                                ? 'Alihkan seluruh akun dari peran ini sebelum menghapus'
                                : 'Hapus peran kustom'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            Hapus
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <Input
                        label="Nama Peran"
                        value={draftRoleName}
                        disabled={isRoleEditLocked}
                        onChange={(e) => setDraftRoleName(e.target.value)}
                      />
                      <Input
                        label="Deskripsi Singkat"
                        value={draftRoleDesc}
                        disabled={isRoleEditLocked}
                        onChange={(e) => setDraftRoleDesc(e.target.value)}
                      />
                    </div>

                    {selectedRole.code === 'SUPER_ADMIN' && (
                      <AlertBox variant="info">
                        Izin inti <span className="font-mono">dashboard:read</span> dan{' '}
                        <span className="font-mono">pengguna:*</span> terkunci pada Super Administrator untuk mencegah kehilangan akses sistem.
                      </AlertBox>
                    )}

                    {isMatrixDirty && !isRoleEditLocked && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs">
                        <span className="font-medium text-amber-900 dark:text-amber-200">
                          Ada perubahan matriks izin ({draftPermissions.size} izin dipilih) yang belum disimpan.
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDraftRoleName(selectedRole.name);
                              setDraftRoleDesc(selectedRole.description);
                              setDraftPermissions(new Set(selectedRole.permissionKeys));
                            }}
                          >
                            Batalkan
                          </Button>
                          <Button size="sm" loading={savingMatrix} onClick={handleSaveMatrix}>
                            <Save className="w-3.5 h-3.5" />
                            Simpan Matriks Izin
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 17 x 6 Matrix Table */}
                  <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="data-table text-left text-xs">
                        <thead className="sticky top-0 z-10">
                          <tr className="th-groups text-[10px] uppercase tracking-wider">
                            <th className="py-1.5 px-3 font-semibold col-id">Modul</th>
                            <th colSpan={2} className="py-1.5 px-2 font-semibold text-center col-a col-sep">
                              Akses Dasar
                            </th>
                            <th colSpan={2} className="py-1.5 px-2 font-semibold text-center col-b col-sep">
                              Modifikasi
                            </th>
                            <th colSpan={2} className="py-1.5 px-2 font-semibold text-center col-c col-sep">
                              Khusus
                            </th>
                            <th className="py-1.5 px-2 font-semibold text-center col-total col-sep">
                              Baris
                            </th>
                          </tr>
                          <tr className="text-slate-700 dark:text-slate-200">
                            <th className="py-2 px-3 font-semibold min-w-[230px] col-id">
                              Modul Aplikasi (17 Modul)
                            </th>
                            {ALL_ACTIONS.map((action, actIdx) => {
                              const colKeys = ALL_MODULES.map((m) => `${m}:${action}`);
                              const unlockedCol =
                                selectedRole.code === 'SUPER_ADMIN'
                                  ? colKeys.filter((k) => !LOCKED_SUPER_ADMIN_PERMISSIONS.includes(k))
                                  : colKeys;
                              const allColChecked =
                                unlockedCol.length > 0 &&
                                unlockedCol.every((k) => draftPermissions.has(k));
                              const grpClass =
                                actIdx < 2 ? 'col-a' : actIdx < 4 ? 'col-b' : 'col-c';
                              const sepClass = actIdx % 2 === 0 ? 'col-sep' : 'col-cell-div';
                              return (
                                <th
                                  key={action}
                                  className={`py-2 px-2 text-center font-semibold w-16 ${grpClass} ${sepClass}`}
                                >
                                  <label className="inline-flex flex-col items-center gap-1 cursor-pointer select-none">
                                    <span>{ACTION_LABELS[action]}</span>
                                    <input
                                      type="checkbox"
                                      checked={allColChecked}
                                      disabled={isRoleEditLocked}
                                      onChange={() => toggleColumnPermissions(action)}
                                      aria-label={`Pilih semua aksi ${ACTION_LABELS[action]}`}
                                      className="rounded border-slate-300 text-[#0F2942] focus:ring-[#1D4ED8] disabled:opacity-50"
                                    />
                                  </label>
                                </th>
                              );
                            })}
                            <th className="py-2 px-2 text-center font-semibold w-16 col-total col-sep">
                              Semua
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ALL_MODULES.map((mod) => {
                            const meta = MODULE_METADATA[mod];
                            const rowKeys = ALL_ACTIONS.map((a) => `${mod}:${a}`);
                            const unlockedRow =
                              selectedRole.code === 'SUPER_ADMIN'
                                ? rowKeys.filter((k) => !LOCKED_SUPER_ADMIN_PERMISSIONS.includes(k))
                                : rowKeys;
                            const allRowChecked =
                              unlockedRow.length > 0 &&
                              unlockedRow.every((k) => draftPermissions.has(k));

                            return (
                              <tr key={mod}>
                                <td className="py-2 px-3 col-id">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {meta.label}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    <span className="font-mono">{mod}</span> · {meta.description}
                                  </div>
                                </td>
                                {ALL_ACTIONS.map((action, actIdx) => {
                                  const key = `${mod}:${action}`;
                                  const isLockedKey =
                                    selectedRole.code === 'SUPER_ADMIN' &&
                                    LOCKED_SUPER_ADMIN_PERMISSIONS.includes(key);
                                  const checked = draftPermissions.has(key);
                                  const grpClass =
                                    actIdx < 2 ? 'col-a' : actIdx < 4 ? 'col-b' : 'col-c';
                                  const sepClass = actIdx % 2 === 0 ? 'col-sep' : 'col-cell-div';
                                  return (
                                    <td
                                      key={action}
                                      className={`py-2 px-2 text-center ${grpClass} ${sepClass}`}
                                    >
                                      <div className="inline-flex items-center justify-center gap-1">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={isRoleEditLocked || isLockedKey}
                                          onChange={() => togglePermission(mod, action)}
                                          aria-label={`${meta.label} - ${ACTION_LABELS[action]}`}
                                          title={
                                            isLockedKey
                                              ? 'Izin inti Super Administrator terkunci'
                                              : `${meta.label}: ${ACTION_LABELS[action]}`
                                          }
                                          className="w-4 h-4 rounded border-slate-300 text-[#0F2942] focus:ring-[#1D4ED8] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        {isLockedKey && (
                                          <Lock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-2 text-center col-total col-sep">
                                  <input
                                    type="checkbox"
                                    checked={allRowChecked}
                                    disabled={isRoleEditLocked}
                                    onChange={() => toggleRowPermissions(mod)}
                                    aria-label={`Pilih semua aksi untuk ${meta.label}`}
                                    className="w-4 h-4 rounded border-slate-300 text-[#0F2942] focus:ring-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <AlertBox variant="info">
              Cadangan database menggunakan SQLite Online Backup API dengan verifikasi checksum SHA-256. Berkas .db dapat diunduh untuk penyimpanan eksternal luring.
            </AlertBox>

            {canCreateBackup && (
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <Input
                    label="Catatan Cadangan (Opsional)"
                    placeholder="Mis. Sebelum sinkronisasi akhir semester"
                    value={backupNotes}
                    onChange={(e) => setBackupNotes(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateBackup}>
                  <DatabaseBackup className="w-4 h-4" />
                  Buat Snapshot Database (.db)
                </Button>
              </div>
            )}

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="data-table text-left text-xs">
                <thead>
                  <tr>
                    <th className="py-3 px-3 font-semibold col-id">Nama Berkas</th>
                    <th className="py-3 px-3 font-semibold col-a col-sep">Catatan</th>
                    <th className="py-3 px-3 font-semibold text-right col-total col-sep">Ukuran</th>
                    <th className="py-3 px-3 font-semibold col-b col-sep">Checksum SHA-256</th>
                    <th className="py-3 px-3 font-semibold text-right col-action col-sep">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Belum ada cadangan database. Klik Buat Snapshot Database untuk membuat salinan pertama.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2.5 px-3 font-mono font-medium col-id">{b.fileName}</td>
                        <td className="py-2.5 px-3 col-a col-sep">{b.notes || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums col-total col-sep">
                          {Math.round(b.sizeBytes / 1024)} KB
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 col-b col-sep">
                          {b.checksum.slice(0, 16)}...
                        </td>
                        <td className="py-2.5 px-3 text-right col-action col-sep">
                          <div className="inline-flex items-center gap-1.5">
                            {canExportBackup && (
                              <a href={`/api/backup?download=${encodeURIComponent(b.fileName)}`}>
                                <Button size="sm" variant="outline">
                                  <Download className="w-3.5 h-3.5" />
                                  Unduh
                                </Button>
                              </a>
                            )}
                            {canApproveBackup && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRestoreTarget(b.fileName)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Pulihkan
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah Akun */}
      <Modal
        open={createUserModal}
        onClose={() => setCreateUserModal(false)}
        title="Tambah Akun Pengguna Baru"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Username"
              value={createUserForm.username}
              onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
              required
            />
            <Input
              label="Nama Lengkap"
              value={createUserForm.fullName}
              onChange={(e) => setCreateUserForm({ ...createUserForm, fullName: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={createUserForm.email}
              onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
              required
            />
            <Input
              label="Kata Sandi Awal"
              type="password"
              minLength={6}
              value={createUserForm.password}
              onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Peran RBAC"
              value={createUserForm.roleId}
              onChange={(e) => {
                const nextRoleId = e.target.value;
                const roleObj = roles.find((r) => String(r.id) === nextRoleId);
                const autoAll =
                  roleObj &&
                  ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'OPERATOR_SEKOLAH', 'BENDAHARA', 'TATA_USAHA'].includes(
                    roleObj.code
                  );
                setCreateUserForm({
                  ...createUserForm,
                  roleId: nextRoleId,
                  scopeMode: autoAll ? 'ALL' : 'ASSIGNED',
                });
              }}
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>
            <Select
              label="Tautkan ke Data Guru (Opsional)"
              value={createUserForm.teacherId}
              onChange={(e) => setCreateUserForm({ ...createUserForm, teacherId: e.target.value })}
            >
              <option value="">-- Tidak ditautkan --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>

          {renderScopeSelector(createUserForm, (patch) =>
            setCreateUserForm((prev) => ({ ...prev, ...patch }))
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateUserModal(false)}>
              Batal
            </Button>
            <Button type="submit">Buat Akun</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Ubah Peran & Cakupan Akun */}
      <Modal
        open={Boolean(editUserTarget)}
        onClose={() => setEditUserTarget(null)}
        title={`Kelola Peran & Cakupan — @${editUserTarget?.username || ''}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveEditUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nama Lengkap"
              value={editUserForm.fullName}
              onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={editUserForm.email}
              onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Peran RBAC"
              value={editUserForm.roleId}
              disabled={editUserTarget?.id === user?.id}
              onChange={(e) => setEditUserForm({ ...editUserForm, roleId: e.target.value })}
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>
            <Select
              label="Tautkan ke Data Guru (Opsional)"
              value={editUserForm.teacherId}
              onChange={(e) => setEditUserForm({ ...editUserForm, teacherId: e.target.value })}
            >
              <option value="">-- Tidak ditautkan --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>

          {renderScopeSelector(editUserForm, (patch) =>
            setEditUserForm((prev) => ({ ...prev, ...patch }))
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditUserTarget(null)}>
              Batal
            </Button>
            <Button type="submit">Simpan Perubahan Akses</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Tambah / Duplikasi Peran Kustom */}
      <Modal
        open={createRoleModal}
        onClose={() => setCreateRoleModal(false)}
        title="Tambah Peran RBAC Kustom"
        subtitle="Kode peran menggunakan huruf kapital, angka, dan garis bawah (contoh: KOORDINATOR_P5)."
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Kode Peran"
              placeholder="MIS. WAKA_KURIKULUM"
              value={createRoleForm.code}
              onChange={(e) =>
                setCreateRoleForm({
                  ...createRoleForm,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                })
              }
              required
            />
            <Input
              label="Nama Tampilan Peran"
              placeholder="Wakil Kepala Kurikulum"
              value={createRoleForm.name}
              onChange={(e) => setCreateRoleForm({ ...createRoleForm, name: e.target.value })}
              required
            />
          </div>
          <Input
            label="Deskripsi Peran"
            placeholder="Jelaskan tugas utama peran ini di sekolah"
            value={createRoleForm.description}
            onChange={(e) => setCreateRoleForm({ ...createRoleForm, description: e.target.value })}
            required
          />
          <Select
            label="Salin Matriks Izin Dari (Opsional)"
            value={createRoleForm.cloneFromRoleId}
            onChange={(e) =>
              setCreateRoleForm({ ...createRoleForm, cloneFromRoleId: e.target.value })
            }
          >
            <option value="">-- Mulai kosong (hanya Beranda: Lihat) --</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.permissionKeys.length} izin)
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateRoleModal(false)}>
              Batal
            </Button>
            <Button type="submit">Buat Peran Kustom</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Reset Sandi */}
      <Modal
        open={Boolean(resetUserTarget)}
        onClose={() => setResetUserTarget(null)}
        title={`Reset Kata Sandi — ${resetUserTarget?.fullName || ''}`}
      >
        <form onSubmit={handleResetUserPassword} className="space-y-4">
          <Input
            label="Kata Sandi Baru (min. 6 karakter)"
            type="password"
            minLength={6}
            value={resetPwdValue}
            onChange={(e) => setResetPwdValue(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetUserTarget(null)}>
              Batal
            </Button>
            <Button type="submit">Reset Kata Sandi</Button>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi Hapus Pengguna */}
      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={handleDeleteUser}
        title="Konfirmasi Hapus Akun Pengguna"
        message={`Akun @${deleteUserTarget?.username} (${deleteUserTarget?.fullName}) akan dihapus permanen beserta konfigurasi cakupannya.`}
        confirmLabel="Ya, Hapus Akun"
        danger
      />

      {/* Konfirmasi Pulihkan Matriks Bawaan Peran */}
      <ConfirmDialog
        open={Boolean(resetRoleDefaultTarget)}
        onClose={() => setResetRoleDefaultTarget(null)}
        onConfirm={handleResetRoleToDefault}
        title="Pulihkan Izin Standar Bawaan"
        message={`Seluruh izin peran "${resetRoleDefaultTarget?.name}" akan dikembalikan ke konfigurasi standar Kemendikdasmen/SEKOLAHKITA.`}
        confirmLabel="Ya, Pulihkan Standar"
      />

      {/* Konfirmasi Hapus Peran Kustom */}
      <ConfirmDialog
        open={Boolean(deleteRoleTarget)}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={handleDeleteRole}
        title="Hapus Peran Kustom"
        message={`Peran kustom "${deleteRoleTarget?.name}" (${deleteRoleTarget?.code}) akan dihapus permanen.`}
        confirmLabel="Ya, Hapus Peran"
        danger
      />

      {/* Konfirmasi Restore Database */}
      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreBackup}
        title="Konfirmasi Pemulihan Database SQLite"
        message={`Pemulihan akan menimpa seluruh data database aktif dengan salinan "${restoreTarget}". Pastikan Anda telah mengunduh cadangan terbaru sebelum melanjutkan.`}
        confirmLabel="Ya, Pulihkan Database"
        danger
      />
    </AppShell>
  );
}
