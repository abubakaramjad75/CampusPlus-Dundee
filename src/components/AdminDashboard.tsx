import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Download,
  Lock,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type {
  AdminAuditEntry,
  FacilityReport,
  QrCodeRecord,
  ReportStatus,
} from '../types/campus';

interface AdminOverview {
  stats: {
    totalUsers: number;
    totalLocations: number;
    activeCheckIns: number;
    totalCheckIns: number;
    openReports: number;
    occupancySubmissions: number;
    flaggedCommunityItems: number;
  };
  qrCodes: QrCodeRecord[];
  occupancySubmissions: Array<{
    id: string;
    locationId: string;
    level: string;
    pseudonym: string;
    createdAt: string;
  }>;
  auditLogs: AdminAuditEntry[];
}

export const AdminDashboard: React.FC = () => {
  const { user, locations, communityItems, refreshCampusData, notify } = useApp();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  // QR generator form
  const [qrLocId, setQrLocId] = useState('main-library');
  const [qrLabel, setQrLabel] = useState('');
  const [qrDays, setQrDays] = useState(90);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annLocId, setAnnLocId] = useState('main-library');

  // Location editor
  const [editLocId, setEditLocId] = useState('main-library');
  const [editLocHours, setEditLocHours] = useState('');
  const [editLocAccess, setEditLocAccess] = useState('');

  const loadAdminData = async () => {
    const [ovRes, repRes] = await Promise.all([
      fetch('/api/admin/overview', { credentials: 'include' }),
      fetch('/api/reports', { credentials: 'include' }),
    ]);
    if (ovRes.ok) {
      const ov = (await ovRes.json()) as AdminOverview;
      setOverview(ov);
      // Generate real scannable QR PNG data URLs
      const map: Record<string, string> = {};
      for (const qr of ov.qrCodes) {
        map[qr.id] = await QRCode.toDataURL(qr.token, { width: 220, margin: 1 });
      }
      setQrImages(map);
    }
    if (repRes.ok) {
      const rj = await repRes.json();
      setReports(rj.reports ?? []);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  useEffect(() => {
    const loc = locations.find((l) => l.id === editLocId);
    if (loc) {
      setEditLocHours(loc.openingHoursNote);
      setEditLocAccess(loc.accessibilityInfo);
    }
  }, [editLocId, locations]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <Lock className="w-8 h-8 text-slate-400 mx-auto" />
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Administrator Access Required
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Admin privileges are strictly enforced server-side. Standard student accounts cannot
            promote themselves via client-side state.
          </p>
        </div>
      </div>
    );
  }

  const handleGenerateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ locationId: qrLocId, label: qrLabel, expiresInDays: qrDays }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify(json.error || 'Could not generate QR code.', 'error');
    } else {
      setQrLabel('');
      await loadAdminData();
      notify('Signed CampusPulse QR code generated.', 'success');
    }
  };

  const handleToggleQr = async (qr: QrCodeRecord) => {
    const res = await fetch(`/api/admin/qr/${qr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ active: !qr.active }),
    });
    if (res.ok) {
      await loadAdminData();
      notify(`QR code ${qr.active ? 'revoked' : 'activated'}.`, 'info');
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: ReportStatus) => {
    const res = await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status,
        adminNotes: `Reviewed by ${user.displayName} on ${new Date().toLocaleDateString('en-GB')}`,
      }),
    });
    if (res.ok) {
      await loadAdminData();
      notify(`Updated report status to ${status}.`, 'success');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        kind: 'announcement',
        title: annTitle,
        body: annBody,
        locationId: annLocId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify(json.error || 'Could not publish announcement.', 'error');
    } else {
      setAnnTitle('');
      setAnnBody('');
      await Promise.all([refreshCampusData(), loadAdminData()]);
      notify('Official CampusPulse announcement published.', 'success');
    }
  };

  const handleSaveLocationMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/locations/${editLocId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        openingHoursNote: editLocHours,
        accessibilityInfo: editLocAccess,
      }),
    });
    if (res.ok) {
      await Promise.all([refreshCampusData(), loadAdminData()]);
      notify('Updated verified campus location metadata.', 'success');
    }
  };

  const handleModerateCommunity = async (id: string, moderationStatus: 'approved' | 'hidden') => {
    const res = await fetch(`/api/admin/community/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ moderationStatus }),
    });
    if (res.ok) {
      await Promise.all([refreshCampusData(), loadAdminData()]);
      notify(`Post marked as ${moderationStatus}.`, 'info');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-[#1D4ED8] dark:text-sky-400" />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            CampusPulse Administrator Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Server-verified RBAC · All sensitive actions are recorded in the immutable audit log.
          </p>
        </div>
      </div>

      {/* Aggregated Usage Stats */}
      {overview && (
        <section
          aria-label="Aggregated usage statistics"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Registered Accounts', value: overview.stats.totalUsers },
            { label: 'Active QR Check-Ins', value: overview.stats.activeCheckIns },
            { label: 'Open Facility Reports', value: overview.stats.openReports },
            { label: 'Occupancy Updates', value: overview.stats.occupancySubmissions },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="font-display text-3xl font-bold text-[#0B1B3B] dark:text-white tabular-nums mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* QR Code Generator & Facility Report Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#1D4ED8] dark:text-sky-400" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Signed CampusPulse QR Generator
            </h2>
          </div>

          <form onSubmit={handleGenerateQr} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="adm-qr-loc" className="block text-xs font-medium mb-1">
                  Study Location
                </label>
                <select
                  id="adm-qr-loc"
                  value={qrLocId}
                  onChange={(e) => setQrLocId(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="adm-qr-days" className="block text-xs font-medium mb-1">
                  Validity (Days)
                </label>
                <input
                  id="adm-qr-days"
                  type="number"
                  min={1}
                  max={365}
                  value={qrDays}
                  onChange={(e) => setQrDays(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs tabular-nums"
                />
              </div>
            </div>
            <div>
              <label htmlFor="adm-qr-label" className="block text-xs font-medium mb-1">
                Sticker Label
              </label>
              <input
                id="adm-qr-label"
                type="text"
                required
                value={qrLabel}
                onChange={(e) => setQrLabel(e.target.value)}
                placeholder="e.g., Main Library — Floor 3 Quiet Desk A"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              Generate Signed QR Code
            </button>
          </form>

          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 max-h-96 overflow-y-auto">
            {overview?.qrCodes.map((qr) => (
              <div
                key={qr.id}
                className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {qrImages[qr.id] && (
                    <img
                      src={qrImages[qr.id]}
                      alt={`QR code for ${qr.label}`}
                      className="w-16 h-16 rounded-lg bg-white p-1 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {qr.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {qr.active ? 'Active' : 'Revoked'} · Expires{' '}
                      {new Date(qr.expiresAt).toLocaleDateString('en-GB')}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500 truncate">{qr.token}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {qrImages[qr.id] && (
                    <a
                      href={qrImages[qr.id]}
                      download={`${qr.id}.png`}
                      className="inline-flex items-center justify-center gap-1 min-h-[34px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
                    >
                      <Download className="w-3 h-3" />
                      PNG
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleQr(qr)}
                    className="min-h-[34px] px-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-medium"
                  >
                    {qr.active ? 'Revoke' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Facility Reports Review */}
        <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Facility Reports Queue ({reports.length})
          </h2>
          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">No facility reports yet.</p>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1D4ED8] dark:text-sky-400">
                      {rep.status}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {new Date(rep.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {rep.locationName} — {rep.category}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{rep.description}</p>
                  <p className="text-[11px] text-slate-500">Submitted by: {rep.reporterDisplay}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(['Under review', 'Resolved', 'Rejected'] as ReportStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleUpdateReportStatus(rep.id, st)}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Mark {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Location Editor, Announcements & Moderation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSaveLocationMeta}
          className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Update Verified Location Information
          </h2>
          <div>
            <label htmlFor="adm-loc-select" className="block text-xs font-medium mb-1">
              Campus Location
            </label>
            <select
              id="adm-loc-select"
              value={editLocId}
              onChange={(e) => setEditLocId(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="adm-loc-hours" className="block text-xs font-medium mb-1">
              Opening Hours Verification Note
            </label>
            <input
              id="adm-loc-hours"
              type="text"
              value={editLocHours}
              onChange={(e) => setEditLocHours(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>
          <div>
            <label htmlFor="adm-loc-access" className="block text-xs font-medium mb-1">
              Accessibility Verification Note
            </label>
            <textarea
              id="adm-loc-access"
              rows={3}
              value={editLocAccess}
              onChange={(e) => setEditLocAccess(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save Verified Details
          </button>
        </form>

        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handlePublishAnnouncement}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3"
          >
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Publish CampusPulse Announcement
            </h2>
            <select
              aria-label="Announcement target location"
              value={annLocId}
              onChange={(e) => setAnnLocId(e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Announcement headline"
              className="w-full min-h-[40px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
            <textarea
              required
              rows={2}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Announcement details..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              Publish Announcement
            </button>
          </form>

          {/* Community Moderation Queue */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Community Moderation ({communityItems.filter((c) => c.moderationStatus === 'flagged').length} flagged)
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {communityItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500">
                      Status: {item.moderationStatus} · Flags: {item.flaggedCount}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleModerateCommunity(item.id, 'approved')}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModerateCommunity(item.id, 'hidden')}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px]"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Immutable Audit Log */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Administrator Audit Log
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {overview?.auditLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-mono font-semibold text-[#1D4ED8] dark:text-sky-400">
                  {log.action}
                </span>{' '}
                <span className="text-slate-700 dark:text-slate-200">— {log.details}</span>
              </div>
              <span className="text-slate-500 tabular-nums shrink-0">
                {log.adminEmail} · {new Date(log.createdAt).toLocaleString('en-GB')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
