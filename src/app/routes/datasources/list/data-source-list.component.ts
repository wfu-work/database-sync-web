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
import { ColumnInfo, DataSource, DataSourceType, MapperRow, TableInfo } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../datasources.service';

@Component({
  selector: 'app-data-source-list',
  templateUrl: './data-source-list.component.html',
  styleUrls: ['./data-source-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DataSourceListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    type: '',
    status: '',
  };

  protected data: DataSource[] = [];
  protected total = 0;
  protected loading = false;
  protected testingGuid = '';
  protected inspecting: DataSource | null = null;
  protected inspectorVisible = false;
  protected tables: TableInfo[] = [];
  protected schemaColumns: ColumnInfo[] = [];
  protected previewRows: MapperRow[] = [];
  protected previewColumns: string[] = [];
  protected tableLoading = false;
  protected columnsLoading = false;
  protected previewLoading = false;
  protected readonly columns: Array<STColumn<DataSource>> = [
    { title: '数据源', index: 'name', render: 'nameRender', width: 200 },
    { title: '连接', index: 'host', render: 'connectionRender', width: 200 },
    { title: '连接状态', index: 'connectionStatus', render: 'connectionStatusRender', width: 90 },
    { title: '状态', index: 'status', render: 'statusRender', width: 65 },
    { title: '更新时间', index: 'updateTime', render: 'timeRender', width: 140 },
    { title: '操作', render: 'actionsRender', width: 140 },
  ];

  protected readonly previewForm = this.fb.group({
    table: ['', [Validators.required]],
    whereClause: [''],
    limit: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    this.service
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
    this.q.type = '';
    this.q.status = '';
    this.getData();
  }

  protected goCreate(): void {
    this.router.navigate(['/datasources/create']);
  }

  protected edit(item: DataSource): void {
    this.router.navigate(['/datasources/edit', item.guid], { state: { dataSource: item } });
  }

  protected test(item: DataSource): void {
    this.testingGuid = item.guid;
    this.service
      .test(item.guid)
      .pipe(
        finalize(() => {
          this.testingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.message.success('连接测试通过'),
        error: (err) => this.message.error(err?.msg || err?.message || '连接测试失败'),
      });
  }

  protected openInspector(item: DataSource): void {
    this.inspecting = item;
    this.inspectorVisible = true;
    this.tables = [];
    this.schemaColumns = [];
    this.previewRows = [];
    this.previewColumns = [];
    this.previewForm.reset({ table: '', whereClause: '', limit: 20 });
    this.loadTables();
  }

  protected closeInspector(): void {
    this.inspectorVisible = false;
  }

  protected loadTables(): void {
    if (!this.inspecting) return;
    this.tableLoading = true;
    this.service
      .tables(this.inspecting.guid)
      .pipe(
        finalize(() => {
          this.tableLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          this.tables = items ?? [];
          const first = this.tables[0]?.name ?? '';
          if (first) {
            this.previewForm.controls.table.setValue(first);
            this.onTableChange(first);
          }
        },
        error: (err) => this.message.error(err?.msg || err?.message || '获取表列表失败'),
      });
  }

  protected onTableChange(table: string): void {
    this.schemaColumns = [];
    this.previewRows = [];
    this.previewColumns = [];
    const current = table?.trim();
    if (!this.inspecting || !current) return;
    this.columnsLoading = true;
    this.service
      .columns(this.inspecting.guid, current)
      .pipe(
        finalize(() => {
          this.columnsLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          this.schemaColumns = items ?? [];
          if (this.previewRows.length > 0) {
            this.previewColumns = this.previewColumnNames(this.previewRows);
          }
        },
        error: (err) => this.message.error(err?.msg || err?.message || '获取字段失败'),
      });
  }

  protected previewData(): void {
    if (!this.inspecting) return;
    if (this.previewForm.invalid) {
      Object.values(this.previewForm.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }
    const value = this.previewForm.getRawValue();
    this.previewLoading = true;
    this.service
      .preview(this.inspecting.guid, {
        table: value.table.trim(),
        whereClause: value.whereClause.trim(),
        limit: value.limit,
      })
      .pipe(
        finalize(() => {
          this.previewLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.previewRows = res.rows ?? [];
          this.previewColumns = this.previewColumnNames(this.previewRows);
          if (this.previewRows.length === 0) this.message.info('当前条件下没有预览数据');
        },
        error: (err) => this.message.error(err?.msg || err?.message || '预览数据失败'),
      });
  }

  protected remove(item: DataSource): void {
    this.modal.confirm({
      nzTitle: '删除数据源',
      nzContent: `确定删除「${item.name}」吗？已被同步任务引用的数据源后端会拒绝删除。`,
      nzOkDanger: true,
      nzOkText: '删除',
      nzCancelText: '取消',
      nzOnOk: () =>
        this.service.delete(item.guid).subscribe({
          next: () => {
            this.message.success('数据源已删除');
            this.getData();
          },
          error: (err) => this.message.error(err?.msg || err?.message || '删除数据源失败'),
        }),
    });
  }

  protected sourceTypeLabel(type: string): string {
    return this.normalizeType(type) === 'tdengine' ? 'TDengine' : 'MySQL';
  }

  protected statusLabel(status: number): string {
    return status === 1 ? '启用' : '禁用';
  }

  protected connectionStatusLabel(status?: string): string {
    switch (status) {
      case 'checking':
        return '检查中';
      case 'connected':
        return '正常';
      case 'failed':
        return '异常';
      default:
        return '未检查';
    }
  }

  protected connectionStatusTooltip(item: DataSource): string {
    const checkedAt = this.formatTime(item.connectionCheckedAt);
    if (item.connectionStatus === 'failed' && item.connectionError) {
      return `${checkedAt} · ${item.connectionError}`;
    }
    return checkedAt === '-' ? '等待定时检查' : `最后检查：${checkedAt}`;
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  protected cellText(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private previewColumnNames(rows: MapperRow[]): string[] {
    const schemaNames = this.schemaColumns
      .map((column) => column.name?.trim())
      .filter((name): name is string => !!name);
    const schemaSet = new Set(schemaNames.map((name) => name.toLowerCase()));
    const keys = new Set<string>();
    rows.forEach((row) =>
      Object.keys(row).forEach((key) => {
        if (!schemaSet.has(key.toLowerCase())) keys.add(key);
      }),
    );
    return [...schemaNames, ...Array.from(keys)];
  }

  private normalizeType(type: string): DataSourceType {
    return type === 'tdengine' || type === 'td' || type === 'taos' ? 'tdengine' : 'mysql';
  }

  protected isConnectionStatus(item: DataSource, status: string): boolean {
    return (item.connectionStatus || 'unknown') === status;
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
