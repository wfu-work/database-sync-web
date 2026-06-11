import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { STChange, STColumn } from '@delon/abc/st';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { SyncError, SyncProgress, SyncRun } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize, switchMap, takeWhile, timer } from 'rxjs';

import { SyncRunsService } from '../sync-runs.service';

@Component({
  selector: 'app-sync-run-detail',
  templateUrl: './sync-run-detail.component.html',
  styleUrls: ['./sync-run-detail.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SyncRunDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly runsService = inject(SyncRunsService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected guid = '';
  protected run: SyncRun | null = null;
  protected progress: SyncProgress | null = null;
  protected errors: SyncError[] = [];
  protected errorsTotal = 0;
  protected loading = false;
  protected errorsLoading = false;
  protected retrying = false;
  protected readonly q = {
    page: 1,
    size: 10,
    keyword: '',
  };
  protected readonly errorColumns: Array<STColumn<SyncError>> = [
    { title: '源数据标识', index: 'sourcePk', render: 'sourcePkRender', width: 180 },
    { title: '错误原因', index: 'errorMessage', render: 'errorRender' },
    { title: '源数据快照', index: 'sourceData', render: 'sourceDataRender', width: 420 },
    { title: '时间', index: 'createTime', render: 'timeRender', width: 180 },
  ];

  ngOnInit(): void {
    this.guid = this.route.snapshot.paramMap.get('guid') || '';
    this.loadRun();
    this.loadErrors();
    this.startPolling();
  }

  protected get percent(): number {
    return Math.round((this.progress?.progress ?? 0) * 100);
  }

  protected get status(): string {
    return this.progress?.status || this.run?.status || 'pending';
  }

  protected get progressStatus(): 'success' | 'exception' | 'active' | 'normal' {
    if (this.status === 'success') return 'success';
    if (this.status === 'failed') return 'exception';
    if (this.status === 'running') return 'active';
    return 'normal';
  }

  protected get canRetryErrors(): boolean {
    return (
      (this.progress?.failedCount ?? this.run?.failedCount ?? 0) > 0 && this.status !== 'running'
    );
  }

  protected refresh(): void {
    this.loadRun();
    this.loadErrors();
  }

  protected searchErrors(): void {
    this.q.page = 1;
    this.loadErrors();
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

  protected prettyJson(value: string): string {
    if (!value) return '-';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  protected retryErrors(): void {
    if (!this.guid || !this.canRetryErrors) return;
    this.modal.confirm({
      nzTitle: '重试失败明细',
      nzContent: '将基于当前运行记录中的失败行生成一次新的同步运行，确定继续？',
      nzOkText: '重试',
      nzCancelText: '取消',
      nzOnOk: () => {
        this.retrying = true;
        this.runsService
          .retryErrors(this.guid)
          .pipe(
            finalize(() => {
              this.retrying = false;
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: (run) => {
              this.message.success('失败明细已开始重试');
              this.router.navigate(['/sync/runs', run.guid]);
            },
            error: (err) => this.message.error(err?.msg || err?.message || '重试失败明细失败'),
          });
      },
    });
  }

  private loadRun(): void {
    if (!this.guid) return;
    this.loading = true;
    this.runsService
      .get(this.guid)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.run = res;
      });
  }

  private loadErrors(): void {
    if (!this.guid) return;
    this.errorsLoading = true;
    this.runsService
      .errors(this.guid, this.q)
      .pipe(
        finalize(() => {
          this.errorsLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.errors = res.data ?? [];
        this.errorsTotal = res.total ?? 0;
        this.q.page = res.page || this.q.page;
        this.q.size = res.size || this.q.size;
      });
  }

  private startPolling(): void {
    if (!this.guid) return;
    timer(0, 3000)
      .pipe(
        switchMap(() => this.runsService.progress(this.guid)),
        takeWhile((res) => !this.isTerminal(res.status), true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.progress = res;
        if (this.isTerminal(res.status)) {
          this.loadRun();
          this.loadErrors();
        }
        this.cdr.markForCheck();
      });
  }

  private isTerminal(status: string): boolean {
    return status === 'success' || status === 'failed' || status === 'canceled';
  }

  protected errorTableChange(event: STChange): void {
    switch (event.type) {
      case 'pi':
      case 'ps':
      case 'filter':
      case 'sort':
        this.q.page = event.pi;
        this.q.size = event.ps;
        this.loadErrors();
        break;
      default:
        break;
    }
  }
}
