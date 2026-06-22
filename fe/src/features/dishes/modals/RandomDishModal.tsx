import React from "react";
import { Dices } from "lucide-react";
import { Badge } from "components/ui/badge";
import { Dialog } from "components/ui/dialog";

export interface RandomDishItem {
  name: string;
  description?: string;
  address?: string;
  imageUrls: string[];
  preferences: string[];
}

export interface RandomDishModalCopy {
  randomDishTitle: string;
  randomDishDesc: string;
  noDescription: string;
  noAddress: string;
}

export interface RandomDishModalProps {
  dish: RandomDishItem | null;
  isVietnamese: boolean;
  copy: RandomDishModalCopy;
  getPreferenceLabel: (preference: string) => string;
  onClose: () => void;
}

export const RandomDishModal: React.FC<RandomDishModalProps> = ({
  dish,
  isVietnamese,
  copy,
  getPreferenceLabel,
  onClose,
}) => (
  <Dialog
    description={copy.randomDishDesc}
    eyebrow={isVietnamese ? "Gợi ý nhanh" : "Quick pick"}
    icon={Dices}
    onClose={onClose}
    open={!!dish}
    title={copy.randomDishTitle}
    tone="dish"
  >
    {dish ? (
      <div className="space-y-4">
        {dish.imageUrls[0] ? (
          <img
            alt={dish.name}
            className="h-56 w-full rounded-[var(--app-radius-xl)] object-cover"
            src={dish.imageUrls[0]}
          />
        ) : null}
        <div>
          <h3 className="text-xl font-semibold">{dish.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {dish.description || copy.noDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dish.preferences.map((preference) => (
            <Badge key={preference} variant="outline">
              {getPreferenceLabel(preference)}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {dish.address || copy.noAddress}
        </p>
      </div>
    ) : null}
  </Dialog>
);
