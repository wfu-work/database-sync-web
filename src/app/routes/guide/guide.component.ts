import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';

interface GuideStep {
  title: string;
  desc: string;
  path?: string;
  action?: string;
  fields: string[];
}

@Component({
  selector: 'app-guide',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SHARED_IMPORTS, TitleLabelComponent],
})
export class GuideComponent {
  protected readonly steps: GuideStep[] = [
    {
      title: '创建数据源',
      desc: '录入 MySQL 或 TDengine 的连接信息，并使用测试连接确认服务可达。',
      path: '/datasources/create',
      action: '新建数据源',
      fields: ['type: mysql / tdengine', 'host / port', 'username / password', 'database'],
    },
    {
      title: '配置同步任务',
      desc: '选择源数据源和目标数据源，填写表名、同步模式、批次大小与写入策略。',
      path: '/sync/tasks/create',
      action: '新建任务',
      fields: ['sourceGuid / targetGuid', 'sourceTable / targetTable', 'mode', 'writeMode'],
    },
    {
      title: '维护字段映射',
      desc: '把源字段映射到目标字段，可补默认值，也可使用简单转换函数处理时间和数值。',
      fields: ['source', 'target', 'default', 'transform: time_to_millis / float / int'],
    },
    {
      title: '执行与排查',
      desc: '手动启动任务后查看运行进度；失败时进入失败明细定位源数据快照和错误原因。',
      path: '/sync/runs/list',
      action: '查看历史',
      fields: ['processedCount', 'successCount', 'failedCount', 'cursorEnd', 'errorMessage'],
    },
  ];

  protected readonly checks = [
    '增量同步必须填写 cursorField，建议使用自增主键、更新时间字段或 TDengine 时间字段。',
    '字段映射数组中的每一项都必须包含 target，并提供 source 或 default。',
    '数据源被同步任务引用时不能删除，需要先调整或删除相关任务。',
    '任务执行是异步的，启动后进入运行详情页查看进度和失败明细。',
  ];
}
