import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DataSource, SaveDataSourcePayload } from '@shared/types/datasync';
import { PageQuery, PageResult } from '@shared/types/page';
import { Observable } from 'rxjs';

export interface DataSourceQuery extends PageQuery {
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class DataSourcesService {
  private readonly http = inject(HttpClient);

  list(query: DataSourceQuery = {}): Observable<PageResult<DataSource>> {
    return this.http.get<PageResult<DataSource>>('/datasources/list', {
      params: this.toParams(query),
    });
  }

  save(payload: SaveDataSourcePayload, guid?: string): Observable<DataSource> {
    if (guid) {
      return this.http.put<DataSource>(`/datasources/${guid}`, payload);
    }
    return this.http.post<DataSource>('/datasources', payload);
  }

  delete(guid: string): Observable<boolean> {
    return this.http.delete<boolean>(`/datasources/${guid}`);
  }

  test(guid: string): Observable<boolean> {
    return this.http.post<boolean>(`/datasources/${guid}/test`, {});
  }

  private toParams(query: DataSourceQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
