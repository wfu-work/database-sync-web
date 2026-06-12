import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EventNotification } from '@shared/types/datasync';
import { PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface EventNotificationQuery {
  page?: number;
  size?: number;
  read?: number | string;
  level?: string;
  sourceType?: string;
  sourceGuid?: string;
  keyword?: string;
}

@Injectable({ providedIn: 'root' })
export class EventNotificationsService {
  private readonly http = inject(HttpClient);

  list(query: EventNotificationQuery = {}): Observable<PageResult<EventNotification>> {
    return this.http.get<PageResult<EventNotification>>('/events/notifications/list', {
      params: this.toParams(query),
    });
  }

  markRead(guid: string): Observable<boolean> {
    return this.http.post<boolean>(`/events/notifications/${guid}/read`, {});
  }

  markAllRead(): Observable<boolean> {
    return this.http.post<boolean>('/events/notifications/read-all', {});
  }

  private toParams(query: EventNotificationQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
