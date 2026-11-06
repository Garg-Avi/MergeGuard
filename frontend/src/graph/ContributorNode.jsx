import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { getTrustStatusInfo } from '../utils/statusHelpers';

export default memo(function ContributorNode({ data, selected }) {
  const statusInfo = getTrustStatusInfo(data.reputation_state);

  return (
    <div
      className={`min-w-[190px] rounded-xl p-3.5 transition-all shadow-xs bg-white ${
        selected
          ? 'border-2 border-indigo-600 shadow-md ring-2 ring-indigo-500/10'
          : 'border border-[#E8E6DF] hover:border-indigo-300 hover:shadow-sm'
      } font-sans`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-indigo-500 !border-white"
      />

      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-full overflow-hidden border border-[#E8E6DF] bg-[#FAF9F5] shrink-0">
          {data.avatar_url ? (
            <img
              src={data.avatar_url}
              alt={data.username}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-bold">
              {data.username ? data.username.slice(0, 2).toUpperCase() : 'CO'}
            </div>
          )}
        </div>

        <div className="overflow-hidden">
          <div className="text-xs font-bold text-slate-900 truncate">
            {data.display_name || data.username}
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate">
            @{data.username}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E8E6DF]">
        <span
          title={statusInfo.description}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusInfo.badgeClass}`}
        >
          {statusInfo.label}
        </span>

        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
          <span className="flex items-center gap-0.5 text-emerald-700 font-medium" title="Recommendations">
            <CheckCircle2 className="w-3 h-3" />
            {data.vouches_count || 0}
          </span>
          <span className="flex items-center gap-0.5 text-amber-600 font-medium" title="Reports">
            <AlertTriangle className="w-3 h-3" />
            {data.allegations_count || 0}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-indigo-500 !border-white"
      />
    </div>
  );
});
