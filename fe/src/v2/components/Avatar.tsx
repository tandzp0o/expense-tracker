import React from "react";

/** The user's photo, or the first letter of their name on the accent wash. */
export const Avatar: React.FC<{ src?: string | null; name: string; size?: number }> = ({
  src,
  name,
  size = 32,
}) =>
  src ? (
    <img
      alt=""
      className="shrink-0 rounded-full object-cover"
      src={src}
      style={{ height: size, width: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-ledger-accent-wash font-semibold text-ledger-accent"
      // The initial scales with the circle instead of staying 13px.
      style={{ fontSize: Math.round(size * 0.42), height: size, width: size }}
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
