/**
 * Client routes.
 *
 * `/p/:publicId` is the employee Pulse experience (Phase 1). `/status` is the
 * Phase 0 development smoke screen. Admin routes are Phase 2 and deliberately
 * absent.
 *
 * No scoring, classification, recommendation or privacy logic may ever live in
 * a component. Those belong to `src/core` so the same code runs in the browser,
 * in the Worker, and in tests. Spec 54.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import { SystemStatus } from './routes/SystemStatus.js';
import { NotFound } from './routes/NotFound.js';
import { PulsePage } from './pulse/PulsePage.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/status" replace />} />
      <Route path="/p/:publicId" element={<PulsePage />} />
      <Route path="/status" element={<SystemStatus />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
