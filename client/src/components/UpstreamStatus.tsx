import { useEffect, useState } from 'react';
import { api, UpstreamInfo } from '../api';

export default function UpstreamStatus() {
  const [upstreams, setUpstreams] = useState<UpstreamInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUpstreams()
      .then(setUpstreams)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#888', padding: 16 }}>加载上游服务器状态...</div>;

  if (upstreams.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
        无 upstream 配置（请先激活一个包含 upstream 的配置文件）
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>🖥 上游服务器状态</h3>
      {upstreams.map((up) => (
        <div key={up.name} style={{
          background: '#fff', borderRadius: 8, padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 15 }}>{up.name}</h4>
            <span style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 4,
              background: '#e6f7ff', color: '#1890ff',
            }}>
              {up.algorithm}
            </span>
            <span style={{ fontSize: 12, color: '#888' }}>
              总请求: {up.totalRequests}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {up.servers.map((svr, i) => {
              const total = up.totalRequests || 1;
              const pct = ((svr.requestCount / total) * 100).toFixed(1);
              return (
                <div key={i} style={{
                  border: '1px solid #f0f0f0', borderRadius: 6, padding: 10,
                  background: svr.down ? '#fff2f0' : svr.backup ? '#fffbe6' : '#fafafa',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                      background: svr.down ? '#ff4d4f' : svr.healthy ? '#52c41a' : '#faad14',
                    }} />
                    <strong style={{ fontSize: 13 }}>{svr.address}:{svr.port}</strong>
                    {svr.down && <span style={{ fontSize: 11, color: '#ff4d4f' }}>DOWN</span>}
                    {svr.backup && <span style={{ fontSize: 11, color: '#faad14' }}>BACKUP</span>}
                  </div>

                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    weight: {svr.weight} | 活跃连接: {svr.activeConnections} | 请求数: {svr.requestCount}
                  </div>

                  {/* 请求分布条 */}
                  <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: svr.down ? '#ffccc7' : 'linear-gradient(90deg, #1890ff, #52c41a)',
                      width: `${Math.min(100, Math.max(0, Number(pct)))}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, textAlign: 'right' }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
