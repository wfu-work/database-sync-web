import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import {
  DatabaseBackup,
  DatabaseRestore,
  ServerDiskInfo,
  SystemMonitorInfo,
  SyncRun,
} from '@shared/types/datasync';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { PanelComponent } from 'src/app/shared/components/panel/panel.component';

import { DatabaseBackupsService } from '../backups/database-backups.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { SystemMonitorService } from '../ops/system-monitor.service';
import { SyncRunsService } from '../sync/sync-runs.service';
import { SyncTasksService } from '../sync/sync-tasks.service';

type DashboardTone = 'success' | 'idle' | 'warning' | 'danger';

interface DashboardCheck {
  name: string;
  flow: string;
  status: string;
  tone: DashboardTone;
  link: string;
}

interface QuickAction {
  title: string;
  desc: string;
  icon: string;
  link: string;
}

interface BackupTimelineItem {
  guid: string;
  title: string;
  subTitle: string;
  status: string;
  percent: number;
  time: number;
  link: string;
  kind: 'backup' | 'restore';
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent, PanelComponent],
})
export class DashboardComponent implements OnInit {
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly tasksService = inject(SyncTasksService);
  private readonly runsService = inject(SyncRunsService);
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly systemMonitorService = inject(SystemMonitorService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected loading = false;
  protected lastUpdated = 0;
  protected dataSourceTotal = 0;
  protected healthySourceTotal = 0;
  protected unhealthySourceTotal = 0;
  protected taskTotal = 0;
  protected enabledTaskTotal = 0;
  protected templateTotal = 0;
  protected enabledTemplateTotal = 0;
  protected runTotal = 0;
  protected failedRunTotal = 0;
  protected runningRunTotal = 0;
  protected backupTotal = 0;
  protected failedBackupTotal = 0;
  protected runningBackupTotal = 0;
  protected restoreTotal = 0;
  protected failedRestoreTotal = 0;
  protected runningRestoreTotal = 0;
  protected recentRuns: SyncRun[] = [];
  protected recentBackups: DatabaseBackup[] = [];
  protected recentRestores: DatabaseRestore[] = [];
  protected systemMonitor: SystemMonitorInfo | null = null;
  protected checks: DashboardCheck[] = [];

  protected readonly quickActions: QuickAction[] = [
    {
      title: '新建同步',
      desc: '创建全量或增量同步任务',
      icon: 'plus',
      link: '/sync/tasks/create',
    },
    {
      title: '同步模板',
      desc: '套用常用字段映射和策略',
      icon: 'profile',
      link: '/sync/templates',
    },
    {
      title: '新建备份',
      desc: '为数据库生成可恢复快照',
      icon: 'cloud-upload',
      link: '/backups/create',
    },
    {
      title: '备份恢复',
      desc: '从备份记录恢复到目标库',
      icon: 'download',
      link: '/backups/restore',
    },
    {
      title: '连接健康',
      desc: '检查数据源可用性和详情',
      icon: 'safety-certificate',
      link: '/datasources/health',
    },
    {
      title: '运行监控',
      desc: '查看服务与服务器状态',
      icon: 'dashboard',
      link: '/ops/monitor',
    },
  ];

  ngOnInit(): void {
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    forkJoin({
      dataSources: this.dataSourcesService.list({ all: true }).pipe(catchError(() => of(null))),
      tasks: this.tasksService.list({ page: 1, size: 1 }).pipe(catchError(() => of(null))),
      enabledTasks: this.tasksService
        .list({ page: 1, size: 1, status: 1 })
        .pipe(catchError(() => of(null))),
      templates: this.tasksService
        .templateList({ page: 1, size: 1 })
        .pipe(catchError(() => of(null))),
      enabledTemplates: this.tasksService
        .templateList({ page: 1, size: 1, status: 1 })
        .pipe(catchError(() => of(null))),
      runs: this.runsService.list({ page: 1, size: 6 }).pipe(catchError(() => of(null))),
      failedRuns: this.runsService
        .list({ page: 1, size: 1, status: 'failed' })
        .pipe(catchError(() => of(null))),
      runningRuns: this.runsService
        .list({ page: 1, size: 1, status: 'running' })
        .pipe(catchError(() => of(null))),
      backups: this.backupsService.list({ page: 1, size: 4 }).pipe(catchError(() => of(null))),
      failedBackups: this.backupsService
        .list({ page: 1, size: 1, status: 'failed' })
        .pipe(catchError(() => of(null))),
      runningBackups: this.backupsService
        .list({ page: 1, size: 1, status: 'running' })
        .pipe(catchError(() => of(null))),
      restores: this.backupsService
        .restoreList({ page: 1, size: 4 })
        .pipe(catchError(() => of(null))),
      failedRestores: this.backupsService
        .restoreList({ page: 1, size: 1, status: 'failed' })
        .pipe(catchError(() => of(null))),
      runningRestores: this.backupsService
        .restoreList({ page: 1, size: 1, status: 'running' })
        .pipe(catchError(() => of(null))),
      systemMonitor: this.systemMonitorService.runtime().pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.lastUpdated = Date.now();
          this.cdr.markForCheck();
        }),
      )
      .subscribe(
        ({
          dataSources,
          tasks,
          enabledTasks,
          templates,
          enabledTemplates,
          runs,
          failedRuns,
          runningRuns,
          backups,
          failedBackups,
          runningBackups,
          restores,
          failedRestores,
          runningRestores,
          systemMonitor,
        }) => {
          const sourceItems = dataSources?.data ?? [];
          this.dataSourceTotal = dataSources?.total ?? sourceItems.length;
          this.healthySourceTotal = sourceItems.filter(
            (item) => item.connectionStatus === 'connected',
          ).length;
          this.unhealthySourceTotal = sourceItems.filter(
            (item) => item.connectionStatus === 'failed',
          ).length;
          this.taskTotal = tasks?.total ?? 0;
          this.enabledTaskTotal = enabledTasks?.total ?? 0;
          this.templateTotal = templates?.total ?? 0;
          this.enabledTemplateTotal = enabledTemplates?.total ?? 0;
          this.runTotal = runs?.total ?? 0;
          this.failedRunTotal = failedRuns?.total ?? 0;
          this.runningRunTotal = runningRuns?.total ?? 0;
          this.backupTotal = backups?.total ?? 0;
          this.failedBackupTotal = failedBackups?.total ?? 0;
          this.runningBackupTotal = runningBackups?.total ?? 0;
          this.restoreTotal = restores?.total ?? 0;
          this.failedRestoreTotal = failedRestores?.total ?? 0;
          this.runningRestoreTotal = runningRestores?.total ?? 0;
          this.recentRuns = runs?.data ?? [];
          this.recentBackups = backups?.data ?? [];
          this.recentRestores = restores?.data ?? [];
          this.systemMonitor = systemMonitor;
          this.checks = this.buildChecks();
        },
      );
  }

