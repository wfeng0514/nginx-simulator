import { useEffect, useState } from 'react';
import { api, GlobalStats } from '../api';
import UpstreamStatus from '../components/UpstreamStatus';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  textAlign: 'center',
  flex: 1,
  minWidth: 140,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#888',
  marginBottom: 8,
};

const valueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#1890ff',
};

export default function Dashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStatus()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ff4d4f' }}>
        <h3>加载失败</h3>
        <p>{error}</p>
        <p style={{ color: '#888', fontSize: 13 }}>请确保后端服务已启动 (npm run dev:server)</p>
      </div>
    );
  }

  if (!stats) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>📊 系统总览</h2>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={cardStyle}>
          <div style={labelStyle}>活跃配置</div>
          <div style={{ ...valueStyle, fontSize: 16 }}>{stats.activeConfig || '(未加载)'}</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
            {stats.environment === 'dev' ? '🔧 开发环境' : stats.environment === 'prod' ? '🔒 生产环境' : '-'}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>总请求数</div>
          <div style={valueStyle}>{stats.totalRequests}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Server 块</div>
          <div style={valueStyle}>{stats.serverBlocks}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Location 块</div>
          <div style={valueStyle}>{stats.locationBlocks}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Upstream 组</div>
          <div style={valueStyle}>{stats.upstreams}</div>
        </div>
      </div>

      {/* 上游服务器状态 */}
      <UpstreamStatus />
    </div>
  );
}
