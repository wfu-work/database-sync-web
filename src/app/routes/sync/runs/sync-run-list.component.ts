import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, SyncRun, SyncTask } from '@shared/types/datasync';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../datasources/datasources.service';
import { SyncRunsService } from '../sync-runs.service';
import { SyncTasksService } from '../sync-tasks.service';

@Component({
  selector: 'app-sync-run-list',
  templateUrl: './sync-run-list.component.html',
  styleUrls: ['./sync-run-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncRunListComponent implements OnInit {
  private readonly runsService = inject(SyncRunsService);
  private readonly tasksService = inject(SyncTasksService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    taskGuid: '',
    status: '',
  };

  protected data: SyncRun[] = [];
  protected tasks: SyncTask[] = [];
  protected dataSources: DataSource[] = [];
  protected total = 0;
  protected loading = false;
  protected readonly columns: Array<STColumn<SyncRun>> = [
    { title: '运行记录', index: 'taskName', render: 'runRender' },
    { title: '状态', index: 'status', render: 'statusRender', width: 160 },
    { title: '进度', index: 'processedCount', render: 'progressRender', width: 220 },
    { title: '统计', index: 'successCount', render: 'countRender', width: 180 },
    { title: '时间', index: 'startTime', render: 'timeRender', width: 190 },
    { title: '操作', render: 'actionsRender', width: 100 },
  ];

  ngOnInit(): void {
    this.loadTasks();
    this.loadDataSources();
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    this.runsService
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
    this.q.taskGuid = '';
    this.q.status = '';
    this.getData();
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

  protected statusClass(status: string): string {
    if (status === 'success') return 'status-success';
    if (status === 'failed') return 'status-failed';
    if (status === 'running') return 'status-running';
    return 'status-idle';
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

  private loadTasks(): void {
    this.tasksService.list({ all: true }).subscribe((res) => {
      this.tasks = res.data ?? [];
      this.cdr.markForCheck();
    });
  }

  private loadDataSources(): void {
    this.dataSourcesService.list({ all: true }).subscribe((res) => {
      this.dataSources = res.data ?? [];
      this.cdr.markForCheck();
    });
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
