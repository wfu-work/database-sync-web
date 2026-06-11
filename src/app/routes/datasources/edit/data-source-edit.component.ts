import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSource, DataSourceType, SaveDataSourcePayload } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../datasources.service';

@Component({
  selector: 'app-data-source-edit',
  templateUrl: './data-source-edit.component.html',
  styleUrls: ['./data-source-edit.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DataSourceEditComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  protected guid = '';
  protected item: DataSource | null = null;
  protected loading = false;
  protected saving = false;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    type: this.fb.control<DataSourceType>('mysql', [Validators.required]),
    host: ['127.0.0.1', [Validators.required, Validators.maxLength(255)]],
    port: [3306, [Validators.required, Validators.min(1)]],
    username: ['', [Validators.maxLength(128)]],
    password: ['', [Validators.maxLength(512)]],
    database: ['', [Validators.maxLength(128)]],
    params: [''],
    remark: ['', [Validators.maxLength(512)]],
    status: [1, [Validators.required]],
  });

  ngOnInit(): void {
    this.guid = this.route.snapshot.paramMap.get('guid') || '';
    if (!this.guid) {
      this.message.error('缺少数据源 GUID');
      this.goList();
      return;
    }
    const stateItem = history.state?.dataSource as DataSource | undefined;
    if (stateItem?.guid === this.guid) {
      this.item = stateItem;
      this.patchForm(stateItem);
      return;
    }
    this.loadDataSource();
  }

  protected goList(): void {
    this.router.navigate(['/datasources/list']);
  }

  protected resetForm(): void {
    if (!this.item) return;
    this.patchForm(this.item);
  }

  protected applyTypeDefaults(type: DataSourceType): void {
    const current = this.form.controls.port.value;
    if (current === 3306 || current === 6041 || !current) {
      this.form.controls.port.setValue(type === 'tdengine' ? 6041 : 3306);
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

    this.saving = true;
    this.service
      .save(this.toPayload(), this.guid)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('数据源已更新');
          this.goList();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存数据源失败'),
      });
  }

  private loadDataSource(): void {
    this.loading = true;
    this.service
      .list({ all: true })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          const item = (res.data ?? []).find((dataSource) => dataSource.guid === this.guid);
          if (!item) {
            this.message.error('数据源不存在或已被删除');
            this.goList();
            return;
          }
          this.item = item;
          this.patchForm(item);
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取数据源失败'),
      });
  }

  private patchForm(item: DataSource): void {
    this.form.reset({
      name: item.name,
      type: this.normalizeType(item.type),
      host: item.host,
      port: item.port,
      username: item.username ?? '',
      password: '',
      database: item.database ?? '',
      params: item.params ?? '',
      remark: item.remark ?? '',
      status: item.status ?? 1,
    });
  }

  private toPayload(): SaveDataSourcePayload {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      type: value.type,
      host: value.host.trim(),
      port: value.port,
      username: value.username.trim(),
      password: value.password.trim() || undefined,
      database: value.database.trim(),
      params: value.params.trim(),
      remark: value.remark.trim(),
      status: Number(value.status),
    };
  }

  private normalizeType(type: string): DataSourceType {
    return type === 'tdengine' || type === 'td' || type === 'taos' ? 'tdengine' : 'mysql';
  }
}
