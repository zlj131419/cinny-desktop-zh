import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Text, IconButton, Icon, Icons, Scroll, Switch, Button } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import {
  AccountDataEditor,
  AccountDataSubmitCallback,
} from '../../../components/AccountDataEditor';
import { copyToClipboard } from '../../../utils/dom';
import { AccountData } from './AccountData';

// 屏幕/布局诊断：真机上量视口、根容器和底部导航的真实位置（env 安全区等），截图或复制发回即可定位贴底问题
function measureLayout(): string {
  const lines: Array<[string, string]> = [];
  const push = (k: string, v: unknown) => lines.push([k, String(v)]);
  try {
    push('屏幕', `${screen.width}×${screen.height}`);
    push('窗口', `${window.innerWidth}×${window.innerHeight}`);
    push(
      '可视区',
      window.visualViewport
        ? `${Math.round(window.visualViewport.width)}×${Math.round(window.visualViewport.height)}`
        : '无'
    );
    push('html高', document.documentElement.clientHeight);
    push('html计算高', getComputedStyle(document.documentElement).height);
    const root = document.getElementById('root');
    if (root) {
      const r = root.getBoundingClientRect();
      push('#root', `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} h=${Math.round(r.height)}`);
    }
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '通讯录'
    );
    let bar: Element | null = btn ?? null;
    while (bar && bar.getBoundingClientRect().width < window.innerWidth * 0.9) {
      bar = bar.parentElement;
    }
    if (bar) {
      const r = bar.getBoundingClientRect();
      push('底栏', `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} h=${Math.round(r.height)}`);
    } else {
      push('底栏', '未找到');
    }
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    push('安全区上', cs.paddingTop);
    push('安全区下', cs.paddingBottom);
    probe.remove();
    push('桌面图标模式', (navigator as unknown as { standalone?: boolean }).standalone ?? '?');
    push('UA', navigator.userAgent);
  } catch (e) {
    push('出错', e instanceof Error ? e.message : e);
  }
  return lines.map(([k, v]) => `${k}：${v}`).join('\n');
}

function LayoutDiagnostics() {
  const [report, setReport] = useState<string>(() => measureLayout());
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">屏幕诊断（贴底问题定位）</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column" gap="400">
        <Box direction="Column" gap="200">
          <Text size="T300" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {report}
          </Text>
          <Box gap="200">
            <Button
              onClick={() => setReport(measureLayout())}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
            >
              <Text size="B300">重新测量</Text>
            </Button>
            <Button
              onClick={() => copyToClipboard(report)}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
            >
              <Text size="B300">复制诊断</Text>
            </Button>
          </Box>
        </Box>
      </SequenceCard>
    </Box>
  );
}

type DeveloperToolsProps = {
  requestClose: () => void;
};
export function DeveloperTools({ requestClose }: DeveloperToolsProps) {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const [developerTools, setDeveloperTools] = useSetting(settingsAtom, 'developerTools');
  const [expand, setExpend] = useState(false);
  const [accountDataType, setAccountDataType] = useState<string | null>();

  const submitAccountData: AccountDataSubmitCallback = useCallback(
    async (type, content) => {
      await mx.setAccountData(type, content);
    },
    [mx]
  );

  if (accountDataType !== undefined) {
    return (
      <AccountDataEditor
        type={accountDataType ?? undefined}
        content={accountDataType ? mx.getAccountData(accountDataType)?.getContent() : undefined}
        submitChange={submitAccountData}
        requestClose={() => setAccountDataType(undefined)}
      />
    );
  }

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              {t('features:settings.developer-tools.developer_tools')}
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <LayoutDiagnostics />
              <Box direction="Column" gap="100">
                <Text size="L400">{t('features:settings.developer-tools.options')}</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('features:settings.developer-tools.enable_developer_tools')}
                    after={
                      <Switch
                        variant="Primary"
                        value={developerTools}
                        onChange={setDeveloperTools}
                      />
                    }
                  />
                </SequenceCard>
                {developerTools && (
                  <SequenceCard
                    className={SequenceCardStyle}
                    variant="SurfaceVariant"
                    direction="Column"
                    gap="400"
                  >
                    <SettingTile
                      title={t('features:settings.developer-tools.access_token')}
                      description={t('features:settings.developer-tools.copy_access_token')}
                      after={
                        <Button
                          onClick={() =>
                            copyToClipboard(mx.getAccessToken() ?? '<NO_ACCESS_TOKEN_FOUND>')
                          }
                          variant="Secondary"
                          fill="Soft"
                          size="300"
                          radii="300"
                          outlined
                        >
                          <Text size="B300">{t('features:settings.developer-tools.copy')}</Text>
                        </Button>
                      }
                    />
                  </SequenceCard>
                )}
              </Box>
              {developerTools && (
                <AccountData
                  expand={expand}
                  onExpandToggle={setExpend}
                  onSelect={setAccountDataType}
                />
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
