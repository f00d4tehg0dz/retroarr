import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',        label: 'Channels',     icon: '▶', exact: true },
  { to: '/epg',     label: 'TV Guide',     icon: '≡' },
  { to: '/tv',      label: 'TV Mode',      icon: '▣' },
  { to: '/plugins', label: 'Plugins',      icon: '⬡' },
  { to: '/settings',label: 'Settings',     icon: '⚙' },
  { to: '/report',  label: 'Report',       icon: '⚑' },
];

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-m3-surface border-r border-m3-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-m3-border">
        <div className="font-bold text-xl tracking-tight leading-none">
          RETRO<span className="text-m3-primary">ARR</span>
        </div>
        <div className="text-m3-muted text-xs tracking-wide mt-1">
          Linear TV Engine
        </div>
        <div className="mt-3 h-0.5 bg-m3-primary/40 w-10 rounded-full" />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {links.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm font-medium rounded-r-m3-sm mr-3 transition-all ${
                isActive
                  ? 'bg-m3-primaryContainer/30 text-m3-primary border-l-2 border-m3-primary'
                  : 'text-m3-textSecondary hover:bg-m3-surfaceContainer hover:text-m3-text border-l-2 border-transparent'
              }`
            }
          >
            <span className="text-base leading-none opacity-70">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-m3-border">
        <div className="text-m3-muted text-xs">v1.0</div>
      </div>
    </aside>
  );
}
