"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Headphones, MapPin, PhoneCall, RefreshCw, Route, ShieldCheck, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./control-room.module.css";

export type Shipment = {
  id: string; trackingCode: string; customerName: string; carrierName: string; origin: string; destination: string;
  promisedEta: string; currentEta: string; status: "attention" | "in_transit" | "rescheduled" | "escalated" | "delivered";
  exceptionType: "weather_delay" | "damage_risk" | "missed_window" | "not_found"; scenarioBehavior: string; version: number;
};
type ShipmentEvent = { id: string; eventType: string; source: string; payload: Record<string, unknown>; createdAt: string };
type CallRecord = { callId: string; lifecycleStatus: string; disposition: string | null; analysis: Record<string, unknown> | null; updatedAt: string };
export type ShipmentDetail = Shipment & { events: ShipmentEvent[]; calls: CallRecord[]; allowedActions: string[] };

export const exceptionLabels: Record<Shipment["exceptionType"], string> = {
  weather_delay: "Weather delay", damage_risk: "Damage risk", missed_window: "Missed window", not_found: "Load not located",
};
const statusLabels: Record<Shipment["status"], string> = {
  attention: "Needs action", in_transit: "In transit", rescheduled: "Rescheduled", escalated: "Escalated", delivered: "Delivered",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function relativeHours(value: string) {
  const hours = Math.round((new Date(value).getTime() - Date.now()) / 3_600_000);
  if (hours === 0) return "due now";
  return hours > 0 ? `in ${hours}h` : `${Math.abs(hours)}h overdue`;
}

export function ControlRoom() {
  const [sessionId, setSessionId] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/shipments/${id}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load shipment details.");
    const payload = (await response.json()) as { shipment: ShipmentDetail };
    setDetail(payload.shipment);
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const response = await fetch("/api/demo/session", { method: "POST" });
        if (!response.ok) throw new Error("Could not initialize the demo database.");
        const payload = (await response.json()) as { sessionId: string; shipments: Shipment[] };
        setSessionId(payload.sessionId); setShipments(payload.shipments);
        const firstId = payload.shipments[0]?.id ?? ""; setSelectedId(firstId);
        if (firstId) await loadDetail(firstId);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not initialize FreightGuard."); }
      finally { setLoading(false); }
    }
    void initialize();
  }, [loadDetail]);

  const metrics = useMemo(() => ({
    open: shipments.filter((shipment) => shipment.status === "attention").length,
    escalated: shipments.filter((shipment) => shipment.status === "escalated").length,
    recovered: shipments.filter((shipment) => shipment.status === "rescheduled").length,
  }), [shipments]);

  async function resetDemo() {
    setResetting(true); setError("");
    try {
      const response = await fetch("/api/demo/session/reset", { method: "POST" });
      if (!response.ok) throw new Error("Could not reset the demo.");
      const payload = (await response.json()) as { shipments: Shipment[] };
      setShipments(payload.shipments); const firstId = payload.shipments[0]?.id ?? ""; setSelectedId(firstId);
      if (firstId) await loadDetail(firstId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reset the demo."); }
    finally { setResetting(false); }
  }

  async function selectShipment(id: string) {
    setSelectedId(id);
    setError("");
    try { await loadDetail(id); }
    catch { setError("Could not load shipment details."); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.brand}><span className={styles.brandMark}><Truck aria-hidden="true" size={20} /></span><div><strong>FreightGuard AI</strong><span>Exception control</span></div></div>
      <div className={styles.headerRight}><span className={styles.systemStatus}><span /> Systems nominal</span><button className={styles.resetButton} onClick={resetDemo} disabled={resetting || loading}><RefreshCw aria-hidden="true" size={15} className={resetting ? styles.spinning : ""} />Reset scenarios</button></div>
    </header>
    <section className={styles.intro}>
      <div><p className={styles.kicker}>Northeast network · Live operations</p><h1>Keep exceptions from becoming failures.</h1><p>Resolve delayed, damaged, and missing loads through a Retell-powered voice operator.</p></div>
      <dl className={styles.metrics}><div><dt>Open exceptions</dt><dd>{metrics.open}</dd></div><div><dt>Escalated</dt><dd>{metrics.escalated}</dd></div><div><dt>Recovered</dt><dd>{metrics.recovered}</dd></div></dl>
    </section>
    {error ? <div className={styles.error} role="alert"><AlertTriangle size={18} />{error}</div> : null}
    <section className={styles.workspace} aria-busy={loading}>
      <aside className={styles.queue}>
        <div className={styles.panelTitle}><div><span>Exception queue</span><strong>{shipments.length} active loads</strong></div><ShieldCheck size={19} aria-label="Session isolated" /></div>
        <div className={styles.queueList}>{loading ? <QueueSkeleton /> : shipments.map((shipment) => <button key={shipment.id} className={`${styles.queueItem} ${selectedId === shipment.id ? styles.queueItemActive : ""}`} onClick={() => void selectShipment(shipment.id)} aria-pressed={selectedId === shipment.id}>
          <span className={styles.queueTop}><strong>{shipment.trackingCode}</strong><span className={`${styles.status} ${styles[shipment.status]}`}>{statusLabels[shipment.status]}</span></span>
          <span className={styles.exception}>{exceptionLabels[shipment.exceptionType]}</span>
          <span className={styles.queueRoute}>{shipment.origin}<ArrowRight size={13} />{shipment.destination}</span>
          <span className={styles.queueMeta}>{shipment.carrierName}<b>{relativeHours(shipment.promisedEta)}</b></span>
        </button>)}</div>
      </aside>
      <section className={styles.loadPanel}>{detail ? <>
        <div className={styles.loadHeading}><div><span>{detail.customerName}</span><h2>{detail.trackingCode}</h2></div><span className={`${styles.statusLarge} ${styles[detail.status]}`}>{statusLabels[detail.status]}</span></div>
        <div className={styles.corridor} aria-label={`Route from ${detail.origin} to ${detail.destination}`}><span className={styles.routePoint}><MapPin size={16} /><b>{detail.origin}</b><small>Origin</small></span><span className={styles.routeLine}><i /><Truck size={22} /></span><span className={styles.routePoint}><MapPin size={16} /><b>{detail.destination}</b><small>Destination</small></span></div>
        <dl className={styles.loadFacts}><div><dt>Carrier</dt><dd>{detail.carrierName}</dd></div><div><dt>Promised</dt><dd>{formatTime(detail.promisedEta)}</dd></div><div><dt>Current ETA</dt><dd>{formatTime(detail.currentEta)}</dd></div><div><dt>Exception</dt><dd>{exceptionLabels[detail.exceptionType]}</dd></div></dl>
        <div className={styles.timeline}><div className={styles.panelTitle}><div><span>Resolution timeline</span><strong>Operational record</strong></div><Clock3 size={18} /></div><div className={styles.timelineBody}>{detail.events.length === 0 ? <div className={styles.emptyTimeline}><Route size={22} /><p>No resolution action yet.</p><span>Start a dispatch call to update this load.</span></div> : detail.events.map((event) => <div className={styles.event} key={event.id}><CheckCircle2 size={17} /><div><strong>{event.eventType.replaceAll("_", " ")}</strong><span>{formatTime(event.createdAt)} · {event.source.replaceAll("_", " ")}</span></div></div>)}</div></div>
      </> : <DetailSkeleton />}</section>
      <aside className={styles.callPanel}>
        <div className={styles.callTop}><div><span>Voice operator</span><strong>Maya · Retell AI</strong></div><span className={styles.readyDot}>Ready</span></div>
        <div className={styles.operator}><div className={styles.operatorOrb}><Headphones size={30} /></div><strong>Carrier dispatch call</strong><p>You play the carrier dispatcher. Maya will verify the exception and update the load.</p></div>
        <div className={styles.callBrief}><span>Call brief</span><dl><div><dt>Load</dt><dd>{detail?.trackingCode ?? "—"}</dd></div><div><dt>Carrier</dt><dd>{detail?.carrierName ?? "—"}</dd></div><div><dt>Objective</dt><dd>{detail ? exceptionLabels[detail.exceptionType] : "—"}</dd></div></dl></div>
        <button className={styles.callButton} disabled title="Retell connection is added in the next milestone"><PhoneCall size={19} />Start dispatch call</button>
        <p className={styles.callNote}>Browser audio · 3 minute limit · synthetic data</p><div className={styles.powered}>Powered by <strong>Retell AI</strong></div>
      </aside>
    </section>
    <footer className={styles.footer}>Session {sessionId ? sessionId.slice(0, 8) : "--------"} · Isolated demo workspace</footer>
  </main>;
}

function QueueSkeleton() { return <div className={styles.skeletonList}>{[0, 1, 2].map((item) => <span key={item} />)}</div>; }
function DetailSkeleton() { return <div className={styles.detailSkeleton}><span /><span /><span /></div>; }
