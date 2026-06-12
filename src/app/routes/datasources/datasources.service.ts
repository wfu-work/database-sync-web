import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ColumnInfo,
  DataSource,
  DatabaseDetail,
  PreviewTableRequest,
  SaveDataSourcePayload,
  TableInfo,
  TablePreviewResult,
} from '@shared/types/datasync';
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

  test(guid: string): Observable<DataSource> {
    return this.http.post<DataSource>(`/datasources/${guid}/test`, {});
  }

  tables(guid: string): Observable<TableInfo[]> {
    return this.http.get<TableInfo[]>(`/datasources/${guid}/tables`);
  }

  databaseDetail(guid: string): Observable<DatabaseDetail> {
    return this.http.get<DatabaseDetail>(`/datasources/${guid}/database-detail`);
  }

  columns(guid: string, table: string): Observable<ColumnInfo[]> {
    return this.http.get<ColumnInfo[]>(`/datasources/${guid}/columns`, {
      params: this.toParams({ table }),
    });
  }

  preview(guid: string, payload: PreviewTableRequest): Observable<TablePreviewResult> {
    return this.http.post<TablePreviewResult>(`/datasources/${guid}/preview`, payload);
  }

  private toParams(query: DataSourceQuery | { table: string }): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params = params.set(key, String(value));
    });
    return params;
  }
}
