"use client";

import { useEffect, useState } from "react";
import { CheckCircleFilled } from "@ant-design/icons";
import { Alert, Button, Input, List, Modal, Spin, Tag, Typography, theme } from "antd";
import { useDefenseVariantsStore } from "@/modules/drone-defense/domain/use-defense-variants-store";
import type { VariantSummary } from "@/shared/types/defense-project";

type Props = { open: boolean; onClose: () => void };

function formatUpdatedAt(updatedAt: string): string {
  return new Date(updatedAt).toLocaleDateString("ru-RU");
}

export function VariantsModal({ open, onClose }: Props) {
  const {
    variants,
    activeVariantId,
    listStatus,
    saveStatus,
    error,
    fetchVariants,
    saveAsNewVariant,
    loadVariant,
    deleteVariant,
  } = useDefenseVariantsStore();
  const { token } = theme.useToken();
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (open) fetchVariants();
  }, [open, fetchVariants]);

  const saving = saveStatus === "saving";
  const trimmedName = newName.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const handleSave = () => {
    if (!canSave) return;
    void saveAsNewVariant(trimmedName).then(() => setNewName(""));
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Варианты конфигурации"
      footer={null}
      width={520}
      destroyOnHidden
    >
      {error ? (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: token.marginMD }}
        />
      ) : null}

      <VariantsBody
        variants={variants}
        activeVariantId={activeVariantId}
        listStatus={listStatus}
        token={token}
        onLoad={(id) => void loadVariant(id).then(onClose)}
        onDelete={(id) => void deleteVariant(id)}
      />

      <div
        style={{
          marginTop: token.marginLG,
          paddingTop: token.marginMD,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text
          strong
          style={{ display: "block", marginBottom: token.marginXS }}
        >
          Сохранить текущую карту
        </Typography.Text>
        <div style={{ display: "flex", gap: token.marginXS }}>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onPressEnter={handleSave}
            placeholder="Имя нового варианта…"
            disabled={saving}
            maxLength={120}
          />
          <Button
            type="primary"
            onClick={handleSave}
            disabled={!canSave}
            loading={saving}
          >
            Сохранить как новый
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type VariantsBodyProps = {
  variants: VariantSummary[];
  activeVariantId: string | null;
  listStatus: "idle" | "loading" | "error";
  token: ReturnType<typeof theme.useToken>["token"];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
};

function VariantsBody({
  variants,
  activeVariantId,
  listStatus,
  token,
  onLoad,
  onDelete,
}: VariantsBodyProps) {
  if (listStatus === "loading") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: token.marginSM,
          padding: `${token.paddingXL}px 0`,
        }}
      >
        <Spin />
        <Typography.Text type="secondary">Загрузка списка…</Typography.Text>
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div
        style={{
          padding: `${token.paddingXL}px ${token.paddingLG}px`,
          textAlign: "center",
        }}
      >
        <Typography.Text type="secondary">
          Пока нет сохранённых вариантов. Сохраните текущую карту как первый
          вариант ниже.
        </Typography.Text>
      </div>
    );
  }

  return (
    <List
      dataSource={variants}
      style={{
        maxHeight: 360,
        overflowY: "auto",
        marginInline: -token.paddingContentHorizontalLG,
      }}
      renderItem={(variant) => {
        const isActive = variant.projectId === activeVariantId;
        return (
          <List.Item
            style={{
              paddingInline: token.paddingContentHorizontalLG,
              background: isActive ? token.colorPrimaryBg : undefined,
              transition: `background ${token.motionDurationMid}`,
            }}
            actions={[
              <Button
                key="load"
                type="link"
                size="small"
                onClick={() => onLoad(variant.projectId)}
              >
                Загрузить
              </Button>,
              <Button
                key="delete"
                type="link"
                size="small"
                danger
                onClick={() => onDelete(variant.projectId)}
              >
                Удалить
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={
                isActive ? (
                  <CheckCircleFilled
                    style={{ color: token.colorPrimary, fontSize: token.fontSizeLG }}
                  />
                ) : undefined
              }
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: token.marginXS }}>
                  {variant.name}
                  {isActive ? (
                    <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                      Текущий
                    </Tag>
                  ) : null}
                </span>
              }
              description={`v${variant.version} · ${formatUpdatedAt(variant.updatedAt)}`}
            />
          </List.Item>
        );
      }}
    />
  );
}
