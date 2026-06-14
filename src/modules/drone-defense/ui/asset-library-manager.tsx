"use client";

import { useMemo, useState } from "react";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  createDefenseAsset,
  deleteDefenseAsset,
  updateDefenseAsset,
  type DefenseAssetMutationInput,
} from "@/modules/drone-defense/infra/asset-library-api";
import type {
  DefenseAsset,
  DefenseAssetCategory,
  DefenseAssetCoverageType,
  PlacedDefenseObject,
} from "@/shared/types/defense-project";

type AssetLibraryManagerProps = {
  assets: DefenseAsset[];
  placedObjects: PlacedDefenseObject[];
  selectedAssetId?: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSelectAsset: (assetId: string) => void;
  onAssetSaved: (asset: DefenseAsset) => void;
  onAssetDeleted: (assetId: string) => { ok: true } | { ok: false; message: string };
  onMessage: (message: string) => void;
};

type AssetFormState = {
  id?: string;
  name: string;
  category: DefenseAssetCategory;
  protectionType: string;
  recommendedLayerCodes: string;
  pricePerUnitMln: string;
  maxEffectiveDistanceKm: string;
  coverageRadiusKm: string;
  coverageType: DefenseAssetCoverageType;
  coverageAngle: string;
  description: string;
  isPublic: boolean;
  enterpriseId: string;
};

const categoryOptions: Array<{ value: DefenseAssetCategory; label: string }> = [
  { value: "detection", label: "Обнаружение" },
  { value: "classification", label: "Классификация" },
  { value: "jamming", label: "РЭБ" },
  { value: "spoofing", label: "Спуфинг" },
  { value: "kinetic", label: "Поражение" },
  { value: "interceptor", label: "Перехват" },
  { value: "passive-protection", label: "Пассивная защита" },
  { value: "engineering-protection", label: "Инженерная защита" },
  { value: "infrastructure", label: "Инфраструктура" },
  { value: "command-center", label: "Командный центр" },
  { value: "early-warning", label: "Раннее предупреждение" },
  { value: "software", label: "ПО" },
  { value: "external-service", label: "Внешний сервис" },
];

const coverageTypeOptions: Array<{ value: DefenseAssetCoverageType; label: string }> = [
  { value: "circle", label: "Круг" },
  { value: "sector", label: "Сектор" },
  { value: "line", label: "Линия" },
  { value: "polygon", label: "Полигон" },
  { value: "none", label: "Нет" },
];

function emptyForm(): AssetFormState {
  return {
    name: "",
    category: "detection",
    protectionType: "",
    recommendedLayerCodes: "L2",
    pricePerUnitMln: "",
    maxEffectiveDistanceKm: "",
    coverageRadiusKm: "",
    coverageType: "circle",
    coverageAngle: "",
    description: "",
    isPublic: true,
    enterpriseId: "",
  };
}

function kmToMeters(value: string) {
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 1000) : undefined;
}

function optionalNumber(value: string) {
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function formFromAsset(asset: DefenseAsset): AssetFormState {
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    protectionType: asset.protectionType ?? "",
    recommendedLayerCodes: asset.recommendedLayerCodes?.join(", ") ?? "",
    pricePerUnitMln: asset.pricePerUnitMln === null ? "" : String(asset.pricePerUnitMln),
    maxEffectiveDistanceKm: asset.maxEffectiveDistance ? String(asset.maxEffectiveDistance / 1000) : "",
    coverageRadiusKm: asset.coverageRadius ? String(asset.coverageRadius / 1000) : "",
    coverageType: asset.coverageType,
    coverageAngle: asset.coverageAngle ? String(asset.coverageAngle) : "",
    description: asset.description ?? "",
    isPublic: asset.isPublic ?? true,
    enterpriseId: asset.enterpriseId ?? "",
  };
}

