import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Key,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register' | 'admin_key'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [agreedPrivacy, setAgreedPrivacy] = useState(true);

  if (!isOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      localStorage.setItem('mergeguard_token', res.access_token);
      localStorage.setItem('mergeguard_user', JSON.stringify(res.user));
      setSuccessMsg(`Welcome back, ${res.user.name || res.user.email}`);
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreedPrivacy) {
      setError('Please acknowledge the security activity logging notice.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await api.register({
        email,
        password,
        name: name.trim() || undefined,
      });
      localStorage.setItem('mergeguard_token', res.access_token);
      localStorage.setItem('mergeguard_user', JSON.stringify(res.user));
      setSuccessMsg(`Account created for ${res.user.email}`);
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminKeyAuth = async (e) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setError('Please provide the X-Admin-Key string.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      localStorage.setItem('mergeguard_admin_key', adminKey.trim());
      const metrics = await api.getAdminMetrics();
      const adminUser = {
        id: 'usr-admin-key',
        email: metrics.admin_email || '16avigarg@gmail.com',
        name: 'Avi Garg (Administrator)',
        is_admin: true,
      };
      localStorage.setItem('mergeguard_user', JSON.stringify(adminUser));
      setSuccessMsg('Master administrative key validated.');
      setTimeout(() => {
        onAuthSuccess(adminUser);
        onClose();
      }, 500);
    } catch {
      localStorage.removeItem('mergeguard_admin_key');
      setError('Invalid Admin Key. Authorization rejected by backend.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickAdmin = () => {
    setMode('signin');
    setEmail('16avigarg@gmail.com');
    setPassword('MergeGuard2026!');
  };

  const fillQuickAdminKey = () => {
    setMode('admin_key');
    setAdminKey('mergeguard_dev_master_key_2026');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in-up font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E8E6DF] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#FAF9F5] px-6 py-4 border-b border-[#E8E6DF] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">
                {mode === 'signin' && 'Sign in to MergeGuard'}
                {mode === 'register' && 'Create Contributor Account'}
                {mode === 'admin_key' && 'Enter Admin Master Key'}
              </h3>
              <p className="text-[11px] text-slate-500">Security & Trust Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 mx-6 mt-4 bg-[#F4F3EE] rounded-xl text-xs font-medium">
          <button
            onClick={() => {
              setMode('signin');
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register
          </button>
          <button
            onClick={() => {
              setMode('admin_key');
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === 'admin_key'
                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Key
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form: Sign In */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="mg-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="mg-input pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mg-btn-primary w-full py-2.5 mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign in to Dashboard'}
              </button>
            </form>
          )}

          {/* Form: Register */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full name (optional)</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="mg-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maintainer@example.com"
                    className="mg-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mg-input pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  id="privacy"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="privacy" className="cursor-pointer leading-tight text-slate-600">
                  I acknowledge server-side security event logging for repository audit operations.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mg-btn-primary w-full py-2.5 mt-2"
              >
                {loading ? 'Creating account...' : 'Create Contributor Account'}
              </button>
            </form>
          )}

          {/* Form: Admin Key */}
          {mode === 'admin_key' && (
            <form onSubmit={handleAdminKeyAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Administrator Secret Key
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Direct administrative authorization via backend <code className="text-indigo-600 font-mono">X-Admin-Key</code> header.
                </p>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Enter ADMIN_SECRET_KEY..."
                    className="mg-input pl-9 font-mono text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mg-btn-primary w-full py-2.5 mt-2"
              >
                {loading ? 'Validating Key...' : 'Authorize Admin Master Key'}
              </button>
            </form>
          )}

          {/* Quick Demo Shortcuts */}
          <div className="pt-3 border-t border-[#E8E6DF] flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono text-[11px] text-slate-400">Quick fill:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillQuickAdmin}
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
              >
                Demo Admin
              </button>
              <span className="text-slate-300">&bull;</span>
              <button
                type="button"
                onClick={fillQuickAdminKey}
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
              >
                Admin Key
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
