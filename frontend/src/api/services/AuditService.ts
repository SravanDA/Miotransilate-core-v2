import { apiClient } from '../client';
import type { AuditTrailResponse } from '../../types';

export class AuditService {
  static async getAuditTrail(params: {
    page?: number;
    size?: number;
    entityType?: string;
    entityId?: string;
    entityIdAux?: string;
    action?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AuditTrailResponse> {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.append('page', params.page.toString());
    if (params.size !== undefined) query.append('size', params.size.toString());
    if (params.entityType) query.append('entityType', params.entityType);
    if (params.entityId) query.append('entityId', params.entityId);
    if (params.entityIdAux) query.append('entityIdAux', params.entityIdAux);
    if (params.action) query.append('action', params.action);
    if (params.userId) query.append('userId', params.userId);
    if (params.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params.dateTo) query.append('dateTo', params.dateTo);

    const res = await apiClient.get(`/v1/audit?${query.toString()}`);
    return res.data;
  }
}
