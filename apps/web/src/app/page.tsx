import { loadHomeMarkets } from '@/lib/home-markets';
import { HomeClient } from '@/components/home';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<React.ReactElement> {
  return <HomeClient {...await loadHomeMarkets()} />;
}
