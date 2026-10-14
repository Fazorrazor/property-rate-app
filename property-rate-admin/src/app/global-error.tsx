'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center p-6 text-center font-sans antialiased bg-stone-900 text-stone-100">
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-stone-400 mb-6">
          An unexpected error occurred in the municipal application.
        </p>
        <button
          onClick={() => reset()}
          className="rounded-lg bg-stone-100 text-stone-900 px-4 py-2 text-sm font-medium hover:bg-stone-200 transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