function rolesForCategory(category: DefenseAssetCategory): DefenseAsset["roles"] {
  switch (category) {
    case "detection":
      return ["detect", "track"];
    case "classification":
      return ["classify"];
    case "jamming":
    case "spoofing":
      return ["suppress"];
    case "kinetic":
    case "interceptor":
      return ["destroy"];
    case "passive-protection":
    case "engineering-protection":
      return ["protect"];
    case "command-center":
      return ["coordinate"];
    case "early-warning":
      return ["alert", "monitor"];
    default:
      return ["monitor"];
  }
}

function placementTypeForCoverage(coverageType: DefenseAssetCoverageType): DefenseAsset["placementType"] {
  if (coverageType === "polygon" || coverageType === "line") return "zone-object";
  if (coverageType === "none") return "non-physical";
  return "map-object";
}

function formToAssetInput(form: AssetFormState): DefenseAssetMutationInput {
  const price = optionalNumber(form.pricePerUnitMln);
  const coverageRadius = kmToMeters(form.coverageRadiusKm);
  const maxEffectiveDistance = kmToMeters(form.maxEffectiveDistanceKm) ?? coverageRadius;
  const recommendedLayerCodes = form.recommendedLayerCodes
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return {
    id: form.id,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    category: form.category,
    roles: rolesForCategory(form.category),
    protectionType: form.protectionType.trim() || undefined,
    pricePerUnitMln: price ?? null,
    currency: "RUB",
    unitLabel: "шт",
    recommendedLayerCodes,
    compatibleLayerCodes: recommendedLayerCodes,
    maxEffectiveDistance,
    coverageType: form.coverageType,
    coverageRadius,
    coverageAngle: optionalNumber(form.coverageAngle),
    deploymentType: form.coverageType === "none" ? "external" : "static",
    placementType: placementTypeForCoverage(form.coverageType),
    tags: recommendedLayerCodes,
    mapCatalogGroupIds: [],
    isPublic: form.isPublic,
    enterpriseId: form.isPublic ? null : form.enterpriseId.trim() || null,
  };
}

