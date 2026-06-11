import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RAW_BODY } from '@delon/theme';
import { DatabaseBackup, StartDatabaseBackupPayload } from '@shared/types/datasync';
import { PageQuery, PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface DatabaseBackupQuery extends PageQuery {
  dataSourceGuid?: string;
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

  download(guid: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`/backups/${guid}/download`, {
      observe: 'response',
      responseType: 'blob',
      context: new HttpContext().set(RAW_BODY, true),
    });
  }

  private toParams(query: DatabaseBackupQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
