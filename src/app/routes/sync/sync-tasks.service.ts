import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  SaveSyncTaskPayload,
  SaveSyncTemplateFromTaskPayload,
  SaveSyncTemplatePayload,
  ScheduleItem,
  SyncRun,
  SyncTemplate,
  SyncTask,
  SyncTaskPreviewRequest,
  SyncTaskPreviewResult,
  ValidateSyncTaskResult,
} from '@shared/types/datasync';
import { PageQuery, PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface SyncTaskQuery extends PageQuery {
  mode?: string;
  scheduleOn?: string | number;
}

export interface SyncTemplateQuery extends PageQuery {
  mode?: string;
  status?: string | number;
}

@Injectable({ providedIn: 'root' })
export class SyncTasksService {
  private readonly http = inject(HttpClient);

  list(query: SyncTaskQuery = {}): Observable<PageResult<SyncTask>> {
    return this.http.get<PageResult<SyncTask>>('/sync/tasks/list', {
      params: this.toParams(query),
    });
  }

  get(guid: string): Observable<SyncTask> {
    return this.http.get<SyncTask>(`/sync/tasks/${guid}`);
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

  stop(guid: string): Observable<boolean> {
    return this.http.post<boolean>(`/sync/tasks/${guid}/stop`, {});
  }

  validate(payload: SaveSyncTaskPayload): Observable<ValidateSyncTaskResult> {
    return this.http.post<ValidateSyncTaskResult>('/sync/tasks/validate', payload);
  }

  validateSaved(guid: string): Observable<ValidateSyncTaskResult> {
    return this.http.get<ValidateSyncTaskResult>(`/sync/tasks/${guid}/validate`);
  }

  preview(guid: string, payload: SyncTaskPreviewRequest = {}): Observable<SyncTaskPreviewResult> {
    return this.http.post<SyncTaskPreviewResult>(`/sync/tasks/${guid}/preview`, payload);
  }

  schedules(): Observable<ScheduleItem[]> {
    return this.http.get<ScheduleItem[]>('/sync/tasks/schedules');
  }

  reloadSchedules(): Observable<boolean> {
    return this.http.post<boolean>('/sync/tasks/schedules/reload', {});
  }

  templateList(query: SyncTemplateQuery = {}): Observable<PageResult<SyncTemplate>> {
    return this.http.get<PageResult<SyncTemplate>>('/sync/templates/list', {
      params: this.toParams(query),
    });
  }

  saveTemplate(payload: SaveSyncTemplatePayload, guid?: string): Observable<SyncTemplate> {
    if (guid) {
      return this.http.put<SyncTemplate>(`/sync/templates/${guid}`, payload);
    }
    return this.http.post<SyncTemplate>('/sync/templates', payload);
  }

  deleteTemplate(guid: string): Observable<boolean> {
    return this.http.delete<boolean>(`/sync/templates/${guid}`);
  }

  updateTemplateStatus(guid: string, status: number): Observable<boolean> {
    return this.http.put<boolean>(`/sync/templates/${guid}/status`, { status });
  }

  saveTemplateFromTask(
    guid: string,
    payload: SaveSyncTemplateFromTaskPayload = {},
  ): Observable<SyncTemplate> {
    return this.http.post<SyncTemplate>(`/sync/templates/from-task/${guid}`, payload);
  }

  private toParams(query: SyncTaskQuery | SyncTemplateQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
