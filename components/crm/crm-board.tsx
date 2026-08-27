'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CRM_STAGE_META } from '@/lib/crm/stages';
import type { CrmStage } from '@/lib/crm/stages';
import type { CrmBoardCase, CrmBoardColumn } from '@/lib/types';
import { CrmColumn } from './crm-column';
import { CrmCaseCardContent } from './crm-case-card';

export interface CrmMoveRequest {
  caseId: string;
  caseNumber: string;
  fromStage: CrmStage;
  toStage: CrmStage;
}

export interface CrmBoardProps {
  columns: CrmBoardColumn[];
  onMoveCase: (move: CrmMoveRequest) => void;
  onLoadMore: (stage: CrmStage) => void;
  onOpenDetails: (caseData: CrmBoardCase) => void;
  onTransfer: (caseData: CrmBoardCase) => void;
  tenantPath?: string;
}

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

const POINTER_ACTIVATION_DISTANCE = 5;

interface ActiveDrag {
  caseData: CrmBoardCase;
  stage: CrmStage;
}

export function CrmBoard({
  columns,
  onMoveCase,
  onLoadMore,
  onOpenDetails,
  onTransfer,
  tenantPath,
}: CrmBoardProps) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnsByStage = useMemo(() => {
    const map = new Map<CrmStage, CrmBoardColumn>();
    for (const column of columns) map.set(column.stage, column);
    return map;
  }, [columns]);

  const stageIds = useMemo(() => new Set<string>(CRM_STAGE_META.map((meta) => meta.id)), []);

  const caseStageByCaseId = useMemo(() => {
    const map = new Map<string, CrmStage>();
    for (const column of columns) {
      for (const item of column.cases) map.set(item.id, column.stage);
    }
    return map;
  }, [columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const caseId = String(event.active.id);
    const stage = caseStageByCaseId.get(caseId);
    if (!stage) return;
    const caseData = columnsByStage.get(stage)?.cases.find((item) => item.id === caseId);
    if (caseData) setActiveDrag({ caseData, stage });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    const drag = activeDrag;
    setActiveDrag(null);
    if (!over || !drag) return;
    const overId = String(over.id);
    const toStage = stageIds.has(overId) ? (overId as CrmStage) : caseStageByCaseId.get(overId);
    if (!toStage || toStage === drag.stage) return;
    onMoveCase({
      caseId: drag.caseData.id,
      caseNumber: drag.caseData.caseNumber,
      fromStage: drag.stage,
      toStage,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div data-testid="crm-board" className="flex h-full items-stretch gap-3 overflow-x-auto pb-2">
        {CRM_STAGE_META.map((meta) => (
          <CrmColumn
            key={meta.id}
            meta={meta}
            column={
              columnsByStage.get(meta.id) ?? {
                stage: meta.id,
                total: 0,
                page: 1,
                totalPages: 1,
                cases: [],
              }
            }
            tenantPath={tenantPath}
            onMoveCase={onMoveCase}
            onLoadMore={onLoadMore}
            onOpenDetails={onOpenDetails}
            onTransfer={onTransfer}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="w-[260px] rotate-2 rounded-xl border border-emerald-300 bg-white p-3 shadow-xl sm:w-[280px]">
            <CrmCaseCardContent caseData={activeDrag.caseData} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
