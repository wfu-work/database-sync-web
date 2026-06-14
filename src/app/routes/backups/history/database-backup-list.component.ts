import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { AppWebSocketService } from '@shared/services/app-websocket.service';
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
export class DatabaseBackupListComponent implements OnInit {
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly ws = inject(AppWebSocketService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

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
  protected retryingGuid = '';
  protected deletingGuid = '';

  protected readonly columns: Array<STColumn<DatabaseBackup>> = [
    { title: '备份记录', index: 'guid', render: 'backupRender', width: 280 },
    { title: '数据源', index: 'dataSourceName', render: 'sourceRender', width: 170 },
    { title: '状态', index: 'status', render: 'statusRender', width: 220 },
    { title: '范围', index: 'totalTables', render: 'scopeRender', width: 100 },
    { title: '文件', index: 'fileSize', render: 'fileRender', width: 90 },
    { title: '时间', index: 'startTime', render: 'timeRender', width: 130 },
    { title: '操作', render: 'actionsRender', width: 170 },
  ];

  ngOnInit(): void {
    this.loadDataSources();
    this.watchBackupUpdates();
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
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

  protected retryTip(item: DatabaseBackup): string {
    const name = item.fileName || item.dataSourceName || item.guid;
    return `将在原失败记录「${name}」上重新执行备份，不会新增历史记录。确认重试吗？`;
  }

  protected deleteTip(item: DatabaseBackup): string {
    const name = item.fileName || item.dataSourceName || item.guid;
    return `确定删除备份记录「${name}」吗？如果存在备份文件，也会一并删除。`;
  }

  protected canDelete(item: DatabaseBackup): boolean {
    return item.status !== 'pending' && item.status !== 'running';
  }

  protected failureSummary(item: DatabaseBackup): string {
    const error = item.lastError || '';
    if (error.includes('EOF') && error.includes('/rest/sql')) {
      const table = item.currentTable || this.failedTableName(error) || '当前表';
      return `备份在读取 ${table} 时，TDengine REST 连接被提前断开。常见原因是该表数据量较大、单批查询响应时间过长，或 6041 REST 服务/中间网络主动关闭了连接。`;
    }
    if (error.includes('context deadline exceeded') || error.includes('Client.Timeout')) {
      return '备份查询超过了当前连接超时时间，后端没有在限定时间内拿到数据库响应。';
    }
    return '备份任务在读取数据或写入备份文件时失败，请结合原始错误和当前表信息排查。';
  }

  protected failureAdvice(item: DatabaseBackup): string {
    const error = item.lastError || '';
    if (error.includes('EOF') && error.includes('/rest/sql')) {
      if (item.backupTimeField && item.backupStartTime) {
        return '建议继续缩小窗口粒度，例如从按天改为按小时，或把 batchSize 调小到 100-500；如果仍失败，再检查 TDengine REST 服务日志和网络代理超时。';
      }
      return '建议先调小备份批次大小，或在数据源连接参数里增大 timeout，例如 {"timeout":"2m"}；如果仍失败，再检查 TDengine REST 服务日志和网络代理超时。';
    }
    if (error.includes('context deadline exceeded') || error.includes('Client.Timeout')) {
      return '建议增大数据源 timeout，或缩小批次大小后重试。';
    }
    return '建议先重试一次；如果稳定复现，查看当前表、数据源连接和后端日志。';
  }

  protected retry(item: DatabaseBackup): void {
    if (item.status !== 'failed') return;
    this.retryingGuid = item.guid;
    this.backupsService
      .retry(item.guid)
      .pipe(
        finalize(() => {
          this.retryingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('已在原记录上重新开始备份');
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '重试备份失败'),
      });
  }

  protected remove(item: DatabaseBackup): void {
    if (!this.canDelete(item)) {
      this.message.warning('备份进行中，完成或失败后再删除');
      return;
    }
    this.deletingGuid = item.guid;
    this.backupsService
      .delete(item.guid)
      .pipe(
        finalize(() => {
          this.deletingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('备份记录已删除');
          if (this.selectedBackup?.guid === item.guid) {
            this.closeDetail();
          }
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '删除备份记录失败'),
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

  protected backupPercent(item: DatabaseBackup): number {
    if (item.status === 'success') return 100;
    if (!item.totalTables) return item.status === 'running' ? 1 : 0;
    const currentTableProgress =
      item.currentTotal > 0 ? Math.min(1, (item.currentRows || 0) / item.currentTotal) : 0;
    const tableProgress = (item.finishedTables || 0) + currentTableProgress;
    return Math.min(99, Math.max(1, Math.round((tableProgress / item.totalTables) * 100)));
  }

  protected currentTablePercent(item: DatabaseBackup): number {
    if (!item.currentTotal) return item.currentRows ? 1 : 0;
    return Math.min(99, Math.round(((item.currentRows || 0) / item.currentTotal) * 100));
  }

  protected rowCount(value?: number): string {
    if (!value) return '0';
    return new Intl.NumberFormat('zh-CN').format(value);
  }

  protected runningDuration(item: DatabaseBackup): string {
    const start = item.currentStarted || item.startTime;
    if (!start) return '-';
    return this.duration(Date.now() - start);
  }

  protected progressStatus(item: DatabaseBackup): 'success' | 'exception' | 'active' | 'normal' {
    if (item.status === 'success') return 'success';
    if (item.status === 'failed') return 'exception';
    if (item.status === 'running') return 'active';
    return 'normal';
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

  private failedTableName(error: string): string {
    const match = error.match(/query table\s+([^\s]+)\s+failed/i);
    return match?.[1] || '';
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

  private watchBackupUpdates(): void {
    this.ws
      .on<DatabaseBackup>('backup.updated')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((backup) => this.applyBackupUpdate(backup));
  }

  private applyBackupUpdate(backup: DatabaseBackup): void {
    if (!backup?.guid) return;
    if (this.selectedBackup?.guid === backup.guid) {
      this.selectedBackup = { ...this.selectedBackup, ...backup };
    }

    if (!this.matchesCurrentQuery(backup)) {
      const previousLength = this.data.length;
      this.data = this.data.filter((item) => item.guid !== backup.guid);
      if (this.data.length !== previousLength) {
        this.total = Math.max(0, this.total - 1);
      }
      this.cdr.markForCheck();
      return;
    }

    const index = this.data.findIndex((item) => item.guid === backup.guid);
    if (index >= 0) {
      this.data = this.data.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...backup } : item,
      );
    } else if (this.q.page === 1) {
      this.data = [backup, ...this.data].slice(0, this.q.size);
      this.total += 1;
    }
    this.cdr.markForCheck();
  }

  private matchesCurrentQuery(item: DatabaseBackup): boolean {
    if (this.q.dataSourceGuid && item.dataSourceGuid !== this.q.dataSourceGuid) return false;
    if (this.q.status && item.status !== this.q.status) return false;
    const keyword = this.q.keyword.trim().toLowerCase();
    if (!keyword) return true;
    return [
      item.guid,
      item.dataSourceName,
      item.database,
      item.tables,
      item.remark,
      item.lastError,
      item.fileName,
    ].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(keyword),
    );
  }
}
