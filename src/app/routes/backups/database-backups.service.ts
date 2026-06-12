import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RAW_BODY } from '@delon/theme';
import {
  DatabaseBackup,
  DatabaseRestore,
  StartDatabaseBackupPayload,
  StartDatabaseRestorePayload,
} from '@shared/types/datasync';
import { PageQuery, PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface DatabaseBackupQuery extends PageQuery {
  dataSourceGuid?: string;
  status?: string;
}

export interface DatabaseRestoreQuery extends PageQuery {
  backupGuid?: string;
  targetDataSourceGuid?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class DatabaseBackupsService {
  private readonly http = inject(HttpClient);

  list(query: DatabaseBackupQuery = {}): Observable<PageResult<DatabaseBackup>> {
    return this.http.get<PageResult<DatabaseBackup>>('/backups/list', {
      params: this.toParams(query),
    });
  }

  get(guid: string): Observable<DatabaseBackup> {
    return this.http.get<DatabaseBackup>(`/backups/${guid}`);
  }

  start(payload: StartDatabaseBackupPayload): Observable<DatabaseBackup> {
    return this.http.post<DatabaseBackup>('/backups', payload);
  }

  retry(guid: string): Observable<DatabaseBackup> {
    return this.http.post<DatabaseBackup>(`/backups/${guid}/retry`, {});
  }

  restore(guid: string, payload: StartDatabaseRestorePayload): Observable<DatabaseRestore> {
    return this.http.post<DatabaseRestore>(`/backups/${guid}/restore`, payload);
  }

  restoreList(query: DatabaseRestoreQuery = {}): Observable<PageResult<DatabaseRestore>> {
    return this.http.get<PageResult<DatabaseRestore>>('/backup-restores/list', {
      params: this.toParams(query),
    });
  }

  restoreGet(guid: string): Observable<DatabaseRestore> {
    return this.http.get<DatabaseRestore>(`/backup-restores/${guid}`);
  }

  delete(guid: string): Observable<boolean> {
    return this.http.delete<boolean>(`/backups/${guid}`);
  }

  download(guid: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`/backups/${guid}/download`, {
      observe: 'response',
      responseType: 'blob',
      context: new HttpContext().set(RAW_BODY, true),
    });
  }

  private toParams(query: DatabaseBackupQuery | DatabaseRestoreQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
