import { Routes } from '@angular/router';

import { OperationMonitorComponent } from './monitor/operation-monitor.component';
import { NotificationCenterComponent } from './notifications/notification-center.component';
import { SystemSettingsComponent } from './settings/system-settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'monitor', pathMatch: 'full' },
  {
    path: 'monitor',
    component: OperationMonitorComponent,
    data: { title: '运行监控' },
  },
  {
    path: 'notifications',
    component: NotificationCenterComponent,
    data: { title: '通知中心' },
  },
  {
    path: 'settings',
    component: SystemSettingsComponent,
    data: { title: '同步设置' },
  },
];
