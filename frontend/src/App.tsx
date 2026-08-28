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
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LoginView } from "./components/auth/LoginView";
import { ChangePasswordView } from "./components/auth/ChangePasswordView";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route 
            path="/change-password" 
            element={
              <ProtectedRoute allowPasswordChange={true}>
                <ChangePasswordView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/pages" replace />} />
            <Route path="pages" element={<PageList />} />
            <Route path="pages/:pageId" element={<PageDetail />} />
            <Route path="pages/:pageId/tags/:tagId" element={<TagDetail />} />
            
            {/* Work and Workflows */}
            <Route path="work" element={<MyWork />} />
            <Route path="coverage" element={<CoverageDashboard />} />
            <Route path="deployments" element={<Deployments />} />
            <Route 
              path="settings" 
              element={
                <ProtectedRoute permission="ADMIN_USERS">
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route path="guide" element={<Guide />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
