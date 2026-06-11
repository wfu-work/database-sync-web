import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RelayAccount {
  guid: string;
  createTime: number;
  updateTime: number;
  name: string;
  email: string;
  phone: string;
  status: number;
  remark: string;
  lastSeenAt: number;
  authFailCount: number;
  lastAuthFailedAt: number;
  frozenAt: number;
}

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);

  list(): Observable<RelayAccount[]> {
    return this.http.get<RelayAccount[]>('/accounts/list');
  }

  enable(guid: string): Observable<boolean> {
    return this.http.post<boolean>(`/accounts/${guid}/enable`, {});
  }

  disable(guid: string): Observable<boolean> {
    return this.http.post<boolean>(`/accounts/${guid}/disable`, {});
  }
}
