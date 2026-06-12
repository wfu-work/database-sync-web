import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import {
  DataSource,
  MapperRow,
  ScheduleItem,
  SyncTask,
  SyncTaskPreviewResult,
} from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../datasources/datasources.service';
import { SyncTasksService } from '../sync-tasks.service';

@Component({
  selector: 'app-sync-task-list',
  templateUrl: './sync-task-list.component.html',
  styleUrls: ['./sync-task-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncTaskListComponent implements OnInit {
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
    scheduleOn: '',
  };

  protected data: SyncTask[] = [];
  protected dataSources: DataSource[] = [];
  protected schedules: ScheduleItem[] = [];
  protected total = 0;
  protected loading = false;
  protected previewLoading = false;
  protected scheduleLoading = false;
  protected runningGuid = '';
  protected stoppingGuid = '';
  protected previewingGuid = '';
  protected templatingGuid = '';
  protected previewVisible = false;
  protected previewResult: SyncTaskPreviewResult | null = null;
  protected sourcePreviewColumns: string[] = [];
  protected mappedPreviewColumns: string[] = [];
  protected readonly columns: Array<STColumn<SyncTask>> = [
    { title: '任务', index: 'name', render: 'taskRender' },
    { title: '数据链路', index: 'sourceGuid', render: 'routeRender' },
    { title: '同步策略', index: 'mode', render: 'strategyRender' },
    { title: '最近运行', index: 'lastRunStatus', render: 'lastRunRender', width: 140 },
    { title: '操作', render: 'actionsRender', width: 260 },
  ];

  ngOnInit(): void {
    this.loadDataSources();
    this.loadSchedules();
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
    this.q.scheduleOn = '';
    this.getData();
  }

  protected goCreate(): void {
    this.router.navigate(['/sync/tasks/create']);
  }

  protected goEdit(item: SyncTask): void {
    this.router.navigate(['/sync/tasks', item.guid, 'edit']);
  }

  protected goValidate(item: SyncTask): void {
    this.router.navigate(['/sync/tasks', item.guid, 'edit'], { queryParams: { validate: 1 } });
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

  protected stop(item: SyncTask): void {
    this.modal.confirm({
      nzTitle: '停止同步任务',
      nzContent: `确定请求停止「${item.name}」当前正在执行的同步吗？`,
      nzOkText: '停止',
      nzOkDanger: true,
      nzCancelText: '取消',
      nzOnOk: () => {
        this.stoppingGuid = item.guid;
        this.taskService
          .stop(item.guid)
          .pipe(
            finalize(() => {
              this.stoppingGuid = '';
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: () => {
              this.message.success('已请求停止同步任务');
              this.getData();
            },
            error: (err) => this.message.error(err?.msg || err?.message || '停止同步任务失败'),
          });
      },
    });
  }

  protected validateTask(item: SyncTask): void {
    this.goValidate(item);
  }

  protected previewTask(item: SyncTask): void {
    this.previewVisible = true;
    this.previewResult = null;
    this.sourcePreviewColumns = [];
    this.mappedPreviewColumns = [];
    this.previewingGuid = item.guid;
    this.previewLoading = true;
    this.taskService
      .preview(item.guid, { limit: 20 })
      .pipe(
        finalize(() => {
          this.previewingGuid = '';
          this.previewLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.previewResult = res;
          this.sourcePreviewColumns = this.rowKeys(res.sourceRows ?? []);
          this.mappedPreviewColumns = this.rowKeys(res.mappedRows ?? []);
          if (!res.count) this.message.info('当前任务没有可预览的数据');
        },
        error: (err) => this.message.error(err?.msg || err?.message || '预览同步任务失败'),
      });
  }

  protected saveAsTemplate(item: SyncTask): void {
    this.templatingGuid = item.guid;
    this.taskService
      .saveTemplateFromTask(item.guid, {
        name: `${item.name} 模板`,
        description: `${item.sourceTable} → ${item.targetTable}`,
      })
      .pipe(
        finalize(() => {
          this.templatingGuid = '';
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.message.success('已保存为同步模板'),
        error: (err) => this.message.error(err?.msg || err?.message || '保存同步模板失败'),
      });
  }

  protected closePreview(): void {
    this.previewVisible = false;
  }

  protected reloadSchedules(): void {
    this.scheduleLoading = true;
    this.taskService
      .reloadSchedules()
      .pipe(
        finalize(() => {
          this.scheduleLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('调度已重载');
          this.loadSchedules();
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '重载调度失败'),
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

  protected scheduleLabel(item: SyncTask): string {
    return Number(item.scheduleOn) === 1 ? item.cronExpr || '已启用' : '手动';
  }

  protected isRunning(item: SyncTask): boolean {
    return item.lastRunStatus === 'running';
  }

  protected cellText(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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

  private loadSchedules(): void {
    this.taskService.schedules().subscribe({
      next: (items) => {
        this.schedules = items ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.schedules = [];
        this.cdr.markForCheck();
      },
    });
  }

  private rowKeys(rows: MapperRow[]): string[] {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return Array.from(keys);
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
