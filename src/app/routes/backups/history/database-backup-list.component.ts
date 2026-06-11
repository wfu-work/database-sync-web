import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, DatabaseBackup } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../datasources/datasources.service';
import { DatabaseBackupsService } from '../database-backups.service';

@Component({
  selector: 'app-database-backup-list',
  templateUrl: './database-backup-list.component.html',
  styleUrls: ['./database-backup-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DatabaseBackupListComponent implements OnInit, OnDestroy {
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    dataSourceGuid: '',
    status: '',
  };

  protected data: DatabaseBackup[] = [];
  protected dataSources: DataSource[] = [];
  protected selectedBackup: DatabaseBackup | null = null;
  protected total = 0;
  protected loading = false;
  protected detailVisible = false;
  protected detailLoading = false;
  protected downloadingGuid = '';

  protected readonly columns: Array<STColumn<DatabaseBackup>> = [
    { title: '备份记录', index: 'guid', render: 'backupRender' },
    { title: '数据源', index: 'dataSourceName', render: 'sourceRender', width: 180 },
    { title: '状态', index: 'status', render: 'statusRender', width: 160 },
    { title: '范围', index: 'totalTables', render: 'scopeRender', width: 180 },
    { title: '文件', index: 'fileSize', render: 'fileRender', width: 180 },
    { title: '时间', index: 'startTime', render: 'timeRender', width: 190 },
    { title: '操作', render: 'actionsRender', width: 150 },
  ];

  ngOnInit(): void {
    this.loadDataSources();
    this.getData();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }

  protected getData(): void {
    this.loading = true;
    this.clearRefreshTimer();
    this.backupsService
      .list(this.q)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.data = res.data ?? [];
          this.total = res.total ?? 0;
          this.q.page = res.page || this.q.page;
          this.q.size = res.size || this.q.size;
          this.scheduleRefreshIfNeeded();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取备份列表失败'),
      });
  }

  protected search(): void {
    this.q.page = 1;
    this.getData();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.dataSourceGuid = '';
    this.q.status = '';
    this.getData();
  }

  protected openDetail(item: DatabaseBackup): void {
    this.detailVisible = true;
    this.detailLoading = true;
    this.selectedBackup = item;
    this.backupsService
      .get(item.guid)
      .pipe(
        finalize(() => {
          this.detailLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.selectedBackup = res;
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取备份详情失败'),
      });
  }

  protected closeDetail(): void {
    this.detailVisible = false;
  }

  protected download(item: DatabaseBackup): void {
    this.downloadingGuid = item.guid;
    this.backupsService
      .download(item.guid)
      .pipe(
        finalize(() => {
          this.downloadingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => this.saveBlob(res.body, item.fileName || `${item.guid}.zip`),
        error: (err) => this.message.error(err?.msg || err?.message || '下载备份文件失败'),
      });
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '备份中',
      success: '成功',
      failed: '失败',
    };
    return map[status] || status || '-';
  }

  protected statusClass(status: string): string {
    if (status === 'success') return 'status-success';
    if (status === 'failed') return 'status-failed';
    if (status === 'running') return 'status-running';
    return 'status-idle';
  }

  protected parsedTables(value?: string): string[] {
    if (!value) return [];
    try {
      const tables = JSON.parse(value) as unknown;
      return Array.isArray(tables) ? tables.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  protected duration(value?: number): string {
    if (!value) return '-';
    if (value < 1000) return `${value}ms`;
    const seconds = Math.round(value / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  protected fileSize(value?: number): string {
    if (!value) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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

  private loadDataSources(): void {
    this.dataSourcesService.list({ all: true }).subscribe({
      next: (res) => {
        this.dataSources = res.data ?? [];
        this.cdr.markForCheck();
      },
      error: (err) => this.message.error(err?.msg || err?.message || '读取数据源失败'),
    });
  }

  private scheduleRefreshIfNeeded(): void {
    if (!this.data.some((item) => item.status === 'pending' || item.status === 'running')) return;
    this.refreshTimer = setTimeout(() => this.getData(), 5000);
  }

  private clearRefreshTimer(): void {
    if (!this.refreshTimer) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private saveBlob(blob: Blob | null, fileName: string): void {
    if (!blob) {
      this.message.error('备份文件为空');
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
