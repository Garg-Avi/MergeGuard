import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FolderGit2, Star, CheckCircle2, AlertTriangle } from 'lucide-react';

export default memo(function ProjectNode({ data, selected }) {
  return (
    <div
      className={`min-w-[210px] rounded-xl p-3.5 transition-all shadow-xs bg-white ${
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
        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
          <FolderGit2 className="w-4 h-4" />
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-bold text-slate-900 truncate">
            {data.name}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {data.slug}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E8E6DF] text-slate-500">
        <div className="flex items-center gap-1 text-amber-600 font-mono text-[10px] font-semibold">
          <Star className="w-3 h-3 fill-amber-500 stroke-none" />
          <span>{data.stars ? data.stars.toLocaleString() : '0'}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-0.5 text-emerald-700 font-medium" title="Vouches Given">
            <CheckCircle2 className="w-3 h-3" />
            {data.vouches_given || 0}
          </span>
          <span className="flex items-center gap-0.5 text-rose-600 font-medium" title="Reports Made">
            <AlertTriangle className="w-3 h-3" />
            {data.reports_made || 0}
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
