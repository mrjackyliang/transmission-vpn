import type {
  ChangeEvent,
  ReactNode,
} from 'react';

import type { Web_Components_Icon_Name } from '@/types/web/components.d.ts';

export type Web_BackupComponents_ExportOption = {
  description: string;
  id: string;
  label: string;
};

export type Web_BackupComponents_ExportSelection = Record<string, boolean>;

export type Web_BackupComponents_FileSource_Props = {
  busy: boolean;
  description: string;
  fileName: string;
  label: string;
  name: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelect: () => void;
  selected: boolean;
};

export type Web_BackupComponents_RunningImport = {
  detail: string;
  progress: number;
  title: string;
};

export type Web_BackupComponents_Section_Props = {
  description: string;
  importJob: Web_BackupComponents_RunningImport | null;
  onExport: () => void;
  onImport: () => void;
  onOpenImport: () => void;
  rowLabel: string;
  title: string;
};

export type Web_BackupComponents_ConfirmIdentityStep_Props = {
  authenticatorEnabled: boolean;
  description: string;
  onBack: () => void;
  onConfirm: (password: string, code: string) => Promise<string>;
  onConfirmed: (grant: string) => Promise<void> | void;
  onPasskey: () => Promise<string>;
  passkeyAvailable: boolean;
};

export type Web_BackupComponents_ExportDialog_Props = {
  authenticatorEnabled: boolean;
  description: string;
  onClose: () => void;
  onConfirm: (password: string, code: string) => Promise<string>;
  onExport: (selection: Web_BackupComponents_ExportSelection, grant: string) => Promise<void>;
  onPasskey: () => Promise<string>;
  open: boolean;
  options: Web_BackupComponents_ExportOption[];
  passkeyAvailable: boolean;
  secretWarning: string;
  title: string;
};

export type Web_BackupComponents_WizardStep = {
  id: string;
  label: string;
};

export type Web_BackupComponents_ImportWizardShell_Props = {
  backDisabled?: boolean;
  busy?: boolean;
  children: ReactNode;
  currentStep: string;
  description: string;
  hideNavigation?: boolean;
  nextDisabled?: boolean;
  nextIcon?: 'upload' | undefined;
  nextLabel?: string;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
  open: boolean;
  steps: Web_BackupComponents_WizardStep[];
  title: string;
};

export type Web_BackupComponents_ImportProgress_Props = {
  applyingLabel: string;
  contextColumn: string;
  headingSummary?: string | undefined;
  itemColumn: string;
  job: Web_BackupComponents_ImportProgressJob;
  onBackground: () => void;
  onDone: () => void;
  progressLabel: (completed: number, total: number) => string;
  remainingLabel?: string | undefined;
};

export type Web_BackupComponents_ImportProgressTone = 'active' | 'danger' | 'muted' | 'success' | 'warning';

export type Web_BackupComponents_ImportProgressItem = {
  context: string;
  detail?: string | undefined;
  id: string;
  name: string;
  status: string;
  tone: Web_BackupComponents_ImportProgressTone;
};

export type Web_BackupComponents_ImportProgressJob = {
  completed: number;
  error: string;
  items: Web_BackupComponents_ImportProgressItem[];
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
};

export type Web_BackupComponents_ReviewItem = {
  id: string;
  text: string;
};

export type Web_BackupComponents_ReviewNote = {
  icon: Web_Components_Icon_Name;
  id: string;
  text: string;
};

export type Web_BackupComponents_ReviewList_Props = {
  error?: string | undefined;
  items: Web_BackupComponents_ReviewItem[];
  notes: Web_BackupComponents_ReviewNote[];
};

export type Web_BackupComponents_SettingsCompareExcludedItem = {
  id: string;
  label: string;
  reason: string;
};

export type Web_BackupComponents_SettingsCompareRow = {
  changed: boolean;
  fileValue: string;
  hereValue: string;
  id: string;
  label: string;
};

export type Web_BackupComponents_SettingsCompare_Props = {
  attentionItems?: Web_BackupComponents_SettingsCompareExcludedItem[] | undefined;
  description: string;
  emptyMessage?: string | undefined;
  excludedItems: Web_BackupComponents_SettingsCompareExcludedItem[];
  fileColumn: string;
  rows: Web_BackupComponents_SettingsCompareRow[];
};
