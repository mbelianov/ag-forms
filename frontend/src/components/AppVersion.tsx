import { useState, useEffect } from 'react';

type Status = 'checking' | 'reachable' | 'unreachable';

const DOT_COLOURS: Record<Status, string> = {
  checking: '#8d8d8d',
  reachable: '#24a148',
  unreachable: '#da1e28',
};

function Dot({ status }: { status: Status }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: DOT_COLOURS[status],
        marginRight: '6px',
        flexShrink: 0,
      }}
    />
  );
}

export default function AppVersion() {
  const [apiStatus, setApiStatus] = useState<Status>('checking');
  const [storageStatus, setStorageStatus] = useState<Status>('checking');

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => {
        if (!res.ok) throw new Error('non-200');
        return res.json();
      })
      .then((body) => {
        setApiStatus('reachable');
        setStorageStatus(body.storage === 'healthy' ? 'reachable' : 'unreachable');
      })
      .catch(() => {
        setApiStatus('unreachable');
        setStorageStatus('unreachable');
      });
  }, []);

  const fullSha: string | undefined = import.meta.env.VITE_APP_VERSION;
  const deployEnv: string | undefined = import.meta.env.VITE_DEPLOY_ENV;

  const shortSha = fullSha ? fullSha.slice(0, 7) : 'local';
  const shaNode = fullSha ? (
    <a
      href={`https://github.com/MartinBelyanov/ag-forms/commit/${fullSha}`}
      target="_blank"
      rel="noreferrer"
      style={{ color: '#525252', textDecoration: 'underline' }}
    >
      {shortSha}
    </a>
  ) : (
    <span>{shortSha}</span>
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        borderRadius: '4px',
        padding: '0.5rem 0.75rem',
        fontSize: '0.75rem',
        color: '#525252',
        lineHeight: '1.6',
        zIndex: 9999,
      }}
    >
      <div style={{ marginBottom: '4px' }}>
        {shaNode}
        {deployEnv ? <span> · {deployEnv}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}><Dot status="reachable" /><span style={{ width: '4.5rem', display: 'inline-block', textAlign: 'left' }}>Frontend</span>reachable</div>
      <div style={{ display: 'flex', alignItems: 'center' }}><Dot status={apiStatus} /><span style={{ width: '4.5rem', display: 'inline-block', textAlign: 'left' }}>API</span>{apiStatus}</div>
      <div style={{ display: 'flex', alignItems: 'center' }}><Dot status={storageStatus} /><span style={{ width: '4.5rem', display: 'inline-block', textAlign: 'left' }}>Storage</span>{storageStatus}</div>
    </div>
  );
}
