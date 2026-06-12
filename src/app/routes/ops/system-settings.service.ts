import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SyncSystemSettings {
  backupBatchSize: number;
  backupRetryTimes: number;
  backupRetryIntervalMs: number;
  backupTimeoutSeconds: number;
  tdengineParams: string;
  mysqlParams: string;
  syncBatchSize: number;
  syncRetryTimes: number;
  syncRetryIntervalMs: number;
  syncTimeoutSeconds: number;
  restoreBatchSize: number;
  restoreWriteMode: string;
  restoreCreateTable: boolean;
  restoreTruncateBefore: boolean;
  healthCheckIntervalSec: number;
  monitorRefreshSeconds: number;
  runRetentionDays: number;
  notificationRetentionDays: number;
  backupRetentionDays: number;
  restoreRetentionDays: number;
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
