import { Routes } from '@angular/router';

import { DataSourceCreateComponent } from './create/data-source-create.component';
import { DataSourceEditComponent } from './edit/data-source-edit.component';
import { DataSourceHealthComponent } from './health/data-source-health.component';
import { DataSourceListComponent } from './list/data-source-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    component: DataSourceListComponent,
    data: { title: '数据源列表' },
  },
  {
    path: 'create',
    component: DataSourceCreateComponent,
    data: { title: '新建数据源' },
  },
  {
    path: 'health',
    component: DataSourceHealthComponent,
    data: { title: '连接健康' },
  },
  {
    path: 'edit/:guid',
    component: DataSourceEditComponent,
    data: { title: '编辑数据源' },
  },
];
