import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize } from 'rxjs';

import { ClientsService, RelayClient } from '../clients.service';

@Component({
  selector: 'app-client-edit',
  templateUrl: './client-edit.component.html',
  styleUrls: ['./client-edit.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class ClientEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly clientsService = inject(ClientsService);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected loading = false;
  protected saving = false;
  protected client: RelayClient | null = null;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    platform: ['', [Validators.maxLength(50)]],
    version: ['', [Validators.maxLength(50)]],
    status: [2, [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const guid = this.route.snapshot.paramMap.get('guid');
    if (!guid) return;
    this.loading = true;
    this.clientsService
      .get(guid)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.client = res;
        this.form.patchValue({
          name: res.name || '',
          platform: res.platform || '',
          version: res.version || '',
          status: res.status || 2,
        });
      });
  }

  protected submit(): void {
    if (!this.client) return;
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }
    const value = this.form.getRawValue();
    this.saving = true;
    this.clientsService
      .update(this.client.guid, {
        name: value.name.trim(),
        platform: this.clean(value.platform),
        version: this.clean(value.version),
        status: value.status,
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe(() => {
        this.message.success('凭证已更新');
        this.router.navigate(['/clients/detail', this.client?.guid]);
      });
  }

  protected back(): void {
    if (this.client) {
      this.router.navigate(['/clients/detail', this.client.guid]);
      return;
    }
    this.router.navigate(['/clients/list']);
  }

  private clean(value: string): string | undefined {
    const text = value.trim();
    return text ? text : undefined;
  }
}
