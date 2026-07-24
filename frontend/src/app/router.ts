import { useCallback, useEffect, useState } from 'react';
import { appRoutePath, parseAppRoute, type AppRoute } from './routes';

export function useAppRouter() {
  const currentLocation = () => parseAppRoute(window.location.pathname, window.location.search);
  const [route, setRoute] = useState<AppRoute>(currentLocation);

  useEffect(() => {
    const handlePopState = () => setRoute(currentLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((
    nextRoute: Exclude<AppRoute, { name: 'not-found' }>,
    options?: { replace?: boolean },
  ) => {
    const path = appRoutePath(nextRoute);
    if (options?.replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
    setRoute(nextRoute);
  }, []);

  const back = useCallback((fallback: Exclude<AppRoute, { name: 'not-found' }>) => {
    if (window.history.length > 1) window.history.back();
    else navigate(fallback, { replace: true });
  }, [navigate]);

  return { route, navigate, back };
}
