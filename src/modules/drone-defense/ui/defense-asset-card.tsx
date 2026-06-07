"use client";

import { DragOutlined } from "@ant-design/icons";
import styles from "./drone-defense-prototype.module.css";

export type PlacementMode = "point" | "line" | "polygon";

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
  void mode;
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
}: DefenseAssetCardProps) {
  void compatibleWithEchelon;
  const isDraggable = true;

  // Классы состояния
  const statusClasses = [
    styles.assetCard,
    styles[tone],
  ]
    .filter(Boolean)
    .join(" ");

  // Показываем drag handle для всех размещаемых на карте средств
  const showDragHandle = isDraggable;

  // Текст-подсказка внизу карточки
  const hint = formatHint(placementMode);

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
      draggable
      onDragStart={() => onDragStart?.()}
      onClick={onOpenDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpenDetails();
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
    </div>
  );
}
