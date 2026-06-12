import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SHARED_IMPORTS, TitleLabelComponent } from '@shared';

interface PolicyRecommendation {
  title: string;
  database: 'TDengine' | 'MySQL' | '通用';
  value: string;
  reason: string;
  tone: 'primary' | 'warning' | 'success';
}

@Component({
  selector: 'app-backup-policy',
  templateUrl: './backup-policy.component.html',
  styleUrls: ['./backup-policy.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, TitleLabelComponent],
})
export class BackupPolicyComponent {
  protected readonly tdengineTimeoutExample = '{"timeout":"5m"}';

  protected readonly recommendations: PolicyRecommendation[] = [
    {
      title: 'TDengine 长查询超时',
      database: 'TDengine',
      value: '{"timeout":"5m"}',
      reason: '大表首批查询慢时，延长 REST 查询等待时间，降低 EOF 或 Client.Timeout 概率。',
      tone: 'primary',
    },
    {
      title: 'TDengine 批次大小',
      database: 'TDengine',
      value: '500 - 2000',
      reason: '超级表或高频采集表建议先用小批次，确认稳定后再逐步调大。',
      tone: 'warning',
    },
    {
      title: 'MySQL 读写超时',
      database: 'MySQL',
      value: '{"timeout":"5m","readTimeout":"5m","writeTimeout":"5m"}',
      reason: '跨网络或大结果集导出时，避免单批读取被驱动或中间网络提前中断。',
      tone: 'primary',
    },
    {
      title: '失败自动重试',
      database: '通用',
      value: '3 次 / 3000ms',
      reason: '对短暂网络抖动、数据库连接池回收、REST 偶发断开更友好。',
      tone: 'success',
    },
    {
      title: '备份范围',
      database: '通用',
      value: '优先勾选核心表',
      reason: '首次备份建议分批验证，避免一张超大表拖住所有表的反馈。',
      tone: 'warning',
    },
  ];

  protected readonly playbooks = [
    {
      title: '大表优先稳住反馈',
      steps: ['批次先降到 500 或 1000', '连接参数 timeout 设置为 5m', '失败后在原记录上重试'],
    },
    {
      title: '网络不稳定时',
      steps: ['开启 2-3 次重试', '重试间隔 3000ms 以上', '观察备份详情里的当前表和批次进度'],
    },
    {
      title: '首次接入新库',
      steps: ['先只备份 1-2 张小表', '确认文件生成和下载正常', '再扩大到全库或核心业务表'],
    },
  ];
}