  protected get dataSourceValue(): string {
    return `${this.dataSourceTotal}`;
  }

  protected get taskValue(): string {
    return `${this.taskTotal}`;
  }

  protected get templateValue(): string {
    return `${this.templateTotal}`;
  }

  protected get pendingIssueTotal(): number {
    return this.failedRunTotal + this.failedBackupTotal + this.failedRestoreTotal;
  }

  protected get pendingIssueValue(): string {
    return `${this.pendingIssueTotal}`;
  }

  protected backupTimeline(): BackupTimelineItem[] {
    const backups = this.recentBackups.map((item) => ({
      guid: item.guid,
      title: item.dataSourceName || item.database || item.guid,
      subTitle: `备份 · ${item.currentTable || item.fileName || item.database || '-'}`,
      status: this.backupStatusLabel(item.status),
      percent: this.backupPercent(item),
      time: item.startTime || item.updateTime,
      link: '/backups/history',
      kind: 'backup' as const,
    }));
    const restores = this.recentRestores.map((item) => ({
      guid: item.guid,
      title: item.targetDataSourceName || item.targetDatabase || item.guid,
      subTitle: `恢复 · ${item.currentTable || item.backupName || '-'}`,
      status: this.restoreStatusLabel(item.status),
      percent: this.restorePercent(item),
      time: item.startTime || item.updateTime,
      link: '/backups/restore',
      kind: 'restore' as const,
    }));
    return [...backups, ...restores].sort((a, b) => b.time - a.time).slice(0, 6);
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

  protected restoreStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '恢复中',
      success: '成功',
      failed: '失败',
    };
    return map[status] || status || '-';
  }

  protected progressStatus(status: string): 'success' | 'exception' | 'active' | 'normal' {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'exception';
    if (status === 'running') return 'active';
    return 'normal';
  }

  protected percent(item: SyncRun): number {
    if (!item.totalCount) return item.status === 'success' ? 100 : 0;
    return Math.min(100, Math.round((item.processedCount / item.totalCount) * 100));
  }

  protected cpuPercent(): number {
    const cpus = this.systemMonitor?.cpu?.cpus ?? [];
    if (cpus.length === 0) return 0;
    const total = cpus.reduce((sum, item) => sum + Number(item || 0), 0);
    return this.clampPercent(total / cpus.length);
  }

  protected memoryPercent(): number {
    return this.clampPercent(this.systemMonitor?.ram?.usedPercent ?? 0);
  }

  protected firstDisk(): ServerDiskInfo | null {
    return this.systemMonitor?.disk?.[0] ?? null;
  }

  protected diskPercent(item: ServerDiskInfo): number {
    return this.clampPercent(item.usedPercent);
  }

  protected serviceHealthTone(): DashboardTone {
    if (!this.systemMonitor) return 'idle';
    if (this.systemMonitor.warnings?.length) return 'warning';
    return this.systemMonitor.service.status === 'running' ? 'success' : 'danger';
  }

  protected percentTone(value: number): 'success' | 'exception' | 'active' | 'normal' {
    if (value >= 90) return 'exception';
    if (value >= 75) return 'active';
    if (value <= 50) return 'success';
    return 'normal';
  }

  protected rowCount(value?: number): string {
    if (!value) return '0';
    return new Intl.NumberFormat('zh-CN').format(value);
  }

  protected formatBytes(value?: number): string {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(size)} ${units[index]}`;
  }

  protected formatMb(value?: number): string {
    return this.formatBytes((value || 0) * 1024 * 1024);
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  protected durationSeconds(value?: number): string {
    const seconds = Number(value || 0);
    if (seconds <= 0) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private buildChecks(): DashboardCheck[] {
    return [
      {
        name: '数据源连接',
        flow: '健康数据源可查看数据库详情，异常连接会影响同步和备份',
        status: this.unhealthySourceTotal > 0 ? `${this.unhealthySourceTotal} 异常` : '正常',
        tone: this.unhealthySourceTotal > 0 ? 'warning' : 'success',
        link: '/datasources/health',
      },
      {
        name: '活动任务',
        flow: '同步、备份、恢复运行中时可进入监控页查看进度',
        status: `${this.runningRunTotal + this.runningBackupTotal + this.runningRestoreTotal}`,
        tone:
          this.runningRunTotal + this.runningBackupTotal + this.runningRestoreTotal > 0
            ? 'warning'
            : 'idle',
        link: '/ops/monitor',
      },
      {
        name: '失败待处理',
        flow: '失败记录需要查看明细、错误原因或通知事件',
        status: `${this.pendingIssueTotal}`,
        tone: this.pendingIssueTotal > 0 ? 'danger' : 'success',
        link: '/ops/notifications',
      },
      {
        name: '备份恢复',
        flow: '备份历史和恢复记录用于回滚、迁移和灾备验证',
        status: `${this.backupTotal}/${this.restoreTotal}`,
        tone: this.failedBackupTotal + this.failedRestoreTotal > 0 ? 'warning' : 'success',
        link: '/backups/restore',
      },
      {
        name: '同步模板',
        flow: '沉淀常用同步配置，减少重复填写字段映射',
        status: `${this.enabledTemplateTotal} 可用`,
        tone: this.enabledTemplateTotal > 0 ? 'success' : 'idle',
        link: '/sync/templates',
      },
    ];
  }

  private backupPercent(item: DatabaseBackup): number {
    if (item.status === 'success') return 100;
    if (!item.totalTables) return item.status === 'running' ? 1 : 0;
    const currentTableProgress =
      item.currentTotal > 0 ? Math.min(1, (item.currentRows || 0) / item.currentTotal) : 0;
    return Math.min(
      99,
      Math.max(
        1,
        Math.round((((item.finishedTables || 0) + currentTableProgress) / item.totalTables) * 100),
      ),
    );
  }

  private restorePercent(item: DatabaseRestore): number {
    if (item.status === 'success') return 100;
    if (!item.totalTables) return item.status === 'running' ? 1 : 0;
    const currentTableProgress =
      item.currentTotal > 0 ? Math.min(1, (item.currentRows || 0) / item.currentTotal) : 0;
    return Math.min(
      99,
      Math.max(
        1,
        Math.round((((item.finishedTables || 0) + currentTableProgress) / item.totalTables) * 100),
      ),
    );
  }

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  }
}
