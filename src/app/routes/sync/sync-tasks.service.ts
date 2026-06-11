import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SaveSyncTaskPayload, SyncRun, SyncTask } from '@shared/types/datasync';
import { PageQuery, PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface SyncTaskQuery extends PageQuery {
  mode?: string;
}

@Injectable({ providedIn: 'root' })
export class SyncTasksService {
  private readonly http = inject(HttpClient);

  list(query: SyncTaskQuery = {}): Observable<PageResult<SyncTask>> {
    return this.http.get<PageResult<SyncTask>>('/sync/tasks/list', {
      params: this.toParams(query),
    });
  }

  save(payload: SaveSyncTaskPayload, guid?: string): Observable<SyncTask> {
    if (guid) {
      return this.http.put<SyncTask>(`/sync/tasks/${guid}`, payload);
    }
    return this.http.post<SyncTask>('/sync/tasks', payload);
  }

  delete(guid: string): Observable<boolean> {
    return this.http.delete<boolean>(`/sync/tasks/${guid}`);
  }

  run(guid: string): Observable<SyncRun> {
    return this.http.post<SyncRun>(`/sync/tasks/${guid}/run`, {});
  }

  private toParams(query: SyncTaskQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
