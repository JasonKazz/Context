const status = document.querySelector('#status');
try {
  const response = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('Unavailable');
  const health = await response.json();
  status.textContent = health.status === 'ok' ? 'Frontend and backend connected.' : 'Backend unavailable.';
} catch { status.textContent = 'Backend unavailable. Start the server and refresh.'; }
