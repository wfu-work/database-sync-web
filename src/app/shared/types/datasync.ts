export type DataSourceType = 'mysql' | 'tdengine';
export type SyncMode = 'full' | 'incremental';
export type WriteMode = 'insert' | 'upsert' | 'replace';
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';
export type BackupStatus = 'pending' | 'running' | 'success' | 'failed';
export type DataSourceConnectionStatus = 'unknown' | 'checking' | 'connected' | 'failed';
export type EventNotificationLevel = 'info' | 'warning' | 'error';
export type MapperRow = Record<string, unknown>;

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
  connectionStatus?: DataSourceConnectionStatus | string;
  connectionCheckedAt?: number;
  connectionError?: string;
  status: number;
}

export interface TableInfo {
  name: string;
  type: string;
  comment: string;
}

export interface ColumnInfo {
  name: string;
  databaseType: string;
  nullable: boolean;
  primaryKey: boolean;
  comment: string;
}

export interface PreviewTableRequest {
  table: string;
  whereClause?: string;
  limit?: number;
}

export interface TablePreviewResult {
  rows: MapperRow[];
  count: number;
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
  cronExpr: string;
  scheduleOn: number;
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
  cronExpr?: string;
  scheduleOn?: number;
  remark?: string;
  status?: number;
}

export interface ValidateSyncTaskResult {
  valid: boolean;
  errors: string[];
  sourceColumns: ColumnInfo[];
  targetColumns: ColumnInfo[];
  missingSourceFields: string[];
  missingTargetFields: string[];
  estimatedSourceCount: number;
  fieldMappingRowCount: number;
  sourceDatasourceGuid: string;
  targetDatasourceGuid: string;
  sourceTable: string;
  targetTable: string;
}

export interface SyncTaskPreviewRequest {
  limit?: number;
}

export interface SyncTaskPreviewResult {
  sourceRows: MapperRow[];
  mappedRows: MapperRow[];
  count: number;
}

export interface ScheduleItem {
  taskGuid: string;
  taskName: string;
  cronExpr: string;
  entryId: number;
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

export interface DatabaseBackup extends BaseEntity {
  dataSourceGuid: string;
  dataSourceName: string;
  dataSourceType: DataSourceType | string;
  database: string;
  tables: string;
  format: string;
  status: BackupStatus | string;
  totalTables: number;
  finishedTables: number;
  currentTable: string;
  currentRows: number;
  currentTotal: number;
  currentBatch: number;
  currentStarted: number;
  totalRows: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  lastError: string;
  remark: string;
}

export interface StartDatabaseBackupPayload {
  dataSourceGuid: string;
  tables?: string[];
  batchSize?: number;
  remark?: string;
}

export interface EventNotification extends BaseEntity {
  type: string;
  level: EventNotificationLevel | string;
  title: string;
  content: string;
  sourceType: string;
  sourceGuid: string;
  sourceName: string;
  read: number;
  eventTime: number;
}
