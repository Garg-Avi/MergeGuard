import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import ProjectNode from './ProjectNode';
import ContributorNode from './ContributorNode';
import { api } from '../services/api';
import { getTrustStatusInfo } from '../utils/statusHelpers';
import {
  Search,
  X,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

const nodeTypes = {
  projectNode: ProjectNode,
  contributorNode: ContributorNode,
};

export default function TrustNetworkGraph({ onSelectContributor, onSelectProject }) {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, VOUCH, DENOUNCEMENT, HIGH_CONFIDENCE
  const [viewFilter, setViewFilter] = useState('ALL'); // ALL, PROJECTS, CONTRIBUTORS
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [, setEvalLoading] = useState(false);

  // Fetch graph data
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNetworkGraph();

      // Style edges for the dark charcoal & amber/semantic theme
      const styledEdges = (data.edges || []).map((e) => {
        const edgeType = e.data?.edge_type;
        if (edgeType === 'VOUCH') {
          return {
            ...e,
            style: { stroke: '#10B981', strokeWidth: 2, opacity: 0.85 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#10B981' },
          };
        } else if (edgeType === 'DENOUNCEMENT') {
          return {
            ...e,
            style: { stroke: '#F43F5E', strokeWidth: 2, strokeDasharray: '4 4', opacity: 0.85 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#F43F5E' },
          };
        } else {
          // Cross-repository links / Federation
          return {
            ...e,
            style: { stroke: '#777D87', strokeWidth: 1.5, strokeDasharray: '3 3', opacity: 0.7 },
          };
        }
      });

      setRawNodes(data.nodes || []);
      setRawEdges(styledEdges);
    } catch (err) {
      console.error('Failed to load network graph:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Apply filters
  useEffect(() => {
    let filteredNodes = [...rawNodes];
    let filteredEdges = [...rawEdges];

    // Filter by view toggle (All, Repositories, People)
    if (viewFilter === 'PROJECTS') {
      filteredNodes = filteredNodes.filter((n) => n.type === 'projectNode');
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type === 'FEDERATION');
    } else if (viewFilter === 'CONTRIBUTORS') {
      filteredNodes = filteredNodes.filter((n) => n.type === 'contributorNode');
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type !== 'FEDERATION');
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filteredNodes = filteredNodes.filter(
        (n) =>
          n.data?.name?.toLowerCase().includes(term) ||
          n.data?.username?.toLowerCase().includes(term) ||
          n.data?.slug?.toLowerCase().includes(term)
      );
    }

    // Filter by relationship type
    if (filterType === 'VOUCH') {
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type === 'VOUCH');
    } else if (filterType === 'DENOUNCEMENT') {
      filteredEdges = filteredEdges.filter((e) => e.data?.edge_type === 'DENOUNCEMENT');
    } else if (filterType === 'HIGH_CONFIDENCE') {
      filteredEdges = filteredEdges.filter((e) => (e.data?.confidence || 0) >= 0.9);
    }

    // Highlight selected node connections
    if (selectedNode) {
      filteredEdges = filteredEdges.map((e) => {
        const isConnected = e.source === selectedNode.id || e.target === selectedNode.id;
        return {
          ...e,
          animated: isConnected,
          style: {
            ...e.style,
            opacity: isConnected ? 1 : 0.12,
            strokeWidth: isConnected ? 2.75 : 1,
          },
        };
      });
    }

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [rawNodes, rawEdges, searchTerm, filterType, viewFilter, selectedNode, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback(async (_, node) => {
    setSelectedNode(node);
    setSelectedDetails(node.data);
    setEvaluationData(null);

    if (node.type === 'contributorNode') {
      try {
        setEvalLoading(true);
        const evalResult = await api.evaluateTrust(node.data.id || node.data.username);
        setEvaluationData(evalResult);
      } catch (e) {
        console.error('Failed to evaluate selected node trust:', e);
      } finally {
        setEvalLoading(false);
      }
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedDetails(null);
    setEvaluationData(null);
  }, []);

  const contributorStatus = selectedDetails ? getTrustStatusInfo(selectedDetails.reputation_state) : null;

  return (
    <div className="relative w-full h-[680px] rounded-2xl overflow-hidden border border-[#2B2E35] bg-[#090A0C] shadow-xs font-sans">
      {/* Top Filter & Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search & View Toggles */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
            <input
              type="text"
              placeholder="Search people or repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mg-input pl-9 pr-8 w-60 text-xs bg-[#17191F]/95 text-[#F5F5F5] border-[#2B2E35] backdrop-blur-xs shadow-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777D87] hover:text-[#F5F5F5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Filter Pill */}
          <div className="flex bg-[#17191F]/95 backdrop-blur-xs border border-[#2B2E35] rounded-xl p-1 text-xs shadow-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PROJECTS', label: 'Repositories' },
              { id: 'CONTRIBUTORS', label: 'People' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setViewFilter(v.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  viewFilter === v.id
                    ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50 shadow-xs'
                    : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Relationship Filters */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="flex bg-[#17191F]/95 backdrop-blur-xs border border-[#2B2E35] rounded-xl p-1 text-xs shadow-xs">
            {[
              { id: 'ALL', label: 'All Signals' },
              { id: 'VOUCH', label: 'Recommendations (+)' },
              { id: 'DENOUNCEMENT', label: 'Reports (!)' },
              { id: 'HIGH_CONFIDENCE', label: 'High Confidence' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  filterType === f.id
                    ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50 shadow-xs'
                    : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadGraph}
            title="Reload Trust Network"
            className="p-2 bg-[#17191F]/95 backdrop-blur-xs border border-[#2B2E35] hover:border-[#383C45] rounded-xl text-[#777D87] hover:text-[#F5F5F5] transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D69B45]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main React Flow Graph Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
        onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.2}
        maxZoom={2.0}
      >
        <Background color="#242730" gap={24} size={1} />
        <Controls className="!bottom-4 !left-4" showInteractive={false} />
      </ReactFlow>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-18 z-10 hidden sm:flex items-center gap-4 px-3.5 py-2 rounded-xl bg-[#17191F]/95 backdrop-blur-xs border border-[#2B2E35] text-[11px] text-[#B0B3BA] shadow-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-1 bg-emerald-500 rounded-full" /> Recommendation (Verified work)
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-1 bg-rose-500 border-b border-dashed border-rose-500" /> Report (Concern raised)
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-1 bg-[#777D87]" /> Cross-Repository Link
        </span>
      </div>

      {/* Detail Inspector Side Drawer */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bottom-4 w-84 z-30 mg-card p-5 flex flex-col overflow-y-auto animate-fade-in-up shadow-xl bg-[#17191F] border-[#2B2E35]">
          <div className="flex items-start justify-between pb-3.5 border-b border-[#242730]">
            <div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#202329] text-[#B0B3BA] font-semibold border border-[#2B2E35]">
                {selectedNode.type === 'projectNode' ? 'Repository' : 'Contributor'}
              </span>
              <h3 className="text-base font-bold text-[#F5F5F5] mt-2 truncate">
                {selectedDetails?.name || `@${selectedDetails?.username}`}
              </h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* PROJECT NODE DETAILS */}
          {selectedNode.type === 'projectNode' && (
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-[#777D87] text-[11px] block font-medium">Repository Identifier</span>
                <span className="font-mono text-[#F5F5F5] font-semibold text-xs">{selectedDetails?.slug}</span>
              </div>

              <div>
                <span className="text-[#777D87] text-[11px] block font-medium">Category</span>
                <span className="text-[#F5F5F5] font-medium">{selectedDetails?.category || 'General'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-2">
                <span className="font-bold text-[#F5F5F5] block text-[11px]">Repository Policy</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#777D87] block text-[10px]">Strictness</span>
                    <span className="text-[#F5F5F5] font-semibold capitalize">{selectedDetails?.trust_policy?.strictness || 'balanced'}</span>
                  </div>
                  <div>
                    <span className="text-[#777D87] block text-[10px]">Min Confidence</span>
                    <span className="text-[#F5F5F5] font-semibold">
                      {((selectedDetails?.trust_policy?.min_confidence ?? 0.6) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectProject?.(selectedDetails)}
                className="mg-btn-primary w-full text-xs mt-2"
              >
                <span>Manage Repository</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* CONTRIBUTOR NODE DETAILS */}
          {selectedNode.type === 'contributorNode' && (
            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-[#2B2E35] bg-[#202329] shrink-0">
                  <img
                    src={selectedDetails?.avatar_url || `https://github.com/${selectedDetails?.username}.png`}
                    alt={selectedDetails?.username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[#F5F5F5] truncate">
                    {selectedDetails?.display_name || selectedDetails?.username}
                  </div>
                  <div className="text-[11px] text-[#777D87] font-mono">
                    @{selectedDetails?.username}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#B0B3BA] font-medium">Status</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${contributorStatus?.badgeClass}`}>
                    {contributorStatus?.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#B0B3BA] leading-relaxed">
                  {contributorStatus?.description}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#242730] text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{selectedDetails?.vouches_count || 0} recommendations</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#D69B45]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{selectedDetails?.allegations_count || 0} reports</span>
                  </div>
                </div>

                {evaluationData && (
                  <div className="pt-2 border-t border-[#242730] flex justify-between text-[11px]">
                    <span className="text-[#B0B3BA] font-medium">Trust Score</span>
                    <span className="font-bold text-[#F5F5F5]">
                      {(evaluationData.trust_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => onSelectContributor?.(selectedDetails)}
                className="mg-btn-primary w-full text-xs mt-2"
              >
                <span>View Full Contributor Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
