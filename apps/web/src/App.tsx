import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Scene from './pages/Scene';
import Episode from './pages/Episode';
import DiskUiSandbox from './pages/DiskUiSandbox';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/scene" element={<Scene />} />
        <Route path="/prototype/disk-ui" element={<DiskUiSandbox />} />
        <Route path="/episode/:id" element={<Episode />} />
      </Routes>
    </BrowserRouter>
  );
}
