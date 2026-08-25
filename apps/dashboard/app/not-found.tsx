import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center space-y-4 p-8 bg-gray-50">
      <h2 className="text-2xl font-bold text-gray-900">404 - Not Found</h2>
      <p className="text-gray-500">The page you are looking for does not exist.</p>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
