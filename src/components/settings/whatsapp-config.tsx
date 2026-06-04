'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { getToken, getRefreshToken, setTokens, clearTokens } from '@/lib/api/client';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function refreshJwt(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    setTokens(d.access_token, d.refresh_token);
    return true;
  } catch { return false; }
}

async function apiFetch(path: string, opts: RequestInit = {}, retry = true): Promise<any> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  // Auto-refresh JWT on 401
  if (res.status === 401 && retry) {
    const refreshed = await refreshJwt();
    if (refreshed) return apiFetch(path, opts, false);
    clearTokens();
    document.cookie = 'platform_access_token=; path=/; max-age=0';
    window.location.href = '/login';
    throw new Error('Session expired — redirecting to login');
  }
  if (res.status === 404) return null;
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).detail || res.statusText); }
  return res.json();
}

export function WhatsAppConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [appSecret, setAppSecret] = useState('');

  // Webhook URL — points directly to FastAPI
  const webhookUrl = `${BASE}/webhooks/whatsapp`;

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await apiFetch('/whatsapp/config');
      if (cfg) {
        setHasConfig(true);
        setPhoneNumberId(cfg.phone_number_id || '');
        setWabaId(cfg.waba_id || '');
        setVerifyToken(''); // never pre-fill token fields
        setAccessToken('');
        setConnected(cfg.has_access_token);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadConfig(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberId.trim()) { toast.error('Phone Number ID is required'); return; }

    setSaving(true);
    try {
      const payload: Record<string, string> = { phone_number_id: phoneNumberId.trim() };
      if (wabaId.trim()) payload.waba_id = wabaId.trim();
      if (accessToken.trim()) payload.access_token = accessToken.trim();
      if (verifyToken.trim()) payload.webhook_verify_token = verifyToken.trim();
      if (appSecret.trim()) payload.app_secret = appSecret.trim();

      await apiFetch('/whatsapp/config', { method: 'PUT', body: JSON.stringify(payload) });
      toast.success('Configuration saved successfully');
      setAccessToken('');
      setVerifyToken('');
      await loadConfig();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${hasConfig && connected ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        {hasConfig && connected
          ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
          : <XCircle className="h-5 w-5 shrink-0 text-amber-400" />}
        <div>
          <p className={`text-sm font-medium ${hasConfig && connected ? 'text-green-300' : 'text-amber-300'}`}>
            {hasConfig && connected ? 'WhatsApp Connected' : 'Not Connected'}
          </p>
          <p className="text-xs text-slate-400">
            {hasConfig && connected
              ? 'Your WhatsApp Business API credentials are configured.'
              : 'Configure your Meta API credentials below.'}
          </p>
        </div>
        <button onClick={loadConfig} className="ml-auto text-slate-500 hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <h3 className="text-sm font-semibold text-white">API Credentials</h3>
          <p className="mt-0.5 text-xs text-slate-400">Enter your Meta WhatsApp Business API credentials.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone Number ID *</label>
            <input
              value={phoneNumberId}
              onChange={e => setPhoneNumberId(e.target.value)}
              placeholder="1103239036212228"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">WhatsApp Business Account ID</label>
            <input
              value={wabaId}
              onChange={e => setWabaId(e.target.value)}
              placeholder="27115714474705294"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Permanent Access Token {hasConfig && connected && <span className="text-green-400">— already set (leave blank to keep)</span>}
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder={hasConfig && connected ? "Leave blank to keep current token" : "EAAxxxxxxxx..."}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 font-mono text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
            <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Webhook Verify Token</label>
            <input
              value={verifyToken}
              onChange={e => setVerifyToken(e.target.value)}
              placeholder="convoxio-wa-2026"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-600">A custom string. Must match the token you set in Meta webhook settings.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Meta App Secret</label>
            <input
              type="password"
              value={appSecret}
              onChange={e => setAppSecret(e.target.value)}
              placeholder="For HMAC webhook verification"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </form>

      {/* Webhook Configuration */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-1 text-sm font-semibold text-white">Webhook Configuration</h3>
        <p className="mb-4 text-xs text-slate-400">Use this URL as your webhook callback in the Meta App Dashboard.</p>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Webhook Callback URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-200 truncate">
              {webhookUrl}
            </code>
            <button
              onClick={copyWebhookUrl}
              className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            ⚠️ This must be a <strong className="text-slate-300">public HTTPS URL</strong>. Use ngrok (<code className="text-slate-300">ngrok http 8000</code>) for local development.
          </p>
        </div>

        <div className="mt-5 space-y-1.5 rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
          <p className="text-xs font-semibold text-slate-300">Setup steps in Meta:</p>
          <ol className="mt-2 space-y-1 text-xs text-slate-400 list-decimal list-inside">
            <li>Go to WhatsApp → Configuration in your Meta App</li>
            <li>Click <strong className="text-slate-300">Edit</strong> on the Webhook section</li>
            <li>Paste the Callback URL above</li>
            <li>Enter the same Verify Token you set in this form</li>
            <li>Click <strong className="text-slate-300">Verify and Save</strong></li>
            <li>Subscribe to <strong className="text-slate-300">messages</strong> webhook field</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
