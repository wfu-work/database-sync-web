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
import { DatabaseRestore } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DatabaseBackupsService } from '../database-backups.service';
import { DatabaseRestoreCreateComponent } from './create/database-restore-create.component';

@Component({
  selector: 'app-database-restore',
  templateUrl: './database-restore.component.html',
  styleUrls: ['./database-restore.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DatabaseRestoreComponent implements OnInit, OnDestroy {
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly cdr = inject(ChangeDetectorRef);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  protected restores: DatabaseRestore[] = [];
  protected loading = false;
  protected total = 0;
  protected detailVisible = false;
  protected detailLoading = false;
  protected selectedRestore: DatabaseRestore | null = null;

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    status: '',
    targetDataSourceGuid: '',
  };

  protected readonly columns: Array<STColumn<DatabaseRestore>> = [
    { title: '恢复记录', index: 'guid', render: 'restoreRender', width: 260 },
    { title: '目标数据源', index: 'targetDataSourceName', render: 'targetRender', width: 170 },
    { title: '状态', index: 'status', render: 'statusRender', width: 230 },
    { title: '范围', index: 'totalTables', render: 'scopeRender', width: 110 },
    { title: '策略', index: 'writeMode', render: 'policyRender', width: 120 },
    { title: '时间', index: 'startTime', render: 'timeRender', width: 140 },
    { title: '操作', render: 'actionsRender', width: 90 },
  ];

  ngOnInit(): void {
    this.getRestores();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }

  protected getRestores(): void {
    this.loading = true;
    this.clearRefreshTimer();
    this.backupsService
      .restoreList(this.q)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.restores = res.data ?? [];
          this.total = res.total ?? 0;
          this.q.page = res.page || this.q.page;
          this.q.size = res.size || this.q.size;
          this.scheduleRefreshIfNeeded();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取恢复历史失败'),
      });
  }

  protected openCreate(): void {
    const ref = this.modal.create({
      nzTitle: '新建备份恢复',
      nzContent: DatabaseRestoreCreateComponent,
      nzFooter: null,
      nzWidth: 860,
      nzMaskClosable: false,
    });
    ref.afterClose.subscribe((created) => {
      if (!created) return;
      this.q.page = 1;
      this.getRestores();
    });
  }

  protected search(): void {
    this.q.page = 1;
    this.getRestores();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.status = '';
    this.q.targetDataSourceGuid = '';
    this.getRestores();
  }

  protected openDetail(item: DatabaseRestore): void {
    this.detailVisible = true;
    this.detailLoading = true;
    this.selectedRestore = item;
    this.backupsService
      .restoreGet(item.guid)
      .pipe(
        finalize(() => {
          this.detailLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.selectedRestore = res;
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取恢复详情失败'),
      });
  }

  protected closeDetail(): void {
    this.detailVisible = false;
  }

  protected writeModeLabel(value: string): string {
    const map: Record<string, string> = {
      insert: '追加写入',
      replace: '覆盖主键',
      upsert: '冲突更新',
    };
    return map[value] || value || '-';
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '恢复中',
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

  protected restorePercent(item: DatabaseRestore): number {
    if (item.status === 'success') return 100;
    if (!item.totalTables) return item.status === 'running' ? 1 : 0;
    const currentTableProgress =
      item.currentTotal > 0 ? Math.min(1, (item.currentRows || 0) / item.currentTotal) : 0;
    const tableProgress = (item.finishedTables || 0) + currentTableProgress;
    return Math.min(99, Math.max(1, Math.round((tableProgress / item.totalTables) * 100)));
  }

  protected currentTablePercent(item: DatabaseRestore): number {
    if (!item.currentTotal) return item.currentRows ? 1 : 0;
    return Math.min(99, Math.round(((item.currentRows || 0) / item.currentTotal) * 100));
  }

  protected progressStatus(item: DatabaseRestore): 'success' | 'exception' | 'active' | 'normal' {
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

  protected rowCount(value?: number): string {
    if (!value) return '0';
    return new Intl.NumberFormat('zh-CN').format(value);
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

  protected tableChange(event: STChange): void {
    switch (event.type) {
      case 'pi':
      case 'ps':
      case 'filter':
      case 'sort':
        this.q.page = event.pi;
        this.q.size = event.ps;
        this.getRestores();
        break;
      default:
        break;
    }
  }

  private scheduleRefreshIfNeeded(): void {
    if (!this.restores.some((item) => item.status === 'pending' || item.status === 'running')) {
      return;
    }
    this.refreshTimer = setTimeout(() => this.getRestores(), 5000);
  }

  private clearRefreshTimer(): void {
    if (!this.refreshTimer) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
}
