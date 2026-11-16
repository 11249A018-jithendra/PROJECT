import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { PortalApp, guarded, mount } from '../PortalShell';

// Gate portal (security) — served at /gate.
const Login = lazy(() => import('../../pages/Login'));
const SecurityDashboard = lazy(() => import('../../pages/security/SecurityDashboard'));
const ScanQr = lazy(() => import('../../pages/security/ScanQr'));
const ManualGate = lazy(() => import('../../pages/security/ManualGate'));
const Visitors = lazy(() => import('../../pages/security/Visitors'));
const CurrentlyOutside = lazy(() => import('../../pages/security/CurrentlyOutside'));
const ScanHistory = lazy(() => import('../../pages/security/ScanHistory'));
const EmergencyCenter = lazy(() => import('../../pages/shared/EmergencyCenter'));

mount(
  <PortalApp portal="gate" home="/security">
    <Route path="/login" element={<Login initialRole="security" />} />
    <Route path="/security" element={guarded('security', <SecurityDashboard />)} />
    <Route path="/security/scan" element={guarded('security', <ScanQr />)} />
    <Route path="/security/manual" element={guarded('security', <ManualGate />)} />
    <Route path="/security/visitors" element={guarded('security', <Visitors />)} />
    <Route path="/security/currently-outside" element={guarded('security', <CurrentlyOutside />)} />
    <Route path="/security/scan-history" element={guarded('security', <ScanHistory />)} />
    <Route path="/emergency" element={guarded('security', <EmergencyCenter />)} />
  </PortalApp>
);
