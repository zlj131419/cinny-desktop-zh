import React from 'react';
import { Box, Text, config } from 'folds';

/**
 * 私语 Siyu 品牌推荐语
 * 用于欢迎页、登录/注册页页尾上方展示
 * 响应式：桌面端大字号，手机端自动缩小
 */
export function SiyuSlogan() {
  return (
    <Box
      justifyContent="Center"
      alignItems="Center"
      direction="Column"
      gap="200"
      style={{
        padding: `${config.space.S400} ${config.space.S400}`,
        maxWidth: '720px',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <Text
        size="H4"
        style={{
          // 响应式字号：clamp(最小, 首选, 最大)
          fontSize: 'clamp(18px, 4vw, 26px)',
          lineHeight: 1.6,
          fontWeight: 600,
          color: 'var(--tc-surface-high)',
        }}
      >
        私语 Siyu，一款属于自己的聊天软件
      </Text>
      <Text
        size="B400"
        style={{
          fontSize: 'clamp(13px, 3.2vw, 16px)',
          lineHeight: 1.8,
          color: 'var(--tc-surface-normal)',
        }}
      >
        一切掌握在自己手里，聊天记录不经过任何第三方。轻快、中文、加密沟通，不收集、不画像、不打扰。聊天，本该如此安全 —— 私语 Siyu
      </Text>
    </Box>
  );
}