export function AssetLibraryManager({
  assets,
  placedObjects,
  selectedAssetId,
  loading,
  error,
  onRefresh,
  onSelectAsset,
  onAssetSaved,
  onAssetDeleted,
  onMessage,
}: AssetLibraryManagerProps) {
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null,
    [assets, selectedAssetId],
  );
  const [form, setForm] = useState<AssetFormState>(() => (selectedAsset ? formFromAsset(selectedAsset) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const usedAssetIds = useMemo(() => new Set(placedObjects.map((object) => object.assetId)), [placedObjects]);
  const selectedAssetUsed = Boolean(selectedAsset && usedAssetIds.has(selectedAsset.id));

  const startCreate = () => {
    setMode("create");
    setForm(emptyForm());
    setLocalError(null);
  };

  const startEdit = () => {
    if (!selectedAsset) return;
    setMode("edit");
    setForm(formFromAsset(selectedAsset));
    onSelectAsset(selectedAsset.id);
    setLocalError(null);
  };

  const saveAsset = async () => {
    if (!form.name.trim()) {
      setLocalError("Укажите название средства защиты.");
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const payload = formToAssetInput(form);
      const asset = mode === "edit" && form.id
        ? await updateDefenseAsset(form.id, payload)
        : await createDefenseAsset(payload);
      onAssetSaved(asset);
      onSelectAsset(asset.id);
      setMode("edit");
      setForm(formFromAsset(asset));
      onMessage(`${asset.name} сохранено в библиотеке`);
    } catch {
      setLocalError("Не удалось сохранить карточку на сервере.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedAsset = async () => {
    if (!selectedAsset) return;
    if (selectedAssetUsed) {
      setLocalError("Средство уже размещено на карте. Удаление заблокировано.");
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await deleteDefenseAsset(selectedAsset.id);
      const result = onAssetDeleted(selectedAsset.id);
      if (!result.ok) {
        setLocalError(result.message);
        return;
      }
      setMode("closed");
      setForm(emptyForm());
      onMessage(`${selectedAsset.name} удалено из библиотеки`);
    } catch {
      setLocalError("Не удалось удалить карточку на сервере.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-slate-100 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Управление карточками</p>
          <p className="truncate text-xs text-slate-600">{assets.length} средств в текущей библиотеке</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"
            onClick={() => void onRefresh()}
            disabled={loading}
            title="Обновить каталог с сервера"
            aria-label="Обновить каталог с сервера"
          >
            <ReloadOutlined />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700"
            onClick={startCreate}
            title="Создать средство защиты"
            aria-label="Создать средство защиты"
          >
            <PlusOutlined />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={startEdit}
            disabled={!selectedAsset}
            title="Редактировать выбранное средство"
            aria-label="Редактировать выбранное средство"
          >
            <EditOutlined />
          </button>
        </div>
      </div>

      {loading ? <p className="mt-2 text-xs text-blue-600">Загрузка библиотеки…</p> : null}
      {error ? <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">{error}</p> : null}
      {localError ? <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{localError}</p> : null}

      {mode !== "closed" ? (
        <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900">
              {mode === "create" ? "Новая карточка" : "Редактирование"}
            </p>
            <button
              type="button"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900"
              onClick={() => setMode("closed")}
              title="Закрыть форму"
              aria-label="Закрыть форму"
            >
              <CloseOutlined />
            </button>
          </div>

          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Название"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-400"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value as DefenseAssetCategory }))
              }
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-400"
              value={form.coverageType}
              onChange={(event) =>
                setForm((current) => ({ ...current, coverageType: event.target.value as DefenseAssetCoverageType }))
              }
            >
              {coverageTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
              value={form.protectionType}
              onChange={(event) => setForm((current) => ({ ...current, protectionType: event.target.value }))}
              placeholder="Тип защиты"
            />
            <input
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
              value={form.recommendedLayerCodes}
              onChange={(event) => setForm((current) => ({ ...current, recommendedLayerCodes: event.target.value }))}
              placeholder="Эшелоны: L2, L3"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
              value={form.pricePerUnitMln}
              onChange={(event) => setForm((current) => ({ ...current, pricePerUnitMln: event.target.value }))}
              placeholder="млн ₽"
              inputMode="decimal"
            />
            <input
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
              value={form.coverageRadiusKm}
              onChange={(event) => setForm((current) => ({ ...current, coverageRadiusKm: event.target.value }))}
              placeholder="радиус, км"
              inputMode="decimal"
            />
            <input
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
              value={form.coverageAngle}
              onChange={(event) => setForm((current) => ({ ...current, coverageAngle: event.target.value }))}
              placeholder="угол"
              inputMode="decimal"
            />
          </div>

          <input
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
            value={form.maxEffectiveDistanceKm}
            onChange={(event) => setForm((current) => ({ ...current, maxEffectiveDistanceKm: event.target.value }))}
            placeholder="максимальная дальность, км"
            inputMode="decimal"
          />

          <textarea
            className="min-h-16 resize-y rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Описание"
          />

          <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
            <span>Общий каталог</span>
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))}
            />
          </label>

          {!form.isPublic ? (
            <input
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400"
              value={form.enterpriseId}
              onChange={(event) => setForm((current) => ({ ...current, enterpriseId: event.target.value }))}
              placeholder="enterpriseId"
            />
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-300"
              onClick={() => void saveAsset()}
              disabled={saving}
            >
              <SaveOutlined />
              Сохранить
            </button>
            {mode === "edit" ? (
              <button
                type="button"
                className="grid h-9 w-10 cursor-pointer place-items-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void deleteSelectedAsset()}
                disabled={saving || selectedAssetUsed}
                title={selectedAssetUsed ? "Средство размещено на карте" : "Удалить средство защиты"}
                aria-label="Удалить средство защиты"
              >
                <DeleteOutlined />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
