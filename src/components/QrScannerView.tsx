import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Clock,
  LogOut,
  QrCode,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DepthCard } from './DepthCard';

interface PublicSampleQr {
  id: string;
  locationId: string;
  locationName: string;
  label: string;
  token: string;
  expiresAt: string;
}

export const QrScannerView: React.FC = () => {
  const {
    user,
    activeCheckIn,
    checkInHistory,
    refreshUserData,
    refreshCampusData,
    setActiveTab,
    notify,
  } = useApp();

  const [manualToken, setManualToken] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sampleQrs, setSampleQrs] = useState<PublicSampleQr[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/qr/public-samples')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.codes) setSampleQrs(json.codes);
      })
      .catch(() => undefined);
  }, []);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const submitCheckInToken = async (tokenValue: string) => {
    if (!tokenValue.trim()) {
      notify('Please scan or enter a CampusPulse QR token.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/qr/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: tokenValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'QR check-in failed.', 'error');
      } else {
        stopCamera();
        setManualToken('');
        await Promise.all([refreshUserData(), refreshCampusData()]);
        notify(`Checked in to ${json.session.locationName}.`, 'success');
      }
    } catch {
      notify('Network error verifying QR code.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/qr/checkout', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not check out.', 'error');
      } else {
        await Promise.all([refreshUserData(), refreshCampusData()]);
        notify(`Checked out of ${json.session.locationName}.`, 'success');
      }
    } catch {
      notify('Network error during check-out.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser. Use QR image upload or manual token entry below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imgData.data, imgData.width, imgData.height);
            if (decoded?.data) {
              setManualToken(decoded.data);
              submitCheckInToken(decoded.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError('Camera permission denied or unavailable. Use QR image upload or manual token entry below.');
      setCameraActive(false);
    }
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(data.data, data.width, data.height);
        if (decoded?.data) {
          setManualToken(decoded.data);
          notify('Decoded QR code from uploaded image.', 'success');
        } else {
          notify('Could not detect a valid QR code in that image.', 'error');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          QR Study Check-In & Check-Out
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Voluntary CampusPulse project check-in system. QR codes are generated and verified server-side
          using HMAC-SHA256 signatures — no official University of Dundee QR integration is claimed.
        </p>
      </div>

      {!user && (
        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Sign in required for QR check-ins
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Sign in with your CampusPulse student account to prevent duplicate sessions and save check-in history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-medium shrink-0"
          >
            Go to Sign In
          </button>
        </div>
      )}

      {/* Active Session Card */}
      {activeCheckIn && (
        <DepthCard
          maxTilt={3.5}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Active Check-In Session
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {activeCheckIn.locationName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Checked in at {new Date(activeCheckIn.checkedInAt).toLocaleString('en-GB')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCheckOut}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shrink-0 disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" />
            Check Out Now
          </button>
        </DepthCard>
      )}

      {/* Scanner & Accessible Alternatives */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 cp-card-3d">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Camera & Image QR Scanner
            </h2>
            <ShieldCheck className="w-5 h-5 text-[#1D4ED8] dark:text-sky-400" />
          </div>

          <div className="rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center relative">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            {!cameraActive && (
              <div className="text-center p-6 space-y-3">
                <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-300 max-w-xs">
                  Point your device camera at a CampusPulse study desk QR code, or upload a saved QR image.
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <p role="alert" className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                Start Camera Scan
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-medium"
              >
                Stop Camera
              </button>
            )}

            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload QR Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="sr-only"
              />
            </label>
          </div>
        </section>

        {/* Manual Token Entry & Demo Test Tokens */}
        <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 cp-card-3d">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Accessible Manual Code Entry
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              If a camera is unavailable, enter the CampusPulse signed QR token printed beneath the QR sticker.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCheckInToken(manualToken);
            }}
            className="space-y-3"
          >
            <div>
              <label
                htmlFor="manual-qr-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                CampusPulse QR Token
              </label>
              <input
                id="manual-qr-input"
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="CP-DUNDEE:main-library:..."
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !user || Boolean(activeCheckIn)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Verifying Signature...' : 'Confirm Check-In'}
            </button>
          </form>

          {sampleQrs.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Active CampusPulse Test Tokens (Generated by Admin System)
              </p>
              <div className="space-y-2">
                {sampleQrs.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {q.label}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {q.token}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualToken(q.token)}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#1D4ED8] dark:text-sky-400 shrink-0"
                    >
                      Use Token
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Check-In History */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Your Check-In History
        </h2>
        {checkInHistory.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No check-in sessions recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {checkInHistory.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.locationName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    In: {new Date(item.checkedInAt).toLocaleString('en-GB')}
                    {item.checkedOutAt && (
                      <>
                        <span>·</span>
                        <span>Out: {new Date(item.checkedOutAt).toLocaleString('en-GB')}</span>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    item.status === 'active'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.status === 'active' ? 'Active Session' : 'Completed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
