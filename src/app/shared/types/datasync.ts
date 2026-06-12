export type DataSourceType = 'mysql' | 'tdengine';
export type SyncMode = 'full' | 'incremental';
export type WriteMode = 'insert' | 'upsert' | 'replace';
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';
export type BackupStatus = 'pending' | 'running' | 'success' | 'failed';
export type RestoreStatus = 'pending' | 'running' | 'success' | 'failed';
export type DataSourceConnectionStatus = 'unknown' | 'checking' | 'connected' | 'failed';
export type EventNotificationLevel = 'info' | 'warning' | 'error';
export type WebSocketEventType = 'backup.updated' | 'datasource.updated' | 'notification.created';
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
  isTag: boolean;
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

export interface MetricItem {
  label: string;
  value: string;
  unit: string;
  hint: string;
}

export interface DatabaseBasicInfo {
  name: string;
  type: DataSourceType | string;
  version: string;
  charset: string;
  collation: string;
  serverTime: string;
  uptimeSeconds: number;
  metrics: MetricItem[];
}

export interface DatabaseConnectionInfo {
  host: string;
  port: number;
  username: string;
  database: string;
  endpoint: string;
  currentUser: string;
  connectionId: string;
  maxConnections: number;
  threadsRunning: number;
  threadsConnected: number;
  metrics: MetricItem[];
}

export interface DatabaseStorageInfo {
  totalBytes: number;
  dataBytes: number;
  indexBytes: number;
  freeBytes: number;
  metrics: MetricItem[];
}

export interface TableStat {
  name: string;
  type: string;
  rows: number;
  dataBytes: number;
  indexBytes: number;
  createdAt: string;
  updatedAt: string;
  comment: string;
}

export interface DatabaseTableStats {
  totalTables: number;
  totalViews: number;
  totalRows: number;
  tables: TableStat[];
}

export interface DatabasePerformanceInfo {
  qps: number;
  slowQueries: number;
  queries: number;
  connections: number;
  openTables: number;
  cacheHitPercent: number;
  metrics: MetricItem[];
}

export interface DatabaseDetail {
  basic: DatabaseBasicInfo;
  connection: DatabaseConnectionInfo;
  storage: DatabaseStorageInfo;
  tableStats: DatabaseTableStats;
  performance: DatabasePerformanceInfo;
  warnings: string[] | null;
  checkedAt: number;
}

export interface ServiceRuntimeInfo {
  name: string;
  status: string;
  pid: number;
  startedAt: number;
  uptimeSeconds: number;
  workingDir: string;
  executable: string;
  goVersion: string;
  goos: string;
  compiler: string;
  numCpu: number;
  numGoroutine: number;
  allocBytes: number;
  sysBytes: number;
  heapAllocBytes: number;
  heapInuseBytes: number;
  lastGcPauseNano: number;
}

export interface ServerOSInfo {
  goos: string;
  numCpu: number;
  compiler: string;
  goVersion: string;
  numGoroutine: number;
}

export interface ServerCPUInfo {
  cpus: number[];
  cores: number;
}

export interface ServerRAMInfo {
  usedMb: number;
  usedGb: number;
  totalMb: number;
  totalGb: number;
  usedPercent: number;
}

export interface ServerDiskInfo {
  mountPoint: string;
  usedMb: number;
  usedGb: number;
  totalMb: number;
  totalGb: number;
  usedPercent: number;
}

export interface SystemMonitorInfo {
  service: ServiceRuntimeInfo;
  os: ServerOSInfo;
  cpu: ServerCPUInfo;
  ram: ServerRAMInfo;
  disk: ServerDiskInfo[];
  warnings: string[];
  checkedAt: number;
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

export interface TagMapping {
  name: string;
  source?: string;
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
  syncTimeField: string;
  syncStartDate: string;
  syncEndDate: string;
  tdengineChildTableTemplate: string;
  tdengineChildTableField: string;
  tdengineTags: string;
  cronExpr: string;
  scheduleOn: number;
  lastRunGuid: string;
  lastRunStatus: RunStatus | string;
  remark: string;
  status: number;
}

export interface SyncTemplate extends BaseEntity {
  name: string;
  description: string;
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
  syncTimeField: string;
  syncStartDate: string;
  syncEndDate: string;
  tdengineChildTableTemplate: string;
  tdengineChildTableField: string;
  tdengineTags: string;
  cronExpr: string;
  scheduleOn: number;
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
  syncTimeField?: string;
  syncStartDate?: string;
  syncEndDate?: string;
  tdengineChildTableTemplate?: string;
  tdengineChildTableField?: string;
  tdengineTags?: string;
  tdengineTagMappings?: TagMapping[];
  cronExpr?: string;
  scheduleOn?: number;
  remark?: string;
  status?: number;
}

export interface SaveSyncTemplatePayload extends SaveSyncTaskPayload {
  description?: string;
}

export interface SaveSyncTemplateFromTaskPayload {
  name?: string;
  description?: string;
  remark?: string;
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
  connectionParams: string;
  batchSize: number;
  retryTimes: number;
  retryIntervalMs: number;
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
  connectionParams?: string;
  retryTimes?: number;
  retryIntervalMs?: number;
  remark?: string;
}

export interface DatabaseRestore extends BaseEntity {
  backupGuid: string;
  backupName: string;
  sourceDataSourceGuid: string;
  sourceDataSourceName: string;
  targetDataSourceGuid: string;
  targetDataSourceName: string;
  targetDataSourceType: DataSourceType | string;
  targetDatabase: string;
  tables: string;
  batchSize: number;
  writeMode: WriteMode | string;
  createTable: boolean;
  truncateBeforeRestore: boolean;
  retryTimes: number;
  retryIntervalMs: number;
  status: RestoreStatus | string;
  totalTables: number;
  finishedTables: number;
  currentTable: string;
  currentRows: number;
  currentTotal: number;
  currentBatch: number;
  totalRows: number;
  successRows: number;
  failedRows: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  lastError: string;
  remark: string;
}

export interface StartDatabaseRestorePayload {
  backupGuid?: string;
  targetDataSourceGuid?: string;
  tables?: string[];
  batchSize?: number;
  writeMode?: WriteMode;
  createTable?: boolean;
  truncateBeforeRestore?: boolean;
  retryTimes?: number;
  retryIntervalMs?: number;
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

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType | string;
  data?: T;
  time: number;
}
