import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../public/PublicChrome';

export function PublicShell({ children, compact = false, showFooter = true }) {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target) window.requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }, [location.pathname, location.hash]);

  return (
    <div className="bb-public-shell">
      <PublicHeader />
      <main id="main-content" className={compact ? 'bb-public-main bb-public-main--full' : 'bb-public-main bb-public-main--contained'}>
        {children}
      </main>
      {showFooter ? <PublicFooter /> : null}
    </div>
  );
}
