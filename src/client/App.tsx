/**
 * Phase 0 client shell.
 *
 * This exists to prove that routing, the build, and the Worker/static-asset
 * integration work. The employee survey, personal result, admin dashboard and
 * Opportunity Map screens are later phases and are deliberately absent.
 *
 * No scoring, classification, recommendation or privacy logic may ever live in
 * a component. Those belong to `src/core` so the same code runs in the browser,
 * in the Worker, and in tests. Spec 54.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import { SystemStatus } from './routes/SystemStatus.js';
import { NotFound } from './routes/NotFound.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/status" replace />} />
      <Route path="/status" element={<SystemStatus />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
