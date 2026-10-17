import React from 'react';
import { Box, Button, Icon, Icons, Text, config, toRem } from 'folds';
import { useTranslation } from 'react-i18next';
import { Page, PageHero, PageHeroSection } from '../../components/page';
import SiyuIcon from '../../../../public/res/siyu-icon.png';

export function WelcomePage() {
  const { t } = useTranslation();

  return (
    <Page>
      <Box
        grow="Yes"
        style={{ padding: config.space.S400, paddingBottom: config.space.S700 }}
        alignItems="Center"
        justifyContent="Center"
      >
        <PageHeroSection>
          <PageHero
            icon={<img width="70" height="70" src={SiyuIcon} alt="私语 Siyu" />}
            title={t('pages:client.welcome_to_cinny')}
            subTitle={
              <span>
                {t('pages:client.yet_another_matrix_client')}{' '}
                <span>v1.0.0</span>
              </span>
            }
          >
            <Box justifyContent="Center" style={{ marginTop: config.space.S400 }}>
              <Button
                as="a"
                href="/public/download.html"
                target="_blank"
                rel="noreferrer noopener"
                before={<Icon size="200" src={Icons.Download} />}
              >
                <Text as="span" size="B400" truncate>
                  下载桌面客户端
                </Text>
              </Button>
            </Box>
          </PageHero>
        </PageHeroSection>
      </Box>
    </Page>
  );
}
