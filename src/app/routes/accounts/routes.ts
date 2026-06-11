import { Routes } from '@angular/router';

import { AccountListComponent } from './list/account-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    component: AccountListComponent,
    data: { title: '账号管理' },
  },
];
