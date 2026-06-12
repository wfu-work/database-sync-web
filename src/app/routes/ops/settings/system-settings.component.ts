import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { SyncSystemSettings, SystemSettingsService } from '../system-settings.service';

const DEFAULT_SETTINGS: SyncSystemSettings = {
  backupBatchSize: 1000,
  backupRetryTimes: 3,
  backupRetryIntervalMs: 3000,
  tdengineParams: '{"timeout":"5m"}',
  mysqlParams: '{"timeout":"5m","readTimeout":"5m","writeTimeout":"5m"}',
  syncBatchSize: 1000,
  monitorRefreshSeconds: 5,
  notificationRetentionDays: 30,
  backupRetentionDays: 30,
  logLevel: 'info',
};

@Component({
  selector: 'app-system-settings',
  templateUrl: './system-settings.component.html',
  styleUrls: ['./system-settings.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class SystemSettingsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(SystemSettingsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected loading = false;
  protected saving = false;
  protected updateTime = 0;
  protected readonly form = this.fb.group({
    backupBatchSize: [DEFAULT_SETTINGS.backupBatchSize, [Validators.required, Validators.min(1)]],
    backupRetryTimes: [DEFAULT_SETTINGS.backupRetryTimes, [Validators.required, Validators.min(0)]],
    backupRetryIntervalMs: [
      DEFAULT_SETTINGS.backupRetryIntervalMs,
      [Validators.required, Validators.min(0)],
    ],
    tdengineParams: [DEFAULT_SETTINGS.tdengineParams],
    mysqlParams: [DEFAULT_SETTINGS.mysqlParams],
    syncBatchSize: [DEFAULT_SETTINGS.syncBatchSize, [Validators.required, Validators.min(1)]],
    monitorRefreshSeconds: [
      DEFAULT_SETTINGS.monitorRefreshSeconds,
      [Validators.required, Validators.min(3)],
    ],
    notificationRetentionDays: [
      DEFAULT_SETTINGS.notificationRetentionDays,
      [Validators.required, Validators.min(1)],
    ],
    backupRetentionDays: [
      DEFAULT_SETTINGS.backupRetentionDays,
      [Validators.required, Validators.min(1)],
    ],
    logLevel: [DEFAULT_SETTINGS.logLevel, [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected save(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }
    if (!this.isJsonObject(this.form.controls.tdengineParams.value)) {
      this.message.error('TDengine 连接参数必须是 JSON 对象');
      return;
    }
    if (!this.isJsonObject(this.form.controls.mysqlParams.value)) {
      this.message.error('MySQL 连接参数必须是 JSON 对象');
      return;
    }

    const payload = this.form.getRawValue();
    this.saving = true;
    this.service
      .saveSync(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.form.reset({ ...DEFAULT_SETTINGS, ...res });
          this.updateTime = res.updateTime ?? Date.now();
          this.message.success('同步设置已保存');
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存同步设置失败'),
      });
  }

  protected resetDefaults(): void {
    this.form.reset(DEFAULT_SETTINGS);
    this.message.info('已恢复推荐默认值，保存后生效');
  }

  protected load(): void {
    this.loading = true;
    this.service
      .getSync()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.form.reset({ ...DEFAULT_SETTINGS, ...res });
          this.updateTime = res.updateTime ?? 0;
        },
        error: (err) => {
          this.form.reset(DEFAULT_SETTINGS);
          this.message.error(err?.msg || err?.message || '读取同步设置失败');
        },
      });
  }

  protected formatTime(value?: number): string {
    if (!value) return '未保存';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未保存';
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  private isJsonObject(value: string): boolean {
    if (!value.trim()) return true;
    try {
      const parsed = JSON.parse(value) as unknown;
      return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }
}
