import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import {
  ColumnInfo,
  DataSource,
  FieldMapping,
  MapperRow,
  SaveSyncTaskPayload,
  ScheduleItem,
  SyncTask,
  SyncTaskPreviewResult,
  TableInfo,
  ValidateSyncTaskResult,
} from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../datasources/datasources.service';
import { SyncTasksService } from '../sync-tasks.service';

const FIELD_SAMPLE = [
  { source: 'created_at', target: 'ts', transform: 'time_to_millis' },
  { source: 'device_id', target: 'device_id' },
  { source: 'temperature', target: 'temperature', transform: 'float' },
  { target: 'source_type', default: 'mysql' },
];

@Component({
  selector: 'app-sync-task-list',
  templateUrl: './sync-task-list.component.html',
  styleUrls: ['./sync-task-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncTaskListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly taskService = inject(SyncTasksService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    mode: '',
    status: '',
    scheduleOn: '',
  };

  protected data: SyncTask[] = [];
  protected dataSources: DataSource[] = [];
  protected sourceTables: TableInfo[] = [];
  protected targetTables: TableInfo[] = [];
  protected sourceColumns: ColumnInfo[] = [];
  protected targetColumns: ColumnInfo[] = [];
  protected schedules: ScheduleItem[] = [];
  protected total = 0;
  protected loading = false;
  protected saving = false;
  protected sourceTableLoading = false;
  protected targetTableLoading = false;
  protected sourceColumnLoading = false;
  protected targetColumnLoading = false;
  protected validationLoading = false;
  protected previewLoading = false;
  protected scheduleLoading = false;
  protected runningGuid = '';
  protected stoppingGuid = '';
  protected validatingGuid = '';
  protected previewingGuid = '';
  protected editing: SyncTask | null = null;
  protected formError = '';
  protected fieldError = '';
  protected validationResult: ValidateSyncTaskResult | null = null;
  protected previewVisible = false;
  protected previewResult: SyncTaskPreviewResult | null = null;
  protected sourcePreviewColumns: string[] = [];
  protected mappedPreviewColumns: string[] = [];
  protected readonly columns: Array<STColumn<SyncTask>> = [
    { title: '任务', index: 'name', render: 'taskRender' },
    { title: '数据链路', index: 'sourceGuid', render: 'routeRender' },
    { title: '同步策略', index: 'mode', render: 'strategyRender' },
    { title: '最近运行', index: 'lastRunStatus', render: 'lastRunRender', width: 140 },
    { title: '操作', render: 'actionsRender', width: 390 },
  ];

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    sourceGuid: ['', [Validators.required]],
    targetGuid: ['', [Validators.required]],
    sourceTable: ['', [Validators.required, Validators.maxLength(255)]],
    targetTable: ['', [Validators.required, Validators.maxLength(255)]],
    mode: this.fb.control<'full' | 'incremental'>('full', [Validators.required]),
    cursorField: ['', [Validators.maxLength(128)]],
    cursorValue: ['', [Validators.maxLength(255)]],
    batchSize: [1000, [Validators.required, Validators.min(1)]],
    writeMode: this.fb.control<'insert' | 'upsert' | 'replace'>('insert', [Validators.required]),
    conflictKeys: ['', [Validators.maxLength(512)]],
    whereClause: [''],
    scheduleOn: [0, [Validators.required]],
    cronExpr: ['', [Validators.maxLength(128)]],
    fieldsText: [JSON.stringify(FIELD_SAMPLE, null, 2), [Validators.required]],
    remark: ['', [Validators.maxLength(512)]],
    status: [1, [Validators.required]],
  });

  ngOnInit(): void {
    this.loadDataSources();
    this.loadSchedules();
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    this.taskService
      .list(this.q)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.data = res.data ?? [];
        this.total = res.total ?? 0;
        this.q.page = res.page || this.q.page;
        this.q.size = res.size || this.q.size;
      });
  }

  protected search(): void {
    this.q.page = 1;
    this.getData();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.mode = '';
    this.q.status = '';
    this.q.scheduleOn = '';
    this.getData();
  }

  protected resetForm(): void {
    this.editing = null;
    this.formError = '';
    this.fieldError = '';
    this.validationResult = null;
    this.resetMetadata();
    this.form.reset({
      name: '',
      sourceGuid: '',
      targetGuid: '',
      sourceTable: '',
      targetTable: '',
      mode: 'full',
      cursorField: '',
      cursorValue: '',
      batchSize: 1000,
      writeMode: 'insert',
      conflictKeys: '',
      whereClause: '',
      scheduleOn: 0,
      cronExpr: '',
      fieldsText: JSON.stringify(FIELD_SAMPLE, null, 2),
      remark: '',
      status: 1,
    });
  }

  protected goCreate(): void {
    this.router.navigate(['/sync/tasks/create']);
  }

  protected get scheduleEnabled(): boolean {
    return Number(this.form.controls.scheduleOn.value) === 1;
  }

  protected edit(item: SyncTask): void {
    this.editing = item;
    this.formError = '';
    this.fieldError = '';
    this.validationResult = null;
    this.form.reset({
      name: item.name,
      sourceGuid: item.sourceGuid,
      targetGuid: item.targetGuid,
      sourceTable: item.sourceTable,
      targetTable: item.targetTable,
      mode: item.mode === 'incremental' ? 'incremental' : 'full',
      cursorField: item.cursorField ?? '',
      cursorValue: item.cursorValue ?? '',
      batchSize: item.batchSize || 1000,
      writeMode: this.normalizeWriteMode(item.writeMode),
      conflictKeys: item.conflictKeys ?? '',
      whereClause: item.whereClause ?? '',
      scheduleOn: item.scheduleOn ?? 0,
      cronExpr: item.cronExpr ?? '',
      fieldsText: this.prettyFields(item.fieldMapping),
      remark: item.remark ?? '',
      status: item.status ?? 1,
    });
    this.loadTables('source', item.sourceTable);
    this.loadTables('target', item.targetTable);
  }

  protected insertSample(): void {
    this.form.controls.fieldsText.setValue(JSON.stringify(FIELD_SAMPLE, null, 2));
    this.fieldError = '';
  }

  protected onSourceDataSourceChange(guid: string): void {
    this.form.controls.sourceTable.setValue('');
    this.form.controls.cursorField.setValue('');
    this.sourceTables = [];
    this.sourceColumns = [];
    if (guid) this.loadTables('source');
  }

  protected onTargetDataSourceChange(guid: string): void {
    this.form.controls.targetTable.setValue('');
    this.targetTables = [];
    this.targetColumns = [];
    if (guid) this.loadTables('target');
  }

  protected onSourceTableChange(table: string): void {
    this.sourceColumns = [];
    if (table) this.loadColumns('source', table);
  }

  protected onTargetTableChange(table: string): void {
    this.targetColumns = [];
    if (table) this.loadColumns('target', table);
  }

  protected refreshSourceTables(): void {
    this.loadTables('source', this.form.controls.sourceTable.value);
  }

  protected refreshTargetTables(): void {
    this.loadTables('target', this.form.controls.targetTable.value);
  }

  protected generateSameNameMapping(): void {
    if (this.sourceColumns.length === 0 || this.targetColumns.length === 0) {
      this.message.warning('请先选择源表和目标表，读取字段后再生成映射');
      return;
    }

    const sourceMap = new Map(
      this.sourceColumns.map((column) => [column.name.toLowerCase(), column.name] as const),
    );
    const fields = this.targetColumns
      .map((target) => {
        const source = sourceMap.get(target.name.toLowerCase());
        if (!source) return null;
        return { source, target: target.name };
      })
      .filter((field): field is { source: string; target: string } => field !== null);

    if (fields.length === 0) {
      this.message.warning('源表和目标表没有同名字段');
      return;
    }
    this.form.controls.fieldsText.setValue(JSON.stringify(fields, null, 2));
    this.fieldError = '';
    this.message.success(`已生成 ${fields.length} 个同名字段映射`);
  }

  protected submit(): void {
    if (!this.editing) return;
    this.formError = '';
    this.fieldError = '';
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }

    const payload = this.toPayload();
    if (!payload) return;

    this.saving = true;
    this.taskService
      .save(payload, this.editing.guid)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('同步任务已更新');
          this.resetForm();
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存同步任务失败'),
      });
  }

  protected validateForm(): void {
    this.formError = '';
    this.fieldError = '';
    const payload = this.toPayload();
    if (!payload) return;

    this.validationLoading = true;
    this.taskService
      .validate(payload)
      .pipe(
        finalize(() => {
          this.validationLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => this.showValidation(res),
        error: (err) => this.message.error(err?.msg || err?.message || '校验同步任务失败'),
      });
  }

  protected run(item: SyncTask): void {
    this.runningGuid = item.guid;
    this.taskService
      .run(item.guid)
      .pipe(
        finalize(() => {
          this.runningGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (run) => {
          this.message.success('同步任务已开始执行');
          this.router.navigate(['/sync/runs', run.guid]);
        },
        error: (err) => this.message.error(err?.msg || err?.message || '启动同步任务失败'),
      });
  }

  protected stop(item: SyncTask): void {
    this.modal.confirm({
      nzTitle: '停止同步任务',
      nzContent: `确定请求停止「${item.name}」当前正在执行的同步吗？`,
      nzOkText: '停止',
      nzOkDanger: true,
      nzCancelText: '取消',
      nzOnOk: () => {
        this.stoppingGuid = item.guid;
        this.taskService
          .stop(item.guid)
          .pipe(
            finalize(() => {
              this.stoppingGuid = '';
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: () => {
              this.message.success('已请求停止同步任务');
              this.getData();
            },
            error: (err) => this.message.error(err?.msg || err?.message || '停止同步任务失败'),
          });
      },
    });
  }

  protected validateTask(item: SyncTask): void {
    this.edit(item);
    this.validatingGuid = item.guid;
    this.taskService
      .validateSaved(item.guid)
      .pipe(
        finalize(() => {
          this.validatingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => this.showValidation(res),
        error: (err) => this.message.error(err?.msg || err?.message || '校验同步任务失败'),
      });
  }

  protected previewTask(item: SyncTask): void {
    this.previewVisible = true;
    this.previewResult = null;
    this.sourcePreviewColumns = [];
    this.mappedPreviewColumns = [];
    this.previewingGuid = item.guid;
    this.previewLoading = true;
    this.taskService
      .preview(item.guid, { limit: 20 })
      .pipe(
        finalize(() => {
          this.previewingGuid = '';
          this.previewLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.previewResult = res;
          this.sourcePreviewColumns = this.rowKeys(res.sourceRows ?? []);
          this.mappedPreviewColumns = this.rowKeys(res.mappedRows ?? []);
          if (!res.count) this.message.info('当前任务没有可预览的数据');
        },
        error: (err) => this.message.error(err?.msg || err?.message || '预览同步任务失败'),
      });
  }

  protected closePreview(): void {
    this.previewVisible = false;
  }

  protected reloadSchedules(): void {
    this.scheduleLoading = true;
    this.taskService
      .reloadSchedules()
      .pipe(
        finalize(() => {
          this.scheduleLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('调度已重载');
          this.loadSchedules();
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '重载调度失败'),
      });
  }

  protected remove(item: SyncTask): void {
    this.modal.confirm({
      nzTitle: '删除同步任务',
      nzContent: `确定删除「${item.name}」吗？历史运行记录不会随前端一起清理。`,
      nzOkDanger: true,
      nzOkText: '删除',
      nzCancelText: '取消',
      nzOnOk: () =>
        this.taskService.delete(item.guid).subscribe({
          next: () => {
            this.message.success('同步任务已删除');
            this.getData();
          },
          error: (err) => this.message.error(err?.msg || err?.message || '删除同步任务失败'),
        }),
    });
  }

  protected sourceName(guid: string): string {
    return this.dataSources.find((item) => item.guid === guid)?.name || guid || '-';
  }

  protected modeLabel(mode: string): string {
    return mode === 'incremental' ? '增量' : '全量';
  }

  protected statusLabel(status: number): string {
    return status === 1 ? '启用' : '禁用';
  }

  protected runStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '运行中',
      success: '成功',
      failed: '失败',
      canceled: '取消',
    };
    return map[status] || '-';
  }

  protected scheduleLabel(item: SyncTask): string {
    return Number(item.scheduleOn) === 1 ? item.cronExpr || '已启用' : '手动';
  }

  protected isRunning(item: SyncTask): boolean {
    return item.lastRunStatus === 'running';
  }

  protected cellText(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  protected columnSummary(columns: ColumnInfo[]): string {
    if (columns.length === 0) return '未读取';
    return columns.map((column) => column.name).join(', ');
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  private loadDataSources(): void {
    this.dataSourcesService.list({ all: true }).subscribe((res) => {
      this.dataSources = res.data ?? [];
      this.cdr.markForCheck();
    });
  }

  private loadTables(kind: 'source' | 'target', selectedTable = ''): void {
    const guid =
      kind === 'source' ? this.form.controls.sourceGuid.value : this.form.controls.targetGuid.value;
    if (!guid) return;

    if (kind === 'source') {
      this.sourceTableLoading = true;
    } else {
      this.targetTableLoading = true;
    }

    this.dataSourcesService
      .tables(guid)
      .pipe(
        finalize(() => {
          if (kind === 'source') {
            this.sourceTableLoading = false;
          } else {
            this.targetTableLoading = false;
          }
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          const currentGuid =
            kind === 'source'
              ? this.form.controls.sourceGuid.value
              : this.form.controls.targetGuid.value;
          if (currentGuid !== guid) return;

          if (kind === 'source') {
            this.sourceTables = items ?? [];
          } else {
            this.targetTables = items ?? [];
          }

          const table = selectedTable || '';
          if (table) {
            this.loadColumns(kind, table);
          }
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取数据表失败'),
      });
  }

  private loadColumns(kind: 'source' | 'target', table: string): void {
    const guid =
      kind === 'source' ? this.form.controls.sourceGuid.value : this.form.controls.targetGuid.value;
    table = table.trim();
    if (!guid || !table) return;

    if (kind === 'source') {
      this.sourceColumnLoading = true;
    } else {
      this.targetColumnLoading = true;
    }

    this.dataSourcesService
      .columns(guid, table)
      .pipe(
        finalize(() => {
          if (kind === 'source') {
            this.sourceColumnLoading = false;
          } else {
            this.targetColumnLoading = false;
          }
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          const currentGuid =
            kind === 'source'
              ? this.form.controls.sourceGuid.value
              : this.form.controls.targetGuid.value;
          const currentTable =
            kind === 'source'
              ? this.form.controls.sourceTable.value
              : this.form.controls.targetTable.value;
          if (currentGuid !== guid || currentTable !== table) return;

          if (kind === 'source') {
            this.sourceColumns = items ?? [];
          } else {
            this.targetColumns = items ?? [];
          }
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取字段失败'),
      });
  }

  private resetMetadata(): void {
    this.sourceTables = [];
    this.targetTables = [];
    this.sourceColumns = [];
    this.targetColumns = [];
  }

  private loadSchedules(): void {
    this.taskService.schedules().subscribe({
      next: (items) => {
        this.schedules = items ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.schedules = [];
        this.cdr.markForCheck();
      },
    });
  }

  private toPayload(): SaveSyncTaskPayload | null {
    const value = this.form.getRawValue();
    const scheduleOn = Number(value.scheduleOn);
    if (scheduleOn === 1 && !value.cronExpr.trim()) {
      this.formError = '启用定时执行时必须填写 Cron 表达式';
      return null;
    }
    if (value.mode === 'incremental' && !value.cursorField.trim()) {
      this.formError = '增量同步必须填写游标字段';
      return null;
    }

    const fields = this.parseFields(value.fieldsText);
    if (!fields) return null;

    return {
      name: value.name.trim(),
      sourceGuid: value.sourceGuid,
      targetGuid: value.targetGuid,
      sourceTable: value.sourceTable.trim(),
      targetTable: value.targetTable.trim(),
      mode: value.mode,
      cursorField: value.cursorField.trim(),
      cursorValue: value.cursorValue.trim(),
      batchSize: value.batchSize,
      fields,
      writeMode: value.writeMode,
      conflictKeys: value.conflictKeys.trim(),
      whereClause: value.whereClause.trim(),
      cronExpr: scheduleOn === 1 ? value.cronExpr.trim() : '',
      scheduleOn,
      remark: value.remark.trim(),
      status: Number(value.status),
    };
  }

  private showValidation(result: ValidateSyncTaskResult): void {
    this.validationResult = result;
    if (result.valid) {
      this.message.success('同步任务配置校验通过');
    } else {
      this.message.warning('同步任务配置存在问题');
    }
  }

  private rowKeys(rows: MapperRow[]): string[] {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return Array.from(keys);
  }

  private parseFields(value: string): FieldMapping[] | null {
    try {
      const fields = JSON.parse(value) as FieldMapping[];
      if (!Array.isArray(fields) || fields.length === 0) {
        this.fieldError = '字段映射必须是非空数组';
        return null;
      }
      const invalidIndex = fields.findIndex(
        (field) => !field.target || (!field.source && field.default === undefined),
      );
      if (invalidIndex >= 0) {
        this.fieldError = `第 ${invalidIndex + 1} 个字段必须包含 target，并提供 source 或 default`;
        return null;
      }
      return fields;
    } catch {
      this.fieldError = '字段映射不是合法 JSON';
      return null;
    }
  }

  private prettyFields(value: string): string {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value || JSON.stringify(FIELD_SAMPLE, null, 2);
    }
  }

  private normalizeWriteMode(value: string): 'insert' | 'upsert' | 'replace' {
    if (value === 'upsert' || value === 'replace') return value;
    return 'insert';
  }

  protected tableChange(event: STChange): void {
    switch (event.type) {
      case 'pi':
      case 'ps':
      case 'filter':
      case 'sort':
        this.q.page = event.pi;
        this.q.size = event.ps;
        this.getData();
        break;
      default:
        break;
    }
  }
}
