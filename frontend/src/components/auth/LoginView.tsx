import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';
import { MioSalonLogo } from '../ui/MioSalonLogo';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/v1/auth/login', { email, password });
      const { token, user, mustChangePassword } = response.data;
      
      login(token, user, mustChangePassword);
      
      if (mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.status === 403) {
        setError('Your account has been suspended');
      } else if (err.response?.status === 429) {
        setError('Too many attempts. Please try again later.');
      } else if (!err.response || err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        setError('Cannot connect to backend server (localhost:8080). Please ensure the backend is running.');
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || 'An error occurred during login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('ChangeMe123!');
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-main p-4">
      <div className="w-full max-w-sm p-8 bg-bg-card rounded-xl border border-border-subtle shadow-xl">
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-bg-hover/70 rounded-2xl border border-border-strong flex items-center justify-center shadow-inner">
            <MioSalonLogo size={36} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">MioSalon Translate</h1>
            <p className="text-[13px] text-text-secondary mt-1">Sign in to your account</p>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-2.5 bg-danger/10 border border-danger/20 text-danger rounded-md text-[12px] font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-text-primary mb-1.5">Email</label>
            <input
              type="email"
              required
              className="w-full px-3 h-9 bg-bg-main border border-border-strong rounded-md focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 text-[13px] text-text-primary transition-all placeholder:text-text-tertiary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-text-primary mb-1.5">Password</label>
            <input
              type="password"
              required
              className="w-full px-3 h-9 bg-bg-main border border-border-strong rounded-md focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 text-[13px] text-text-primary transition-all placeholder:text-text-tertiary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 mt-2 bg-text-primary hover:bg-text-primary/90 text-bg-main font-bold text-[13px] rounded-md transition-colors disabled:opacity-50 cursor-pointer outline-none"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border-subtle">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 text-center">Quick Demo Logins</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickFill('founder@miosalonsoftware.com')}
              className="px-2 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary bg-bg-hover/50 hover:bg-bg-hover rounded border border-border-subtle transition-all text-left truncate cursor-pointer outline-none"
              title="Founder (All access)"
            >
              👑 Founder
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('dev@miosalonsoftware.com')}
              className="px-2 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary bg-bg-hover/50 hover:bg-bg-hover rounded border border-border-subtle transition-all text-left truncate cursor-pointer outline-none"
              title="Developer"
            >
              💻 Developer
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('pm@miosalonsoftware.com')}
              className="px-2 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary bg-bg-hover/50 hover:bg-bg-hover rounded border border-border-subtle transition-all text-left truncate cursor-pointer outline-none"
              title="Product Manager"
            >
              📋 Product Mgr
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('lr@miosalonsoftware.com')}
              className="px-2 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary bg-bg-hover/50 hover:bg-bg-hover rounded border border-border-subtle transition-all text-left truncate cursor-pointer outline-none"
              title="Localization Reviewer"
            >
              🌐 Reviewer (LR)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
