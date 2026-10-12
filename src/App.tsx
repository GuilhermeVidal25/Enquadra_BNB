import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Catalog from './pages/Catalog';
import Intake from './pages/Intake';
import References from './pages/References';
import CasePage from './pages/CasePage';
import type { Analyst } from './types';
import { api, mutation } from './lib/api';
import { Notice } from './components/UI';
export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'analisados'),
    [profile, setProfile] = useState<Analyst | null>(null),
    [profiles, setProfiles] = useState<Analyst[]>([]),
    [sessionVersion, setSessionVersion] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    const update = () => {
      setRoute(location.hash.slice(1) || 'analisados');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    api<{ currentUser: Analyst; profiles: Analyst[] }>('/dev-session')
      .then((r) => {
        setProfile(r.currentUser);
        setProfiles(r.profiles);
      })
      .catch(() => {});
  }, [sessionVersion]);
  async function changeProfile(id: string) {
    try {
      await mutation('/dev-session', { id });
      setSessionVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const [page, id] = route.split('/');
  return (
    <Layout
      page={page}
      profile={profile}
      profiles={profiles}
      onProfile={(id) => void changeProfile(id)}
    >
      {error && <Notice error>{error}</Notice>}
      <div key={sessionVersion}>
        {page === 'entrada' ? (
          <Intake />
        ) : page === 'referencias' || page === 'conhecimento' ? (
          <References />
        ) : page === 'caso' && id ? (
          <CasePage id={id} />
        ) : (
          <Catalog dashboard={page === 'dashboard' || page === 'projetos'} />
        )}
      </div>
    </Layout>
  );
}
