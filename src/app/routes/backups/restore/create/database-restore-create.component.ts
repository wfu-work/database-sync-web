import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { SHARED_IMPORTS } from '@shared';
import { DataSource, DatabaseBackup, WriteMode } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../../datasources/datasources.service';
import { SyncSystemSettings, SystemSettingsService } from '../../../ops/system-settings.service';
import { DatabaseBackupsService } from '../../database-backups.service';

const DEFAULT_SETTINGS: Pick<
  SyncSystemSettings,
  | 'restoreBatchSize'
  | 'restoreWriteMode'
  | 'restoreCreateTable'
  | 'restoreTruncateBefore'
  | 'backupRetryTimes'
  | 'backupRetryIntervalMs'
> = {
  restoreBatchSize: 1000,
  restoreWriteMode: 'insert',
  restoreCreateTable: true,
  restoreTruncateBefore: false,
  backupRetryTimes: 3,
  backupRetryIntervalMs: 3000,
};

@Component({
  selector: 'app-database-restore-create',
  templateUrl: './database-restore-create.component.html',
  styleUrls: ['./database-restore-create.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
})
export class DatabaseRestoreCreateComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly settingsService = inject(SystemSettingsService);
  private readonly message = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef);

  protected dataSources: DataSource[] = [];
  protected backups: DatabaseBackup[] = [];
  protected selectedBackup: DatabaseBackup | null = null;
  protected backupLoading = false;
  protected dataSourceLoading = false;
  protected saving = false;

  protected readonly form = this.fb.group({
    backupGuid: ['', [Validators.required]],
    targetDataSourceGuid: [''],
    tables: this.fb.control<string[]>([]),
    batchSize: [DEFAULT_SETTINGS.restoreBatchSize, [Validators.required, Validators.min(1)]],
    writeMode: [DEFAULT_SETTINGS.restoreWriteMode, [Validators.required]],
    createTable: [DEFAULT_SETTINGS.restoreCreateTable],
    truncateBeforeRestore: [DEFAULT_SETTINGS.restoreTruncateBefore],
    retryTimes: [
      DEFAULT_SETTINGS.backupRetryTimes,
      [Validators.required, Validators.min(0), Validators.max(10)],
    ],
    retryIntervalMs: [
      DEFAULT_SETTINGS.backupRetryIntervalMs,
      [Validators.required, Validators.min(0)],
    ],
    remark: ['', [Validators.maxLength(512)]],
  });

  ngOnInit(): void {
    this.loadSettings();
    this.loadBackups();
    this.loadDataSources();
  }

  protected onBackupChange(guid: string): void {
    this.selectedBackup = this.backups.find((item) => item.guid === guid) ?? null;
    this.form.controls.tables.setValue([]);
    if (!this.form.controls.targetDataSourceGuid.value && this.selectedBackup?.dataSourceGuid) {
      this.form.controls.targetDataSourceGuid.setValue(this.selectedBackup.dataSourceGuid);
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }
    const value = this.form.getRawValue();
    this.saving = true;
    this.backupsService
      .restore(value.backupGuid, {
        targetDataSourceGuid: value.targetDataSourceGuid,
        tables: value.tables,
        batchSize: value.batchSize,
        writeMode: value.writeMode as WriteMode,
        createTable: value.createTable,
        truncateBeforeRestore: value.truncateBeforeRestore,
        retryTimes: value.retryTimes,
        retryIntervalMs: value.retryIntervalMs,
        remark: value.remark.trim(),
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('备份恢复已开始');
          this.modalRef?.close(true);
        },
        error: (err) => this.message.error(err?.msg || err?.message || '启动备份恢复失败'),
      });
  }

  protected cancel(): void {
    this.modalRef?.close(false);
  }

  protected backupTables(): string[] {
    return this.parsedTables(this.selectedBackup?.tables);
  }

  protected selectAllTables(): void {
    this.form.controls.tables.setValue(this.backupTables());
  }

  protected clearTables(): void {
    this.form.controls.tables.setValue([]);
  }

  protected selectedBackupLabel(item: DatabaseBackup): string {
    const file = item.fileName || item.guid;
    const rows = this.rowCount(item.totalRows);
    return `${file} · ${item.dataSourceName || '-'} · ${item.totalTables || 0} 表 / ${rows} 行`;
  }

  protected writeModeLabel(value: string): string {
    const map: Record<string, string> = {
      insert: '追加写入',
      replace: '覆盖主键',
      upsert: '冲突更新',
    };
    return map[value] || value || '-';
  }

  protected rowCount(value?: number): string {
    if (!value) return '0';
    return new Intl.NumberFormat('zh-CN').format(value);
  }

  private parsedTables(value?: string): string[] {
    if (!value) return [];
    try {
      const tables = JSON.parse(value) as unknown;
      return Array.isArray(tables) ? tables.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  private loadBackups(): void {
    this.backupLoading = true;
    this.backupsService
      .list({ page: 1, size: 100, status: 'success' })
      .pipe(
        finalize(() => {
          this.backupLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.backups = res.data ?? [];
          const current = this.form.controls.backupGuid.value;
          if (current) this.onBackupChange(current);
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取可恢复备份失败'),
      });
  }

  private loadDataSources(): void {
    this.dataSourceLoading = true;
    this.dataSourcesService
      .list({ all: true })
      .pipe(
        finalize(() => {
          this.dataSourceLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.dataSources = res.data ?? [];
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取数据源失败'),
      });
  }

  private loadSettings(): void {
    this.settingsService.getSync().subscribe({
      next: (settings) => {
        this.form.patchValue({
          batchSize: settings.restoreBatchSize || DEFAULT_SETTINGS.restoreBatchSize,
          writeMode: settings.restoreWriteMode || DEFAULT_SETTINGS.restoreWriteMode,
          createTable: settings.restoreCreateTable ?? DEFAULT_SETTINGS.restoreCreateTable,
          truncateBeforeRestore:
            settings.restoreTruncateBefore ?? DEFAULT_SETTINGS.restoreTruncateBefore,
          retryTimes: settings.backupRetryTimes ?? DEFAULT_SETTINGS.backupRetryTimes,
          retryIntervalMs: settings.backupRetryIntervalMs ?? DEFAULT_SETTINGS.backupRetryIntervalMs,
        });
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }
}
