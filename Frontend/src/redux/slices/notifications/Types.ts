export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  category: string;
  priority: string;
  source_event?: string | null;
  salon_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  unread_count: number;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  notification_type?: string;
  category?: string;
  unread_only?: boolean;
  date_from?: string;
  date_to?: string;
  salon_id?: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  sound_enabled: boolean;
  browser_notification_enabled: boolean;
  popup_toast_enabled: boolean;
  categories: Record<string, { in_app: boolean; sound: boolean; email: boolean; whatsapp: boolean }>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  template_type: string;
  channel: string;
  subject?: string | null;
  body: string;
  variables: string[];
  status: string;
  is_system?: boolean;
  created_at?: string;
}

export interface CommunicationCampaign {
  id: string;
  name: string;
  communication_type: string;
  audience: string;
  subject?: string | null;
  body: string;
  status: string;
  scheduled_for?: string | null;
  sent_at?: string | null;
  totals: { total_recipients?: number; total_jobs?: number; pending?: number; sent: number; delivered: number; failed: number };
  created_at?: string;
}

export interface CommunicationLog {
  id: string;
  campaign_id?: string | null;
  channel: string;
  recipient_address: string;
  status: string;
  provider: string;
  error_message?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  created_at?: string;
}

export interface BusinessAlert {
  id: string;
  alert_type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  status: string;
  created_at?: string;
}

export interface PaginatedCollection<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CampaignCreateRequest {
  name: string;
  communication_type: 'EMAIL' | 'WHATSAPP' | 'BOTH';
  audience: string;
  selected_customer_ids?: string[];
  subject?: string;
  body: string;
  send_now: boolean;
  scheduled_for?: string;
  salon_id?: string;
}

export interface TemplateCreateRequest {
  name: string;
  template_type: string;
  channel: string;
  subject?: string;
  body: string;
  variables: string[];
  salon_id?: string;
}
