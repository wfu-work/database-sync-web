import { Routes } from '@angular/router';

import { NotificationCenterComponent } from './notifications/notification-center.component';

export const routes: Routes = [
  { path: '', redirectTo: 'notifications', pathMatch: 'full' },
  {
    path: 'notifications',
    component: NotificationCenterComponent,
    data: { title: '通知中心' },
  },
];
