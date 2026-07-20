import { useState } from 'react';

interface Props {
  onSubmit: (params: {
    method: string; uri: string; host: string; scheme: 'http' | 'https';
    headers: Record<string, string>; body: string; clientIp: string;
  }) => void;
  loading: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d9d9d9', fontSize: 13, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 4, display: 'block',
};

export default function RequestForm({ onSubmit, loading }: Props) {
  const [method, setMethod] = useState('GET');
  const [uri, setUri] = useState('/api/users');
  const [host, setHost] = useState('localhost');
  const [scheme, setScheme] = useState<'http' | 'https'>('http');
  const [clientIp, setClientIp] = useState('127.0.0.1');
  const [headers, setHeaders] = useState<[string, string][]>([['Accept', 'application/json']]);
  const [body, setBody] = useState('');

  const addHeader = () => setHeaders([...headers, ['', '']]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, j) => j !== i));
  const updateHeader = (i: number, key: string, val: string) => {
    const next = [...headers];
    next[i] = [key, val];
    setHeaders(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const headerObj: Record<string, string> = {};
    headers.forEach(([k, v]) => { if (k.trim()) headerObj[k.trim()] = v; });
    onSubmit({ method, uri, host, scheme, headers: headerObj, body, clientIp });
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#fff', borderRadius: 8, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <h3 style={{ marginBottom: 16, fontSize: 16 }}>📝 请求配置</h3>

      {/* Method + Scheme */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Scheme</label>
          <select value={scheme} onChange={e => setScheme(e.target.value as 'http' | 'https')} style={inputStyle}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
      </div>

      {/* Host */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Host</label>
        <input value={host} onChange={e => setHost(e.target.value)} style={inputStyle} placeholder="e.g. localhost" />
      </div>

      {/* URI */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>URI</label>
        <input value={uri} onChange={e => setUri(e.target.value)} style={inputStyle} placeholder="e.g. /api/users?id=1" />
      </div>

      {/* Client IP */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Client IP</label>
        <input value={clientIp} onChange={e => setClientIp(e.target.value)} style={inputStyle} />
      </div>

      {/* Headers */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Headers
          <button type="button" onClick={addHeader} style={{
            marginLeft: 8, fontSize: 12, padding: '2px 8px',
            background: '#f0f0f0', border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer',
          }}>+ 添加</button>
        </label>
        {headers.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              value={k} onChange={e => updateHeader(i, e.target.value, v)}
              placeholder="Key" style={{ ...inputStyle, flex: 1, fontSize: 12 }}
            />
            <input
              value={v} onChange={e => updateHeader(i, k, e.target.value)}
              placeholder="Value" style={{ ...inputStyle, flex: 2, fontSize: 12 }}
            />
            <button type="button" onClick={() => removeHeader(i)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', fontSize: 16, padding: '0 4px',
            }}>✕</button>
          </div>
        ))}
      </div>

      {/* Body */}
      {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'monospace' }}
            placeholder='{"key": "value"}'
          />
        </div>
      )}

      <button type="submit" disabled={loading} style={{
        width: '100%', padding: '10px', borderRadius: 6, border: 'none',
        background: loading ? '#91caff' : '#1890ff', color: '#fff',
        fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '⏳ 模拟中...' : '🚀 发送请求'}
      </button>
    </form>
  );
}
