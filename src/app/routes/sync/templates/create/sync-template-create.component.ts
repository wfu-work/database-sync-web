import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { SHARED_IMPORTS } from '@shared';
import {
  ColumnInfo,
  DataSource,
  FieldMapping,
  SaveSyncTemplatePayload,
  SyncTemplate,
  TagMapping,
  TableInfo,
} from '@shared/types/datasync';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';

import { DataSourcesService } from '../../../datasources/datasources.service';
import { SyncTasksService } from '../../sync-tasks.service';

const FIELD_SAMPLE = [
  { source: 'created_at', target: 'ts', transform: 'time_to_millis' },
  { source: 'device_id', target: 'device_id' },
  { source: 'temperature', target: 'temperature', transform: 'float' },
];

interface TdengineTagRow {
  name: string;
  databaseType: string;
  source: string;
  defaultValue: string;
  transform: string;
  comment: string;
}

interface SyncTemplateModalData {
  template?: SyncTemplate;
}

@Component({
  selector: 'app-sync-template-create',
  templateUrl: './sync-template-create.component.html',
  styleUrls: ['./sync-template-create.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
})
export class SyncTemplateCreateComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(SyncTasksService);
  private readonly dataSourcesService = inject(DataSourcesService);
  private readonly message = inject(NzMessageService);
  private readonly modalRef = inject(NzModalRef, { optional: true });
  private readonly modalData = inject<SyncTemplateModalData>(NZ_MODAL_DATA, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef);

  protected dataSources: DataSource[] = [];
  protected sourceTables: TableInfo[] = [];
  protected targetTables: TableInfo[] = [];
  protected sourceColumns: ColumnInfo[] = [];
  protected targetColumns: ColumnInfo[] = [];
  protected saving = false;
  protected sourceTableLoading = false;
  protected targetTableLoading = false;
  protected sourceColumnLoading = false;
  protected targetColumnLoading = false;
  protected fieldError = '';
  protected tagError = '';
  protected formError = '';
  protected tagRows: TdengineTagRow[] = [];
  protected template: SyncTemplate | null = null;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    description: ['', [Validators.maxLength(512)]],
    sourceGuid: [''],
    targetGuid: [''],
    sourceTable: ['', [Validators.maxLength(255)]],
    targetTable: ['', [Validators.maxLength(255)]],
    mode: this.fb.control<'full' | 'incremental'>('full', [Validators.required]),
    cursorField: ['', [Validators.maxLength(128)]],
    cursorValue: ['', [Validators.maxLength(255)]],
    batchSize: [1000, [Validators.required, Validators.min(1)]],
    writeMode: this.fb.control<'insert' | 'upsert' | 'replace'>('insert', [Validators.required]),
    conflictKeys: ['', [Validators.maxLength(512)]],
    whereClause: [''],
    syncTimeField: ['', [Validators.maxLength(128)]],
    syncStartDate: [''],
    syncEndDate: [''],
    tdengineChildTableTemplate: ['', [Validators.maxLength(255)]],
    tdengineTags: [''],
    scheduleOn: [0, [Validators.required]],
    cronExpr: ['', [Validators.maxLength(128)]],
    fieldsText: [JSON.stringify(FIELD_SAMPLE, null, 2), [Validators.required]],
    remark: ['', [Validators.maxLength(512)]],
    status: [1, [Validators.required]],
  });

  ngOnInit(): void {
    this.template = this.modalData?.template ?? null;
    this.loadDataSources();
    if (this.template) {
      this.patchTemplate(this.template);
      if (this.template.sourceGuid) this.loadTables('source', this.template.sourceTable || '');
      if (this.template.targetGuid) this.loadTables('target', this.template.targetTable || '');
    }
  }

  protected get scheduleEnabled(): boolean {
    return Number(this.form.controls.scheduleOn.value) === 1;
  }

  protected get tdengineSourceSelected(): boolean {
    return this.selectedSourceDataSource()?.type === 'tdengine';
  }

  protected get tdengineTargetSelected(): boolean {
    return this.selectedTargetDataSource()?.type === 'tdengine';
  }

  protected insertSample(): void {
    this.form.controls.fieldsText.setValue(JSON.stringify(FIELD_SAMPLE, null, 2));
    this.fieldError = '';
  }

  protected formatFieldsJson(): void {
    const value = this.form.controls.fieldsText.value.trim();
    if (!value) {
      this.fieldError = '字段映射 JSON 不能为空';
      return;
    }
    try {
      this.form.controls.fieldsText.setValue(JSON.stringify(JSON.parse(value), null, 2));
      this.fieldError = '';
      this.message.success('字段映射 JSON 已格式化');
    } catch {
      this.fieldError = '字段映射不是合法 JSON，无法格式化';
    }
  }

  protected onSourceDataSourceChange(guid: string | null): void {
    this.form.controls.sourceTable.setValue('');
    this.form.controls.syncTimeField.setValue('');
    this.form.controls.syncStartDate.setValue('');
    this.form.controls.syncEndDate.setValue('');
    this.sourceTables = [];
    this.sourceColumns = [];
    if (guid) this.loadTables('source');
  }

  protected onTargetDataSourceChange(guid: string | null): void {
    this.form.controls.targetTable.setValue('');
    this.form.controls.tdengineChildTableTemplate.setValue('');
    this.form.controls.tdengineTags.setValue('');
    this.tagRows = [];
    this.tagError = '';
    this.targetTables = [];
    this.targetColumns = [];
    if (guid) this.loadTables('target');
  }

  protected onSourceTableChange(table: string | null): void {
    this.sourceColumns = [];
    this.form.controls.syncTimeField.setValue('');
    if (table) this.loadColumns('source', table);
  }

  protected onTargetTableChange(table: string | null): void {
    this.targetColumns = [];
    this.form.controls.tdengineTags.setValue('');
    this.tagRows = [];
    this.tagError = '';
    if (table) this.loadColumns('target', table);
  }

  protected generateSameNameTags(): void {
    if (this.tagRows.length === 0) {
      this.message.warning('目标超级表没有读取到 TAG 字段');
      return;
    }
    this.applySameNameTagSources(true);
    this.tagError = '';
    this.updateTdengineTagsControl();
    const matched = this.tagRows.filter((tag) => tag.source.trim()).length;
    if (matched > 0) {
      this.message.success(`已匹配 ${matched} 个同名 TAG 来源字段`);
    } else {
      this.message.warning('源表和目标 TAG 没有同名字段');
    }
  }

  protected clearTagValues(): void {
    this.tagRows = this.tagRows.map((tag) => ({
      ...tag,
      source: '',
      defaultValue: '',
      transform: '',
    }));
    this.tagError = '';
    this.updateTdengineTagsControl();
  }

  protected onTagRowChange(): void {
    this.tagError = '';
    this.updateTdengineTagsControl();
  }

  protected refreshSourceTables(): void {
    this.loadTables('source', this.form.controls.sourceTable.value || '');
  }

  protected refreshTargetTables(): void {
    this.loadTables('target', this.form.controls.targetTable.value || '');
  }

  protected generateSameNameMapping(): void {
    if (this.sourceColumns.length === 0 || this.targetColumns.length === 0) {
      this.message.warning('请先选择源表和目标表，读取字段后再生成映射');
      return;
    }

    const sourceMap = new Map(
      this.sourceColumns.map((column) => [column.name.toLowerCase(), column.name] as const),
    );
    const fields = this.targetColumns
      .filter((target) => !target.isTag)
      .map((target) => {
        const source = sourceMap.get(target.name.toLowerCase());
        if (!source) return null;
        return { source, target: target.name };
      })
      .filter((field): field is { source: string; target: string } => field !== null);

    if (fields.length === 0) {
      this.message.warning('源表和目标表没有同名字段');
      return;
    }
    this.form.controls.fieldsText.setValue(JSON.stringify(fields, null, 2));
    this.fieldError = '';
    this.message.success(`已生成 ${fields.length} 个同名字段映射`);
  }

  protected columnSummary(columns: ColumnInfo[]): string {
    if (columns.length === 0) return '未读取';
    return columns.map((column) => column.name).join(', ');
  }

  protected submit(): void {
    this.formError = '';
    this.fieldError = '';
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      return;
    }
    const payload = this.toPayload();
    if (!payload) return;

    this.saving = true;
    this.service
      .saveTemplate(payload, this.template?.guid)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.message.success(this.template ? '同步模板已更新' : '同步模板已创建');
          this.modalRef?.close(true);
        },
        error: (err) => this.message.error(err?.msg || err?.message || '保存同步模板失败'),
      });
  }

  protected cancel(): void {
    this.modalRef?.close(false);
  }

  private loadDataSources(): void {
    this.dataSourcesService.list({ all: true }).subscribe({
      next: (res) => {
        this.dataSources = res.data ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.dataSources = [];
        this.cdr.markForCheck();
      },
    });
  }

  private patchTemplate(item: SyncTemplate): void {
    this.tagError = '';
    this.tagRows = [];
    this.form.reset({
      name: item.name,
      description: item.description || '',
      sourceGuid: item.sourceGuid || '',
      targetGuid: item.targetGuid || '',
      sourceTable: item.sourceTable || '',
      targetTable: item.targetTable || '',
      mode: item.mode === 'incremental' ? 'incremental' : 'full',
      cursorField: item.cursorField || '',
      cursorValue: item.cursorValue || '',
      batchSize: item.batchSize || 1000,
      writeMode: this.normalizeWriteMode(item.writeMode),
      conflictKeys: item.conflictKeys || '',
      whereClause: item.whereClause || '',
      syncTimeField: item.syncTimeField || '',
      syncStartDate: item.syncStartDate || '',
      syncEndDate: item.syncEndDate || '',
      tdengineChildTableTemplate:
        item.tdengineChildTableTemplate || item.tdengineChildTableField || '',
      tdengineTags: this.prettyJson(item.tdengineTags, []),
      scheduleOn: Number(item.scheduleOn) || 0,
      cronExpr: item.cronExpr || '',
      fieldsText: this.prettyFields(item.fieldMapping),
      remark: item.remark || '',
      status: item.status ?? 1,
    });
  }

  private loadTables(kind: 'source' | 'target', selectedTable = ''): void {
    const guid =
      kind === 'source' ? this.form.controls.sourceGuid.value : this.form.controls.targetGuid.value;
    if (!guid) {
      this.message.warning(kind === 'source' ? '请先选择源数据源' : '请先选择目标数据源');
      return;
    }

    if (kind === 'source') {
      this.sourceTableLoading = true;
    } else {
      this.targetTableLoading = true;
    }

    this.dataSourcesService
      .tables(guid)
      .pipe(
        finalize(() => {
          if (kind === 'source') {
            this.sourceTableLoading = false;
          } else {
            this.targetTableLoading = false;
          }
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          const currentGuid =
            kind === 'source'
              ? this.form.controls.sourceGuid.value
              : this.form.controls.targetGuid.value;
          if (currentGuid !== guid) return;

          const value = selectedTable.trim();
          const tables = items ?? [];
          const normalized =
            !value || tables.some((item) => item.name === value)
              ? tables
              : [{ name: value, type: '', comment: '模板预填表' }, ...tables];

          if (kind === 'source') {
            this.sourceTables = normalized;
          } else {
            this.targetTables = normalized;
          }

          if (value) {
            this.loadColumns(kind, value);
          }
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取数据表失败'),
      });
  }

  private loadColumns(kind: 'source' | 'target', table: string): void {
    const guid =
      kind === 'source' ? this.form.controls.sourceGuid.value : this.form.controls.targetGuid.value;
    table = table.trim();
    if (!guid || !table) return;

    if (kind === 'source') {
      this.sourceColumnLoading = true;
    } else {
      this.targetColumnLoading = true;
    }

    this.dataSourcesService
      .columns(guid, table)
      .pipe(
        finalize(() => {
          if (kind === 'source') {
            this.sourceColumnLoading = false;
          } else {
            this.targetColumnLoading = false;
          }
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (items) => {
          const currentGuid =
            kind === 'source'
              ? this.form.controls.sourceGuid.value
              : this.form.controls.targetGuid.value;
          const currentTable =
            kind === 'source'
              ? this.form.controls.sourceTable.value
              : this.form.controls.targetTable.value;
          if (currentGuid !== guid || currentTable !== table) return;

          if (kind === 'source') {
            this.sourceColumns = items ?? [];
            this.fillDefaultSyncTimeField();
            this.applySameNameTagSources(false);
            this.updateTdengineTagsControl();
          } else {
            this.targetColumns = items ?? [];
            this.syncTagRowsFromTargetColumns();
          }
        },
        error: (err) => this.message.error(err?.msg || err?.message || '读取字段失败'),
      });
  }

  private toPayload(): SaveSyncTemplatePayload | null {
    const value = this.form.getRawValue();
    const scheduleOn = Number(value.scheduleOn);
    if (scheduleOn === 1 && !value.cronExpr.trim()) {
      this.formError = '启用定时时必须填写 Cron 表达式';
      return null;
    }
    if (value.mode === 'incremental' && !value.cursorField.trim()) {
      this.formError = '增量模板必须填写游标字段';
      return null;
    }
    if (this.tdengineTargetSelected && !value.tdengineChildTableTemplate.trim()) {
      this.formError = 'TDengine 目标库必须填写子表名模板';
      return null;
    }
    const fields = this.parseFields(value.fieldsText);
    if (!fields) return null;
    const tdengineTags = this.tdengineTargetSelected ? this.buildTagMappings() : [];
    if (tdengineTags === null) return null;
    const tdengineTagsText = this.tdengineTargetSelected ? JSON.stringify(tdengineTags) : '';
    return {
      name: value.name.trim(),
      description: value.description.trim(),
      sourceGuid: value.sourceGuid,
      targetGuid: value.targetGuid,
      sourceTable: (value.sourceTable || '').trim(),
      targetTable: (value.targetTable || '').trim(),
      mode: value.mode,
      cursorField: value.cursorField.trim(),
      cursorValue: value.cursorValue.trim(),
      batchSize: value.batchSize,
      fields,
      writeMode: value.writeMode,
      conflictKeys: value.conflictKeys.trim(),
      whereClause: value.whereClause.trim(),
      syncTimeField: value.syncTimeField.trim(),
      syncStartDate: value.syncStartDate.trim(),
      syncEndDate: value.syncEndDate.trim(),
      tdengineChildTableTemplate: this.tdengineTargetSelected
        ? value.tdengineChildTableTemplate.trim()
        : '',
      tdengineChildTableField: '',
      tdengineTags: tdengineTagsText,
      tdengineTagMappings: this.tdengineTargetSelected ? tdengineTags : [],
      cronExpr: scheduleOn === 1 ? value.cronExpr.trim() : '',
      scheduleOn,
      remark: value.remark.trim(),
      status: Number(value.status),
    };
  }

  private parseFields(value: string): FieldMapping[] | null {
    try {
      const fields = JSON.parse(value) as FieldMapping[];
      if (!Array.isArray(fields) || fields.length === 0) {
        this.fieldError = '字段映射必须是非空数组';
        return null;
      }
      const invalidIndex = fields.findIndex(
        (field) => !field.target || (!field.source && field.default === undefined),
      );
      if (invalidIndex >= 0) {
        this.fieldError = `第 ${invalidIndex + 1} 个字段必须包含 target，并提供 source 或 default`;
        return null;
      }
      return fields;
    } catch {
      this.fieldError = '字段映射不是合法 JSON';
      return null;
    }
  }

  private syncTagRowsFromTargetColumns(): void {
    const tagColumns = this.targetColumns.filter((column) => column.isTag);
    const existing = this.parseExistingTagMappings();
    this.tagRows = tagColumns.map((column) => {
      const saved = existing.get(column.name.toLowerCase());
      return {
        name: column.name,
        databaseType: column.databaseType,
        source: saved?.source || '',
        defaultValue:
          saved?.default === undefined || saved?.default === null ? '' : String(saved.default),
        transform: saved?.transform || '',
        comment: column.comment || '',
      };
    });
    this.applySameNameTagSources(false);
    this.tagError = '';
    this.updateTdengineTagsControl();
  }

  private parseExistingTagMappings(): Map<string, TagMapping> {
    const mappings = new Map<string, TagMapping>();
    const value = this.form.controls.tdengineTags.value.trim();
    if (!value) return mappings;
    try {
      const tags = JSON.parse(value) as TagMapping[];
      if (!Array.isArray(tags)) return mappings;
      for (const tag of tags) {
        const name = (tag?.name || '').trim();
        if (!name) continue;
        mappings.set(name.toLowerCase(), tag);
      }
    } catch {
      // Older invalid JSON should not block loading the target table structure.
    }
    return mappings;
  }

  private applySameNameTagSources(overwrite: boolean): void {
    if (this.tagRows.length === 0 || this.sourceColumns.length === 0) return;
    const sourceMap = new Map(
      this.sourceColumns.map((column) => [column.name.toLowerCase(), column.name] as const),
    );
    this.tagRows = this.tagRows.map((tag) => {
      if (!overwrite && (tag.source.trim() || tag.defaultValue.trim())) return tag;
      const source = sourceMap.get(tag.name.toLowerCase());
      return source ? { ...tag, source } : tag;
    });
  }

  private buildTagMappings(): TagMapping[] | null {
    if (this.tagRows.length === 0) {
      this.tagError = '目标超级表没有读取到 TAG 字段，请确认选择的是超级表';
      return null;
    }
    const invalidIndex = this.tagRows.findIndex(
      (tag) => !tag.source.trim() && !tag.defaultValue.trim(),
    );
    if (invalidIndex >= 0) {
      this.tagError = `TAG「${this.tagRows[invalidIndex].name}」必须选择来源字段或填写默认值`;
      return null;
    }
    const mappings: TagMapping[] = this.tagRows.map((tag) => {
      const mapping: TagMapping = { name: tag.name };
      if (tag.source.trim()) {
        mapping.source = tag.source.trim();
      } else {
        mapping.default = this.parseDefaultValue(tag.defaultValue);
      }
      if (tag.transform.trim()) {
        mapping.transform = tag.transform.trim();
      }
      return mapping;
    });
    this.tagError = '';
    this.form.controls.tdengineTags.setValue(JSON.stringify(mappings, null, 2));
    return mappings;
  }

  private updateTdengineTagsControl(): void {
    const mappings = this.tagRows.map((tag) => {
      const mapping: TagMapping = { name: tag.name };
      if (tag.source.trim()) {
        mapping.source = tag.source.trim();
      } else if (tag.defaultValue.trim()) {
        mapping.default = this.parseDefaultValue(tag.defaultValue);
      }
      if (tag.transform.trim()) {
        mapping.transform = tag.transform.trim();
      }
      return mapping;
    });
    this.form.controls.tdengineTags.setValue(JSON.stringify(mappings, null, 2));
  }

  private parseDefaultValue(value: string): unknown {
    const text = value.trim();
    if (text === '') return '';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private prettyFields(value: string): string {
    return this.prettyJson(value, FIELD_SAMPLE);
  }

  private prettyJson(value: string, fallback: unknown): string {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value || JSON.stringify(fallback, null, 2);
    }
  }

  private normalizeWriteMode(value: string): 'insert' | 'upsert' | 'replace' {
    if (value === 'upsert' || value === 'replace') return value;
    return 'insert';
  }

  private selectedSourceDataSource(): DataSource | undefined {
    const guid = this.form.controls.sourceGuid.value;
    return this.dataSources.find((item) => item.guid === guid);
  }

  private selectedTargetDataSource(): DataSource | undefined {
    const guid = this.form.controls.targetGuid.value;
    return this.dataSources.find((item) => item.guid === guid);
  }

  private fillDefaultSyncTimeField(): void {
    if (!this.tdengineSourceSelected || this.form.controls.syncTimeField.value.trim()) return;
    const preferredNames = ['gps_time', 'time', 'ts'];
    const preferredColumn =
      preferredNames
        .map((name) => this.sourceColumns.find((column) => column.name.toLowerCase() === name))
        .find((column) => column !== undefined) ?? this.sourceColumns[0];
    if (preferredColumn) {
      this.form.controls.syncTimeField.setValue(preferredColumn.name);
    }
  }
}
