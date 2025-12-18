import { CITIES } from '@weatherb/shared/constants';

export default function HomePage(): JSX.Element {
  const city = CITIES[0];
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">WeatherB</h1>
      <p className="mt-2 text-sm text-slate-600">Automated weather prediction markets on Flare.</p>
      <div className="mt-6 rounded border p-4">
        <div className="text-sm font-medium">Example city</div>
        <div className="text-sm text-slate-700">
          {city?.name} ({city?.latitude}, {city?.longitude})
        </div>
      </div>
    </main>
  );
}
