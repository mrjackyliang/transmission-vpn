export type Web_BackupView_Step = 'source' | 'folders' | 'profiles' | 'settings' | 'review' | 'confirm' | 'importing';

export type Web_BackupView_FolderPicker = {
  initialPath: string;
  purpose: 'download' | 'incomplete' | 'profile';
  sourcePath: string;
};

export type Web_BackupView_Source = 'another-transmission' | 'transmission-vpn-export';

export type Web_BackupView_SourceDirectoryDialogProps = {
  initialPath: string;
  onClose: () => void;
  onSelect: (path: string) => void;
  open: boolean;
};
