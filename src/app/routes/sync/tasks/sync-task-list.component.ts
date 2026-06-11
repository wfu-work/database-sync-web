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
import { DataSource, FieldMapping, SaveSyncTaskPayload, SyncTask } from '@shared/types/datasync';
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
  };

  protected data: SyncTask[] = [];
  protected dataSources: DataSource[] = [];
  protected total = 0;
  protected loading = false;
  protected saving = false;
  protected runningGuid = '';
  protected editing: SyncTask | null = null;
  protected fieldError = '';
  protected readonly columns: Array<STColumn<SyncTask>> = [
    { title: '任务', index: 'name', render: 'taskRender' },
    { title: '数据链路', index: 'sourceGuid', render: 'routeRender' },
    { title: '同步策略', index: 'mode', render: 'strategyRender' },
    { title: '最近运行', index: 'lastRunStatus', render: 'lastRunRender', width: 140 },
    { title: '操作', render: 'actionsRender', width: 260 },
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
    fieldsText: [JSON.stringify(FIELD_SAMPLE, null, 2), [Validators.required]],
    remark: ['', [Validators.maxLength(512)]],
    status: [1, [Validators.required]],
  });

  ngOnInit(): void {
    this.loadDataSources();
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
    this.getData();
  }

  protected create(): void {
    this.editing = null;
    this.fieldError = '';
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
      fieldsText: JSON.stringify(FIELD_SAMPLE, null, 2),
      remark: '',
      status: 1,
    });
  }

  protected edit(item: SyncTask): void {
    this.editing = item;
    this.fieldError = '';
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
      fieldsText: this.prettyFields(item.fieldMapping),
      remark: item.remark ?? '',
      status: item.status ?? 1,
    });
  }

  protected insertSample(): void {
    this.form.controls.fieldsText.setValue(JSON.stringify(FIELD_SAMPLE, null, 2));
    this.fieldError = '';
  }

  protected submit(): void {
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
      .save(payload, this.editing?.guid)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success(this.editing ? '同步任务已更新' : '同步任务已创建');
          this.create();
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存同步任务失败'),
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

  private toPayload(): SaveSyncTaskPayload | null {
    const value = this.form.getRawValue();
    if (value.mode === 'incremental' && !value.cursorField.trim()) {
      this.fieldError = '增量同步必须填写游标字段';
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
      remark: value.remark.trim(),
      status: Number(value.status),
    };
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
