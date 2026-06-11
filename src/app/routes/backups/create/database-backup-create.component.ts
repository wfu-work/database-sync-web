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

  protected readonly form = this.fb.group({
    dataSourceGuid: ['', [Validators.required]],
    tables: this.fb.control<string[]>([]),
    batchSize: [1000, [Validators.required, Validators.min(1)]],
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
    this.form.reset({
      dataSourceGuid: '',
      tables: [],
      batchSize: 1000,
      remark: '',
    });
  }

  protected onDataSourceChange(guid: string): void {
    this.form.controls.tables.setValue([]);
    this.tables = [];
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
      .start({
        dataSourceGuid: value.dataSourceGuid,
        tables: value.tables,
        batchSize: value.batchSize,
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
