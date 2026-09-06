'use client';

import React, { useState } from 'react';
import {
  Form, Input, Button, Select, DatePicker, InputNumber,
  Card, Breadcrumb, Typography, Space, Row, Col, Alert, Result
} from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useClubs } from '../../../../hooks/useClubs';
import { useAcademicBatches } from '../../../../hooks/useAcademicBatches';
import { useCreateEvent, useSubmitEventForApproval, CreateEventPayload } from '../../../../hooks/useCreateEvent';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function CreateEventPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { data: clubsData, isLoading: isLoadingClubs } = useClubs();
  const { data: batchesData, isLoading: isLoadingBatches } = useAcademicBatches();

  const { mutateAsync: createEvent, isPending: isCreating } = useCreateEvent();
  const { mutateAsync: submitApproval, isPending: isSubmitting } = useSubmitEventForApproval();

  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitApprovalError, setSubmitApprovalError] = useState<string | null>(null);

  const isGlobalAdmin = ['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(currentUser?.global_role || '');

  const eligibleClubs = isGlobalAdmin
    ? (clubsData?.data?.map(c => ({ id: c.id, name: c.name })) || [])
    : (currentUser?.club_memberships?.filter(m => m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER').map(m => ({ id: m.club_id, name: m.club_name })) || []);

  const isAuthorizedToCreate = isGlobalAdmin || eligibleClubs.length > 0;

  interface CreateEventFormValues {
    title: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dateRange: [any, any];
    location_name?: string;
    event_type: string;
    visibility: string;
    registration_type: string;
    attendance_type: string;
    minimum_team_size?: number;
    maximum_team_size?: number;
    max_capacity?: number;
    club_id: string;
    collaborating_club_ids?: string[];
    audience: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';
    audience_batch_ids?: string[];
  }

  const handleFinish = async (values: CreateEventFormValues, action: 'DRAFT' | 'SUBMIT') => {
    setErrorMessage(null);
    setSubmitApprovalError(null);

    let eventId = createdEventId;

    try {
      if (!eventId) {
        const [start, end] = values.dateRange;
        const payload: CreateEventPayload = {
          title: values.title,
          description: values.description,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          location_name: values.location_name,
          event_type: values.event_type,
          visibility: values.visibility,
          registration_type: values.registration_type,
          attendance_type: values.attendance_type,
          audience: values.audience,
          audience_batch_ids: values.audience === 'SPECIFIC_BATCHES' ? values.audience_batch_ids : undefined,
          max_capacity: values.max_capacity ?? undefined,
          club_ids: [
            { club_id: values.club_id, is_primary: true },
            ...(values.collaborating_club_ids ?? [])
              .filter((id) => id !== values.club_id)
              .map((id) => ({
                club_id: id,
                is_primary: false,
              })),
          ],
          metadata: values.registration_type === 'TEAM' ? {
            minimum_team_size: values.minimum_team_size ?? undefined,
            maximum_team_size: values.maximum_team_size ?? undefined,
          } : undefined,
        };

        const event = await createEvent(payload);
        eventId = event.id;
        setCreatedEventId(event.id);
      }

      if (action === 'SUBMIT') {
        try {
          await submitApproval(eventId!);
          router.push(`/events/${eventId}`);
        } catch (err: unknown) {
          const error = err as Error;
          setSubmitApprovalError(error.message || 'Failed to submit event for approval.');
        }
      } else {
        router.push(`/events/${eventId}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Failed to create event. Please check your inputs.');
    }
  };

  if (isLoadingUser || isLoadingClubs || isLoadingBatches) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!isAuthorizedToCreate) {
    return (
      <Result
        status="403"
        title="Unauthorized"
        subTitle="You do not have permission to create events. You must be a Club Admin or Platform/Faculty Admin."
        extra={<Link href="/events"><Button type="primary">Back to Events</Button></Link>}
      />
    );
  }

  const isPending = isCreating || isSubmitting;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link href="/events">Events</Link> },
            { title: 'Create Event' },
          ]}
        />
        <Title level={2} style={{ margin: 0 }}>Create Event</Title>
        <Text type="secondary">Create and submit a new campus event.</Text>
      </div>

      {errorMessage && (
        <Alert type="error" title="Creation Failed" description={errorMessage} showIcon />
      )}

      {submitApprovalError && createdEventId && (
        <Alert
          type="warning"
          title="Event draft created, but submission for approval failed."
          description={submitApprovalError}
          showIcon
          action={
            <Space>
              <Link href={`/events/${createdEventId}`}>
                <Button size="small">View Draft</Button>
              </Link>
              <Button size="small" type="primary" loading={isSubmitting} onClick={() => handleFinish(form.getFieldsValue(), 'SUBMIT')}>
                Retry Submission
              </Button>
            </Space>
          }
        />
      )}

      <Form
        form={form}
        layout="vertical"
        disabled={isPending}
        initialValues={{
          visibility: 'PUBLIC',
          registration_type: 'INDIVIDUAL',
          attendance_type: 'SINGLE',
          audience: 'ALL_STUDENTS',
        }}
        onValuesChange={(changedValues) => {
          if (changedValues.registration_type === 'INDIVIDUAL') {
            form.setFieldsValue({ minimum_team_size: undefined, maximum_team_size: undefined });
          }
          if (changedValues.audience === 'ALL_STUDENTS') {
            form.setFieldsValue({ audience_batch_ids: undefined });
          }
          if (changedValues.club_id) {
            const currentCollaborators = form.getFieldValue('collaborating_club_ids') || [];
            if (currentCollaborators.includes(changedValues.club_id)) {
              form.setFieldsValue({
                collaborating_club_ids: currentCollaborators.filter((id: string) => id !== changedValues.club_id),
              });
            }
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
                          <div style={{ padding: 16, backgroundColor: 'var(--ant-color-fill-alter)', borderRadius: 8, border: '1px solid var(--ant-color-border-secondary)' }}>
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
                  noStyle
                  shouldUpdate={(prev, curr) => prev.registration_type !== curr.registration_type}
                >
                  {({ getFieldValue }) => {
                    const isTeam = getFieldValue('registration_type') === 'TEAM';
                    return (
                      <Form.Item
                        name="max_capacity"
                        label={isTeam ? "Maximum Teams" : "Maximum Participants"}
                        extra={
                          isTeam
                            ? "Maximum number of registered teams allowed. Leave empty for unlimited."
                            : "Maximum number of individual students allowed. Leave empty for unlimited."
                        }
                        rules={[{ type: 'number', min: 1 }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder={isTeam ? "e.g. 10" : "e.g. 100"} />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>

            </Row>
          </Card>

          {/* AUDIENCE & ACCESS */}
          <Card title="Audience & Access" size="small">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="club_id"
                  label="Primary Club"
                  extra="Main organizing club for this event. Events may involve multiple clubs, but one club is designated as primary."
                  rules={[{ required: true, message: 'Please select a club' }]}
                >
                  <Select
                    placeholder="Select a club"
                    options={eligibleClubs.map(c => ({ label: c.name, value: c.id }))}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) => prev.club_id !== curr.club_id}
                >
                  {({ getFieldValue }) => {
                    const primaryClubId = getFieldValue('club_id');
                    const collabs = eligibleClubs.filter(c => c.id !== primaryClubId);

                    return (
                      <Form.Item
                        name="collaborating_club_ids"
                        label="Collaborating Clubs"
                        extra={
                          collabs.length > 0
                            ? "Select other Clubs collaborating on this event."
                            : "No other eligible Clubs available."
                        }
                      >
                        <Select
                          mode="multiple"
                          placeholder="Select collaborating clubs"
                          options={collabs.map(c => ({ label: c.name, value: c.id }))}
                          disabled={collabs.length === 0}
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                          }
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
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
              </Col>
            </Row>

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
              <Link href="/events">
                <Button disabled={isPending}>Cancel</Button>
              </Link>
              <Button
                onClick={() => {
                  form.validateFields().then(values => handleFinish(values, 'DRAFT'));
                }}
                loading={isCreating && !isSubmitting}
                disabled={isSubmitting || !!submitApprovalError}
              >
                Save Draft
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  form.validateFields().then(values => handleFinish(values, 'SUBMIT'));
                }}
                loading={isSubmitting || (isCreating && !submitApprovalError)}
              >
                Submit for Approval
              </Button>
            </Space>
          </Row>
        </Space>
      </Form>
    </div>
  );
}
