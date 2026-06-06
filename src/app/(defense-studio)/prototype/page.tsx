import { DroneDefensePrototype } from "@/modules/drone-defense/ui/drone-defense-prototype";

export default function Page() {
  // #region agent log C2
  fetch('http://127.0.0.1:7846/ingest/2a02bcd4-67b8-44cb-ae7d-61415a62c8ca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be2d71'},body:JSON.stringify({sessionId:'be2d71',runId:'pre',hypothesisId:'C2',location:'prototype-page.tsx:7',message:'Page component mounted',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return <DroneDefensePrototype />;
}
