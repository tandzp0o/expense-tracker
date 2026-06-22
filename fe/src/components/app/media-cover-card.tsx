import React from "react";
import { PencilLine, Trash2 } from "lucide-react";
import { cn } from "lib/utils";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Card } from "components/ui/card";

const oneLineClampStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 1,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export interface MediaCoverCardTag {
  key: string;
  label: string;
}

export interface MediaCoverCardProps {
  media: React.ReactNode;
  topBadges?: React.ReactNode;
  title: string;
  subtitle?: string;
  tags?: MediaCoverCardTag[];
  maxTags?: number;
  footerLeading?: React.ReactNode;
  extraContent?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  className?: string;
  coverClassName?: string;
}

export const MediaCoverCard: React.FC<MediaCoverCardProps> = ({
  media,
  topBadges,
  title,
  subtitle,
  tags = [],
  maxTags = 2,
  footerLeading,
  extraContent,
  onEdit,
  onDelete,
  editLabel,
  className,
  coverClassName = "aspect-[4/4.35]",
}) => {
  const visibleTags = tags.slice(0, maxTags);
  const hiddenTagCount = tags.length - visibleTags.length;

  return (
    <Card
      className={cn("overflow-hidden border-border/80 bg-card/95", className)}
    >
      <div className={cn("relative overflow-hidden", coverClassName)}>
        <div className="absolute inset-0">{media}</div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.28)_32%,rgba(2,6,23,0.78)_62%,rgba(2,6,23,0.96)_100%)]" />

        {topBadges ? (
          <div className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3">
            <div className="flex flex-wrap gap-2">{topBadges}</div>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold text-white sm:text-base">
                {title}
              </h3>
              {subtitle ? (
                <p
                  className="text-[12px] leading-4 text-white/90"
                  style={oneLineClampStyle}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>

            {extraContent}

            {visibleTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((tag) => (
                  <Badge
                    key={tag.key}
                    className="border-white/10 bg-white/10 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
                    variant="outline"
                  >
                    {tag.label}
                  </Badge>
                ))}
                {hiddenTagCount > 0 ? (
                  <Badge
                    className="border-white/10 bg-white/10 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
                    variant="outline"
                  >
                    +{hiddenTagCount}
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {footerLeading || onEdit || onDelete ? (
              <div className="flex md:flex-row items-center justify-between gap-3">
                {footerLeading ? (
                  <div className="min-w-0 flex-1 text-xs text-white">
                    {footerLeading}
                  </div>
                ) : (
                  <span className="flex-1" />
                )}
                {onEdit || onDelete ? (
                  <div className="flex shrink-0 justify-end gap-2 sm:items-center sm:justify-start">
                    {onEdit ? (
                      <Button
                        aria-label={editLabel}
                        className="h-7 w-7 shrink-0 rounded-full bg-slate-950/45 p-0 text-white backdrop-blur-sm hover:bg-slate-950/65 hover:text-white sm:h-7 sm:w-auto sm:px-2.5 sm:py-0 sm:text-[10px]"
                        onClick={onEdit}
                        size="icon"
                        variant="ghost"
                      >
                        <PencilLine className="h-3.5 w-3.5 shrink-0" />
                        {editLabel ? (
                          <span className="hidden sm:inline">{editLabel}</span>
                        ) : null}
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        className="h-7 w-7 shrink-0 rounded-full bg-slate-950/45 p-0 text-white backdrop-blur-sm hover:bg-slate-950/65 hover:text-white"
                        onClick={onDelete}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
};

export const overlayBadgeClassName =
  "border-white/15 bg-slate-950/35 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm";

export const mediaCoverCardAspectDefault = "aspect-[4/4.35]";

export const mediaCoverCardAspectTall =
  "aspect-[4/6.25] min-h-[240px] sm:aspect-[4/5.75] sm:min-h-[250px]";
