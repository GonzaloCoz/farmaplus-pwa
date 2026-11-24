import React from 'react';

export function ZebraIcon({ className, size = 16, strokeWidth = 1.75 }: { className?: string; size?: number; strokeWidth?: number }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Viewfinder frame */}
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            {/* Barcode bars */}
            <path d="M7 8v8" />
            <path d="M10 8v8" />
            <path d="M13 8v8" />
            <path d="M17 8v8" />
        </svg>
    );
}

