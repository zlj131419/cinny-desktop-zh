import { atom } from 'jotai';

export type HomeFilter =
  | 'all'
  | 'favourite'
  | 'rooms'
  | 'friends'
  | 'spaces'
  | 'unread'
  | 'mentions';

/** 首页会话筛选（全部/收藏/房间/好友/空间/未读/提及）；顶栏五角星快捷切收藏用同一状态 */
export const homeFilterAtom = atom<HomeFilter>('all');
