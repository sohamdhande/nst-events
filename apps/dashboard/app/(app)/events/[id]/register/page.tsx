'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Skeleton, Alert, Typography, Breadcrumb, Space } from 'antd';
import { useEventDetail, useMyRegistration } from '../../../../../hooks/useEventDetail';
import { useRegisterForEvent } from '../../../../../hooks/useRegisterForEvent';

const { Title, Text } = Typography;

export default function RegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  const router = useRouter();

  const { data: event, isLoading: isLoadingEvent, isError: isErrorEvent } = useEventDetail(eventId);
  const { data: registration, isLoading: isLoadingReg } = useMyRegistration(eventId);
  const { mutate: register, isPending: isRegistering } = useRegisterForEvent(eventId);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // UX Guard: Redirect back to Event Detail if already registered or waitlisted or cancelled
    if (registration && registration.status !== 'UNREGISTERED') {
      router.replace(`/events/${eventId}`);
    }
  }, [registration, router, eventId]);

  if (isLoadingEvent || isLoadingReg) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (isErrorEvent || !event) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Alert
          title="Event Not Found"
          description="We could not find the event you are trying to register for."
          type="error"
          showIcon
          action={
            <Link href={`/events/${eventId}`}>
              <Button size="small">Go Back</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleRegister = () => {
    setErrorMessage(null);
    register(undefined, {
      onSuccess: () => {
        router.push(`/events/${eventId}`);
      },
      onError: (err: Error) => {
        setErrorMessage(err.message || 'An error occurred during registration.');
      }
    });
  };

  // If the guard is firing, don't render the form
  if (registration && registration.status !== 'UNREGISTERED') {
    return null; 
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 24 }}
        items={[
          { title: <Link href="/events">Events</Link> },
          { title: <Link href={`/events/${eventId}`}>{event?.title}</Link> },
          { title: 'Confirm Registration' },
        ]}
      />

      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Confirm Registration</Title>
        <Text type="secondary">Please confirm your registration below.</Text>
      </div>

      <Card>
        <Text style={{ fontSize: 16 }}>
          You are registering for: <Text strong>{event.title}</Text>
        </Text>

        {errorMessage && (
          <Alert
            title={errorMessage}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Button 
              onClick={() => router.push(`/events/${eventId}`)}
              disabled={isRegistering}
            >
              Cancel
            </Button>
            <Button 
              type="primary"
              onClick={handleRegister}
              loading={isRegistering}
            >
              Confirm Registration
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
