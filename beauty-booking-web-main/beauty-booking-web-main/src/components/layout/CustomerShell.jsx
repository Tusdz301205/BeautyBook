import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  Compass,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  TicketPercent,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { PublicFooter } from '../public/PublicChrome';
import { cx, IconButton } from '../ui';

const primaryLinks = [
  ['/explore', 'Khám phá', Compass],
  ['/customer/appointments', 'Lịch hẹn', CalendarCheck],
  ['/customer/vouchers', 'Voucher', TicketPercent],
  ['/customer/payments', 'Thanh toán', WalletCards],
  ['/customer/reviews', 'Đánh giá', Star],
];

const accountLinks = [
  ['/customer/profile', 'Hồ sơ cá nhân', UserRound],
  ['/customer/privacy', 'Quyền riêng tư', ShieldCheck],
  ['/customer/security', 'Bảo mật & phiên đăng nhập', ShieldCheck],
];

export function CustomerShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const accountRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;
    const loadUnread = () => notificationsApi.getUnreadCount()
      .then((result) => { if (active) setUnread(Number(result?.count ?? result ?? 0)); })
      .catch(() => { if (active) setUnread(0); });
    loadUnread();
    const timer = window.setInterval(loadUnread, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen && !accountOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const close = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setAccountOpen(false);
      }
      if (accountOpen && accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    if (mobileOpen) document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [accountOpen, mobileOpen]);

  const initials = (user?.fullName || user?.email || 'BB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="bb-customer-shell min-h-screen bg-[var(--bb-canvas)] text-[var(--bb-ink)]">
      <a href="#main-content" className="bb-sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">
        Bỏ qua điều hướng
      </a>
      <header className="bb-customer-header sticky top-0 z-[var(--z-sticky)] border-b border-[var(--bb-border)] bg-[color-mix(in_oklch,var(--bb-surface)_94%,transparent)] backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[var(--maxw-page)] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2" aria-label="BeautyBook — trang chủ">
            <span className="grid h-9 w-9 place-items-center rounded-[var(--bb-radius-control)] bg-[var(--bb-brand)] text-[var(--color-accent-ink)]" aria-hidden="true"><Sparkles size={18} /></span>
            <span className="bb-display text-lg font-bold tracking-tight">BeautyBook</span>
          </Link>

          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex" aria-label="Tài khoản khách hàng">
            {primaryLinks.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx('flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[var(--bb-radius-control)] px-3 text-sm font-semibold transition-colors', isActive ? 'bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]' : 'text-[var(--bb-ink-soft)] hover:bg-[var(--bb-surface-subtle)] hover:text-[var(--bb-ink)]')}>
                <Icon size={16} aria-hidden="true" />{label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/customer/notifications" className="relative grid h-11 w-11 place-items-center rounded-[var(--bb-radius-control)] text-[var(--bb-ink-soft)] hover:bg-[var(--bb-surface-subtle)]" aria-label={unread ? `${unread} thông báo chưa đọc` : 'Thông báo'}>
              <Bell size={19} aria-hidden="true" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--bb-brand)] px-1 text-[10px] font-bold leading-none text-[var(--color-accent-ink)]">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <div ref={accountRef} className="relative hidden sm:block">
              <button type="button" className="flex min-h-11 items-center gap-2 rounded-[var(--bb-radius-control)] px-2 text-left hover:bg-[var(--bb-surface-subtle)]" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--bb-brand-soft)] text-xs font-bold text-[var(--bb-brand-strong)]">{initials}</span>
                <span className="hidden max-w-36 lg:block"><span className="block truncate text-xs font-bold">{user?.fullName || 'Tài khoản'}</span><span className="block truncate text-[11px] text-[var(--bb-muted)]">Khách hàng</span></span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {accountOpen && <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-dropdown)] w-72 rounded-[var(--bb-radius-card)] border border-[var(--bb-border)] bg-white p-2 shadow-[var(--bb-shadow-float)]">
                <div className="border-b border-[var(--bb-border)] px-3 py-2"><p className="truncate text-sm font-bold">{user?.fullName || 'Tài khoản BeautyBook'}</p><p className="truncate text-xs text-[var(--bb-muted)]">{user?.email}</p></div>
                {accountLinks.map(([to, label, Icon]) => <Link key={to} role="menuitem" to={to} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-[var(--bb-surface-subtle)]"><Icon size={17} />{label}</Link>)}
                <button type="button" role="menuitem" onClick={signOut} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-[var(--bb-danger)] hover:bg-red-50"><LogOut size={17} />Đăng xuất</button>
              </div>}
            </div>
            <IconButton label="Mở menu tài khoản" className="lg:hidden" aria-expanded={mobileOpen} aria-controls="customer-mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></IconButton>
          </div>
        </div>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-overlay)]" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
        <nav id="customer-mobile-menu" aria-label="Menu tài khoản khách hàng" className="ml-auto flex h-full w-[min(88vw,22rem)] flex-col bg-white p-4 shadow-[var(--bb-shadow-float)]">
          <div className="flex items-center justify-between border-b border-[var(--bb-border)] pb-3"><div><p className="font-bold">{user?.fullName || 'Tài khoản BeautyBook'}</p><p className="text-xs text-[var(--bb-muted)]">{user?.email}</p></div><IconButton label="Đóng menu" onClick={() => setMobileOpen(false)}><X size={20} /></IconButton></div>
          <div className="bb-scrollbar mt-3 flex-1 overflow-y-auto">
            {[...primaryLinks, ['/customer/notifications', 'Thông báo', Bell], ...accountLinks].map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => cx('flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold', isActive ? 'bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]' : 'hover:bg-[var(--bb-surface-subtle)]')}><Icon size={18} />{label}{to === '/customer/notifications' && unread > 0 ? <span className="ml-auto rounded-full bg-[var(--bb-brand)] px-2 py-0.5 text-xs text-[var(--color-accent-ink)]">{unread}</span> : null}</NavLink>)}
          </div>
          <button type="button" onClick={signOut} className="flex min-h-12 items-center gap-3 border-t border-[var(--bb-border)] px-3 pt-3 text-sm font-semibold text-[var(--bb-danger)]"><LogOut size={18} />Đăng xuất</button>
        </nav>
      </div>}

      <main id="main-content" tabIndex="-1" className="bb-customer-main mx-auto min-h-[60dvh] w-full max-w-[var(--maxw-page)] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-10">
        {children}
      </main>
      <PublicFooter />

      <nav className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] grid grid-cols-5 border-t border-[var(--bb-border)] bg-[color-mix(in_oklch,var(--bb-surface)_96%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Điều hướng nhanh">
        {[
          ['/explore', 'Khám phá', Compass],
          ['/customer/appointments', 'Lịch hẹn', CalendarCheck],
          ['/customer/notifications', 'Thông báo', Bell],
          ['/customer/vouchers', 'Voucher', TicketPercent],
          ['/customer/profile', 'Tài khoản', UserRound],
        ].map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => cx('relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold', isActive ? 'text-[var(--bb-brand-strong)]' : 'text-[var(--bb-muted)]')}><Icon size={19} aria-hidden="true" /><span className="max-w-full truncate">{label}</span>{to === '/customer/notifications' && unread > 0 ? <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-[var(--bb-brand)]" aria-hidden="true" /> : null}</NavLink>)}
      </nav>
    </div>
  );
}
