import { useState } from 'react';
import { api, SimResult } from '../api';
import RequestForm from '../components/RequestForm';
import RoutingTrace from '../components/RoutingTrace';

export default function Simulator() {
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSimulate = async (params: {
    method: string; uri: string; host: string; scheme: 'http' | 'https';
    headers: Record<string, string>; body: string; clientIp: string;
  }) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.simulate(params);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>🔧 请求模拟器</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        {/* 左侧：请求表单 */}
        <div>
          <RequestForm onSubmit={handleSimulate} loading={loading} />
        </div>

        {/* 右侧：响应结果 */}
        <div>
          {error && (
            <div style={{ padding: 16, background: '#fff2f0', color: '#ff4d4f', borderRadius: 8, marginBottom: 16, border: '1px solid #ffccc7' }}>
              ❌ {error}
            </div>
          )}

          {result && (
            <div>
              {/* 响应摘要 */}
              <div style={{
                background: '#fff', borderRadius: 8, padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 4, fontSize: 14, fontWeight: 600,
                    color: '#fff',
                    background: result.statusCode < 300 ? '#52c41a' :
                               result.statusCode < 400 ? '#faad14' :
                               result.statusCode < 500 ? '#ff7a45' : '#ff4d4f',
                  }}>
                    {result.statusCode} {result.statusText}
                  </span>
                  <span style={{ fontSize: 13, color: '#888' }}>耗时 {result.elapsed}ms</span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>
                    {result.environment === 'dev' ? '🔧 开发' : '🔒 生产'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#888' }}>匹配 Server: </span>
                    <strong>{result.matchedServer}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>匹配 Location: </span>
                    <strong>{result.matchedLocation}</strong>
                    <span style={{ color: '#aaa', fontSize: 11, marginLeft: 6 }}>({result.matchType})</span>
                  </div>
                  {result.upstreamServer && (
                    <>
                      <div>
                        <span style={{ color: '#888' }}>上游服务器: </span>
                        <strong style={{ color: '#1890ff' }}>{result.upstreamServer}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#888' }}>负载算法: </span>
                        <strong>{result.upstreamAlgorithm}</strong>
                        <span style={{ color: '#aaa', fontSize: 11, marginLeft: 6 }}>({result.upstreamName})</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 响应头 */}
              <details style={{
                background: '#fff', borderRadius: 8, padding: '12px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
              }}>
                <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#333' }}>
                  📋 响应头 ({Object.keys(result.headers).length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(result.headers).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 13, padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <span style={{ color: '#1890ff' }}>{k}</span>: <span style={{ color: '#666' }}>{v}</span>
                    </div>
                  ))}
                  {Object.keys(result.headers).length === 0 && <span style={{ color: '#aaa', fontSize: 13 }}>无</span>}
                </div>
              </details>

              {/* 响应体 */}
              <details style={{
                background: '#fff', borderRadius: 8, padding: '12px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
              }}>
                <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#333' }}>
                  📄 响应体
                </summary>
                <pre style={{
                  marginTop: 8, background: '#f5f5f5', padding: 12, borderRadius: 6,
                  fontSize: 13, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
                }}>
                  {result.body || '(空)'}
                </pre>
              </details>

              {/* 路由链路 */}
              <RoutingTrace steps={result.processingSteps} />
            </div>
          )}

          {!result && !error && (
            <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>
              ← 填写请求参数并点击"发送请求"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
