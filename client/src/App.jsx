import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ChannelDetail from './pages/ChannelDetail';
import EpgPage from './pages/EpgPage';
import Settings from './pages/Settings';
import ReportVideo from './pages/ReportVideo';
import TvMode from './pages/TvMode';
import PluginStore from './pages/PluginStore';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/channel/:id" element={<ChannelDetail />} />
          <Route path="/epg" element={<EpgPage />} />
          <Route path="/tv" element={<TvMode />} />
          <Route path="/plugins" element={<PluginStore />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/report" element={<ReportVideo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
