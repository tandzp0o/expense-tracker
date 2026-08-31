import React from "react";
import { Goal as GoalIcon } from "lucide-react";
import { MoneyField } from "components/app/money-field";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogSection,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";

export interface GoalFormData {
  title: string;
  targetAmount: number;
  deadline: string;
  description: string;
  category: string;
}

export interface GoalFormModalCopy {
  formDescription: string;
  editGoal: string;
  createGoalTitle: string;
  title: string;
  category: string;
  targetAmount: string;
  deadlineLabel: string;
  coverImage: string;
  goalPreview: string;
  description: string;
  cancel: string;
  saving: string;
  updateGoal: string;
  createGoal: string;
}

export interface GoalFormModalProps {
  open: boolean;
  editing: { title: string } | null;
  isVietnamese: boolean;
  copy: GoalFormModalCopy;
  form: GoalFormData;
  targetAmountInput: string;
  imagePreview: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<GoalFormData>>;
  onTargetAmountChange: (value: string, numericValue: number) => void;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  open,
  editing,
  isVietnamese,
  copy,
  form,
  targetAmountInput,
  imagePreview,
  saving,
  onClose,
  onSubmit,
  onFormChange,
  onTargetAmountChange,
  onImageChange,
}) => (
  <Dialog
    className="max-w-3xl"
    description={copy.formDescription}
    eyebrow={
      editing
        ? isVietnamese
          ? "Chỉnh mục tiêu"
          : "Edit goal"
        : isVietnamese
          ? "Kế hoạch mới"
          : "New plan"
    }
    icon={GoalIcon}
    onClose={onClose}
    open={open}
    title={editing ? copy.editGoal : copy.createGoalTitle}
    tone="goal"
  >
    <div className="space-y-3">
      <DialogSection
        description={
          isVietnamese
            ? "Mặt định đặt mục tiêu theo tên và nhóm để dễ phân biệt."
            : "Start with the goal name and grouping so it stays easy to spot later."
        }
        title={isVietnamese ? "Nhận diện mục tiêu" : "Goal identity"}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.title}</label>
            <Input
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              value={form.title}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.category}</label>
            <Input
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              value={form.category}
            />
          </div>
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Đặt số tiền cần đạt và mốc thời gian. Số đã tiết kiệm được cộng lên qua từng lần nạp tiền từ ví."
            : "Set the target amount and deadline. Saved progress builds up through deposits from a wallet."
        }
        title={isVietnamese ? "Tiến độ" : "Progress setup"}
      >
        <div className="space-y-3">
          <MoneyField
            label={copy.targetAmount}
            onChange={onTargetAmountChange}
            placeholder={copy.targetAmount}
            value={targetAmountInput}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.deadlineLabel}</label>
          <Input
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                deadline: event.target.value,
              }))
            }
            type="date"
            value={form.deadline}
          />
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Thêm ảnh bìa và mô tả để mục tiêu dễ gợi nhớ hơn."
            : "Add a cover image and note for better context."
        }
        title={isVietnamese ? "Ngữ cảnh" : "Context"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.coverImage}</label>
          <Input accept="image/*" onChange={onImageChange} type="file" />
          {imagePreview ? (
            <img
              alt={copy.goalPreview}
              className="mt-3 h-28 w-full rounded-[var(--app-radius-lg)] object-cover sm:h-36"
              src={imagePreview}
            />
          ) : null}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.description}</label>
          <Textarea
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            value={form.description}
          />
        </div>
      </DialogSection>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onClose} variant="outline">
          {copy.cancel}
        </Button>
        <Button className="w-full sm:w-auto" disabled={saving} onClick={onSubmit}>
          {saving ? copy.saving : editing ? copy.updateGoal : copy.createGoal}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
);
