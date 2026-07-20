import { useEffect, useState } from 'react';
import { api, ConfigInfo } from '../api';

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

export default function ConfigViewer() {
  const [configs, setConfigs] = useState<ConfigInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getConfigs().then(setConfigs);
  }, []);

  const handleSelect = async (name: string) => {
    setSelected(name);
    setMessage('');
    try {
      const { content: c } = await api.getConfig(name);
      setContent(c);
    } catch {
      setContent('加载失败');
    }
  };

  const handleActivate = async () => {
    if (!selected) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await api.activateConfig(selected);
      setMessage(
        `✅ 已激活 ${result.name}（${result.environment === 'dev' ? '开发环境' : '生产环境'}）| Server: ${result.serverBlocks} | Location: ${result.locationBlocks} | Upstream: ${result.upstreams}`
      );
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>📁 配置管理</h2>

      {/* 配置选择器 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selected}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 14, minWidth: 250 }}
        >
          <option value="">-- 选择配置文件 --</option>
          {configs.map((c) => (
            <option key={c.name} value={c.name}>
              {c.environment === 'dev' ? '🔧' : '🔒'} {c.name} ({c.environment === 'dev' ? '开发' : '生产'})
            </option>
          ))}
        </select>

        <button
          onClick={handleActivate}
          disabled={!selected || loading}
          style={{
            ...btnStyle,
            background: '#1890ff',
            color: '#fff',
            opacity: !selected || loading ? 0.5 : 1,
          }}
        >
          {loading ? '激活中...' : '▶ 激活此配置'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: 6, marginBottom: 16, fontSize: 13,
          background: message.startsWith('✅') ? '#f6ffed' : '#fff2f0',
          color: message.startsWith('✅') ? '#52c41a' : '#ff4d4f',
          border: `1px solid ${message.startsWith('✅') ? '#b7eb8f' : '#ffccc7'}`,
        }}>
          {message}
        </div>
      )}

      {/* 配置内容 */}
      {content && (
        <div style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          borderRadius: 8,
          padding: 20,
          fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
          fontSize: 13,
          lineHeight: 1.7,
          overflow: 'auto',
          maxHeight: 'calc(100vh - 280px)',
          whiteSpace: 'pre-wrap',
        }}>
          {highlightNginx(content)}
        </div>
      )}

      {!content && (
        <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>
          请选择一个配置文件查看
        </div>
      )}
    </div>
  );
}

/** 简单的 nginx 语法高亮 */
function highlightNginx(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    let styled: React.ReactNode = line;

    // 注释
    if (line.trim().startsWith('#')) {
      styled = <span style={{ color: '#6a9955' }}>{line}</span>;
    } else {
      // 指令高亮
      styled = line
        .replace(/\b(server|location|upstream|listen|return|proxy_pass|rewrite|try_files|add_header|root|index|error_page|gzip|ssl_protocols|ssl_ciphers|keepalive|allow|deny|include|set|if|expires|limit_req|limit_conn)\b/g,
          '\x01$1\x02')
        .split('\x01')
        .map((part, j) => {
          if (part.startsWith('\x02')) {
            const end = part.indexOf('\x02', 1);
            const word = part.slice(1, end);
            const rest = part.slice(end + 1);
            return <><span key={j} style={{ color: '#569cd6' }}>{word}</span>{rest}</>;
          }
          return <span key={j}>{part}</span>;
        });
    }

    return (
      <div key={i} style={{ minHeight: '1.4em' }}>
        <span style={{ color: '#858585', marginRight: 16, userSelect: 'none', display: 'inline-block', width: 40, textAlign: 'right' }}>{i + 1}</span>
        {styled}
      </div>
    );
  });
}
