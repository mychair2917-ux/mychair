import React from 'react';
import { Building, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useGetAdminSalonWhatsAppStatusesQuery } from '../../redux/slices/whatsapp/whatsappApi';

export const AdminWhatsAppOverview: React.FC = () => {
  const { data, isLoading, refetch } = useGetAdminSalonWhatsAppStatusesQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-500" />
        Loading Admin WhatsApp overview...
      </div>
    );
  }

  const items = data?.data || [];
  const connectedCount = items.filter((i) => i.status === 'CONNECTED').length;
  const totalCount = items.length;

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 font-semibold uppercase">Total Salons</div>
          <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-emerald-400 font-semibold uppercase">WhatsApp Active</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{connectedCount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-500 font-semibold uppercase">Pending Setup</div>
          <div className="text-2xl font-bold text-slate-300 mt-1">{totalCount - connectedCount}</div>
        </div>
      </div>

      {/* Salons Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-400" /> Multi-Salon WhatsApp Status Overview
          </h3>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Salon Name</th>
                  <th className="py-3 px-4">WhatsApp Status</th>
                  <th className="py-3 px-4">Business Phone Number</th>
                  <th className="py-3 px-4">Display Name</th>
                  <th className="py-3 px-4">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => {
                  const isConn = item.status === 'CONNECTED';

                  return (
                    <tr key={item.salon_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">{item.salon_name}</td>
                      <td className="py-3.5 px-4">
                        {isConn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <XCircle className="w-3.5 h-3.5" /> Disconnected
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {item.phone_number || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {item.display_name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {item.last_message_at ? new Date(item.last_message_at).toLocaleString() : 'No recent activity'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            No salons registered in MYCHAIR.
          </div>
        )}
      </div>
    </div>
  );
};
