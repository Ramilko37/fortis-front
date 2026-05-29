"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  type LucideIcon,
  ArrowLeft, ScanLine, RefreshCw, Wifi, WifiOff,
  Radio, Video, Shield, Monitor, Minus, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockSites, mockConfigurations, mockDeviceStatuses, mockThreatEvents } from "@/shared/lib/mock-data";
import { kindLabel, kindColor } from "@/shared/config/defense-visuals";
import type { ObjectKind, SiteStatus } from "@/shared/types/defense";

type Tab = "overview" | "config" | "incidents" | "devices";

const statusLabel: Record<SiteStatus, string> = {
  active:      "Активен",
  configuring: "Настройка",
  offline:     "Отключён",
};
const statusVariant: Record<SiteStatus, "default" | "secondary" | "outline"> = {
  active: "default", configuring: "secondary", offline: "outline",
};

const kindIcon: Record<ObjectKind, LucideIcon> = {
  operator_substation: Monitor,
  scaffolding: Shield,
  fbs_enclosure: Minus,
  perimeter_barrier: Minus,
  cable_mesh: Video,
  sensor:  Radio,
  camera:  Video,
  shield:  Shield,
  post:    Monitor,
  barrier: Minus,
};

const tabs: { id: Tab; label: string }[] = [
  { id: "overview",   label: "Обзор" },
  { id: "config",     label: "Конфигурация" },
  { id: "incidents",  label: "Инциденты" },
  { id: "devices",    label: "Устройства" },
];

export function SiteDetailPage({ siteId }: { siteId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [syncing, setSyncing] = useState(false);

  const site = mockSites.find((s) => s.id === siteId);
  const config = mockConfigurations.find((c) => c.siteId === siteId);
  const siteEvents = mockThreatEvents.filter((e) => e.siteId === siteId);

  if (!site) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/dashboard/sites" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> Назад к объектам
        </Link>
        <p className="text-muted-foreground">Объект не найден</p>
      </div>
    );
  }

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">

      {/* Навигация назад */}
      <Link href="/dashboard/sites" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Назад к объектам
      </Link>

      {/* Шапка объекта */}
      <div className="rounded-2xl glass-md border-(--glass-border) p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-accent/15 grid place-items-center shrink-0">
          <Shield className="h-6 w-6 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-foreground">{site.name}</h2>
            <Badge variant={statusVariant[site.status]}>{statusLabel[site.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {site.address}
          </p>
        </div>
        <Link href="/prototype">
          <Button className="cursor-pointer shrink-0" size="sm">
            <ScanLine className="h-4 w-4 mr-1.5" />
            Конфигуратор
          </Button>
        </Link>
      </div>

      {/* Вкладки */}
      <div className="flex gap-0.5 glass rounded-xl border-(--glass-border) p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 h-8 rounded-lg text-[13px] font-medium transition-colors cursor-pointer",
              activeTab === id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Обзор ───────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Покрытие", value: `${site.coveragePercent}%` },
            { label: "Устройств", value: site.devicesCount },
            { label: "Инцидентов", value: siteEvents.length },
            { label: "Версия конфига", value: config ? `v${config.version}` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl glass-md border-(--glass-border) p-4 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
              <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Конфигурация ────────────────────────────────────────── */}
      {activeTab === "config" && (
        <div className="flex flex-col gap-4">
          {config ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Сценарий: <span className="text-accent">{config.scenarioId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Синхронизировано: {config.lastSyncedAt.toLocaleString("ru-RU")} · v{config.version}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncing && "animate-spin")} />
                  {syncing ? "Синхронизация..." : "Синхронизировать"}
                </Button>
              </div>

              <div className="rounded-xl glass-md border-(--glass-border) overflow-hidden">
                <div className="px-4 py-3 border-b border-(--glass-border)">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Устройства в конфигурации ({config.objects.length})
                  </p>
                </div>
                <div className="divide-y divide-(--glass-border)">
                  {config.objects.map((obj) => {
                    const Icon = kindIcon[obj.kind];
                    const color = kindColor[obj.kind];
                    return (
                      <div key={obj.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="h-7 w-7 rounded-lg grid place-items-center shrink-0"
                          style={{ background: `${color}18` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{obj.label}</p>
                          <p className="text-[11px] text-muted-foreground">{kindLabel[obj.kind]} · {obj.assignment}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground tabular-nums">R: {obj.radius}м</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">H: {obj.elevation}м</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl glass border-(--glass-border) p-8 text-center">
              <p className="text-muted-foreground text-sm">Конфигурация не синхронизирована</p>
              <Link href="/prototype">
                <Button size="sm" className="cursor-pointer mt-3">
                  <ScanLine className="h-4 w-4 mr-1.5" />
                  Открыть конфигуратор
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Инциденты ───────────────────────────────────────────── */}
      {activeTab === "incidents" && (
        <div className="rounded-xl glass-md border-(--glass-border) overflow-hidden">
          {siteEvents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Инцидентов не зафиксировано</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--glass-border)">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Дата</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Источник</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Уровень</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Статус</th>
                </tr>
              </thead>
              <tbody>
                {siteEvents.map((e) => (
                  <tr key={e.id} className="border-b border-(--glass-border) last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {e.detectedAt.toLocaleDateString("ru-RU")} {e.detectedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{e.sourceLabel}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border
                        text-amber-500 bg-amber-500/10 border-amber-500/30">
                        {e.threatLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={e.status === "alarm_raised" ? "destructive" : "outline"}>
                        {e.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Устройства ──────────────────────────────────────────── */}
      {activeTab === "devices" && (
        <div className="rounded-xl glass-md border-(--glass-border) overflow-hidden">
          {!config ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Конфигурация не загружена</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--glass-border)">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Устройство</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Статус</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Сигнал</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Последний пинг</th>
                </tr>
              </thead>
              <tbody>
                {config.objects.map((obj) => {
                  const ds = mockDeviceStatuses.find((d) => d.objectId === obj.id);
                  const online = ds?.online ?? false;
                  return (
                    <tr key={obj.id} className="border-b border-(--glass-border) last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground text-xs">{obj.label}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                        )}>
                          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                        {ds?.signalStrength ? `${ds.signalStrength}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                        {ds ? ds.lastPing.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
