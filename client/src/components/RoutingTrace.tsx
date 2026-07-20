import { ProcessingStep } from '../api';

interface Props {
  steps: ProcessingStep[];
}

const phaseColors: Record<string, string> = {
  ssl_termination: '#722ed1',
  server_selection: '#1890ff',
  access_control_server: '#fa8c16',
  server_rewrite: '#13c2c2',
  location_selection: '#52c41a',
  access_control_location: '#fa8c16',
  rewrite: '#13c2c2',
  rate_limit: '#eb2f96',
  content_handler: '#f5222d',
  response_headers: '#2f54eb',
  error_page: '#faad14',
  logging: '#8c8c8c',
};

export default function RoutingTrace({ steps }: Props) {
  if (!steps || steps.length === 0) return null;

  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <h3 style={{ marginBottom: 16, fontSize: 16 }}>🔍 路由处理链路</h3>

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* 时间线 */}
        <div style={{
          position: 'absolute', left: 10, top: 8, bottom: 8,
          width: 2, background: '#e8e8e8',
        }} />

        {steps.map((step) => (
          <div key={step.order} style={{
            position: 'relative', marginBottom: 12,
            opacity: step.matched ? 1 : 0.5,
          }}>
            {/* 节点 */}
            <div style={{
              position: 'absolute', left: -18, top: 10,
              width: 10, height: 10, borderRadius: '50%',
              background: step.matched ? (phaseColors[step.phase] || '#1890ff') : '#d9d9d9',
              border: '2px solid #fff',
              boxShadow: '0 0 0 2px ' + (step.matched ? (phaseColors[step.phase] || '#1890ff') + '40' : '#d9d9d940'),
              zIndex: 1,
            }} />

            {/* 内容卡片 */}
            <div style={{
              background: '#fafafa', borderRadius: 6, padding: '10px 14px',
              border: `1px solid ${step.error ? '#ffccc7' : '#f0f0f0'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, padding: '1px 6px', borderRadius: 3,
                  background: (phaseColors[step.phase] || '#1890ff') + '18',
                  color: phaseColors[step.phase] || '#1890ff',
                  fontWeight: 600,
                }}>
                  {step.order}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{step.phaseLabel}</span>
                {step.matched ? (
                  <span style={{ fontSize: 11, color: '#52c41a' }}>✓</span>
                ) : (
                  <span style={{ fontSize: 11, color: '#d9d9d9' }}>—</span>
                )}
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{step.duration}μs</span>
              </div>
              <div style={{ fontSize: 13, color: step.error ? '#ff4d4f' : '#555' }}>
                {step.action}
              </div>
              {step.error && (
                <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>⚠ {step.error}</div>
              )}
              {Object.keys(step.output).length > 0 && step.matched && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>
                  {Object.entries(step.output).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 12 }}>
                      <span style={{ color: '#333' }}>{k}</span>={' '}
                      <span style={{ color: '#1890ff' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
