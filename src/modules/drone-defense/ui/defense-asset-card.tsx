"use client";

import { DragOutlined } from "@ant-design/icons";
import styles from "./drone-defense-prototype.module.css";

export type PlacementMode = "point" | "line" | "polygon" | "none";

export interface DefenseAssetCardProps {
  /** Уникальный идентификатор средства */
  id: string;
  /** Визуальная метка из каталога */
  label: string;
  /** Цветовой тон (cyan, green, amber, orange, steel) */
  tone: string;
  /** Иконка компонента */
  icon: React.ReactNode;
  /** Категория / роль средства */
  category: string;
  /** Тип покрытия (круг, сектор, линия…) */
  coverageType: string;
  /** Радиус покрытия в метрах (опционально) */
  coverageRadiusM?: number;
  /** Цена в млн ₽ (опционально) */
  costMln?: number;
  /** Режим размещения */
  placementMode: PlacementMode;
  /** Текущее количество размещённых объектов */
  placedCount: number;
  /** Максимально допустимое количество (0 = без лимита) */
  maxQuantity: number;
  /** Флаг: можно ли разместить в текущем эшелоне */
  compatibleWithEchelon: boolean;
  /** Вызывается при клике — открыть детальную панель */
  onOpenDetails: () => void;
  /** Вызывается при начале drag-and-drop для point/polygon/line режимов */
  onDragStart?: () => void;
  /** Вызывается при клике на кнопку «Добавить» для none-режима */
  onAddClick?: () => void;
}

/** Конвертируем радиус в отображение */
function formatCoverage(coverageType: string, radiusM?: number): string {
  if (!radiusM || coverageType === "none") return "Без покрытия";
  const km = Math.round(radiusM / 100);
  return `круг ${km} км`;
}

/** Счётчик размещения зависит от типа актива */
function formatCounter(
  mode: PlacementMode,
  placed: number,
  max: number,
): string {
  if (mode === "none") return `${placed} ед.`;
  if (max > 0) return `${placed}/${max}`;
  return `${placed}`;
}

function formatHint(mode: PlacementMode): string {
  switch (mode) {
    case "point":
      return "Перетащите на карту";
    case "line":
    case "polygon":
      return "Нарисовать";
    default:
      return "Добавить";
  }
}

/** Компактная карточка защитного средства */
export function DefenseAssetCard({
  id,
  label,
  tone,
  icon,
  category,
  coverageType,
  coverageRadiusM,
  costMln,
  placementMode,
  placedCount,
  maxQuantity,
  compatibleWithEchelon,
  onOpenDetails,
  onDragStart,
  onAddClick,
}: DefenseAssetCardProps) {
  const isDraggable = placementMode !== "none";
  const isLimited = maxQuantity > 0 && placedCount >= maxQuantity;
  const isIncompatible = !compatibleWithEchelon;
  const isDisabled = isLimited || isIncompatible;

  // Классы состояния
  const statusClasses = [
    styles.assetCard,
    styles[tone],
    isDisabled ? styles.disabled : "",
    isIncompatible ? styles.incompatible : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Показываем drag handle только если средство можно перетащить и не достигнут лимит
  const showDragHandle = isDraggable && !isDisabled;

  // Текст-подсказка внизу карточки
  const hint = isIncompatible
    ? `Не подходит`
    : isLimited
    ? "Лимит"
    : isDraggable
    ? "Перетащите"
    : "Добавить";

  // Строка покрытия
  const coverageText = formatCoverage(coverageType, coverageRadiusM);

  // Счётчик
  const counterText = formatCounter(placementMode, placedCount, maxQuantity);

  // Цена (если указана)
  const priceText = costMln ? `${costMln} млн ₽` : null;

  return (
    <div
      className={statusClasses}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${counterText}`}
      onClick={!isDraggable ? onOpenDetails : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!isDraggable) onOpenDetails();
        }
      }}
      data-testid={`defense-asset-card-${id}`}
    >
      {/* Drag handle (только для draggable-карточек) */}
      {showDragHandle && (
        <span className={styles.dragHandle}>
          <DragOutlined />
        </span>
      )}

      {/* Иконка */}
      <span className={styles.assetGlyph}>{icon}</span>

      {/* Информация */}
      <div className={styles.assetInfo}>
        {/* Название + счётчик по строкам */}
        <div className={styles.assetTitleRow}>
          <span className={styles.assetName}>{label}</span>
          <span className={styles.assetCounter}>{counterText}</span>
        </div>

        {/* Категория + покрытие */}
        <div className={styles.assetMetaRow}>
          <span>{category}</span>
          <span className={styles.divider}>·</span>
          <span className={styles.coverageText}>{coverageText}</span>
        </div>

        {/* Цена + подсказка */}
        <div className={styles.assetBottomRow}>
          {priceText && <span className={styles.priceText}>{priceText}</span>}
          <span className={styles.hintText}>{hint}</span>
        </div>
      </div>

      {/* Кнопка «Добавить» для non-draggable активов */}
      {!isDraggable && (
        <button
          className={styles.addButton}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddClick?.();
          }}
          disabled={isDisabled}
          aria-label="Добавить актив"
        >
          + Добавить
        </button>
      )}
    </div>
  );
}
