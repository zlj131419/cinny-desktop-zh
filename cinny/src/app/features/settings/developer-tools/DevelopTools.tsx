import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Text, IconButton, Icon, Icons, Scroll, Switch, Button, color } from 'folds';
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
import { SIYU_VERSION } from '../../../../version';
import { AccountData } from './AccountData';

type DeveloperToolsProps = {
  requestClose: () => void;
};
// 远程小工具：工具脚本放在自家服务器 public/tools/ 下，打开本页时现拉清单、
// 点运行时现拉脚本在本页环境执行——App 里跑出的就是 App 的真实数据。
// 新增/修改检测工具只更新服务器文件即可，已装机的 App 立刻能用，绕开发版打包。
const TOOLS_BASE = 'https://chat.xxqw.net/public/tools/';

type RemoteToolDef = { id: string; name: string; desc?: string; file: string; version?: number };

function loadToolScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${url}?t=${Date.now()}`;
    s.onload = () => {
      s.remove();
      resolve();
    };
    s.onerror = () => {
      s.remove();
      reject(new Error('脚本加载失败（检查网络或服务器 tools 目录）'));
    };
    document.head.appendChild(s);
  });
}

function RemoteTools() {
  const [tools, setTools] = useState<RemoteToolDef[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      await loadToolScript(`${TOOLS_BASE}manifest.js`);
      const list = (window as unknown as Record<string, unknown>)
        .__siyuToolsManifest as RemoteToolDef[] | undefined;
      if (!Array.isArray(list)) throw new Error('工具清单格式不对');
      setTools(list);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runTool = async (tool: RemoteToolDef) => {
    setRunningId(tool.id);
    const lines: string[] = [];
    const report = (line: string) => {
      lines.push(line);
      setOutputs((prev) => ({ ...prev, [tool.id]: lines.join('\n') }));
    };
    report(`开始运行：${tool.name}`);
    try {
      await loadToolScript(`${TOOLS_BASE}${tool.file}`);
      const registry = (window as unknown as Record<string, unknown>).__siyuTools as
        | Record<string, (ctx: { report: (l: string) => void; appVersion: string }) => Promise<void>>
        | undefined;
      const fn = registry?.[tool.id];
      if (typeof fn !== 'function') throw new Error('工具脚本未注册');
      await fn({ report, appVersion: SIYU_VERSION });
    } catch (e) {
      report(`运行失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">远程小工具（服务器现拉现跑，不用等发版）</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column" gap="400">
        <Box direction="Column" gap="300">
          {listError && (
            <Text size="T300" style={{ color: color.Critical.Main }}>
              工具清单加载失败：{listError}
            </Text>
          )}
          {tools === null && !listError && <Text size="T300">正在加载工具清单…</Text>}
          {tools?.map((tool) => (
            <Box key={tool.id} direction="Column" gap="200">
              <Box direction="Column" gap="100">
                <Text size="T400">
                  {tool.name}
                  {tool.version ? ` · v${tool.version}` : ''}
                </Text>
                {tool.desc && (
                  <Text size="T300" priority="400">
                    {tool.desc}
                  </Text>
                )}
              </Box>
              {outputs[tool.id] && (
                <Text size="T300" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {outputs[tool.id]}
                </Text>
              )}
              <Box gap="200">
                <Button
                  onClick={() => void runTool(tool)}
                  variant="Secondary"
                  fill="Soft"
                  size="300"
                  radii="300"
                  outlined
                  disabled={runningId === tool.id}
                >
                  <Text size="B300">{runningId === tool.id ? '运行中…' : '运行'}</Text>
                </Button>
                {outputs[tool.id] && (
                  <Button
                    onClick={() => copyToClipboard(outputs[tool.id])}
                    variant="Secondary"
                    fill="Soft"
                    size="300"
                    radii="300"
                    outlined
                  >
                    <Text size="B300">复制结果</Text>
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          <Box>
            <Button
              onClick={() => void loadList()}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
            >
              <Text size="B300">刷新工具清单</Text>
            </Button>
          </Box>
        </Box>
      </SequenceCard>
    </Box>
  );
}

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
              {developerTools && <RemoteTools />}
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
