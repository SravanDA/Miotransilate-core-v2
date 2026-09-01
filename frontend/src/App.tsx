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
import { History } from "./pages/History";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LoginView } from "./components/auth/LoginView";
import { ChangePasswordView } from "./components/auth/ChangePasswordView";
import { FloatingLLMInspector } from "./components/dev/FloatingLLMInspector";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
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
            <Route 
              path="pages" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <PageList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="pages/:pageId" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <PageDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="pages/:pageId/tags/:tagId" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <TagDetail />
                </ProtectedRoute>
              } 
            />
            
            {/* Work and Workflows */}
            <Route 
              path="work" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <MyWork />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="coverage" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <CoverageDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="deployments" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <Deployments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="history" 
              element={
                <ProtectedRoute permission="AUDIT_VIEW">
                  <History />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="settings" 
              element={
                <ProtectedRoute permission="ADMIN_USERS">
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="guide" 
              element={
                <ProtectedRoute permission="CONTENT_VIEW">
                  <Guide />
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
        <FloatingLLMInspector />
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
