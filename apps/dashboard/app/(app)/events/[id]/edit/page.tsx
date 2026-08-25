'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  Form, Input, Button, Select, DatePicker, InputNumber, 
  Card, Breadcrumb, Typography, Space, Row, Col, Alert, Result, App
} from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useAcademicBatches } from '../../../../../hooks/useAcademicBatches';
import { useEventDetail } from '../../../../../hooks/useEventDetail';
import { useUpdateEvent, UpdateEventInput } from '../../../../../hooks/useUpdateEvent';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  
  const router = useRouter();
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { data: batchesData, isLoading: isLoadingBatches } = useAcademicBatches();
  const { data: event, isLoading: isLoadingEvent, isError: isErrorEvent, error: errorEvent } = useEventDetail(eventId);
  const { mutateAsync: updateEvent, isPending: isUpdating } = useUpdateEvent(eventId);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (event) {
      form.setFieldsValue({
        title: event.title,
        description: event.description,
        dateRange: [dayjs(event.startTime), dayjs(event.endTime)],
        location_name: event.locationName,
        event_type: event.eventType,
        visibility: event.visibility,
        registration_type: event.registrationType,
        attendance_type: event.attendanceType,
        max_capacity: event.maxCapacity,
        minimum_team_size: event.metadata?.minimum_team_size as number | undefined,
        maximum_team_size: event.metadata?.maximum_team_size as number | undefined,
        audience: event.audience,
        audience_batch_ids: event.audienceBatchIds,
      });
    }
  }, [event, form]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (isLoadingUser || isLoadingEvent || isLoadingBatches) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (isErrorEvent && errorEvent?.message?.includes('EVENT_LOCKED')) {
    return (
      <Result
        status="warning"
        title="Event Locked"
        subTitle="This event can no longer be edited."
        extra={<Button type="primary" onClick={() => router.push(`/events/${eventId}`)}>Back to Event</Button>}
      />
    );
  }

  if (!event || event.state !== 'DRAFT') {
    return (
      <Result
        status="warning"
        title="Not Editable"
        subTitle="This event is no longer in DRAFT state and cannot be edited."
        extra={<Button type="primary" onClick={() => router.push(`/events/${eventId}`)}>Back to Event</Button>}
      />
    );
  }

  let isAuthorizedToEdit = false;
  if (currentUser) {
    if (currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN') {
      isAuthorizedToEdit = true;
    } else {
      const userAdminClubs = currentUser.club_memberships
        .filter(m => m.role === 'CLUB_ADMIN') 
        .map(m => m.club_id);
      
      const isClubAdmin = event.eventClubs?.some(ec => userAdminClubs.includes(ec.clubId)) ?? false;
      if (isClubAdmin) {
        isAuthorizedToEdit = true;
      }
    }
  }

  if (!isAuthorizedToEdit) {
    return (
      <Result
        status="403"
        title="Unauthorized"
        subTitle="You do not have permission to edit this event."
        extra={<Link href={`/events/${eventId}`}><Button type="primary">Back to Event</Button></Link>}
      />
    );
  }

  interface EditEventFormValues {
    title: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dateRange: [any, any];
    location_name?: string;
    event_type: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    registration_type: 'INDIVIDUAL' | 'TEAM';
    attendance_type: 'SINGLE' | 'MULTI_SESSION';
    max_capacity?: number;
    minimum_team_size?: number;
    maximum_team_size?: number;
    audience: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';
    audience_batch_ids?: string[];
  }

  const handleFinish = async (values: EditEventFormValues) => {
    setErrorMessage(null);

    try {
      const [start, end] = values.dateRange;
      const payload: UpdateEventInput = {
        title: values.title,
        description: values.description,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        location_name: values.location_name,
        event_type: values.event_type,
        visibility: values.visibility,
        registration_type: values.registration_type,
        attendance_type: values.attendance_type,
        max_capacity: values.max_capacity,
        audience: values.audience,
        audience_batch_ids: values.audience === 'SPECIFIC_BATCHES' ? values.audience_batch_ids : undefined,
      };

      const updatedMetadata: Record<string, unknown> = { ...(event.metadata || {}) };
      if (values.registration_type === 'TEAM') {
        updatedMetadata.minimum_team_size = values.minimum_team_size;
        updatedMetadata.maximum_team_size = values.maximum_team_size;
      } else {
        delete updatedMetadata.minimum_team_size;
        delete updatedMetadata.maximum_team_size;
      }
      payload.metadata = Object.keys(updatedMetadata).length > 0 ? updatedMetadata : undefined;

      await updateEvent(payload);
      setIsDirty(false);
      message.success('Event updated successfully');
      router.push(`/events/${eventId}`);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === 'EVENT_LOCKED' || error.message?.includes('DRAFT')) {
        setErrorMessage(error.message);
        modal.warning({
          title: 'Event State Changed',
          content: 'This event can no longer be edited.',
          onOk: () => router.push(`/events/${eventId}`)
        });
      } else if (error.message?.includes('403') || error.message?.toLowerCase().includes('forbidden')) {
        setErrorMessage('You do not have permission to edit this event.');
      } else {
        setErrorMessage(error.message || 'Failed to update event. Please check your inputs.');
      }
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      modal.confirm({
        title: 'Discard unsaved changes?',
        content: 'You have unsaved changes. Are you sure you want to discard them?',
        okText: 'Discard',
        okButtonProps: { danger: true },
        cancelText: 'Stay',
        onOk: () => {
          setIsDirty(false);
          router.push(`/events/${eventId}`);
        }
      });
    } else {
      router.push(`/events/${eventId}`);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link href="/events">Events</Link> },
            { title: <Link href={`/events/${eventId}`}>{event.title}</Link> },
            { title: 'Edit Event' },
          ]}
        />
        <Title level={2} style={{ margin: 0 }}>Edit Event</Title>
        <Text type="secondary">Update the details of your drafted event.</Text>
      </div>

      {errorMessage && (
        <Alert type="error" title="Update Failed" description={errorMessage} showIcon />
      )}

      <Form
        form={form}
        layout="vertical"
        disabled={isUpdating}
        onValuesChange={(changedValues) => {
          setIsDirty(true);
          if (changedValues.registration_type === 'INDIVIDUAL') {
            form.setFieldsValue({ minimum_team_size: undefined, maximum_team_size: undefined });
          }
          if (changedValues.audience === 'ALL_STUDENTS') {
            form.setFieldsValue({ audience_batch_ids: undefined });
          }
        }}
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {/* BASIC INFORMATION */}
          <Card title="Basic Information" size="small">
            <Form.Item
              name="title"
              label="Event Name"
              rules={[{ required: true, message: 'Please enter the event name' }, { min: 3, max: 255 }]}
            >
              <Input placeholder="e.g. AI Hackathon 2026" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ max: 5000 }]}
            >
              <Input.TextArea rows={4} placeholder="Detailed description of the event..." />
            </Form.Item>
            <Form.Item
              name="event_type"
              label="Event Type"
              extra="Describes the kind of event."
              rules={[{ required: true, message: 'Please select an event type' }]}
            >
              <Select
                options={[
                  { label: 'Workshop', value: 'WORKSHOP' },
                  { label: 'Seminar', value: 'SEMINAR' },
                  { label: 'Competition', value: 'COMPETITION' },
                  { label: 'Meetup', value: 'MEETUP' },
                  { label: 'Hackathon', value: 'HACKATHON' },
                  { label: 'Cultural', value: 'CULTURAL' },
                  { label: 'Sports', value: 'SPORTS' },
                  { label: 'Other', value: 'OTHER' },
                ]}
              />
            </Form.Item>
          </Card>

          {/* SCHEDULE & LOCATION */}
          <Card title="Schedule & Location" size="small">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="dateRange"
                  label="Start and End Date/Time"
                  rules={[{ required: true, message: 'Please select the date range' }]}
                >
                  <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="location_name"
                  label="Venue / Location Name"
                  rules={[{ max: 255 }]}
                >
                  <Input placeholder="e.g. Main Auditorium" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* REGISTRATION */}
          <Card title="Registration" size="small">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) => prev.registration_type !== curr.registration_type}
                >
                  {({ getFieldValue }) => {
                    const regType = getFieldValue('registration_type');
                    return (
                      <Space orientation="vertical" style={{ width: '100%', marginBottom: regType === 'TEAM' ? 24 : 0 }}>
                        <Form.Item
                          name="registration_type"
                          label="Registration Type"
                          extra={
                            regType === 'TEAM' 
                              ? "Participants must register through a team."
                              : "Participants register individually."
                          }
                          rules={[{ required: true }]}
                          style={{ marginBottom: regType === 'TEAM' ? 8 : 24 }}
                        >
                          <Select
                            options={[
                              { label: 'Individual', value: 'INDIVIDUAL' },
                              { label: 'Team', value: 'TEAM' },
                            ]}
                          />
                        </Form.Item>
                        {regType === 'TEAM' && (
                          <div style={{ padding: 16, backgroundColor: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                            <Row gutter={16}>
                              <Col xs={24} md={12}>
                                <Form.Item
                                  name="minimum_team_size"
                                  label="Minimum Team Size"
                                  extra="Must be at least 1."
                                  rules={[
                                    { required: true, message: 'Required' },
                                    { type: 'number', min: 1, message: 'Must be >= 1' }
                                  ]}
                                >
                                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 2" />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={12}>
                                <Form.Item
                                  name="maximum_team_size"
                                  label="Maximum Team Size"
                                  extra="Must be >= minimum size."
                                  rules={[
                                    { required: true, message: 'Required' },
                                    ({ getFieldValue }) => ({
                                      validator(_, value) {
                                        const min = getFieldValue('minimum_team_size');
                                        if (!value || !min || value >= min) {
                                          return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Max size must be >= min size'));
                                      },
                                    }),
                                  ]}
                                >
                                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 4" />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Alert 
                              type="info" 
                              title="Individual registration is not permitted for team events." 
                              showIcon 
                            />
                          </div>
                        )}
                      </Space>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="max_capacity"
                  label="Maximum Capacity"
                  extra="Maximum number of participants allowed for the event. Leave empty for unlimited spots."
                  rules={[{ type: 'number', min: 1 }]}
                >
                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 100" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* AUDIENCE & ACCESS */}
          <Card title="Audience & Access" size="small">
            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.visibility !== curr.visibility}
            >
              {({ getFieldValue }) => {
                const vis = getFieldValue('visibility');
                return (
                  <Form.Item
                    name="visibility"
                    label="Visibility"
                    extra={
                      vis === 'PRIVATE'
                        ? "Visible only to authorized event or club users and global administrators."
                        : "Visible to authenticated users when the event is published."
                    }
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { label: 'Public', value: 'PUBLIC' },
                        { label: 'Private', value: 'PRIVATE' },
                      ]}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.audience !== curr.audience}
            >
              {({ getFieldValue }) => {
                const aud = getFieldValue('audience');
                return (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Form.Item
                      name="audience"
                      label="Audience"
                      extra={
                        aud === 'ALL_STUDENTS'
                          ? "All students are eligible to see and register."
                          : "Only students from specific batches are eligible."
                      }
                      rules={[{ required: true }]}
                      style={{ marginBottom: aud === 'SPECIFIC_BATCHES' ? 8 : 24 }}
                    >
                      <Select
                        options={[
                          { label: 'All Students', value: 'ALL_STUDENTS' },
                          { label: 'Specific Batches', value: 'SPECIFIC_BATCHES' },
                        ]}
                      />
                    </Form.Item>

                    {aud === 'SPECIFIC_BATCHES' && (
                      <Form.Item
                        name="audience_batch_ids"
                        label="Eligible Batches"
                        rules={[{ required: true, message: 'Please select at least one batch' }]}
                        style={{ marginBottom: 24 }}
                      >
                        <Select
                          mode="multiple"
                          placeholder="Select batches"
                          options={batchesData?.map(b => ({ label: b.display_name, value: b.id }))}
                          showSearch
                          filterOption={(input, option) => 
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                          }
                        />
                      </Form.Item>
                    )}
                  </Space>
                );
              }}
            </Form.Item>
          </Card>

          {/* ATTENDANCE */}
          <Card title="Attendance" size="small">
            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.attendance_type !== curr.attendance_type}
            >
              {({ getFieldValue }) => {
                const attType = getFieldValue('attendance_type');
                return (
                  <Form.Item
                    name="attendance_type"
                    label="Attendance Type"
                    extra={
                      attType === 'MULTI_SESSION'
                        ? "Multiple attendance sessions can be created for this event."
                        : "Exactly one attendance session can be created."
                    }
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { label: 'Single Session', value: 'SINGLE' },
                        { label: 'Multi Session', value: 'MULTI_SESSION' },
                      ]}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Card>

          {/* SUBMISSION BUTTONS */}
          <Row justify="end" style={{ marginTop: 8 }}>
            <Space wrap>
              <Button onClick={handleCancel} disabled={isUpdating}>Cancel</Button>
              <Button 
                type="primary"
                onClick={() => {
                  form.validateFields().then(values => handleFinish(values));
                }}
                loading={isUpdating}
              >
                Save Changes
              </Button>
            </Space>
          </Row>
        </Space>
      </Form>
    </div>
  );
}
