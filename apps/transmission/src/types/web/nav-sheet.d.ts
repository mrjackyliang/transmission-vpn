import type { ReactNode } from 'react';

import type { Web_Components_View } from '@/types/web/components.d.ts';
import type { Web_Navigation_SheetLevel } from '@/types/web/navigation.d.ts';

/**
 * Nav Sheet.
 *
 * @since 2.0.0
 */
export type Web_NavSheet_Props = {
  activeView: Web_Components_View;
  children?: ReactNode;
  level: Web_Navigation_SheetLevel;
  onBack: () => void;
  onClose: () => void;
  onNavigate: (view: Web_Components_View) => void;
  onPush: (level: Web_Navigation_SheetLevel) => void;
};
