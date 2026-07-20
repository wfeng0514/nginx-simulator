import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', label: '📊 总览', end: true },
  { to: '/configs', label: '📁 配置' },
  { to: '/simulate', label: '🔧 模拟' },
];

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#f0f2f5',
  } as React.CSSProperties,
  sidebar: {
    width: 200,
    background: '#001529',
    color: '#fff',
    padding: '20px 0',
    flexShrink: 0,
  } as React.CSSProperties,
  logo: {
    padding: '0 20px 20px',
    fontSize: 18,
    fontWeight: 700,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: 16,
    color: '#1890ff',
  } as React.CSSProperties,
  navLink: {
    display: 'block',
    padding: '10px 24px',
    color: 'rgba(255,255,255,0.65)',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'all 0.2s',
  } as React.CSSProperties,
  navLinkActive: {
    color: '#fff',
    background: '#1890ff',
  } as React.CSSProperties,
  main: {
    flex: 1,
    padding: 24,
    overflow: 'auto',
  } as React.CSSProperties,
  header: {
    background: '#fff',
    padding: '12px 24px',
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 14,
    color: '#666',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>🖥 Nginx Simulator</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </aside>
      <main style={styles.main}>
        <div style={styles.header}>
          当前位置：{navItems.find(i =>
            i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)
          )?.label || location.pathname}
        </div>
        {children}
      </main>
    </div>
  );
}
