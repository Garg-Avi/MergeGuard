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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up font-sans">
      <div className="w-full max-w-md bg-[#17191F] text-[#F5F5F5] rounded-2xl shadow-2xl border border-[#2B2E35] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#111318] px-6 py-4 border-b border-[#2B2E35] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#D69B45] shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#F5F5F5]">
                {mode === 'signin' && 'Sign in to MergeGuard'}
                {mode === 'register' && 'Create Contributor Account'}
                {mode === 'admin_key' && 'Enter Admin Master Key'}
              </h3>
              <p className="text-[11px] text-[#777D87]">Security & Trust Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777D87] hover:text-[#F5F5F5] hover:bg-[#202329] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 mx-6 mt-4 bg-[#111318] border border-[#2B2E35] rounded-xl text-xs font-medium">
          <button
            onClick={() => {
              setMode('signin');
              setError('');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-[#202329] text-[#F5F5F5] shadow-xs font-semibold'
                : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
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
                ? 'bg-[#202329] text-[#F5F5F5] shadow-xs font-semibold'
                : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
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
                ? 'bg-[#202329] text-[#F5F5F5] shadow-xs font-semibold'
                : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
            }`}
          >
            Admin Key
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form: Sign In */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#B0B3BA] mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="mg-input pl-9 bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B0B3BA] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="mg-input pl-9 pr-9 bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777D87] hover:text-[#F5F5F5]"
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
                <label className="block text-xs font-medium text-[#B0B3BA] mb-1.5">Full name (optional)</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="mg-input pl-9 bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B0B3BA] mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maintainer@example.com"
                    className="mg-input pl-9 bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B0B3BA] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mg-input pl-9 pr-9 bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777D87] hover:text-[#F5F5F5]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1 text-xs text-[#B0B3BA]">
                <input
                  type="checkbox"
                  id="privacy"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="mt-0.5 rounded border-[#2B2E35] bg-[#111318] text-[#D69B45] focus:ring-[#D69B45]"
                />
                <label htmlFor="privacy" className="cursor-pointer leading-tight text-[#B0B3BA]">
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
                <label className="block text-xs font-medium text-[#B0B3BA] mb-1">
                  Administrator Secret Key
                </label>
                <p className="text-[11px] text-[#777D87] mb-2">
                  Direct administrative authorization via backend <code className="text-[#F5F5F5] font-mono">X-Admin-Key</code> header.
                </p>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
                  <input
                    type="password"
                    required
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Enter ADMIN_SECRET_KEY..."
                    className="mg-input pl-9 font-mono text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
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
          <div className="pt-3 border-t border-[#2B2E35] flex items-center justify-between text-xs text-[#777D87]">
            <span className="font-mono text-[11px] text-[#777D87]">Quick fill:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillQuickAdmin}
                className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline font-medium"
              >
                Demo Admin
              </button>
              <span className="text-[#2B2E35]">&bull;</span>
              <button
                type="button"
                onClick={fillQuickAdminKey}
                className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline font-medium"
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
