import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SystemMonitorInfo } from '@shared/types/datasync';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SystemMonitorService {
  private readonly http = inject(HttpClient);

  runtime(): Observable<SystemMonitorInfo> {
    return this.http.get<SystemMonitorInfo>('/system/monitor/runtime');
  }
}
