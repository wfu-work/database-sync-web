import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SyncError, SyncProgress, SyncRun } from '@shared/types/datasync';
import { PageQuery, PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface SyncRunQuery extends PageQuery {
  taskGuid?: string;
}

@Injectable({ providedIn: 'root' })
export class SyncRunsService {
  private readonly http = inject(HttpClient);

  list(query: SyncRunQuery = {}): Observable<PageResult<SyncRun>> {
    return this.http.get<PageResult<SyncRun>>('/sync/runs/list', {
      params: this.toParams(query),
    });
  }

  get(guid: string): Observable<SyncRun> {
    return this.http.get<SyncRun>(`/sync/runs/${guid}`);
  }

  progress(guid: string): Observable<SyncProgress> {
    return this.http.get<SyncProgress>(`/sync/runs/${guid}/progress`);
  }

  errors(guid: string, query: PageQuery = {}): Observable<PageResult<SyncError>> {
    return this.http.get<PageResult<SyncError>>(`/sync/runs/${guid}/errors`, {
      params: this.toParams(query),
    });
  }

  retryErrors(guid: string): Observable<SyncRun> {
    return this.http.post<SyncRun>(`/sync/runs/${guid}/retry-errors`, {});
  }

  private toParams(query: PageQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
