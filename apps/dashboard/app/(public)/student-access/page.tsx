'use client';

import React from 'react';
import { Result, Button, Typography, Layout, Space } from 'antd';
import { AppleOutlined, AndroidOutlined, LogoutOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { getWebAuthStore } from '../../../lib/auth-store';

const { Title, Paragraph } = Typography;
const { Content } = Layout;

export default function StudentAccessPage() {
  const router = useRouter();
  const playUrl = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL;
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL;
  
  const handleSignOut = () => {
    getWebAuthStore().logout();
    router.push('/login');
  };

  return (
    <Layout className="min-h-screen flex items-center justify-center">
      <Content className="w-full max-w-md p-6">
        <Result
          status="info"
          title={<Title level={2}>NST Events Mobile</Title>}
          subTitle={
            <div className="text-left mt-4">
              <Paragraph>
                The Web application is strictly for event management and administration.
              </Paragraph>
              <Paragraph strong>
                Students must use the dedicated NST Events mobile app to view events, register, and track attendance.
              </Paragraph>
            </div>
          }
          extra={
            <Space orientation="vertical" size="large" className="w-full mt-6">
              <Space orientation="vertical" className="w-full">
                {playUrl ? (
                  <Button 
                    type="primary" 
                    icon={<AndroidOutlined />} 
                    size="large" 
                    block
                    href={playUrl}
                    target="_blank"
                  >
                    Download on Google Play
                  </Button>
                ) : (
                  <Button disabled block size="large" icon={<AndroidOutlined />}>
                    Google Play (Configuration Gap)
                  </Button>
                )}
                
                {appStoreUrl ? (
                  <Button 
                    type="primary" 
                    icon={<AppleOutlined />} 
                    size="large" 
                    block
                    href={appStoreUrl}
                    target="_blank"
                  >
                    Download on the App Store
                  </Button>
                ) : (
                  <Button disabled block size="large" icon={<AppleOutlined />}>
                    App Store (Configuration Gap)
                  </Button>
                )}
              </Space>
              
              <Button 
                type="text" 
                icon={<LogoutOutlined />} 
                onClick={handleSignOut}
                block
              >
                Sign Out
              </Button>
            </Space>
          }
        />
      </Content>
    </Layout>
  );
}
