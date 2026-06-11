export type DataSourceType = 'mysql' | 'tdengine';
export type SyncMode = 'full' | 'incremental';
export type WriteMode = 'insert' | 'upsert' | 'replace';
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

export interface BaseEntity {
  guid: string;
  createTime: number;
  updateTime: number;
}

export interface DataSource extends BaseEntity {
  name: string;
  type: DataSourceType | string;
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
  params: string;
  remark: string;
  status: number;
}

export interface SaveDataSourcePayload {
  guid?: string;
  name: string;
  type: DataSourceType;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  params?: string;
  remark?: string;
  status?: number;
}

export interface FieldMapping {
  source?: string;
  target: string;
  default?: unknown;
  transform?: string;
}

export interface SyncTask extends BaseEntity {
  name: string;
  sourceGuid: string;
  targetGuid: string;
  sourceTable: string;
  targetTable: string;
  mode: SyncMode | string;
  cursorField: string;
  cursorValue: string;
  batchSize: number;
  fieldMapping: string;
  writeMode: WriteMode | string;
  conflictKeys: string;
  whereClause: string;
  lastRunGuid: string;
  lastRunStatus: RunStatus | string;
  remark: string;
  status: number;
}

export interface SaveSyncTaskPayload {
  guid?: string;
  name: string;
  sourceGuid: string;
  targetGuid: string;
  sourceTable: string;
  targetTable: string;
  mode: SyncMode;
  cursorField?: string;
  cursorValue?: string;
  batchSize: number;
  fields: FieldMapping[];
  writeMode: WriteMode;
  conflictKeys?: string;
  whereClause?: string;
  remark?: string;
  status?: number;
}

export interface SyncRun extends BaseEntity {
  taskGuid: string;
  taskName: string;
  status: RunStatus | string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  cursorStart: string;
  cursorEnd: string;
  lastError: string;
}

export interface SyncProgress {
  guid: string;
  taskGuid: string;
  status: RunStatus | string;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  progress: number;
  cursorStart: string;
  cursorEnd: string;
  lastError: string;
}

export interface SyncError extends BaseEntity {
  runGuid: string;
  taskGuid: string;
  sourcePk: string;
  sourceData: string;
  errorMessage: string;
}
