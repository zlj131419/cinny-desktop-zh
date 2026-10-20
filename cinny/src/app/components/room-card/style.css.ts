import { style } from '@vanilla-extract/css';
import { DefaultReset, config } from 'folds';
import { ContainerColor } from '../../styles/ContainerColor.css';

export const CardGrid = style({
  display: 'grid',
  // 纯 CSS 按容器宽算列：不再用 JS 量宽写内联样式（WebView 里量宽误差曾把手机端压成单列）
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
  gap: config.space.S300,
  '@media': {
    'screen and (min-width: 768px)': {
      gap: config.space.S400,
    },
  },
});

export const RoomCardBase = style([
  DefaultReset,
  ContainerColor({ variant: 'SurfaceVariant' }),
  {
    padding: config.space.S500,
    borderRadius: config.radii.R500,
  },
]);

export const RoomCardTopic = style({
  minHeight: `calc(3 * ${config.lineHeight.T200})`,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  cursor: 'pointer',

  ':hover': {
    textDecoration: 'underline',
  },
});

export const ActionButton = style({
  flex: '1 1 0',
  minWidth: 1,
});
