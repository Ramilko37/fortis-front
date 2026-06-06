# Feature: Drag‑to‑Map Icon Transformation

## Description
When a user drags a **DefenseToolIcon** card onto the map, the dragged preview should become a **32 × 32 px** square with a **4 px border‑radius**, displaying the asset image. After dropping, the card is placed as an object inside the selected echelon.

## Technical Solution
| File | Change |
|------|--------|
| `src/modules/drone-defense/ui/defense-tool-icon.tsx` | Add `handleDragStart` that creates a `Image` preview (32 × 32 px, border‑radius 4 px) and sets it via `event.dataTransfer.setDragImage`. Insert instrumentation log **F**. |
| `src/modules/drone-defense/ui/gis-board.tsx` | Implement `onDropAsset` that receives `assetId` and coordinates, then calls `placeObject` from the project store. |
| `src/modules/drone-defense/domain/project-map-adapter.ts` (or `echelon‑map‑model.ts`) | Extend `placeObject` / `validateObjectPlacement` to ensure placement lies within the bounds of the selected echelon. |
| `src/modules/drone-defense/ui/drone-defense-prototype.tsx` | Pass `onDropAsset` down to `GisBoard` and `DefenseToolsPanel`. |
| `src/modules/drone-defense/ui/defense-tools-panel.tsx` | Propagate `onDropAsset` to each `DefenseToolIcon`. |

### Code References
```tsx
// defense-tool-icon.tsx: handleDragStart
81|  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
82|    // #region agent log F
83|    fetch(
84|      "http://127.0.0.1:7846/ingest/2a02bcd4-67b8-44cb-ae7d-61415a62c8ca",
85|      {
86|        method: "POST",
87|        headers: {
88|          "Content-Type": "application/json",
89|          "X-Debug-Session-Id": "be2d71",
90|        },
91|        body: JSON.stringify({
92|          sessionId: "be2d71",
93|          runId: "pre",
94|          hypothesisId: "F",
95|          location: "defense-tool-icon.tsx:84",
96|          message: "handleDragStart invoked",
97|          data: { assetId, name },
98|          timestamp: Date.now(),
99|        }),
100|      },
101|    ).catch(() => {});
102|    // #endregion
103|    const previewImg = new Image();
104|    previewImg.src = imageUrl;
105|    previewImg.width = 32; // width in px
106|    previewImg.height = 32; // height in px
107|    previewImg.style.borderRadius = "4px"; // rounded corners
108|    setTimeout(() => event.dataTransfer.setDragImage(previewImg, 16, 16), 0);
109|    onDragAsset(event); // keep original drag handling
110|  };
```

```tsx
// gis-board.tsx: onDropAsset signature and usage
57|  onDropAsset?: (assetId: string, coordinate: { lng: number; lat: number }) => void;
...
573|        if (!assetId || !onDropAsset) return;
582|        onDropAsset(assetId, { lng, lat });
```

## Flow Diagram
```mermaid
flowchart TD
  UI[DefenseToolsPanel] -->|drag start| Icon[DefenseToolIcon]
  Icon -->|handleDragStart| DragPreview[Image 32×32, border‑radius 4px]
  DragPreview -->|browser drag| Map[GisBoard]
  Map -->|drop| PlaceObject[placeObject(assetId, layerId, coords)]
  PlaceObject -->|update| ProjectStore[useDefenseProjectStore]
```

## Parameters
- **Icon size:** `32 × 32 px`
- **Border radius:** `4 px`

## Implementation Steps
1. Add `handleDragStart` (see code reference) to `defense-tool-icon.tsx`.
2. Apply inline style `borderRadius: '4px'` to the preview image.
3. Propagate `onDropAsset` from `GisBoard` up to `DefenseToolsPanel` and finally to each `DefenseToolIcon`.
4. In `project-map-adapter.ts` (or equivalent) ensure `placeObject` validates that the drop coordinates are inside the selected echelon.
5. Write a unit test `defense-tool-icon.test.ts` that mounts the component, triggers `dragstart`, and asserts that `event.dataTransfer.setDragImage` was called with an image of width 32, height 32 and border‑radius 4 px.
6. Update documentation (`docs/feature-drag-icon.md`) with the new behavior and the mermaid diagram.

## Logging
Instrumentation log **F** is already inserted in `handleDragStart`. Example payload:
```json
{
  "sessionId":"be2d71",
  "runId":"pre",
  "hypothesisId":"F",
  "location":"defense-tool-icon.tsx:84",
  "message":"handleDragStart invoked",
  "data":{"assetId":"...","name":"..."},
  "timestamp":<timestamp>
}
```

---

*This markdown file documents the complete plan for the drag‑to‑map icon transformation feature.*