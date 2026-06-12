import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, DatabaseBackup, EventNotification, SyncRun } from '@shared/types/datasync';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { DatabaseBackupsService } from '../../backups/database-backups.service';
import { DataSourcesService } from '../../datasources/datasources.service';
import { SyncRunsService } from '../../sync/sync-runs.service';
import { EventNotificationsService } from '../../../shared/services/event-notifications.service';

interface MonitorMetric {
  label: string;
  value: number;
  hint: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'idle';
  link: string;
}

interface ActivityItem {
  guid: string;
  title: string;
  subTitle: string;
  status: string;
  percent: number;
  kind: 'sync' | 'backup';
  elapsed: string;
  link: string;
}

@Component({
  selector: 'app-operation-monitor',
  templateUrl: './operation-monitor.component.html',
  styleUrls: ['./operation-monitor.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class OperationMonitorComponent implements OnInit, OnDestroy {
  private readonly runsService = inject(SyncRunsService);
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly notificationsService = inject(EventNotificationsService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  protected loading = false;
  protected autoRefresh = true;
  protected lastUpdated = 0;
  protected runningRuns: SyncRun[] = [];
  protected failedRuns: SyncRun[] = [];
  protected runningBackups: DatabaseBackup[] = [];
  protected failedBackups: DatabaseBackup[] = [];
  protected unhealthySources: DataSource[] = [];
  protected unreadNotifications: EventNotification[] = [];

  ngOnInit(): void {
    this.getData();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }

  protected getData(): void {
    this.loading = true;
    this.clearRefreshTimer();
    forkJoin({
      runningRuns: this.runsService
        .list({ page: 1, size: 8, status: 'running' })
        .pipe(catchError(() => of(null))),
      failedRuns: this.runsService
        .list({ page: 1, size: 8, status: 'failed' })
        .pipe(catchError(() => of(null))),
      runningBackups: this.backupsService
        .list({ page: 1, size: 8, status: 'running' })
        .pipe(catchError(() => of(null))),
      failedBackups: this.backupsService
        .list({ page: 1, size: 8, status: 'failed' })
        .pipe(catchError(() => of(null))),
      dataSources: this.dataSourcesService.list({ all: true }).pipe(catchError(() => of(null))),
      notifications: this.notificationsService
        .list({ page: 1, size: 6, read: 0 })
        .pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.lastUpdated = Date.now();
          this.scheduleRefresh();
          this.cdr.markForCheck();
        }),
      )
      .subscribe(({ runningRuns, failedRuns, runningBackups, failedBackups, dataSources, notifications }) => {
        this.runningRuns = runningRuns?.data ?? [];
        this.failedRuns = failedRuns?.data ?? [];
        this.runningBackups = runningBackups?.data ?? [];
        this.failedBackups = failedBackups?.data ?? [];
        this.unhealthySources = (dataSources?.data ?? []).filter(
          (item) => item.connectionStatus === 'failed',
        );
        this.unreadNotifications = notifications?.data ?? [];
      });
  }

  protected toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.scheduleRefresh();
    } else {
      this.clearRefreshTimer();
    }
  }

  protected metrics(): MonitorMetric[] {
    return [
      {
        label: '同步运行中',
        value: this.runningRuns.length,
        hint: '正在处理数据的同步记录',
        tone: this.runningRuns.length > 0 ? 'primary' : 'idle',
        link: '/sync/runs/list',
      },
      {
        label: '备份运行中',
        value: this.runningBackups.length,
        hint: '正在导出的备份记录',
        tone: this.runningBackups.length > 0 ? 'primary' : 'idle',
        link: '/backups/history',
      },
      {
        label: '失败待处理',
        value: this.failedRuns.length + this.failedBackups.length,
        hint: '同步或备份失败记录',
        tone: this.failedRuns.length + this.failedBackups.length > 0 ? 'danger' : 'success',
        link: '/ops/notifications',
      },
      {
        label: '异常连接',
        value: this.unhealthySources.length,
        hint: '会影响任务和备份',
        tone: this.unhealthySources.length > 0 ? 'warning' : 'success',
        link: '/datasources/health',
      },
      {
        label: '未读通知',
        value: this.unreadNotifications.length,
        hint: '需要关注的运行消息',
        tone: this.unreadNotifications.length > 0 ? 'warning' : 'idle',
        link: '/ops/notifications',
      },
    ];
  }

  protected activities(): ActivityItem[] {
    const syncItems = this.runningRuns.map((item) => ({
      guid: item.guid,
      title: item.taskName || item.guid,
      subTitle: `${this.rowCount(item.processedCount)} / ${this.rowCount(item.totalCount)} 行`,
      status: this.statusLabel(item.status),
      percent: this.syncPercent(item),
      kind: 'sync' as const,
      elapsed: this.duration(Date.now() - (item.startTime || Date.now())),
      link: `/sync/runs/${item.guid}`,
    }));
    const backupItems = this.runningBackups.map((item) => ({
      guid: item.guid,
      title: item.dataSourceName || item.guid,
      subTitle: item.currentTable
        ? `${item.currentTable} · ${this.rowCount(item.currentRows)} 行`
        : `${item.finishedTables || 0} / ${item.totalTables || 0} 张表`,
      status: this.backupStatusLabel(item.status),
      percent: this.backupPercent(item),
      kind: 'backup' as const,
      elapsed: this.duration(Date.now() - (item.startTime || Date.now())),
      link: '/backups/history',
    }));
    return [...syncItems, ...backupItems];
  }

  protected openLink(link: string): void {
    this.router.navigateByUrl(link);
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '运行中',
      success: '成功',
      failed: '失败',
      canceled: '取消',
    };
    return map[status] || status || '-';
  }

  protected backupStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '备份中',
      success: '成功',
      failed: '失败',
    };
    return map[status] || status || '-';
  }

  protected syncPercent(item: SyncRun): number {
    if (!item.totalCount) return item.status === 'success' ? 100 : 0;
    return Math.min(100, Math.round((item.processedCount / item.totalCount) * 100));
  }

  protected backupPercent(item: DatabaseBackup): number {
    if (item.status === 'success') return 100;
    if (!item.totalTables) return item.status === 'running' ? 1 : 0;
    const currentTableProgress =
      item.currentTotal > 0 ? Math.min(1, (item.currentRows || 0) / item.currentTotal) : 0;
    return Math.min(
      99,
      Math.max(1, Math.round((((item.finishedTables || 0) + currentTableProgress) / item.totalTables) * 100)),
    );
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
    if (!value || value < 0) return '-';
    if (value < 1000) return `${value}ms`;
    const seconds = Math.round(value / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private scheduleRefresh(): void {
    if (!this.autoRefresh) return;
    this.clearRefreshTimer();
    this.refreshTimer = setTimeout(() => this.getData(), 5000);
  }

  private clearRefreshTimer(): void {
    if (!this.refreshTimer) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
}
