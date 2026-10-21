import type { ReactNode } from "react";
import { Button, Dialog } from "@/design-system";

export interface ConfirmDialogProps {
  open: boolean;
  /** The action, e.g. "Cancel lecture". The confirm button repeats it. */
  title: string;
  /** Name the thing and the consequence: "Cancel lecture 13 for Batch 07? 42 students will be notified." */
  description: ReactNode;
  confirmLabel?: string;
  /** Label for the button that backs out, e.g. "Keep lecture". */
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

/** Destructive actions always go through this confirmation. */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Go back", danger = true, onConfirm, onClose, children }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel || title}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
