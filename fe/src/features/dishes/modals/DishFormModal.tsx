import React from "react";
import { UtensilsCrossed } from "lucide-react";
import { MoneyField } from "components/app/money-field";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogSection,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Textarea } from "components/ui/textarea";
import { preferenceOptions } from "../constants";

export interface DishFormValues {
  name: string;
  price: number;
  description: string;
  address: string;
  preferences: string[];
  existingImages: string[];
  newImages: File[];
}

export interface DishFormModalCopy {
  formDescription: string;
  editDish: string;
  createDish: string;
  dishName: string;
  price: string;
  description: string;
  address: string;
  tasteTags: string;
  images: string;
  remove: string;
  cancel: string;
  saving: string;
  updateDish: string;
}

export interface DishFormModalProps {
  open: boolean;
  editing: { name: string } | null;
  isVietnamese: boolean;
  language: "vi" | "en";
  copy: DishFormModalCopy;
  formValues: DishFormValues;
  priceInput: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormValuesChange: React.Dispatch<React.SetStateAction<DishFormValues>>;
  onPriceChange: (value: string, numericValue: number) => void;
  onTogglePreference: (preference: string) => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DishFormModal: React.FC<DishFormModalProps> = ({
  open,
  editing,
  isVietnamese,
  language,
  copy,
  formValues,
  priceInput,
  saving,
  onClose,
  onSubmit,
  onFormValuesChange,
  onPriceChange,
  onTogglePreference,
  onImageUpload,
}) => (
  <Dialog
    className="max-w-3xl"
    description={copy.formDescription}
    eyebrow={
      editing
        ? isVietnamese
          ? "Chỉnh món"
          : "Edit dish"
        : isVietnamese
          ? "Món mới"
          : "New dish"
    }
    icon={UtensilsCrossed}
    onClose={onClose}
    open={open}
    title={editing ? copy.editDish : copy.createDish}
    tone="dish"
  >
    <div className="space-y-3">
      <DialogSection
        description={
          isVietnamese
            ? "Lưu tên món, giá và mô tả ngắn để dễ quyết định."
            : "Capture the dish name, price, and a short description first."
        }
        title={isVietnamese ? "Thông tin món" : "Dish details"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.dishName}</label>
          <Input
            onChange={(event) =>
              onFormValuesChange((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            value={formValues.name}
          />
        </div>

        <MoneyField
          label={copy.price}
          onChange={onPriceChange}
          placeholder={copy.price}
          value={priceInput}
        />

        <div>
          <label className="mb-2 block text-sm font-medium">{copy.description}</label>
          <Textarea
            onChange={(event) =>
              onFormValuesChange((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            value={formValues.description}
          />
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Gắn địa điểm và thẻ hương vị để lọc nhanh khi cần."
            : "Add location and taste tags so filtering feels more useful."
        }
        title={isVietnamese ? "Phân biệt và gợi ý" : "Discovery details"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.address}</label>
          <Input
            onChange={(event) =>
              onFormValuesChange((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
            value={formValues.address}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{copy.tasteTags}</label>
          <div className="flex flex-wrap gap-2">
            {preferenceOptions.map((preference) => {
              const active = formValues.preferences.includes(preference.value);
              return (
                <button
                  key={preference.value}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/70"
                  }`}
                  onClick={() => onTogglePreference(preference.value)}
                  type="button"
                >
                  {language === "vi" ? preference.vi : preference.en}
                </button>
              );
            })}
          </div>
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Hình ảnh giúp modal random và card món dễ nhìn hơn."
            : "Images make both the cards and random dish modal much clearer."
        }
        title={isVietnamese ? "Bộ ảnh" : "Image set"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.images}</label>
          <Input accept="image/*" multiple onChange={onImageUpload} type="file" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {formValues.existingImages.map((image) => (
              <div key={image} className="relative">
                <img
                  alt="Existing dish"
                  className="h-24 w-full rounded-[var(--app-radius-lg)] object-cover"
                  src={image}
                />
                <button
                  className="absolute right-2 top-2 rounded-full bg-slate-950/70 px-2 py-1 text-xs text-white"
                  onClick={() =>
                    onFormValuesChange((current) => ({
                      ...current,
                      existingImages: current.existingImages.filter(
                        (item) => item !== image,
                      ),
                    }))
                  }
                  type="button"
                >
                  {copy.remove}
                </button>
              </div>
            ))}
            {formValues.newImages.map((image) => (
              <div
                key={`${image.name}-${image.lastModified}`}
                className="relative"
              >
                <img
                  alt={image.name}
                  className="h-24 w-full rounded-[var(--app-radius-lg)] object-cover"
                  src={URL.createObjectURL(image)}
                />
                <button
                  className="absolute right-2 top-2 rounded-full bg-slate-950/70 px-2 py-1 text-xs text-white"
                  onClick={() =>
                    onFormValuesChange((current) => ({
                      ...current,
                      newImages: current.newImages.filter(
                        (item) =>
                          item.name !== image.name ||
                          item.lastModified !== image.lastModified,
                      ),
                    }))
                  }
                  type="button"
                >
                  {copy.remove}
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogSection>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onClose} variant="outline">
          {copy.cancel}
        </Button>
        <Button className="w-full sm:w-auto" disabled={saving} onClick={onSubmit}>
          {saving
            ? copy.saving
            : editing
              ? copy.updateDish
              : copy.createDish}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
);
