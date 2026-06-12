import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, TableInfo } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../datasources/datasources.service';
import { DatabaseBackupsService } from '../database-backups.service';

const TDENGINE_BACKUP_PARAMS = {
  timeout: '5m',
};

const MYSQL_BACKUP_PARAMS = {
  timeout: '30s',
  readTimeout: '5m',
  writeTimeout: '5m',
  interpolateParams: 'true',
};

@Component({
  selector: 'app-database-backup-create',
  templateUrl: './database-backup-create.component.html',
  styleUrls: ['./database-backup-create.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DatabaseBackupCreateComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly backupsService = inject(DatabaseBackupsService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected dataSources: DataSource[] = [];
  protected tables: TableInfo[] = [];
  protected dataSourceLoading = false;
  protected tableLoading = false;
  protected saving = false;
  protected paramsError = '';

  protected readonly form = this.fb.group({
    dataSourceGuid: ['', [Validators.required]],
    tables: this.fb.control<string[]>([]),
    batchSize: [1000, [Validators.required, Validators.min(1)]],
    connectionParams: [''],
    retryTimes: [2, [Validators.required, Validators.min(0), Validators.max(10)]],
    retryIntervalMs: [1500, [Validators.required, Validators.min(0)]],
    remark: ['', [Validators.maxLength(512)]],
  });

  ngOnInit(): void {
    this.loadDataSources();
  }

  protected goHistory(): void {
    this.router.navigate(['/backups/history']);
  }

  protected resetForm(): void {
    this.tables = [];
    this.paramsError = '';
    this.form.reset({
      dataSourceGuid: '',
      tables: [],
      batchSize: 1000,
      connectionParams: '',
      retryTimes: 2,
      retryIntervalMs: 1500,
      remark: '',
    });
  }

  protected onDataSourceChange(guid: string): void {
    this.form.controls.tables.setValue([]);
    this.tables = [];
    this.paramsError = '';
    this.applyRecommendedParams();
    if (!guid) return;

    this.tableLoading = true;
    this.dataSourcesService
      .tables(guid)
      .pipe(
        finalize(() => {
          this.tableLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          if (this.form.controls.dataSourceGuid.value !== guid) return;
          this.tables = items ?? [];
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取数据表失败'),
      });
  }

  protected selectAllTables(): void {
    this.form.controls.tables.setValue(this.tables.map((table) => table.name));
  }

  protected clearTables(): void {
    this.form.controls.tables.setValue([]);
  }

  protected selectedDataSource(): DataSource | undefined {
    const guid = this.form.controls.dataSourceGuid.value;
    return this.dataSources.find((item) => item.guid === guid);
  }

  protected selectedTypeLabel(): string {
    const type = this.selectedDataSource()?.type;
    return this.normalizeType(type) === 'tdengine' ? 'TDengine' : 'MySQL';
  }

  protected applyRecommendedParams(): void {
    const params =
      this.normalizeType(this.selectedDataSource()?.type) === 'tdengine'
        ? TDENGINE_BACKUP_PARAMS
        : MYSQL_BACKUP_PARAMS;
    this.form.controls.connectionParams.setValue(JSON.stringify(params, null, 2));
    this.paramsError = '';
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
    const connectionParams = this.normalizeConnectionParams(value.connectionParams);
    if (connectionParams === null) return;
    this.saving = true;
    this.backupsService
      .start({
        dataSourceGuid: value.dataSourceGuid,
        tables: value.tables,
        batchSize: value.batchSize,
        connectionParams,
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
          this.message.success('数据库备份已开始');
          this.goHistory();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '启动备份失败'),
      });
  }

  private normalizeType(type?: string): 'mysql' | 'tdengine' {
    return type === 'tdengine' || type === 'td' || type === 'taos' ? 'tdengine' : 'mysql';
  }

  private normalizeConnectionParams(value: string): string | null {
    value = value.trim();
    this.paramsError = '';
    if (!value) return '';
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        this.paramsError = '连接参数必须是 JSON 对象';
        return null;
      }
      return JSON.stringify(parsed);
    } catch {
      this.paramsError = '连接参数不是合法 JSON';
      return null;
    }
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
}
