import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { SHARED_IMPORTS } from '@shared';
import { SyncRun } from '@shared/types/datasync';
import { catchError, forkJoin, of } from 'rxjs';
import { PanelComponent } from 'src/app/shared/components/panel/panel.component';
import { TitleLabelComponent } from 'src/app/shared/components/title-label/title-label.component';

import { DataSourcesService } from '../datasources/datasources.service';
import { SyncRunsService } from '../sync/sync-runs.service';
import { SyncTasksService } from '../sync/sync-tasks.service';

interface DashboardRule {
  name: string;
  flow: string;
  status: string;
  tone: 'success' | 'idle' | 'warning';
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
  private readonly cdr = inject(ChangeDetectorRef);

  protected dataSourceTotal = 0;
  protected taskTotal = 0;
  protected runTotal = 0;
  protected failedRunTotal = 0;
  protected runningRunTotal = 0;
  protected recentRuns: SyncRun[] = [];
  protected rules: DashboardRule[] = [];

  ngOnInit(): void {
    this.getData();
  }

  private getData(): void {
    forkJoin({
      dataSources: this.dataSourcesService
        .list({ page: 1, size: 1 })
        .pipe(catchError(() => of(null))),
      tasks: this.tasksService.list({ page: 1, size: 1 }).pipe(catchError(() => of(null))),
      runs: this.runsService.list({ page: 1, size: 6 }).pipe(catchError(() => of(null))),
      failedRuns: this.runsService
        .list({ page: 1, size: 1, status: 'failed' })
        .pipe(catchError(() => of(null))),
      runningRuns: this.runsService
        .list({ page: 1, size: 1, status: 'running' })
        .pipe(catchError(() => of(null))),
    }).subscribe(({ dataSources, tasks, runs, failedRuns, runningRuns }) => {
      this.dataSourceTotal = dataSources?.total ?? 0;
      this.taskTotal = tasks?.total ?? 0;
      this.runTotal = runs?.total ?? 0;
      this.failedRunTotal = failedRuns?.total ?? 0;
      this.runningRunTotal = runningRuns?.total ?? 0;
      this.recentRuns = runs?.data ?? [];
      this.rules = this.buildRules();
      this.cdr.markForCheck();
    });
  }

  protected get dataSourceValue(): string {
    return `${this.dataSourceTotal}`;
  }

  protected get taskValue(): string {
    return `${this.taskTotal}`;
  }

  protected get runValue(): string {
    return `${this.runTotal}`;
  }

  protected get failedValue(): string {
    return `${this.failedRunTotal}`;
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

  protected percent(item: SyncRun): number {
    if (!item.totalCount) return item.status === 'success' ? 100 : 0;
    return Math.min(100, Math.round((item.processedCount / item.totalCount) * 100));
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  private buildRules(): DashboardRule[] {
    return [
      {
        name: '数据源可用性',
        flow: '创建后使用测试连接确认数据库可达',
        status: `${this.dataSourceTotal}`,
        tone: this.dataSourceTotal > 0 ? 'success' : 'idle',
      },
      {
        name: '运行中任务',
        flow: '持续轮询运行详情页查看游标和处理量',
        status: `${this.runningRunTotal}`,
        tone: this.runningRunTotal > 0 ? 'warning' : 'success',
      },
      {
        name: '失败运行',
        flow: '进入失败明细定位源数据快照与错误原因',
        status: `${this.failedRunTotal}`,
        tone: this.failedRunTotal > 0 ? 'warning' : 'success',
      },
    ];
  }
}
