import { Routes } from '@angular/router';

import { ClientCreateComponent } from './create/client-create.component';
import { ClientDetailComponent } from './detail/client-detail.component';
import { ClientEditComponent } from './edit/client-edit.component';
import { ClientListComponent } from './list/client-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    component: ClientListComponent,
    data: { title: '凭证列表' },
  },
  {
    path: 'create',
    component: ClientCreateComponent,
    data: { title: '创建凭证' },
  },
  {
    path: 'detail/:guid',
    component: ClientDetailComponent,
    data: { title: '凭证详情' },
  },
  {
    path: 'edit/:guid',
    component: ClientEditComponent,
    data: { title: '编辑凭证' },
  },
];
