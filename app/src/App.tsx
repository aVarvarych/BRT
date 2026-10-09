import { HomeScreen } from './screens/HomeScreen';
import { RouteScreen } from './screens/RouteScreen';
import { TripScreen } from './screens/TripScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { Toast, useHash } from './ui';

export function App() {
  const [, view, id, sub] = useHash().replace(/^#/, '').split('/');
  let screen;
  if (view === 'route' && id) screen = <RouteScreen key={id} routeId={id} />;
  else if (view === 'trip' && id && sub === 'review') screen = <ReviewScreen key={id} tripId={id} />;
  else if (view === 'trip' && id) screen = <TripScreen key={id} tripId={id} />;
  else screen = <HomeScreen />;
  return (
    <>
      {screen}
      <Toast />
    </>
  );
}
