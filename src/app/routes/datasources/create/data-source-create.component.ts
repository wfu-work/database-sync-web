import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { DataSourceType, SaveDataSourcePayload } from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../datasources.service';

@Component({
  selector: 'app-data-source-create',
  templateUrl: './data-source-create.component.html',
  styleUrls: ['./data-source-create.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class DataSourceCreateComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

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

  protected resetForm(): void {
    this.form.reset({
      name: '',
      type: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      username: '',
      password: '',
      database: '',
      params: '',
      remark: '',
      status: 1,
    });
  }

  protected goList(): void {
    this.router.navigate(['/datasources/list']);
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
      .save(this.toPayload())
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success('数据源已创建');
          this.goList();
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存数据源失败'),
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
}
