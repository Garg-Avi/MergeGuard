import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FolderGit2, Star, CheckCircle2, AlertTriangle } from 'lucide-react';

export default memo(function ProjectNode({ data, selected }) {
  return (
    <div
      className={`min-w-[210px] rounded-xl p-3.5 transition-all shadow-xs bg-[#17191F] text-[#B0B3BA] ${
        selected
          ? 'border-2 border-[#D69B45] shadow-md ring-2 ring-[#D69B45]/20'
          : 'border border-[#2B2E35] hover:border-[#383C45] hover:shadow-sm'
      } font-sans`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[#D69B45] !border-[#17191F]"
      />

      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#B0B3BA] shrink-0">
          <FolderGit2 className="w-4 h-4" />
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-bold text-[#F5F5F5] truncate">
            {data.name}
          </div>
          <div className="text-[10px] text-[#777D87] font-mono truncate">
            {data.slug}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#2B2E35] text-[#B0B3BA]">
        <div className="flex items-center gap-1 text-[#D69B45] font-mono text-[10px] font-semibold">
          <Star className="w-3 h-3 fill-[#D69B45] stroke-none" />
          <span>{data.stars ? data.stars.toLocaleString() : '0'}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-0.5 text-emerald-400 font-medium" title="Vouches Given">
            <CheckCircle2 className="w-3 h-3" />
            {data.vouches_given || 0}
          </span>
          <span className="flex items-center gap-0.5 text-rose-400 font-medium" title="Reports Made">
            <AlertTriangle className="w-3 h-3" />
            {data.reports_made || 0}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[#D69B45] !border-[#17191F]"
      />
    </div>
  );
});
