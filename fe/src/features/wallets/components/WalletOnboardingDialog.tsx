import React, { useEffect, useState } from "react";
import {
  Building2,
  Check,
  LucideIcon,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  WalletCards,
} from "lucide-react";
import { Button } from "components/ui/button";
import { Dialog, DialogFooter } from "components/ui/dialog";
import { hexToRgba } from "lib/utils";

interface OnboardingSlide {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: { icon: LucideIcon; label: string }[];
}

interface WalletOnboardingDialogProps {
  open: boolean;
  isVietnamese: boolean;
  primaryColor: string;
  onSkip: () => void;
  onStart: () => void;
}

const getSlides = (isVietnamese: boolean): OnboardingSlide[] =>
  isVietnamese
    ? [
        {
          icon: Sparkles,
          title: "Chào mừng bạn đến với TonFin",
          description:
            "Chỉ mất khoảng một phút để bắt đầu. Trước tiên, hãy tạo một chiếc ví — nơi tiền của bạn thực sự đang nằm.",
          bullets: [
            { icon: Check, label: "Không bắt buộc, bạn có thể bỏ qua bất cứ lúc nào" },
            { icon: Check, label: "Có thể sửa hoặc xóa ví sau khi tạo" },
          ],
        },
        {
          icon: WalletCards,
          title: "Ví là gì?",
          description:
            "Ví đại diện cho một nguồn tiền có thật. Bạn có bao nhiêu nguồn tiền thì tạo bấy nhiêu ví.",
          bullets: [
            { icon: Wallet, label: "Tiền mặt trong người" },
            { icon: Building2, label: "Tài khoản ngân hàng (Techcombank, VCB...)" },
            { icon: Smartphone, label: "Ví điện tử (Momo, ZaloPay...)" },
          ],
        },
        {
          icon: Target,
          title: "Tạo ví đầu tiên cần gì?",
          description:
            "Chỉ cần tên ví và số dư hiện tại là đủ. Những mục còn lại đều không bắt buộc.",
          bullets: [
            { icon: Check, label: "Tên ví — ví dụ: “Tiền mặt” hoặc “Techcombank”" },
            { icon: Check, label: "Số dư ban đầu — số tiền đang có ngay lúc này" },
            { icon: Check, label: "Xong! Giao dịch, ngân sách và mục tiêu sẽ mở khóa" },
          ],
        },
      ]
    : [
        {
          icon: Sparkles,
          title: "Welcome to TonFin",
          description:
            "This takes about a minute. First, create a wallet — the place your money actually lives.",
          bullets: [
            { icon: Check, label: "Optional — you can skip at any time" },
            { icon: Check, label: "You can edit or delete a wallet later" },
          ],
        },
        {
          icon: WalletCards,
          title: "What is a wallet?",
          description:
            "A wallet represents a real source of money. Create one wallet per source you have.",
          bullets: [
            { icon: Wallet, label: "Cash you carry" },
            { icon: Building2, label: "Bank accounts (Techcombank, VCB...)" },
            { icon: Smartphone, label: "E-wallets (Momo, ZaloPay...)" },
          ],
        },
        {
          icon: Target,
          title: "What do you need?",
          description:
            "Only a name and the current balance. Everything else is optional.",
          bullets: [
            { icon: Check, label: "Wallet name — e.g. “Cash” or “Techcombank”" },
            { icon: Check, label: "Starting balance — what you have right now" },
            { icon: Check, label: "Done! Transactions, budgets and goals unlock" },
          ],
        },
      ];

export const WalletOnboardingDialog: React.FC<WalletOnboardingDialogProps> = ({
  open,
  isVietnamese,
  primaryColor,
  onSkip,
  onStart,
}) => {
  const slides = getSlides(isVietnamese);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  const slide = slides[Math.min(index, slides.length - 1)];
  const isLast = index === slides.length - 1;
  const SlideIcon = slide.icon;

  return (
    <Dialog
      description={
        isVietnamese
          ? "Hướng dẫn nhanh cho lần đầu sử dụng"
          : "A quick tour for your first visit"
      }
      eyebrow={isVietnamese ? "Bắt đầu" : "Getting started"}
      icon={WalletCards}
      onClose={onSkip}
      open={open}
      title={isVietnamese ? "Tạo ví đầu tiên" : "Create your first wallet"}
      tone="wallet"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-md)]"
            style={{
              backgroundColor: hexToRgba(primaryColor, 0.12),
              color: primaryColor,
            }}
          >
            <SlideIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground sm:text-lg">
              {slide.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {slide.description}
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {slide.bullets.map((bullet) => {
            const BulletIcon = bullet.icon;
            return (
              <li
                className="flex items-center gap-3 rounded-[var(--app-radius-md)] border border-border/70 bg-muted/30 px-3 py-2.5"
                key={bullet.label}
              >
                <BulletIcon
                  className="h-4 w-4 shrink-0"
                  style={{ color: primaryColor }}
                />
                <span className="text-sm text-foreground/90">
                  {bullet.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-center gap-1.5 pt-1">
          {slides.map((item, slideIndex) => (
            <button
              aria-label={`${isVietnamese ? "Bước" : "Step"} ${slideIndex + 1}`}
              className="h-1.5 rounded-full transition-all"
              key={item.title}
              onClick={() => setIndex(slideIndex)}
              style={{
                width: slideIndex === index ? 22 : 8,
                backgroundColor:
                  slideIndex === index
                    ? primaryColor
                    : hexToRgba(primaryColor, 0.22),
              }}
              type="button"
            />
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onSkip} variant="ghost">
          {isVietnamese ? "Để sau" : "Maybe later"}
        </Button>
        {!isLast ? (
          <Button
            className="w-full sm:w-auto"
            onClick={() => setIndex((current) => current + 1)}
            variant="outline"
          >
            {isVietnamese ? "Tiếp tục" : "Next"}
          </Button>
        ) : null}
        <Button className="w-full sm:w-auto" onClick={onStart}>
          {isVietnamese ? "Tạo ví ngay" : "Create a wallet"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default WalletOnboardingDialog;
