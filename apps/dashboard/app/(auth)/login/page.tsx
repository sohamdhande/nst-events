'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getWebAuthStore } from '../../../lib/auth-store';
import { Button, Typography, Alert, Spin, Divider, theme } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function LoginContent() {
  const { token } = theme.useToken();
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = getWebAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  
  const errorParam = searchParams.get('error');

  useEffect(() => {
    // If the user already has a token in memory, send them to the app
    if (store.accessToken) {
      router.push('/dashboard');
    }
  }, [store.accessToken, router]);

  const handleLogin = () => {
    setIsLoading(true);
    // Let the browser redirect to the OAuth endpoint
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div suppressHydrationWarning style={{
      width: '100%',
      maxWidth: 400,
      padding: '40px 32px',
      backgroundColor: token.colorBgContainer,
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.02)',
      border: `1px solid ${token.colorBorderSecondary}`,
      textAlign: 'center',
    }}>
      <div suppressHydrationWarning style={{ marginBottom: 32 }}>
        <div suppressHydrationWarning style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          marginBottom: 20,
          boxShadow: '0 4px 12px rgba(22, 119, 255, 0.2)'
        }}>
          <span suppressHydrationWarning style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
            NST
          </span>
        </div>
        
        <Title suppressHydrationWarning level={3} style={{ margin: 0, fontWeight: 700, letterSpacing: -0.5, color: token.colorText }}>
          NST Events
        </Title>
        <Text suppressHydrationWarning style={{ display: 'block', marginTop: 6, fontSize: 14, color: token.colorTextSecondary }}>
          Club & Faculty Management Portal
        </Text>
      </div>

      {errorParam && (
        <Alert
          title="Authentication Failed"
          description={errorParam}
          type="error"
          showIcon
          style={{ marginBottom: 24, textAlign: 'left', borderRadius: 8 }}
        />
      )}

      <Button
        suppressHydrationWarning
        type="primary"
        size="large"
        block
        icon={<GoogleOutlined />}
        onClick={handleLogin}
        loading={isLoading}
        style={{ 
          height: 48, 
          fontSize: 15, 
          fontWeight: 500,
          borderRadius: 8,
          boxShadow: '0 2px 0 rgba(22, 119, 255, 0.1)'
        }}
      >
        Sign in with Google
      </Button>

      <div suppressHydrationWarning>
        <Divider style={{ margin: '24px 0', borderColor: token.colorBorderSecondary }}>
          <Text type="secondary" suppressHydrationWarning style={{ fontSize: 12 }}>STUDENT ACCESS</Text>
        </Divider>
      </div>

      <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
        Are you a student? {' '}
        <Link 
          suppressHydrationWarning
          href="/student-access" 
          style={{ color: '#1677ff', fontWeight: 500, transition: 'color 0.2s' }}
        >
          Download the app
        </Link>
      </Text>
    </div>
  );
}

export default function LoginPage() {
  const { token } = theme.useToken();

  return (
    <div suppressHydrationWarning style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: token.colorBgLayout,
      backgroundImage: `radial-gradient(${token.colorBorderSecondary} 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      padding: 24
    }}>
      <Suspense fallback={<Spin size="large" />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
