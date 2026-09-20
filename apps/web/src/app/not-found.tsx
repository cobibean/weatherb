import Link from 'next/link';
import { Header, Footer } from '@/components/layout';

export default function NotFound(): React.ReactElement {
  return (
    <div data-wb-theme="afterglow" className="wb-home wb-positions min-h-screen flex flex-col">
      <Header afterglow />
      <main className="wb-interior-main wb-shell flex-1">
        <div className="wb-page-heading">
          <p className="text-sm text-[#b6c4d5] mb-4">404</p>
          <h1 className="wb-page-title">Nothing on the horizon.</h1>
          <p className="text-[#b6c4d5] mb-8">
            This page isn’t available. Head back to the markets.
          </p>
          <Link href="/" className="wb-outcome wb-outcome--compact inline-block max-w-fit">
            Browse markets
          </Link>
        </div>
      </main>
      <Footer afterglow />
    </div>
  );
}
