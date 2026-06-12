import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import {
  ColumnInfo,
  DataSource,
  FieldMapping,
  SaveSyncTaskPayload,
  TableInfo,
  ValidateSyncTaskResult,
} from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
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
  selector: 'app-sync-task-create',
  templateUrl: './sync-task-create.component.html',
  styleUrls: ['./sync-task-create.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncTaskCreateComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly taskService = inject(SyncTasksService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected dataSources: DataSource[] = [];
  protected sourceTables: TableInfo[] = [];
  protected targetTables: TableInfo[] = [];
  protected sourceColumns: ColumnInfo[] = [];
  protected targetColumns: ColumnInfo[] = [];
  protected saving = false;
  protected sourceTableLoading = false;
  protected targetTableLoading = false;
  protected sourceColumnLoading = false;
  protected targetColumnLoading = false;
  protected validationLoading = false;
  protected formError = '';
  protected fieldError = '';
  protected validationResult: ValidateSyncTaskResult | null = null;
  protected columnDrawerVisible = false;
  protected columnDrawerKind: 'source' | 'target' = 'source';

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
  }

  protected resetForm(): void {
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

  protected goList(): void {
    this.router.navigate(['/sync/tasks/list']);
  }

  protected get scheduleEnabled(): boolean {
    return Number(this.form.controls.scheduleOn.value) === 1;
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

  protected openColumnDrawer(kind: 'source' | 'target'): void {
    const table =
      kind === 'source' ? this.form.controls.sourceTable.value : this.form.controls.targetTable.value;
    if (!table?.trim()) {
      this.message.warning(kind === 'source' ? '请先选择源表' : '请先选择目标表');
      return;
    }
    this.columnDrawerKind = kind;
    this.columnDrawerVisible = true;
    const columns = kind === 'source' ? this.sourceColumns : this.targetColumns;
    if (columns.length === 0) {
      this.loadColumns(kind, table);
    }
  }

  protected closeColumnDrawer(): void {
    this.columnDrawerVisible = false;
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
      .save(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('同步任务已创建');
          this.goList();
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

  protected columnSummary(columns: ColumnInfo[]): string {
    if (columns.length === 0) return '未读取';
    return columns.map((column) => column.name).join(', ');
  }

  protected drawerTitle(): string {
    const prefix = this.columnDrawerKind === 'source' ? '源表字段' : '目标表字段';
    const table =
      this.columnDrawerKind === 'source'
        ? this.form.controls.sourceTable.value
        : this.form.controls.targetTable.value;
    return table ? `${prefix} · ${table}` : prefix;
  }

  protected drawerColumns(): ColumnInfo[] {
    return this.columnDrawerKind === 'source' ? this.sourceColumns : this.targetColumns;
  }

  protected drawerLoading(): boolean {
    return this.columnDrawerKind === 'source'
      ? this.sourceColumnLoading
      : this.targetColumnLoading;
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
}
