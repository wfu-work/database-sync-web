import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SyncSystemSettings {
  backupBatchSize: number;
  backupRetryTimes: number;
  backupRetryIntervalMs: number;
  tdengineParams: string;
  mysqlParams: string;
  syncBatchSize: number;
  monitorRefreshSeconds: number;
  notificationRetentionDays: number;
  backupRetentionDays: number;
  logLevel: string;
  updateTime?: number;
}

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly http = inject(HttpClient);

  getSync(): Observable<SyncSystemSettings> {
    return this.http.get<SyncSystemSettings>('/system/settings/sync');
  }

  saveSync(payload: SyncSystemSettings): Observable<SyncSystemSettings> {
    return this.http.put<SyncSystemSettings>('/system/settings/sync', payload);
  }
}
