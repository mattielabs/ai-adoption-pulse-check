/**
 * Client routes.
 *
 * `/p/:publicId` is the employee Pulse experience; `/admin/*` is the
 * administrative control plane; `/status` is the development smoke screen.
 *
 * The admin routes are guarded by `AdminApp` for navigation only. Authorization
 * is enforced by the Worker on every request - a route reached any other way
 * simply gets 401s instead of data.
 *
 * No scoring, classification, recommendation or privacy logic may ever live in
 * a component. Those belong to `src/core` so the same code runs in the browser,
 * in the Worker, and in tests. Spec 54.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import { SystemStatus } from './routes/SystemStatus.js';
import { NotFound } from './routes/NotFound.js';
import { PulsePage } from './pulse/PulsePage.js';
import { AdminApp } from './admin/AdminApp.js';
import { LoginPage } from './admin/LoginPage.js';
import { SetupPage } from './admin/SetupPage.js';
import { OrganizationPage } from './admin/OrganizationPage.js';
import { PulseListPage } from './admin/PulseListPage.js';
import { PulseNewPage } from './admin/PulseNewPage.js';
import { PulseDetailPage } from './admin/PulseDetailPage.js';
import { ResultsLayout } from './admin/results/ResultsLayout.js';
import { OverviewTab } from './admin/results/OverviewTab.js';
import { DimensionTab } from './admin/results/DimensionTab.js';
import { OpportunitiesTab } from './admin/results/OpportunitiesTab.js';
import { ResponsesTab } from './admin/results/ResponsesTab.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/p/:publicId" element={<PulsePage />} />

      <Route path="/admin" element={<AdminApp />}>
        <Route index element={<Navigate to="/admin/pulses" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="pulses" element={<PulseListPage />} />
        <Route path="pulses/new" element={<PulseNewPage />} />
        <Route path="pulses/:id" element={<PulseDetailPage />} />

        {/*
          One layout fetches the analysis once and hosts every view, so
          switching tabs does not re-run the analysis.
        */}
        <Route path="pulses/:id/results" element={<ResultsLayout />}>
          <Route index element={<OverviewTab />} />
          <Route path="adoption" element={<DimensionTab dimension="adoption" />} />
          <Route path="confidence" element={<DimensionTab dimension="confidence" />} />
          <Route path="workflow" element={<DimensionTab dimension="workflow" />} />
          <Route path="safety" element={<DimensionTab dimension="safety" />} />
          <Route path="enablement" element={<DimensionTab dimension="enablement" />} />
          <Route path="opportunities" element={<OpportunitiesTab />} />
          <Route path="responses" element={<ResponsesTab />} />
        </Route>
      </Route>

      <Route path="/status" element={<SystemStatus />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
