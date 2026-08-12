import { type ReactNode, useEffect } from 'react';
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
import { useGetMe } from '@workspace/api-client-react';

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

// Auth Guard Component
function ProtectedRoute({ component: Component, ...rest }: { component: any, path: string }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
    }
  });

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      setLocation('/login');
    }
  }, [user, isLoading, isError, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return <Component {...rest} />;
}

function Router() {
  return (
    <AppLayout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/tournament" component={TournamentResults} />
          
          <Route path="/dashboard">
            {() => <ProtectedRoute component={Dashboard} path="/dashboard" />}
          </Route>
          <Route path="/brackets/:id">
            {({ id }) => <ProtectedRoute component={BracketViewer} path={`/brackets/${id}`} />}
          </Route>
          <Route path="/groups">
            {() => <ProtectedRoute component={Groups} path="/groups" />}
          </Route>
          <Route path="/groups/:id">
            {({ id }) => <ProtectedRoute component={GroupDetail} path={`/groups/${id}`} />}
          </Route>
          <Route path="/admin">
            {() => <ProtectedRoute component={Admin} path="/admin" />}
          </Route>
          
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
