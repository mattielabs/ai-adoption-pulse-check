/**
 * Client routes.
 *
 * `/p/:publicId` is the employee Pulse experience; `/admin/*` is the
 * administrative control plane; `/demo/*` and `/methodology` are the public,
 * synthetic-data demonstration; `/status` is the development smoke screen.
 *
 * The admin routes are guarded by `AdminApp` for navigation only. Authorization
 * is enforced by the Worker on every request - a route reached any other way
 * simply gets 401s instead of data.
 *
 * The demo route tree renders the SAME results components as the admin one, in
 * demo mode, so there is one dashboard rather than a real one and a mock-up.
 * What differs is where the payload comes from: `/api/demo/*`, which takes no
 * identifier and cannot read D1.
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
import { ResultsLayout } from './results/ResultsLayout.js';
import { OverviewTab } from './results/OverviewTab.js';
import { DimensionTab } from './results/DimensionTab.js';
import { OpportunitiesTab } from './results/OpportunitiesTab.js';
import { ResponsesTab } from './results/ResponsesTab.js';
import { ExportsTab } from './results/ExportsTab.js';
import { DemoLayout } from './demo/DemoLayout.js';
import { DemoLanding } from './demo/DemoLanding.js';
import { MethodologyPage } from './demo/MethodologyPage.js';

/** The dashboard views, mounted identically under /admin and under /demo. */
function resultsViews() {
  return (
    <>
      <Route index element={<OverviewTab />} />
      <Route path="adoption" element={<DimensionTab dimension="adoption" />} />
      <Route path="confidence" element={<DimensionTab dimension="confidence" />} />
      <Route path="workflow" element={<DimensionTab dimension="workflow" />} />
      <Route path="safety" element={<DimensionTab dimension="safety" />} />
      <Route path="enablement" element={<DimensionTab dimension="enablement" />} />
      <Route path="opportunities" element={<OpportunitiesTab />} />
      <Route path="responses" element={<ResponsesTab />} />
    </>
  );
}

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
          {resultsViews()}
          {/* Admin only: the demo has nothing real to export. */}
          <Route path="exports" element={<ExportsTab />} />
        </Route>
      </Route>

      <Route path="/demo" element={<DemoLayout />}>
        <Route index element={<DemoLanding />} />
        <Route path="survey" element={<PulsePage demo />} />
        <Route path="results" element={<ResultsLayout source="demo" />}>
          {resultsViews()}
        </Route>
      </Route>

      <Route path="/methodology" element={<DemoLayout />}>
        <Route index element={<MethodologyPage />} />
      </Route>

      <Route path="/status" element={<SystemStatus />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
