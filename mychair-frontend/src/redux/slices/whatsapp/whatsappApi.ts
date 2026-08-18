import { baseApi } from '../api/baseApi';
import { API_PATHS } from '../api/apiPaths';

export interface WhatsAppAccount {
  id?: string;
  salon_id: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';
  connection_status: 'ACTIVE' | 'MIGRATION_REQUIRED' | 'COEXISTENCE_REQUIRED' | 'VERIFICATION_REQUIRED';
  waba_id?: string;
  phone_number_id?: string;
  business_phone_number?: string;
  display_name?: string;
  connected_at?: string;
  disconnected_at?: string;
  features: {
    billing_enabled: boolean;
    appointment_confirmations_enabled: boolean;
    appointment_reminders_enabled: boolean;
    birthday_messages_enabled: boolean;
    marketing_enabled: boolean;
  };
  templates: Record<string, string>;
}

export interface WhatsAppConnectPayload {
  salon_id: string;
  waba_id: string;
  phone_number_id: string;
  business_phone_number: string;
  display_name?: string;
  access_token: string;
  connection_status?: string;
}

export interface WhatsAppSettingsUpdatePayload {
  salon_id: string;
  features?: Partial<WhatsAppAccount['features']>;
  templates?: Record<string, string>;
}

export interface WhatsAppTestMessagePayload {
  salon_id: string;
  recipient_phone: string;
}

export interface WhatsAppMessageLogItem {
  id: string;
  salon_id: string;
  customer_id?: string;
  phone_number: string;
  message_type: string;
  status: string;
  delivery_status?: string;
  template_name?: string;
  wamid?: string;
  reference_type?: string;
  reference_id?: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at?: string;
}

export interface WhatsAppMessageLogsResponse {
  items: WhatsAppMessageLogItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminSalonWhatsAppItem {
  salon_id: string;
  salon_name: string;
  status: string;
  connection_status: string;
  phone_number?: string;
  display_name?: string;
  last_message_at?: string;
  connected_at?: string;
}

export const whatsappApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWhatsAppStatus: builder.query<{ success: boolean; data: WhatsAppAccount }, { salonId: string }>({
      query: ({ salonId }) => ({
        url: `${API_PATHS.WHATSAPP.STATUS}?salon_id=${salonId}`,
        method: 'GET',
      }),
      providesTags: ['WhatsAppStatus'],
    }),

    connectWhatsApp: builder.mutation<{ success: boolean; data: WhatsAppAccount }, WhatsAppConnectPayload>({
      query: (body) => ({
        url: API_PATHS.WHATSAPP.CONNECT,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WhatsAppStatus', 'WhatsAppAdmin'],
    }),

    disconnectWhatsApp: builder.mutation<{ success: boolean; data: WhatsAppAccount }, { salonId: string }>({
      query: ({ salonId }) => ({
        url: `${API_PATHS.WHATSAPP.DISCONNECT}?salon_id=${salonId}`,
        method: 'POST',
      }),
      invalidatesTags: ['WhatsAppStatus', 'WhatsAppAdmin'],
    }),

    updateWhatsAppSettings: builder.mutation<{ success: boolean; data: WhatsAppAccount }, WhatsAppSettingsUpdatePayload>({
      query: (body) => ({
        url: API_PATHS.WHATSAPP.SETTINGS,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['WhatsAppStatus'],
    }),

    sendTestWhatsAppMessage: builder.mutation<{ success: boolean; data: any }, WhatsAppTestMessagePayload>({
      query: (body) => ({
        url: API_PATHS.WHATSAPP.TEST,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WhatsAppLogs'],
    }),

    getWhatsAppMessageLogs: builder.query<{ success: boolean; data: WhatsAppMessageLogsResponse }, { salonId: string; page?: number; limit?: number; status?: string; message_type?: string }>({
      query: ({ salonId, page = 1, limit = 20, status, message_type }) => {
        const params = new URLSearchParams({ salon_id: salonId, page: String(page), limit: String(limit) });
        if (status) params.append('status', status);
        if (message_type) params.append('message_type', message_type);
        return {
          url: `${API_PATHS.WHATSAPP.MESSAGES}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['WhatsAppLogs'],
    }),

    getAdminSalonWhatsAppStatuses: builder.query<{ success: boolean; data: AdminSalonWhatsAppItem[] }, void>({
      query: () => ({
        url: API_PATHS.WHATSAPP.ADMIN_SALONS,
        method: 'GET',
      }),
      providesTags: ['WhatsAppAdmin'],
    }),
  }),
});

export const {
  useGetWhatsAppStatusQuery,
  useConnectWhatsAppMutation,
  useDisconnectWhatsAppMutation,
  useUpdateWhatsAppSettingsMutation,
  useSendTestWhatsAppMessageMutation,
  useGetWhatsAppMessageLogsQuery,
  useGetAdminSalonWhatsAppStatusesQuery,
} = whatsappApi;
