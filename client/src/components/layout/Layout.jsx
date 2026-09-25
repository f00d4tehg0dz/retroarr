import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import PlayerModal from '../player/PlayerModal';

// Full-bleed pages (guide, TV mode) manage their own padding.
const FULL_BLEED = ['/epg', '/tv'];

export default function Layout() {
  const { pathname } = useLocation();
  const fullBleed = FULL_BLEED.includes(pathname);
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className={`flex-1 overflow-auto pb-20 md:pb-0 ${fullBleed ? '' : 'px-4 sm:px-6 lg:px-8 py-6'}`}>
          <div key={pathname} className={fullBleed ? 'h-full' : 'mx-auto max-w-[1600px] animate-fade-up'}>
            <Outlet />
          </div>
        </main>
      </div>
      <PlayerModal />
    </div>
  );
}
