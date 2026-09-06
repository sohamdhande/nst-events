import React from 'react';
import { StatusBadge } from './core/StatusBadge';
import { DisputeStatus } from '../hooks/use-disputes';

interface DisputeStatusBadgeProps {
  status: DisputeStatus;
}

export const DisputeStatusBadge: React.FC<DisputeStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'APPROVED':
      return <StatusBadge status="[APPROVED]" type="success" />;
    case 'REJECTED':
      return <StatusBadge status="[REJECTED]" type="error" />;
    case 'PENDING':
    default:
      return <StatusBadge status="[PENDING REVIEW]" type="warning" />;
  }
};
