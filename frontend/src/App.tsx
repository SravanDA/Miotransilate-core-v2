import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { PageList } from "./pages/PageList";
import { PageDetail } from "./pages/PageDetail";
import { TagDetail } from "./pages/TagDetail";
import { Deployments } from "./pages/Deployments";
import { Settings } from "./pages/Settings";
import { CoverageDashboard } from "./pages/CoverageDashboard";
import { MyWork } from "./pages/MyWork";
import { Guide } from "./pages/Guide";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Navigate to="/pages" replace />} />
          <Route path="pages" element={<PageList />} />
          <Route path="pages/:pageId" element={<PageDetail />} />
          <Route path="pages/:pageId/tags/:tagId" element={<TagDetail />} />
          
          {/* Work and Workflows */}
          <Route path="work" element={<MyWork />} />
          <Route path="coverage" element={<CoverageDashboard />} />
          <Route path="deployments" element={<Deployments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="guide" element={<Guide />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
