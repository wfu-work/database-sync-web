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
import { ScheduleItem, SyncTask } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { SyncTasksService } from '../sync-tasks.service';

interface ScheduleRow {
  guid: string;
  name: string;
  cronExpr: string;
  entryId: number;
  task?: SyncTask;
}

@Component({
  selector: 'app-sync-schedule-list',
  templateUrl: './sync-schedule-list.component.html',
  styleUrls: ['./sync-schedule-list.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncScheduleListComponent implements OnInit {
  private readonly service = inject(SyncTasksService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
    status: '',
  };

  protected data: ScheduleRow[] = [];
  protected total = 0;
  protected loading = false;
  protected reloading = false;
  protected runningGuid = '';
  protected readonly columns: Array<STColumn<ScheduleRow>> = [
    { title: '调度任务', index: 'name', render: 'taskRender' },
    { title: 'Cron', index: 'cronExpr', render: 'cronRender', width: 220 },
    { title: '状态', index: 'task.status', render: 'statusRender', width: 140 },
    { title: '最近运行', index: 'task.lastRunStatus', render: 'lastRunRender', width: 180 },
    { title: '操作', render: 'actionsRender', width: 210 },
  ];

  ngOnInit(): void {
    this.getData();
  }

  protected getData(): void {
    this.loading = true;
    forkJoin({
      schedules: this.service.schedules().pipe(catchError(() => of([] as ScheduleItem[]))),
      tasks: this.service.list({ page: 1, size: 500, scheduleOn: 1 }),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ schedules, tasks }) => {
          const taskMap = new Map((tasks.data ?? []).map((item) => [item.guid, item]));
          const rows = (schedules ?? []).map((item) => ({
            guid: item.taskGuid,
            name: item.taskName,
            cronExpr: item.cronExpr,
            entryId: item.entryId,
            task: taskMap.get(item.taskGuid),
          }));
          this.data = this.filterRows(rows);
          this.total = this.data.length;
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取任务调度失败'),
      });
  }

  protected search(): void {
    this.q.page = 1;
    this.getData();
  }

  protected resetQuery(): void {
    this.q.page = 1;
    this.q.keyword = '';
    this.q.status = '';
    this.getData();
  }

  protected reloadSchedules(): void {
    this.reloading = true;
    this.service
      .reloadSchedules()
      .pipe(
        finalize(() => {
          this.reloading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('调度已重载');
          this.getData();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '重载调度失败'),
      });
  }

  protected run(row: ScheduleRow): void {
    this.runningGuid = row.guid;
    this.service
      .run(row.guid)
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

  protected statusLabel(task?: SyncTask): string {
    if (!task) return '调度中';
    return task.status === 1 ? '启用' : '禁用';
  }

  protected runStatusLabel(status?: string): string {
    const map: Record<string, string> = {
      pending: '等待',
      running: '运行中',
      success: '成功',
      failed: '失败',
      canceled: '取消',
    };
    return map[status || ''] || '-';
  }

  protected formatTime(value?: number): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  protected tableChange(event: STChange): void {
    switch (event.type) {
      case 'pi':
      case 'ps':
        this.q.page = event.pi;
        this.q.size = event.ps;
        break;
      default:
        break;
    }
  }

  private filterRows(rows: ScheduleRow[]): ScheduleRow[] {
    const keyword = this.q.keyword.trim().toLowerCase();
    const status = this.q.status;
    return rows.filter((row) => {
      const text = [row.name, row.guid, row.cronExpr, row.task?.sourceTable, row.task?.targetTable]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const keywordMatched = !keyword || text.includes(keyword);
      const statusMatched = !status || String(row.task?.status ?? 1) === status;
      return keywordMatched && statusMatched;
    });
  }
}
