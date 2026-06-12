import { Routes } from '@angular/router';
import { startPageGuard } from '@core';

import { LayoutBasic } from '../layout';
import { DashboardComponent } from './dashboard/dashboard.component';
import { GuideComponent } from './guide/guide.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutBasic,
    canActivate: [startPageGuard],
    data: { title: 'DataSync' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent, data: { title: '工作台' } },
      { path: 'guide', component: GuideComponent, data: { title: '使用指南' } },
      {
        path: 'datasources',
        loadChildren: () => import('./datasources/routes').then((m) => m.routes),
        data: { title: '数据源管理' },
      },
      {
        path: 'sync',
        loadChildren: () => import('./sync/routes').then((m) => m.routes),
        data: { title: '同步管理' },
      },
      {
        path: 'backups',
        loadChildren: () => import('./backups/routes').then((m) => m.routes),
        data: { title: '数据库备份' },
      },
      {
        path: 'ops',
        loadChildren: () => import('./ops/routes').then((m) => m.routes),
        data: { title: '运维中心' },
      },
    ],
  },
  { path: '', loadChildren: () => import('./passport/routes').then((m) => m.routes) },
  {
    path: 'exception',
    loadChildren: () => import('./exception/routes').then((m) => m.routes),
    data: { title: '异常页' },
  },
  { path: '**', redirectTo: 'exception/404' },
];
