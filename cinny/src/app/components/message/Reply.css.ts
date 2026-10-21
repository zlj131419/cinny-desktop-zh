import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const ReplyBend = style({
  flexShrink: 0,
});

export const ThreadIndicator = style({
  opacity: config.opacity.P300,

  selectors: {
    'button&': {
      cursor: 'pointer',
    },
    ':hover&': {
      opacity: config.opacity.P500,
    },
  },
});

export const Reply = style({
  marginBottom: toRem(1),
  minWidth: 0,
  // 按容器列宽封顶（容器已改为撑满列宽、宽度确定）；早先用 vw 算宽会在桌面端超列溢出、用 % 又因容器收缩而失效
  maxWidth: '100%',
  minHeight: config.lineHeight.T300,
  overflow: 'hidden',
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
  },
});

export const ReplyContent = style({
  opacity: config.opacity.P300,
  minWidth: 0,
  overflow: 'hidden',

  selectors: {
    [`${Reply}:hover &`]: {
      opacity: config.opacity.P500,
    },
  },
});
