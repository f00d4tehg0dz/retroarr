import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import PlayerModal from '../player/PlayerModal';

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-m3-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
      <PlayerModal />
    </div>
  );
}
