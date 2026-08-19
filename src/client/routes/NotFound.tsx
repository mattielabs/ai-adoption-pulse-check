export function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 font-sans text-slate-800">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        This route does not exist. Invalid Pulse links return an indistinguishable
        response so that a public id cannot be probed for existence.
      </p>
    </main>
  );
}
