import React, { useMemo } from 'react';
import { getItemIconUrl } from '../game/textures';
import { ITEM_DEFS } from '../game/types';

interface ItemIconProps {
  itemId: string;
  count?: number;
  size?: number;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  itemId,
  count,
  size = 34,
  className = '',
}) => {
  const url = useMemo(() => getItemIconUrl(itemId), [itemId]);
  const def = ITEM_DEFS[itemId];

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      title={def?.name || itemId}
    >
      <img
        src={url}
        alt={def?.name || itemId}
        className="w-full h-full object-contain pixelated pointer-events-none"
        draggable={false}
      />
      {count !== undefined && count > 1 && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[11px] leading-none font-bold font-mono-num text-white drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.95)] pointer-events-none">
          {count}
        </span>
      )}
    </div>
  );
};
