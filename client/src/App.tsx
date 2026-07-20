import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ConfigViewer from './pages/ConfigViewer';
import Simulator from './pages/Simulator';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/configs" element={<ConfigViewer />} />
        <Route path="/simulate" element={<Simulator />} />
      </Routes>
    </Layout>
  );
}
