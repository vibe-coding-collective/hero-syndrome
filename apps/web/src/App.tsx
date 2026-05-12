import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Scene from './pages/Scene';
import Episode from './pages/Episode';
import DiskPrototype from './pages/DiskPrototype';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/scene" element={<Scene />} />
        <Route path="/episode/:id" element={<Episode />} />
        <Route path="/prototype/disk-ui" element={<DiskPrototype />} />
      </Routes>
    </BrowserRouter>
  );
}
