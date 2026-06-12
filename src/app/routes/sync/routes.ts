import { Routes } from '@angular/router';

import { SyncTaskCreateComponent } from './create/sync-task-create.component';
import { SyncRunDetailComponent } from './run-detail/sync-run-detail.component';
import { SyncRunListComponent } from './runs/sync-run-list.component';
import { SyncScheduleListComponent } from './schedules/sync-schedule-list.component';
import { SyncTaskListComponent } from './tasks/sync-task-list.component';
import { SyncTemplateListComponent } from './templates/sync-template-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'tasks/list', pathMatch: 'full' },
  {
    path: 'tasks/list',
    component: SyncTaskListComponent,
    data: { title: '同步任务' },
  },
  {
    path: 'tasks/create',
    component: SyncTaskCreateComponent,
    data: { title: '新建任务' },
  },
  {
    path: 'tasks/:guid/edit',
    component: SyncTaskCreateComponent,
    data: { title: '编辑任务' },
  },
  {
    path: 'templates',
    component: SyncTemplateListComponent,
    data: { title: '同步模板' },
  },
  {
    path: 'runs/list',
    component: SyncRunListComponent,
    data: { title: '同步历史' },
  },
  {
    path: 'schedules',
    component: SyncScheduleListComponent,
    data: { title: '任务调度' },
  },
  {
    path: 'runs/:guid',
    component: SyncRunDetailComponent,
    data: { title: '运行详情' },
  },
];
