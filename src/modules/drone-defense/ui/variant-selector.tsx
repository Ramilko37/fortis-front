"use client";

import { useState } from "react";
import { Button, theme } from "antd";
import { useDefenseVariantsStore } from "@/modules/drone-defense/domain/use-defense-variants-store";
import { VariantsModal } from "@/modules/drone-defense/ui/variants-modal";

export function VariantSelector() {
  const { token } = theme.useToken();
  const { activeVariantId, activeVariantName, saveStatus, overwriteActiveVariant } =
    useDefenseVariantsStore();
  const [open, setOpen] = useState(false);

  const isDraft = !activeVariantId;
  const saving = saveStatus === "saving";
  const label = isDraft ? "Черновик (не сохранён)" : activeVariantName;
  const dotColor = isDraft ? token.colorWarning : token.colorSuccess;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: token.marginXS,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Открыть варианты конфигурации"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: token.marginXS,
          minWidth: 0,
          maxWidth: 200,
          height: token.controlHeightSM,
          paddingInline: token.paddingSM,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          color: token.colorText,
          cursor: "pointer",
          font: "inherit",
          fontSize: token.fontSizeSM,
          lineHeight: 1,
          transition: `border-color ${token.motionDurationMid}, background ${token.motionDurationMid}`,
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = token.colorPrimaryBorderHover;
          event.currentTarget.style.background = token.colorFillTertiary;
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = token.colorBorderSecondary;
          event.currentTarget.style.background = token.colorFillQuaternary;
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 0 3px ${dotColor}1f`,
          }}
        />
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: token.fontWeightStrong,
            color: isDraft ? token.colorTextSecondary : token.colorText,
          }}
        >
          {label}
        </span>
        <span
          aria-hidden
          style={{ flexShrink: 0, color: token.colorTextTertiary, fontSize: token.fontSizeSM }}
        >
          ▾
        </span>
      </button>

      <Button
        size="small"
        type="primary"
        disabled={isDraft || saving}
        loading={saving}
        onClick={() => void overwriteActiveVariant()}
      >
        Сохранить
      </Button>
      <Button size="small" onClick={() => setOpen(true)}>
        Сохранить как…
      </Button>

      <VariantsModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
