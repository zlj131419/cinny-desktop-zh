import { useMatch, useParams } from 'react-router-dom';
import { getExploreFeaturedPath, getExploreManagePath, getExplorePath } from '../../pages/pathUtils';

export const useExploreSelected = (): boolean => {
  const match = useMatch({
    path: getExplorePath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useExploreFeaturedSelected = (): boolean => {
  const match = useMatch({
    path: getExploreFeaturedPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useExploreServer = (): string | undefined => {
  const { server } = useParams();

  return server;
};

export const useExploreManageSelected = (): boolean => {
  const match = useMatch({
    path: getExploreManagePath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};
