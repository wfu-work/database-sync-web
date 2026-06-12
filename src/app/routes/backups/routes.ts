import { Routes } from '@angular/router';

import { DatabaseBackupCreateComponent } from './create/database-backup-create.component';
import { DatabaseBackupListComponent } from './history/database-backup-list.component';
import { BackupPolicyComponent } from './policies/backup-policy.component';

export const routes: Routes = [
  { path: '', redirectTo: 'history', pathMatch: 'full' },
  {
    path: 'history',
    component: DatabaseBackupListComponent,
    data: { title: '备份历史' },
  },
  {
    path: 'create',
    component: DatabaseBackupCreateComponent,
    data: { title: '新建备份' },
  },
  {
    path: 'policies',
    component: BackupPolicyComponent,
    data: { title: '备份策略' },
  },
];
