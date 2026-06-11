import { Routes } from '@angular/router';

import { DataSourceListComponent } from './list/data-source-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    component: DataSourceListComponent,
    data: { title: '数据源管理' },
  },
];
