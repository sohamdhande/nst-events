'use client';

import React, { useEffect, useState } from 'react';
import { ConfigProvider, theme as antdTheme, App } from 'antd';
import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes';

const sharedToken = {
  colorPrimary: '#1677ff',
  colorInfo: '#1677ff',
  borderRadius: 6,
  wireframe: false,
  fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const lightTheme = {
  token: {
    ...sharedToken,
    colorSuccess: '#3f8600',
    colorWarning: '#faad14',
    colorError: '#cf1322',
    colorText: '#111827',
    colorTextSecondary: '#667085',
    colorBorder: '#E5E7EB',
    colorBorderSecondary: '#E5E7EB',
    colorBgLayout: '#F5F7FA',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      siderBg: '#0F172A',
    },
    Menu: {
      darkItemBg: '#0F172A',
      darkItemSelectedBg: 'rgba(22, 119, 255, 0.1)',
      darkItemSelectedColor: '#1677ff',
      darkItemColor: '#94A3B8',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.05)',
      darkItemHoverColor: '#F8FAFC',
    },
    Card: {
      paddingLG: 20,
    }
  },
};

const darkTheme = {
  token: {
    ...sharedToken,
    colorSuccess: '#73D13D',
    colorWarning: '#FFC53D',
    colorError: '#FF7875',
    colorText: '#F3F4F6',
    colorTextSecondary: '#9CA3AF',
    colorBorder: '#263244',
    colorBorderSecondary: '#263244',
    colorBgLayout: '#111827',
    colorBgContainer: '#18212F',
    colorBgElevated: '#1F2937',
  },
  components: {
    Layout: {
      headerBg: '#111827',
      siderBg: '#0B1220',
    },
    Menu: {
      darkItemBg: '#0B1220',
      darkItemSelectedBg: 'rgba(22, 119, 255, 0.15)',
      darkItemSelectedColor: '#1677ff',
      darkItemColor: '#9CA3AF',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.05)',
      darkItemHoverColor: '#F3F4F6',
    },
    Card: {
      paddingLG: 20,
    }
  },
};

function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: isDark ? darkTheme.token : lightTheme.token,
        components: isDark ? darkTheme.components : lightTheme.components,
      }}
    >
      <App>
        {children}
      </App>
    </ConfigProvider>
  );
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AntdConfigProvider>{children}</AntdConfigProvider>
    </NextThemeProvider>
  );
}
