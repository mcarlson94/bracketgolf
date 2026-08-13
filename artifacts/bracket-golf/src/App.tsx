import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { AppLayout } from '@/components/layout/AppLayout';

import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import BracketViewer from '@/pages/BracketViewer';
import Leaderboard from '@/pages/Leaderboard';
import Groups from '@/pages/Groups';
import GroupDetail from '@/pages/GroupDetail';
import TournamentResults from '@/pages/TournamentResults';
import Admin from '@/pages/Admin';

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          {/* /login kept in routes so existing sessions/bookmarks still work */}
          <Route path="/login" component={Login} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/tournament" component={TournamentResults} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/brackets/:id" component={BracketViewer} />
          <Route path="/groups" component={Groups} />
          <Route path="/groups/:id" component={GroupDetail} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppLayout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
