import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { CheckCircle2, XCircle, QrCode, RotateCcw, Camera, CameraOff, Upload, Smartphone, Keyboard } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

const SCANNER_ID = 'qr-scanner-region';

const fmt = formatDateTime;

const ScanQr = () => {
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fileScanning, setFileScanning] = useState(false);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState(null); // { valid, action, message, outpass }
  const [submitting, setSubmitting] = useState(false);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const busyRef = useRef(false); // guards against firing the same scan twice

  // Manual / Type Token: the 8-character token shown under the student's QR.
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'token' ? 'token' : 'scan');
  const [gateToken, setGateToken] = useState('');
  const [tokenCheck, setTokenCheck] = useState(null); // verified, waiting for the guard's approval
  const [tokenError, setTokenError] = useState('');

  // Upper case, A–Z and 0–9 only, at most 8 characters (the server checks again).
  const cleanToken = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  const verifyToken = async (e) => {
    e.preventDefault();
    if (gateToken.length !== 8 || busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    setTokenError('');
    try {
      const res = await api.post('/outpasses/token/verify', { token: gateToken });
      setTokenCheck(res.data);
    } catch (err) {
      setTokenError(err.response?.data?.message || 'Could not verify the token. Please try again.');
    } finally {
      setSubmitting(false);
      busyRef.current = false;
    }
  };

  const approveToken = async () => {
    if (!tokenCheck || busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    try {
      const res = await api.post('/outpasses/token/confirm', { token: tokenCheck.token, action: tokenCheck.action });
      setResult(res.data);
    } catch (err) {
      setResult(err.response?.data || { valid: false, message: 'Could not record this. Please try again.' });
    } finally {
      setTokenCheck(null);
      setGateToken('');
      setSubmitting(false);
      busyRef.current = false;
    }
  };

  const switchMode = (next) => {
    if (next === 'token') stopCamera();
    setMode(next);
    setTokenCheck(null);
    setTokenError('');
  };

  const submitScan = async (qrToken) => {
    if (!qrToken || busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    try {
      await stopCamera();
      const check = await api.post('/outpasses/scan/verify', { qr_token: qrToken });
      const res = await api.post('/outpasses/scan', { qr_token: qrToken, action: check.data.action });
      setResult(res.data);
    } catch (err) {
      setResult(err.response?.data || { valid: false, message: 'Scan failed. Please try again.' });
    } finally {
      setSubmitting(false);
      // Keep this scan latched until the guard explicitly chooses Scan Next.
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      const scanner = new Html5QrcodeScanner(
        SCANNER_ID,
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        false
      );
      scanner.render(
        (decodedText) => submitScan(decodedText),
        () => {} // ignore per-frame "not found" noise
      );
      scannerRef.current = scanner;
      setCameraOn(true);
    } catch {
      setCameraError('Could not access the camera. You can still enter the QR token manually below.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch {
        // ignore — element may already be gone
      }
      scannerRef.current = null;
    }
    setCameraOn(false);
  };

  useEffect(() => {
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    setFileScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('qr-temp-file-scanner');
      try {
        const decodedText = await html5QrCode.scanFile(file, true);
        await html5QrCode.clear();
        submitScan(decodedText);
      } catch {
        setFileError('Could not read a QR code from this image. Please try a clearer picture or enter the token.');
      }
    } catch (err) {
      setFileError('Error reading image file: ' + err.message);
    } finally {
      setFileScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const scanNext = () => {
    busyRef.current = false;
    setResult(null);
  };

  return (
    <Layout>
      <div id="qr-temp-file-scanner" style={{ display: 'none' }} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scan Outpass QR</h1>
          <p className="text-slate-500 mt-1">Scan a student's QR at the gate to record exit or return</p>
        </div>
        <Link to="/security/manual" className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm">
          <Smartphone size={16} /> Phone dead? Manual entry
        </Link>
      </div>

      {!result && (
        <div className="flex gap-2 mb-5">
          {[['scan', 'Scan QR Code', QrCode], ['token', 'Manual / Type Token', Keyboard]].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              aria-pressed={mode === key}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                mode === key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      )}

      {!result && mode === 'token' ? (
        tokenCheck ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-lg mx-auto">
            <h3 className="font-semibold text-slate-800 mb-1">Token {tokenCheck.token} verified</h3>
            <p className="text-sm text-slate-500 mb-4">{tokenCheck.message}</p>
            <dl className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 space-y-1.5 mb-5">
              {[
                ['Student Name', tokenCheck.details.student_name],
                ['Register Number', tokenCheck.details.register_no],
                ['Hostel Block', tokenCheck.details.hostel_block],
                ['Room Number', tokenCheck.details.room_no],
                ['Destination', tokenCheck.details.destination],
                ['Outpass Purpose', tokenCheck.details.purpose],
                ['Expected Return Time', fmt(tokenCheck.details.expected_return)],
                ['Current Hostel Status', tokenCheck.details.current_status],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-right">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={approveToken}
              disabled={submitting}
              className={`w-full text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 ${
                tokenCheck.action === 'EXIT' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {submitting ? 'Recording...' : tokenCheck.action === 'EXIT' ? 'APPROVE EXIT' : 'APPROVE RETURN'}
            </button>
            <button type="button" onClick={() => setTokenCheck(null)} className="w-full mt-2 text-sm text-slate-500 hover:text-slate-700 py-2">
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={verifyToken} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-lg mx-auto">
            <label htmlFor="gate-token" className="block font-semibold text-slate-800 mb-1">Enter Outpass Token</label>
            <p className="text-sm text-slate-500 mb-4">The 8-character token shown under the student's QR code, e.g. H7K9M2P4.</p>
            <input
              id="gate-token"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              value={gateToken}
              onChange={(e) => { setGateToken(cleanToken(e.target.value)); setTokenError(''); }}
              placeholder="Enter 8-character token"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xl font-mono tracking-[0.3em] text-center uppercase placeholder:text-sm placeholder:tracking-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {tokenError && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 mt-3">{tokenError}</p>}
            <button
              type="submit"
              disabled={submitting || gateToken.length !== 8}
              className="w-full mt-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition"
            >
              {submitting ? 'Verifying...' : 'VERIFY TOKEN'}
            </button>
          </form>
        )
      ) : !result ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Camera */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Camera size={18} /> Camera Scanner
              </h3>
              {cameraOn ? (
                <button onClick={stopCamera} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <CameraOff size={14} /> Stop
                </button>
              ) : null}
            </div>

            {!cameraOn && (
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition"
              >
                <Camera size={18} /> Open Camera
              </button>
            )}
            {cameraError && <p className="text-sm text-red-500 mt-3">{cameraError}</p>}
            <div id={SCANNER_ID} className="mt-4" />
          </div>

          {/* QR Image Upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Upload size={18} /> Upload QR Image
              </h3>

              {/* QR Image Upload Option */}
              <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-upload"
                />
                <label
                  htmlFor="qr-file-upload"
                  className="inline-flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer py-2.5 px-4 bg-white border border-indigo-200 rounded-lg shadow-xs hover:bg-indigo-50/50 transition text-center"
                >
                  <Upload size={16} />
                  {fileScanning ? 'Scanning QR image...' : 'Upload QR Code Image'}
                </label>
                {fileError && <p className="text-xs text-red-500 mt-2 text-center">{fileError}</p>}
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Select a screenshot or photo containing the outpass QR code
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-4">Use this option if the live camera is unavailable or scanning from a saved picture.</p>
          </div>
        </div>
      ) : (
        <ScanResultCard result={result} onScanNext={scanNext} />
      )}
    </Layout>
  );
};

const ScanResultCard = ({ result, onScanNext }) => {
  const { valid, action, message, outpass } = result;
  return (
    <div className={`rounded-2xl border p-6 max-w-lg mx-auto ${valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex flex-col items-center text-center mb-5">
        {valid ? <CheckCircle2 size={48} className="text-green-600 mb-3" /> : <XCircle size={48} className="text-red-600 mb-3" />}
        <h3 className={`text-xl font-bold ${valid ? 'text-green-700' : 'text-red-700'}`}>
          {valid ? (action === 'EXIT' ? 'VALID OUTPASS' : 'VALID RETURN') : 'INVALID SCAN'}
        </h3>
        <p className={`text-sm mt-1 ${valid ? 'text-green-700' : 'text-red-600'}`}>{message}</p>
      </div>

      {outpass && (
        <div className="bg-white rounded-xl p-4 text-sm text-slate-700 space-y-1.5 mb-5">
          <p><span className="text-slate-400">Student:</span> <span className="font-medium">{outpass.student?.name}</span></p>
          <p><span className="text-slate-400">Student ID:</span> {outpass.student?.roll_no}</p>
          <p><span className="text-slate-400">Room:</span> {outpass.student?.room_no}</p>
          <p><span className="text-slate-400">Destination:</span> {outpass.destination}</p>
          <p><span className="text-slate-400">Purpose:</span> {outpass.reason}</p>
          {action === 'EXIT' && <p><span className="text-slate-400">Expected Return:</span> {fmt(outpass.return_datetime)}</p>}
          {action === 'RETURN' && (
            <>
              <p><span className="text-slate-400">Expected Return:</span> {fmt(outpass.return_datetime)}</p>
              <p><span className="text-slate-400">Actual Return:</span> {fmt(outpass.actual_return_time)}</p>
            </>
          )}
        </div>
      )}

      <button
        onClick={onScanNext}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition"
      >
        <RotateCcw size={16} /> Scan Next
      </button>
    </div>
  );
};

export default ScanQr;
